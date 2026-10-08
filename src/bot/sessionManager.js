import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  handleIncomingMessage,
  invalidateGroupMetadataCache,
  isBotAdmin,
  extractMessageText,
} from './handlers/messageHandler.js';
import database from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseAuthDir = path.resolve(__dirname, '../../auth_sessions');

/**
 * Manages an individual WhatsApp Bot socket for a single user
 */
export class UserWhatsAppClient {
  constructor(userId, io = null) {
    this.userId = Number(userId);
    this.io = io;
    this.sock = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
    this.qrCodeDataUrl = null;
    this.rawQr = null;
    this.user = null;
    this.isReconnecting = false;
    this.isInitializing = false;
    this.logger = pino({ level: 'silent' });
    this.authDir = path.join(baseAuthDir, `session_user_${this.userId}`);
  }

  setSocketIO(io) {
    this.io = io;
  }

  hasSavedCredentials() {
    try {
      if (!fs.existsSync(this.authDir)) return false;
      const credsFile = path.join(this.authDir, 'creds.json');
      return fs.existsSync(credsFile);
    } catch (e) {
      return false;
    }
  }

  async initialize() {
    if (this.isInitializing) return;
    if (this.sock && this.status === 'connected') {
      return; // Already active
    }
    this.isInitializing = true;
    try {
      this.status = 'connecting';
      this.notifyStatusUpdate();

      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const { version } = await fetchLatestBaileysVersion();

      console.log(`[User ${this.userId}] Initializing WhatsApp Socket with Baileys v${version.join('.')}...`);

      this.sock = makeWASocket({
        version,
        logger: this.logger,
        printQRInTerminal: false,
        auth: state,
        browser: ['CapyBot', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        syncFullHistory: false,
      });

      // Save credentials whenever updated
      this.sock.ev.on('creds.update', saveCreds);

      // Handle connection updates
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.rawQr = qr;
          this.status = 'qr_ready';
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 300,
              color: {
                dark: '#000000',
                light: '#ffffff',
              },
            });
          } catch (qrErr) {
            console.error(`[User ${this.userId}] Error generating QR data URL:`, qrErr);
          }

          console.log(`[User ${this.userId}] New QR code generated. Ready for scanning.`);
          this.notifyStatusUpdate();
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(
            `[User ${this.userId}] Connection closed. StatusCode: ${statusCode}. Reconnecting: ${shouldReconnect}`
          );

          this.status = 'disconnected';
          this.user = null;
          this.qrCodeDataUrl = null;
          this.notifyStatusUpdate();

          if (shouldReconnect && !this.isReconnecting) {
            this.isReconnecting = true;
            setTimeout(() => {
              this.isReconnecting = false;
              this.initialize();
            }, 5000);
          } else if (statusCode === DisconnectReason.loggedOut) {
            console.log(`[User ${this.userId}] Session logged out. Cleaning auth directory...`);
            this.clearAuthSession();
            this.initialize();
          }
        } else if (connection === 'open') {
          console.log(`[User ${this.userId}] ✅ WhatsApp connection established successfully!`);
          this.status = 'connected';
          this.qrCodeDataUrl = null;
          this.rawQr = null;

          const userJid = this.sock.user?.id || '';
          const phone = userJid.split(':')[0] || userJid.split('@')[0];
          this.user = {
            id: userJid,
            name: this.sock.user?.name || 'WhatsApp Bot',
            phone,
          };

          database.logActivity(this.userId, {
            actionType: 'BOT_CONNECTED',
            details: `Bot connected with WhatsApp account: +${phone}`,
          });

          this.notifyStatusUpdate();
        }
      });

      // Handle incoming & outgoing messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify' && type !== 'append') return;

        for (const msg of messages) {
          try {
            await handleIncomingMessage(this.sock, msg, this.io, this.userId);
          } catch (msgErr) {
            console.error(`[User ${this.userId}] Error handling incoming message:`, msgErr);
          }
        }
      });

      // Handle WhatsApp history sync
      this.sock.ev.on('messaging-history.set', async ({ messages }) => {
        if (messages && Array.isArray(messages)) {
          console.log(`[User ${this.userId}] Received history sync (${messages.length} messages)`);
          for (const msg of messages) {
            const isGroup = msg.key?.remoteJid?.endsWith('@g.us');
            if (!isGroup) continue;

            const text = extractMessageText(msg.message);
            if (!text) continue;

            const isFromMe = Boolean(msg.key?.fromMe);
            const senderJid = isFromMe ? (this.user?.id || '') : (msg.key?.participant || msg.participant || '');
            const senderName = isFromMe ? (this.user?.name || 'Admin') : (msg.pushName || senderJid.split('@')[0] || 'Member');
            const messageId = msg.key?.id || null;
            const timestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now();

            database.saveGroupMessage(this.userId, {
              messageId,
              groupJid: msg.key.remoteJid,
              senderJid,
              senderName,
              messageText: text,
              isFromMe: isFromMe ? 1 : 0,
              timestamp,
            });
          }
        }
      });

      // Invalidate metadata cache on participant changes
      this.sock.ev.on('group-participants.update', ({ id, participants, action }) => {
        invalidateGroupMetadataCache(id);
        console.log(`[User ${this.userId}] Group participants updated in ${id}: ${action}`);
      });

    } catch (err) {
      console.error(`[User ${this.userId}] Failed to initialize WhatsApp client:`, err);
      this.status = 'disconnected';
      this.notifyStatusUpdate();
    } finally {
      this.isInitializing = false;
    }
  }

  notifyStatusUpdate() {
    const statusData = this.getStatus();
    if (this.io) {
      this.io.to(`user:${this.userId}`).emit('bot:status', statusData);
    }
  }

  getStatus() {
    return {
      userId: this.userId,
      status: this.status,
      qrCode: this.qrCodeDataUrl,
      user: this.user,
      connectedAt: this.status === 'connected' ? Date.now() : null,
    };
  }

  async getJoinedGroups() {
    if (this.status !== 'connected' || !this.sock) {
      const dbGroups = database.getAllGroups(this.userId);
      return dbGroups.map((g) => ({
        id: g.group_jid,
        name: g.group_name,
        participantsCount: g.member_count,
        totalMessages: g.total_messages,
        isBotAdmin: false,
      }));
    }

    try {
      const groups = await this.sock.groupFetchAllParticipating();
      const groupList = Object.values(groups).map((group) => {
        const botIsAdmin = isBotAdmin(this.sock, group);
        let settings = { user_id: this.userId, group_jid: group.id, group_name: group.subject };
        try {
          settings = database.getGroupSettings(this.userId, group.id);
        } catch (settingsErr) {
          console.warn(`[User ${this.userId}] Could not get group settings for ${group.id}:`, settingsErr.message);
        }
        const totalMessages = database.getGroupTotalMessages(this.userId, group.id);

        if (settings.group_name !== group.subject) {
          try {
            database.updateGroupSettings(this.userId, group.id, { group_name: group.subject });
          } catch (updateErr) {
            console.warn(`[User ${this.userId}] Could not update group name for ${group.id}:`, updateErr.message);
          }
        }

        return {
          id: group.id,
          name: group.subject,
          description: group.desc?.toString() || '',
          participantsCount: group.participants?.length || 0,
          totalMessages: totalMessages || 0,
          creation: group.creation,
          owner: group.owner,
          isBotAdmin: botIsAdmin,
          settings,
        };
      });

      return groupList;
    } catch (err) {
      console.error(`[User ${this.userId}] Failed to fetch participating groups:`, err.message);
      return [];
    }
  }

  clearAuthSession() {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        console.log(`[User ${this.userId}] Auth directory removed.`);
      }
    } catch (err) {
      console.error(`[User ${this.userId}] Error removing auth directory:`, err);
    }
  }

  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (err) {
      console.error(`[User ${this.userId}] Error during logout:`, err);
    } finally {
      this.clearAuthSession();
      this.status = 'disconnected';
      this.user = null;
      this.qrCodeDataUrl = null;
      this.notifyStatusUpdate();
      setTimeout(() => this.initialize(), 1000);
    }
  }
}

/**
 * Multi-Session Manager coordinating all active user WhatsApp instances
 */
class MultiSessionManager {
  constructor() {
    this.sessions = new Map();
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
    for (const client of this.sessions.values()) {
      client.setSocketIO(io);
    }
  }

  /**
   * Retrieves or instantiates a UserWhatsAppClient for a given userId
   * @param {number} userId
   * @param {boolean} autoInit - Automatically starts socket if true
   * @returns {UserWhatsAppClient}
   */
  getOrCreateSession(userId, autoInit = true) {
    const uid = Number(userId) || 1;
    if (this.sessions.has(uid)) {
      const client = this.sessions.get(uid);
      if (this.io && !client.io) client.setSocketIO(this.io);
      return client;
    }

    const newClient = new UserWhatsAppClient(uid, this.io);
    this.sessions.set(uid, newClient);

    if (autoInit) {
      newClient.initialize();
    }

    return newClient;
  }

  /**
   * Boots all existing user accounts on server startup
   */
  async bootAllSessions() {
    if (!fs.existsSync(baseAuthDir)) {
      fs.mkdirSync(baseAuthDir, { recursive: true });
    }

    // Check registered users from database
    const users = database.getAllUsers();
    console.log(`[SessionManager] Found ${users.length} registered user(s) in database.`);

    for (const user of users) {
      const client = this.getOrCreateSession(user.id, false);
      // Start session automatically if they have saved credentials
      if (client.hasSavedCredentials()) {
        console.log(`[SessionManager] Restoring active session for User ${user.id}`);
        client.initialize();
      }
    }

    // Also migrate or check default user 1 if not exists
    if (users.length === 0) {
      console.log(`[SessionManager] Initializing default session for User ID 1`);
      this.getOrCreateSession(1, true);
    }
  }

  getSession(userId, autoInit = true) {
    const uid = Number(userId) || 1;
    return this.sessions.get(uid) || this.getOrCreateSession(uid, autoInit);
  }

  /**
   * Shuts down socket and permanently wipes on-disk WhatsApp session
   * @param {number} userId
   */
  async deleteUserSession(userId) {
    const uid = Number(userId);
    if (!uid) return;

    if (this.sessions.has(uid)) {
      const client = this.sessions.get(uid);
      try {
        if (client.sock) {
          try {
            await client.sock.logout();
          } catch (e) {
            client.sock.end(new Error('Account deleted'));
          }
        }
      } catch (err) {
        console.error(`[User ${uid}] Error during session deletion:`, err);
      }
      client.clearAuthSession();
      this.sessions.delete(uid);
    } else {
      const userAuthDir = path.join(baseAuthDir, `session_user_${uid}`);
      if (fs.existsSync(userAuthDir)) {
        try {
          fs.rmSync(userAuthDir, { recursive: true, force: true });
        } catch (e) {}
      }
    }
  }
}

export const sessionManager = new MultiSessionManager();
export default sessionManager;

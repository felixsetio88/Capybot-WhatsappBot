import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import database from './database/db.js';
import sessionManager from './bot/sessionManager.js';
import { isBotAdmin, isParticipantAdmin } from './bot/handlers/messageHandler.js';
import {
  hashPassword,
  verifyPassword,
  formatPhoneNumber,
  createAuthToken,
  verifyAuthToken,
} from './bot/utils/auth.js';
import aiService from './bot/services/aiService.js';
import aiHealthService from './bot/services/aiHealthService.js';
import crashLogger from './bot/services/crashLogger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Connect Socket.IO to Multi-Session Manager & Crash Logger
sessionManager.setSocketIO(io);
crashLogger.setSocketIO(io);
crashLogger.init(database);

/**
 * Authentication Middleware
 * Validates JWT / HMAC Bearer token and attaches req.userId & req.user
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query.token) {
    token = String(req.query.token).trim();
  }

  if (!token) {
    // If no users exist in database yet, fallback to default userId 1 for initial setup
    const allUsers = database.getAllUsers();
    if (allUsers.length === 0) {
      req.userId = 1;
      req.user = { id: 1, phone_number: 'admin', display_name: 'Super Admin' };
      return next();
    }
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.',
      code: 'AUTH_REQUIRED',
    });
  }

  const payload = verifyAuthToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session. Please log in again.',
      code: 'AUTH_EXPIRED',
    });
  }

  req.userId = Number(payload.userId);
  req.user = database.getUserById(req.userId);

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'User account not found.',
      code: 'USER_NOT_FOUND',
    });
  }

  next();
}

// ==========================================================================
// AUTHENTICATION API ROUTES (Register, Login, Me, Logout)
// ==========================================================================

// 1. User Registration (Phone Number + Password)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { phoneNumber, password, displayName } = req.body;

    const cleanedPhone = formatPhoneNumber(phoneNumber);
    if (!cleanedPhone || cleanedPhone.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid phone number (e.g. 60123456789).',
      });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters.',
      });
    }

    const existing = database.getUserByPhone(cleanedPhone);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this phone number already exists. Please log in.',
      });
    }

    const passwordHash = hashPassword(password);
    const user = database.createUser({
      phoneNumber: cleanedPhone,
      passwordHash,
      displayName: displayName || `+${cleanedPhone}`,
    });

    // Initialize dedicated WhatsApp session for this user
    const client = sessionManager.getOrCreateSession(user.id, true);

    const token = createAuthToken({
      userId: user.id,
      phoneNumber: user.phone_number,
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        displayName: user.display_name,
        aiEnabled: Boolean(user.ai_enabled),
        aiPrompted: Boolean(user.ai_prompted),
      },
      botStatus: client.getStatus(),
    });
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 2. User Login (Phone Number + Password)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    const cleanedPhone = formatPhoneNumber(phoneNumber);
    if (!cleanedPhone || !password) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and password are required.',
      });
    }

    const user = database.getUserByPhone(cleanedPhone);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid phone number or password.',
      });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid phone number or password.',
      });
    }

    database.updateUserLastLogin(user.id);

    // Boot user WhatsApp session if not already running (preserves existing QR / auth session!)
    const client = sessionManager.getOrCreateSession(user.id, true);

    const token = createAuthToken({
      userId: user.id,
      phoneNumber: user.phone_number,
    });

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        displayName: user.display_name,
        aiEnabled: Boolean(user.ai_enabled),
        aiPrompted: Boolean(user.ai_prompted),
      },
      botStatus: client.getStatus(),
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 3. Current User Profile & WhatsApp Bot Status
app.get('/api/auth/me', requireAuth, (req, res) => {
  const client = sessionManager.getOrCreateSession(req.userId, true);
  res.json({
    success: true,
    user: {
      id: req.user.id,
      phoneNumber: req.user.phone_number,
      displayName: req.user.display_name,
      aiEnabled: Boolean(req.user.ai_enabled),
      aiPrompted: Boolean(req.user.ai_prompted),
    },
    botStatus: client.getStatus(),
  });
});

// 4. User AI Status & Settings
app.get('/api/user/ai-status', requireAuth, (req, res) => {
  try {
    const status = database.getUserAIStatus(req.userId);
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/ai-status', requireAuth, async (req, res) => {
  try {
    const { aiEnabled, aiPrompted, enableAllGroups } = req.body;
    database.updateUserAIStatus(req.userId, { aiEnabled, aiPrompted });

    if (aiEnabled) {
      if (enableAllGroups) {
        const groups = database.getAllGroups(req.userId);
        for (const g of groups) {
          database.updateGroupSettings(req.userId, g.group_jid, { ai_enabled: 1 });
        }
      }
      // Start AI microservice on-demand without blocking HTTP response
      aiService.ensureAIServiceRunning().catch((e) => {
        console.warn('[AIService] Notice starting AI:', e.message);
      });
    } else {
      // Disable AI across all groups for this user
      database.disableAllGroupSettingsAI(req.userId);

      // If no users have AI enabled, completely stop Python microservice in background
      if (!database.isAnyUserAIEnabled()) {
        aiService.stopAIService().catch((e) => {
          console.warn('[AIService] Notice stopping AI:', e.message);
        });
      }
    }

    const updated = database.getUserAIStatus(req.userId);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Unlink WhatsApp Account (Clears WhatsApp QR credentials for this user)
app.post('/api/auth/unlink-whatsapp', requireAuth, async (req, res) => {
  try {
    const client = sessionManager.getOrCreateSession(req.userId, false);
    await client.logout();
    res.json({
      success: true,
      message: 'WhatsApp account unlinked. A new QR code has been generated.',
      botStatus: client.getStatus(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 6. Delete User Account & All Data Permanently
app.post('/api/auth/delete-account', requireAuth, async (req, res) => {
  const uid = req.userId;
  const userPhone = req.user.phone_number;

  try {
    // Terminate active socket and remove saved credentials directory
    await sessionManager.deleteUserSession(uid);

    // Cascade delete all database records for this user
    database.deleteUser(uid);

    console.log(`[Auth] User ID ${uid} (${userPhone}) permanently deleted their account.`);

    res.json({
      success: true,
      message: 'Your account and all associated WhatsApp bot data have been permanently deleted.',
    });
  } catch (err) {
    console.error(`[Auth] Error deleting user ${uid}:`, err);
    res.status(500).json({
      success: false,
      error: `Failed to delete account: ${err.message}`,
    });
  }
});

// ==========================================================================
// DASHBOARD & GROUP MANAGEMENT REST API (Scoped to req.userId)
// ==========================================================================

// 1. Bot Status & Summary
app.get('/api/status', requireAuth, (req, res) => {
  const client = sessionManager.getOrCreateSession(req.userId, true);
  const botStatus = client.getStatus();
  const dbStats = database.getStatsSummary(req.userId);
  res.json({
    success: true,
    data: {
      ...botStatus,
      stats: dbStats,
    },
  });
});

// 2. List Groups
app.get('/api/groups', requireAuth, async (req, res) => {
  try {
    const client = sessionManager.getOrCreateSession(req.userId, true);
    const groups = await client.getJoinedGroups();
    res.json({
      success: true,
      data: groups,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 3. Group Leaderboard / Member Chat Stats
app.get('/api/groups/:jid/stats', requireAuth, async (req, res) => {
  const { jid } = req.params;
  const limit = parseInt(req.query.limit) || 100;
  const uid = req.userId;

  try {
    const client = sessionManager.getOrCreateSession(uid, true);
    const dbLeaderboard = database.getGroupLeaderboard(uid, jid, limit);
    const settings = database.getGroupSettings(uid, jid);
    const recentLogs = database.getRecentLogs(uid, 20, jid);

    const blockedMembers = database.getBlockedMembers(uid, jid);
    const blockedSet = new Set(blockedMembers.map((b) => b.user_jid));

    let finalLeaderboard = dbLeaderboard.map((m) => ({
      ...m,
      isBlocked: blockedSet.has(m.user_jid),
    }));
    let isBotGroupAdmin = false;

    // If bot is connected to WhatsApp, merge live participants
    if (client.status === 'connected' && client.sock) {
      try {
        const metadata = await client.sock.groupMetadata(jid);
        if (metadata && metadata.participants) {
          isBotGroupAdmin = isBotAdmin(client.sock, metadata);
          const dbMemberMap = new Map(dbLeaderboard.map((m) => [m.user_jid, m]));

          finalLeaderboard = metadata.participants.map((p) => {
            const existing = dbMemberMap.get(p.id);
            if (existing) {
              return {
                ...existing,
                isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
                isBlocked: blockedSet.has(p.id),
              };
            }
            return {
              user_id: uid,
              group_jid: jid,
              user_jid: p.id,
              user_name: null,
              chat_count: 0,
              last_active: null,
              isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
              isBlocked: blockedSet.has(p.id),
            };
          });

          // Sort by chat count descending, then active timestamp
          finalLeaderboard.sort((a, b) => {
            if (b.chat_count !== a.chat_count) return b.chat_count - a.chat_count;
            return (b.last_active || 0) - (a.last_active || 0);
          });

          finalLeaderboard = finalLeaderboard.slice(0, limit);
        }
      } catch (groupErr) {
        // Fallback to recorded database entries
      }
    }

    res.json({
      success: true,
      data: {
        groupJid: jid,
        isBotAdmin: isBotGroupAdmin,
        leaderboard: finalLeaderboard,
        blockedMembers,
        settings,
        recentLogs,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 4. Block a Group Member
app.post('/api/groups/:jid/block', requireAuth, (req, res) => {
  const { jid } = req.params;
  const userJid = req.body?.userJid || req.query?.userJid;
  const userName = req.body?.userName || req.query?.userName;
  const uid = req.userId;

  if (!userJid) {
    return res.status(400).json({ success: false, error: 'User JID is required.' });
  }

  database.blockMember(uid, jid, userJid, userName || null, 'Admin (Dashboard)');
  database.logActivity(uid, {
    groupJid: jid,
    userJid,
    userName: userName || userJid.split('@')[0],
    actionType: 'ADMIN_BLOCK_MEMBER',
    details: `Admin blocked @${userJid.split('@')[0]} from web dashboard`,
  });

  io.to(`user:${uid}`).emit('member:blocked', { groupJid: jid, userJid });

  res.json({
    success: true,
    message: `Member @${userJid.split('@')[0]} has been blocked.`,
    blockedMembers: database.getBlockedMembers(uid, jid),
  });
});

// 5. Unblock a Group Member
app.post('/api/groups/:jid/unblock', requireAuth, (req, res) => {
  const { jid } = req.params;
  const userJid = req.body?.userJid || req.query?.userJid;
  const uid = req.userId;

  if (!userJid) {
    return res.status(400).json({ success: false, error: 'User JID is required.' });
  }

  const success = database.unblockMember(uid, jid, userJid);
  database.logActivity(uid, {
    groupJid: jid,
    userJid,
    userName: userJid.split('@')[0],
    actionType: 'ADMIN_UNBLOCK_MEMBER',
    details: `Admin unblocked @${userJid.split('@')[0]} from web dashboard`,
  });

  io.to(`user:${uid}`).emit('member:unblocked', { groupJid: jid, userJid });

  res.json({
    success,
    message: `Member @${userJid.split('@')[0]} has been unblocked.`,
    blockedMembers: database.getBlockedMembers(uid, jid),
  });
});

// 6. Remove / Kick a Member from WhatsApp Group
app.post('/api/groups/:jid/kick', requireAuth, async (req, res) => {
  const { jid } = req.params;
  const userJid = req.body?.userJid || req.query?.userJid;
  const uid = req.userId;

  if (!userJid) {
    return res.status(400).json({ success: false, error: 'User JID is required.' });
  }

  const client = sessionManager.getOrCreateSession(uid, true);
  if (client.status !== 'connected' || !client.sock) {
    return res.status(400).json({
      success: false,
      error: 'WhatsApp bot is not currently connected. Please link or reconnect WhatsApp first.',
    });
  }

  try {
    const metadata = await client.sock.groupMetadata(jid);
    const botIsAdmin = isBotAdmin(client.sock, metadata);
    if (!botIsAdmin) {
      return res.status(403).json({
        success: false,
        error: 'CapyBot must be promoted to Group Admin in WhatsApp to remove members.',
      });
    }

    const isAdmin = isParticipantAdmin(metadata, userJid);
    if (isAdmin) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove a Group Admin. Please demote them in WhatsApp first.',
      });
    }

    await client.sock.groupParticipantsUpdate(jid, [userJid], 'remove');

    const phone = userJid.split('@')[0];
    database.logActivity(uid, {
      groupJid: jid,
      groupName: metadata.subject || 'WhatsApp Group',
      userJid,
      userName: phone,
      actionType: 'ADMIN_KICK_MEMBER',
      details: `Admin removed @${phone} via Web Dashboard`,
    });

    io.to(`user:${uid}`).emit('log:activity', {
      type: 'admin_kick',
      groupJid: jid,
      groupName: metadata.subject,
      userJid,
      userName: phone,
      text: `Admin removed member @${phone} from group`,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      message: `Member @${phone} has been removed from ${metadata.subject || 'the group'}.`,
    });
  } catch (err) {
    console.error('[Server] Failed to kick member:', err);
    res.status(500).json({
      success: false,
      error: `Failed to remove member: ${err.message}`,
    });
  }
});

// 7. Get Group Chat Messages History (with pagination & search)
app.get('/api/groups/:jid/messages', requireAuth, (req, res) => {
  const { jid } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before ? Number(req.query.before) : null;
  const search = req.query.search ? String(req.query.search).trim() : null;

  try {
    const result = database.getGroupMessages(req.userId, jid, { limit, before, search });
    res.json({
      success: true,
      data: result.messages,
      pagination: {
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        oldestTimestamp: result.oldestTimestamp,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 5. Send Message to WhatsApp Group from Admin Web Dashboard
app.post('/api/groups/:jid/send-message', requireAuth, async (req, res) => {
  const { jid } = req.params;
  const { text } = req.body;
  const uid = req.userId;

  if (!text || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Message text is required',
    });
  }

  const client = sessionManager.getOrCreateSession(uid, true);

  if (client.status !== 'connected' || !client.sock) {
    return res.status(503).json({
      success: false,
      error: 'WhatsApp Bot is not connected. Please pair your WhatsApp account first.',
    });
  }

  try {
    const trimmedText = text.trim();
    // Send message to WhatsApp group via user's Baileys socket
    const sent = await client.sock.sendMessage(jid, { text: trimmedText });

    const botJid = client.user?.id || 'admin@s.whatsapp.net';
    const botName = client.user?.name || 'Admin (Dashboard)';
    const messageId = sent?.key?.id || null;

    // Save to local database scoped to this user
    const savedMsg = database.saveGroupMessage(uid, {
      messageId,
      groupJid: jid,
      senderJid: botJid,
      senderName: botName,
      messageText: trimmedText,
      isFromMe: 1,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      data: savedMsg || { messageId, groupJid: jid, messageText: trimmedText },
    });
  } catch (err) {
    console.error(`[User ${uid}] Failed to send message from dashboard:`, err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 6. Reset Chat Count (Single Member or Entire Group)
app.post('/api/groups/:jid/reset', requireAuth, (req, res) => {
  const { jid } = req.params;
  const { userJid, groupName } = req.body;
  const uid = req.userId;

  try {
    if (userJid) {
      const success = database.resetMemberChatCount(uid, jid, userJid);
      io.to(`user:${uid}`).emit('chat:reset', { groupJid: jid, userJid, type: 'single' });
      return res.json({
        success: true,
        message: `Chat count for user ${userJid} reset to 0`,
      });
    } else {
      const rowsAffected = database.resetGroupChatCounts(uid, jid, groupName);
      io.to(`user:${uid}`).emit('chat:reset', { groupJid: jid, type: 'group', rowsAffected });
      return res.json({
        success: true,
        message: `Chat counts for all members in group reset to 0`,
        rowsAffected,
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 7. Get Group Settings
app.get('/api/groups/:jid/settings', requireAuth, (req, res) => {
  const { jid } = req.params;
  try {
    const settings = database.getGroupSettings(req.userId, jid);
    res.json({
      success: true,
      data: settings,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 8. Update Group Settings
app.post('/api/groups/:jid/settings', requireAuth, (req, res) => {
  const { jid } = req.params;
  const newSettings = req.body;
  const uid = req.userId;

  try {
    const updated = database.updateGroupSettings(uid, jid, newSettings);
    io.to(`user:${uid}`).emit('settings:updated', { groupJid: jid, settings: updated });
    res.json({
      success: true,
      message: 'Group settings updated successfully',
      data: updated,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 9. Activity Logs
app.get('/api/logs', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const groupJid = req.query.groupJid || null;

  try {
    const logs = database.getRecentLogs(req.userId, limit, groupJid);
    res.json({
      success: true,
      data: logs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ==========================================================================
// 10. LOCAL ON-DEVICE AI API ROUTES (Qwen 3.5 & Multimodal Vision)
// ==========================================================================

// AI Status & Health Telemetry (available, busy, unavailable)
app.get('/api/ai/status', async (req, res) => {
  try {
    const status = await aiService.checkAIStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// List All 6 Qwen 3.5 Models
app.get('/api/ai/models', requireAuth, async (req, res) => {
  try {
    const modelsData = await aiService.getAIModels();
    res.json({
      success: true,
      data: modelsData,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Download an AI Model
app.post('/api/ai/models/download', requireAuth, async (req, res) => {
  const { modelId } = req.body;
  if (!modelId) {
    return res.status(400).json({ success: false, error: 'Model ID is required.' });
  }

  try {
    const result = await aiService.downloadAIModel(modelId);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Apply / Switch Active AI Model
app.post('/api/ai/models/apply', requireAuth, async (req, res) => {
  const { modelId } = req.body;
  if (!modelId) {
    return res.status(400).json({ success: false, error: 'Model ID is required.' });
  }

  try {
    const result = await aiService.applyAIModel(modelId);
    // Broadcast model change to dashboard users
    io.emit('ai:model_changed', result);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Delete a Downloaded AI Model
app.post('/api/ai/models/delete', requireAuth, async (req, res) => {
  const { modelId } = req.body;
  if (!modelId) {
    return res.status(400).json({ success: false, error: 'Model ID is required.' });
  }

  try {
    const result = await aiService.deleteAIModel(modelId);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Update AI Configuration (Context Length, etc.)
app.post('/api/ai/models/config', requireAuth, async (req, res) => {
  const { contextLength, activeModelId } = req.body;

  try {
    const result = await aiService.updateAIConfig({ contextLength, activeModelId });
    io.emit('ai:config_changed', result);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// AI Service Health & Crash Telemetry
app.get('/api/ai/health', requireAuth, (req, res) => {
  try {
    const health = aiHealthService.getAIHealth();
    res.json({
      success: true,
      data: health,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.post('/api/ai/health/acknowledge', requireAuth, (req, res) => {
  try {
    const health = aiHealthService.acknowledgeCrash();
    res.json({
      success: true,
      data: health,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Test AI Chat & Image Recognition from Web Dashboard
app.post('/api/ai/ask', requireAuth, async (req, res) => {
  const userAiStatus = database.getUserAIStatus(req.userId);
  if (!userAiStatus.ai_enabled) {
    return res.status(403).json({
      success: false,
      error: 'AI features are currently disabled in your account settings. Please enable them to use the AI chatbot.',
    });
  }

  const { prompt, imageBase64, history } = req.body;
  if (!prompt && !imageBase64) {
    return res.status(400).json({ success: false, error: 'Prompt or image is required.' });
  }

  try {
    let imageBuffer = null;
    let mimetype = 'image/jpeg';

    if (imageBase64) {
      const match = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        mimetype = match[1];
        imageBuffer = Buffer.from(match[2], 'base64');
      } else {
        imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
      }
    }

    const result = await aiService.askQuestion({
      prompt,
      imageBuffer,
      mimetype,
      history: Array.isArray(history) ? history : [],
      senderName: req.user?.display_name || 'Admin',
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// System Resource Telemetry & Diagnostics
app.get('/api/system/info', requireAuth, (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const sysUptime = os.uptime();
    const procUptime = process.uptime();

    // Storage calculation
    let diskFree = 0;
    let diskTotal = 0;
    try {
      if (fs.statfsSync) {
        const stats = fs.statfsSync(__dirname);
        diskFree = stats.bavail * stats.bsize;
        diskTotal = stats.blocks * stats.bsize;
      }
    } catch (e) {}

    const getDirSize = (dirPath) => {
      let size = 0;
      try {
        if (!fs.existsSync(dirPath)) return 0;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            size += getDirSize(fullPath);
          } else if (entry.isFile()) {
            size += fs.statSync(fullPath).size;
          }
        }
      } catch (e) {}
      return size;
    };

    const projectRoot = path.resolve(__dirname, '../');
    const modelsDir = path.join(projectRoot, 'ai_service', 'models_weights');
    const dbPath = path.join(projectRoot, 'data', 'bot.db');
    const srcDir = path.join(projectRoot, 'src');
    const publicDir = path.join(projectRoot, 'public');

    const modelsSize = getDirSize(modelsDir);
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    const appCodeSize = getDirSize(srcDir) + getDirSize(publicDir);
    const totalUsedSpace = modelsSize + dbSize + appCodeSize;

    res.json({
      success: true,
      data: {
        memory: {
          total_bytes: totalMem,
          free_bytes: freeMem,
          used_bytes: usedMem,
          usage_percent: Math.round((usedMem / totalMem) * 100),
          process_rss: process.memoryUsage().rss,
        },
        storage: {
          total_used_bytes: totalUsedSpace,
          models_used_bytes: modelsSize,
          app_used_bytes: appCodeSize + dbSize,
          disk_free_bytes: diskFree,
          disk_total_bytes: diskTotal,
        },
        uptime: {
          system_seconds: Math.floor(sysUptime),
          process_seconds: Math.floor(procUptime),
        },
        platform: {
          os: `${os.type()} ${os.release()}`,
          arch: os.arch(),
          cpus: os.cpus().length,
          node_version: process.version,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ==========================================================================
// SYSTEM CRASH LOGS & DIAGNOSTICS ENDPOINTS
// ==========================================================================
app.get('/api/system/crashes', requireAuth, (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const crashes = crashLogger.getCrashHistory(req.user.id, limit, database);
    res.json({
      success: true,
      count: crashes.length,
      crashes,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/system/crashes', requireAuth, (req, res) => {
  try {
    const result = crashLogger.clearCrashHistory(req.user.id, database);
    res.json({
      success: true,
      message: 'Crash history successfully cleared.',
      deletedCount: result.count,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/system/crashes/test', requireAuth, (req, res) => {
  try {
    const { sampleType } = req.body || {};
    let errorMsg = 'Simulated uncaught exception: Memory threshold test';
    let crashType = 'test_simulation';
    let stack = new Error(errorMsg).stack;

    if (sampleType === 'oom') {
      crashType = 'unclean_exit_or_oom';
      errorMsg = 'Process terminated abruptly without clean shutdown (Probable Linux Out-Of-Memory OOM Killer).';
      stack = 'Simulated V8 Heap Out Of Memory event.\nProcess killed by kernel OOM manager (SIGKILL).\nActive memory exceeded 1024MB limit.';
    } else if (sampleType === 'network') {
      crashType = 'uncaught_exception';
      errorMsg = 'Error: Connection lost: ECONNRESET in WebSocket Baileys client';
      stack = 'Error: Connection lost: ECONNRESET\n    at WebSocket.onclose (baileys/lib/Socket/socket.js:124:19)\n    at Socket.emit (events.js:517:28)';
    }

    const saved = crashLogger.recordCrash({
      userId: req.user.id,
      crashType,
      errorMessage: errorMsg,
      stackTrace: stack,
      metadata: { isTestSimulation: true, triggeredBy: req.user.phone_number },
    }, database);

    res.json({
      success: true,
      message: 'Test crash entry logged successfully.',
      crash: saved,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================================================
// AI CHATBOT SESSIONS & MULTI-DEVICE SYNC ENDPOINTS
// ==========================================================================
app.get('/api/chatbot/sessions', requireAuth, (req, res) => {
  try {
    const sessions = database.getChatbotSessions(req.user.id);
    res.json({
      success: true,
      data: sessions,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/chatbot/sessions', requireAuth, (req, res) => {
  const { id, title, modelId, createdAt, updatedAt } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Session ID is required.' });
  }

  try {
    database.saveChatbotSession(req.user.id, {
      id,
      title: title || 'New Conversation',
      modelId: modelId || 'qwen-3.5-0.8b-q4',
      createdAt: createdAt || Date.now(),
      updatedAt: updatedAt || Date.now(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/chatbot/sessions/:id', requireAuth, (req, res) => {
  const { title } = req.body;
  const sessionId = req.params.id;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Session title is required.' });
  }

  try {
    const updated = database.updateChatbotSessionTitle(req.user.id, sessionId, title);
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/chatbot/sessions/:id', requireAuth, (req, res) => {
  const sessionId = req.params.id;
  try {
    const deleted = database.deleteChatbotSession(req.user.id, sessionId);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/chatbot/sessions', requireAuth, (req, res) => {
  try {
    database.clearAllChatbotSessions(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/chatbot/sessions/:id/messages', requireAuth, (req, res) => {
  const sessionId = req.params.id;
  const { role, content, imageBase64, createdAt } = req.body;

  if (!role || (!content && !imageBase64)) {
    return res.status(400).json({ success: false, error: 'Message role and content or image is required.' });
  }

  try {
    const saved = database.saveChatbotMessage(req.user.id, sessionId, {
      role,
      content: content || '',
      imageBase64: imageBase64 || null,
      createdAt: createdAt || Date.now(),
    });
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================================================
// SOCKET.IO REAL-TIME CONNECTION (Room isolation per user)
// ==========================================================================
io.on('connection', (socket) => {
  // Allow client to authenticate their socket
  socket.on('auth:authenticate', (token) => {
    const payload = verifyAuthToken(token);
    if (payload && payload.userId) {
      const uid = Number(payload.userId);
      socket.userId = uid;
      socket.join(`user:${uid}`);

      const client = sessionManager.getSession(uid);
      socket.emit('bot:status', client.getStatus());
      socket.emit('stats:summary', database.getStatsSummary(uid));
      console.log(`[Socket] Authenticated socket ${socket.id} joined room user:${uid}`);
    }
  });

  // If no auth event sent, default to user 1 without auto-initializing background socket
  const defaultClient = sessionManager.getSession(1, false);
  socket.emit('bot:status', defaultClient.getStatus());
  socket.emit('stats:summary', database.getStatsSummary(1));

  socket.on('disconnect', () => {
    // disconnected
  });
});

// ==========================================================================
// SERVER STARTUP
// ==========================================================================
server.listen(PORT, HOST, async () => {
  console.log(`====================================================`);
  console.log(`🚀 WhatsApp Bot Server & Admin Dashboard Running!`);
  console.log(`📊 Local Web Dashboard: http://localhost:${PORT}`);
  console.log(`🌐 Network Dashboard:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`====================================================`);

  // Check if AI crashed during previous session and trigger fail-safe recovery
  const crashReport = aiHealthService.checkAndHandleStartupCrashCheck(database);
  if (crashReport.crashDetected) {
    console.warn(`[AIHealth] 🛡️ FAIL-SAFE RECOVERY: AI features automatically disabled on startup due to previous crash: "${crashReport.reason}"`);
  }

  // Ensure Local Qwen 3.5 AI Microservice is running only if an account has AI enabled
  if (database.isAnyUserAIEnabled()) {
    await aiService.ensureAIServiceRunning();
  } else {
    console.log('[AIService] ℹ️ AI features are currently disabled. Python AI microservice is stopped (0 MB RAM used).');
  }

  // Boot all user sessions with saved WhatsApp credentials
  await sessionManager.bootAllSessions();
});

// ==========================================================================
// PROCESS-LEVEL CRASH GUARDS & RECOVERY
// ==========================================================================
process.on('uncaughtException', (err) => {
  console.error('[Process Error] ⚠️ Uncaught Exception:', err?.stack || err);
  try {
    crashLogger.recordCrash({
      userId: 1,
      crashType: 'uncaught_exception',
      errorMessage: err?.message || String(err),
      stackTrace: err?.stack || '',
      metadata: { code: err?.code, errno: err?.errno },
    }, database);
  } catch (e) { }

  // Keep alive for transient network or socket dropouts
  if (err && (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ETIMEDOUT')) {
    return;
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process Error] ⚠️ Unhandled Promise Rejection at:', promise, 'reason:', reason);
  try {
    crashLogger.recordCrash({
      userId: 1,
      crashType: 'unhandled_rejection',
      errorMessage: reason instanceof Error ? reason.message : String(reason),
      stackTrace: reason instanceof Error ? reason.stack : String(reason),
      metadata: { unhandledRejection: true },
    }, database);
  } catch (e) { }
});

export default { app, server, io };

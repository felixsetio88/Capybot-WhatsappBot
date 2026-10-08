import database from '../../database/db.js';
import { detectBlockedLinks, isHiGreeting } from '../utils/linkDetector.js';
import {
  extractMediaForSticker,
  extractViewOnceMedia,
  downloadMediaBuffer,
  convertToStickerWebp,
  isStickerCommand,
  isPeekCommand,
} from '../utils/stickerConverter.js';
import aiService from '../services/aiService.js';
import songBank, { generateSongGuessQuestion, evaluateSongGuess } from '../services/songBank.js';

// Active in-memory word games by group JID
const activeWordGames = new Map();
// Active in-memory song guessing games by group JID
const activeGuessGames = new Map();

function getChemistryVibe(replyCount) {
  if (replyCount >= 30) return { score: 99, label: 'Soulmates / Unstoppable Duo 🔥' };
  if (replyCount >= 15) return { score: 92, label: 'Best Banter Partners ✨' };
  if (replyCount >= 8) return { score: 85, label: 'High Chemistry / Late-Night Talkers ⚡' };
  if (replyCount >= 3) return { score: 78, label: 'Friendly Vibing / Great Energy 💬' };
  return { score: 70, label: 'Getting to Know Each Other 🌱' };
}

// Cache for group metadata to minimize unnecessary WhatsApp network calls
const groupMetadataCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Extracts plain text content from various WhatsApp message structures
 * @param {object} messageContent
 * @returns {string}
 */
export function extractMessageText(messageContent) {
  if (!messageContent) return '';
  if (typeof messageContent === 'string') return messageContent;

  if (messageContent.conversation) return messageContent.conversation;
  if (messageContent.extendedTextMessage?.text) return messageContent.extendedTextMessage.text;
  if (messageContent.imageMessage?.caption) return messageContent.imageMessage.caption;
  if (messageContent.imageMessage) return '📷 [Image]';
  if (messageContent.videoMessage?.caption) return messageContent.videoMessage.caption;
  if (messageContent.videoMessage) return '🎥 [Video]';
  if (messageContent.documentMessage?.caption) return messageContent.documentMessage.caption;
  if (messageContent.documentMessage?.fileName) return `📎 [Document: ${messageContent.documentMessage.fileName}]`;
  if (messageContent.documentMessage) return '📎 [Document]';
  if (messageContent.audioMessage) return '🎵 [Voice/Audio]';
  if (messageContent.stickerMessage) return '✨ [Sticker]';
  if (messageContent.contactMessage?.displayName) return `👤 [Contact: ${messageContent.contactMessage.displayName}]`;
  if (messageContent.locationMessage) return '📍 [Location]';

  return (
    messageContent.buttonsResponseMessage?.selectedButtonId ||
    messageContent.listResponseMessage?.singleSelectReply?.selectedRowId ||
    messageContent.templateButtonReplyMessage?.selectedId ||
    ''
  );
}

/**
 * Checks whether a message contains an image, sticker, view-once image, or image document
 * @param {object} msg
 * @returns {boolean}
 */
export function hasImageMedia(msg) {
  if (!msg || !msg.message) return false;
  const m = msg.message;
  return Boolean(
    m.imageMessage ||
    m.viewOnceMessage?.message?.imageMessage ||
    m.viewOnceMessageV2?.message?.imageMessage ||
    m.ephemeralMessage?.message?.imageMessage ||
    m.stickerMessage ||
    (m.documentMessage?.mimetype && m.documentMessage.mimetype.startsWith('image/'))
  );
}

/**
 * Checks whether a message is an emoji reaction
 * @param {object} msg
 * @returns {boolean}
 */
export function isReactionMessage(msg) {
  if (!msg || !msg.message) return false;
  const m = msg.message;
  return Boolean(
    m.reactionMessage ||
    m.encReactionMessage ||
    m.ephemeralMessage?.message?.reactionMessage ||
    m.ephemeralMessage?.message?.encReactionMessage
  );
}

/**
 * Checks whether a message is a system stub or protocol event (not a real user chat message)
 * @param {object} msg
 * @returns {boolean}
 */
export function isSystemOrStubMessage(msg) {
  if (!msg) return true;
  if (msg.messageStubType || msg.stubType) return true;
  if (!msg.message || Object.keys(msg.message).length === 0) return true;
  const m = msg.message;
  return Boolean(
    m.protocolMessage ||
    m.ephemeralMessage?.message?.protocolMessage ||
    m.senderKeyDistributionMessage ||
    m.pollUpdateMessage ||
    (Object.keys(m).length === 1 && m.messageContextInfo)
  );
}

/**
 * Checks whether a message contains actual text content (non-empty)
 * @param {object} msg
 * @returns {boolean}
 */
export function isActualTextMessage(msg) {
  if (!msg || !msg.message) return false;
  if (isReactionMessage(msg) || isSystemOrStubMessage(msg)) return false;
  const m = msg.message.ephemeralMessage?.message || msg.message;
  const text = m.conversation || m.extendedTextMessage?.text || '';
  return typeof text === 'string' && text.trim().length > 0;
}

/**
 * Retrieves group metadata with in-memory caching
 * @param {object} sock
 * @param {string} groupJid
 * @returns {Promise<object|null>}
 */
export async function getCachedGroupMetadata(sock, groupJid) {
  const cached = groupMetadataCache.get(groupJid);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const metadata = await sock.groupMetadata(groupJid);
    groupMetadataCache.set(groupJid, {
      data: metadata,
      timestamp: now,
    });
    return metadata;
  } catch (err) {
    console.error(`[Bot] Failed to fetch group metadata for ${groupJid}:`, err.message);
    return cached?.data || null;
  }
}

/**
 * Invalidate group metadata cache when participants change
 * @param {string} groupJid
 */
export function invalidateGroupMetadataCache(groupJid) {
  groupMetadataCache.delete(groupJid);
}

/**
 * Checks if a participant in a group has admin or superadmin privileges
 * @param {object} groupMetadata
 * @param {string} senderJid
 * @returns {boolean}
 */
/**
 * Checks if a participant in a group has admin or superadmin privileges
 * Handles standard phone JIDs (@s.whatsapp.net) and privacy LIDs (@lid)
 * @param {object} groupMetadata
 * @param {string} senderJid
 * @returns {boolean}
 */
export function isParticipantAdmin(groupMetadata, senderJid) {
  if (!groupMetadata || !groupMetadata.participants || !senderJid) return false;

  const senderClean = senderJid.replace(/:.*@/, '@').split('@')[0];

  const participant = groupMetadata.participants.find((p) => {
    const pIdClean = p.id ? p.id.replace(/:.*@/, '@').split('@')[0] : '';
    const pLidClean = p.lid ? p.lid.replace(/:.*@/, '@').split('@')[0] : '';
    return p.id === senderJid || p.lid === senderJid || pIdClean === senderClean || pLidClean === senderClean;
  });

  return Boolean(participant && (participant.admin === 'admin' || participant.admin === 'superadmin'));
}

/**
 * Checks if the bot itself is an admin in the group
 * Matches bot's phone number and bot's LID against participant list
 * @param {object} sock
 * @param {object} groupMetadata
 * @returns {boolean}
 */
export function isBotAdmin(sock, groupMetadata) {
  if (!sock?.user || !groupMetadata?.participants) return false;

  const botPhone = sock.user.id ? sock.user.id.replace(/:.*@/, '@').split('@')[0] : null;
  const botLid = sock.user.lid ? sock.user.lid.replace(/:.*@/, '@').split('@')[0] : null;

  return groupMetadata.participants.some((p) => {
    if (!p.admin || (p.admin !== 'admin' && p.admin !== 'superadmin')) {
      return false;
    }

    const pPhone = p.id ? p.id.replace(/:.*@/, '@').split('@')[0] : '';
    const pLid = p.lid ? p.lid.replace(/:.*@/, '@').split('@')[0] : '';

    return (
      (botPhone && (pPhone === botPhone || pLid === botPhone)) ||
      (botLid && (pPhone === botLid || pLid === botLid))
    );
  });
}

/**
 * Checks whether a sender can execute an admin-restricted command in a group.
 * Admins are always permitted. Non-admins are permitted only if the group's
 * 'allow_non_admin_commands' toggle is enabled and the specific commandKey is listed.
 *
 * @param {string} commandKey e.g. 'chatcount', 'tagall', 'hidetag', 'inactive', 'delete', 'kick', 'resetchat', 'block', 'unblock', 'passive_set'
 * @param {boolean} isAdmin whether sender is a group admin
 * @param {object} settings group settings object
 * @returns {boolean}
 */
export function canExecuteAdminCommand(commandKey, isAdmin, settings) {
  if (isAdmin) return true;
  if (!settings || !settings.allow_non_admin_commands) return false;

  const allowedList = (settings.allowed_non_admin_commands || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  return allowedList.includes(commandKey.toLowerCase());
}

/**
 * Primary message processing pipeline
 * @param {object} sock - Baileys socket instance
 * @param {object} msg - Incoming WhatsApp message object
 * @param {object} io - Socket.io server instance for live UI updates
 * @param {number} userId - Database User ID for multi-account isolation
 */
export async function handleIncomingMessage(sock, msg, io = null, userId = 1) {
  const uid = Number(userId) || 1;
  // Helper to emit events to user room
  const emitEvent = (eventName, data) => {
    if (!io) return;
    io.to(`user:${uid}`).emit(eventName, data);
  };
  // Ignore messages without key or from status broadcasts
  if (!msg.key || msg.key.remoteJid === 'status@broadcast') return;

  // Ignore emoji reactions and stray system/stub events immediately
  if (isReactionMessage(msg) || isSystemOrStubMessage(msg)) return;

  const isGroup = msg.key.remoteJid?.endsWith('@g.us');
  const groupJid = isGroup ? msg.key.remoteJid : null;
  const isFromMe = Boolean(msg.key.fromMe);

  // Determine sender JID and display name
  const senderJid = isGroup
    ? (msg.key.participant || msg.participant || (isFromMe ? sock.user?.id : '') || '')
    : msg.key.remoteJid;
  const senderName = isFromMe
    ? (sock.user?.name || 'Admin')
    : (msg.pushName || senderJid.split('@')[0] || 'Member');

  const messageText = extractMessageText(msg.message);
  const trimmedText = messageText.trim();

  // Context info for quoted messages and mentions
  const contextInfo =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.imageMessage?.contextInfo ||
    msg.message?.videoMessage?.contextInfo ||
    null;

  // Group-specific workflows
  if (isGroup && groupJid) {
    const groupMeta = await getCachedGroupMetadata(sock, groupJid);
    const groupName = groupMeta?.subject || 'WhatsApp Group';
    const isAdmin = isParticipantAdmin(groupMeta, senderJid);
    const botAdminStatus = isBotAdmin(sock, groupMeta);
    const settings = database.getGroupSettings(uid, groupJid);

    // Save group name in settings if not present
    if (!settings.group_name && groupName) {
      database.updateGroupSettings(uid, groupJid, { group_name: groupName });
    }

    // 1. SAVE ALL INCOMING & OUTGOING GROUP MESSAGES TO DATABASE & EMIT TO DASHBOARD
    if (messageText) {
      const messageId = msg.key?.id || null;
      const replyToJid = contextInfo?.participant || null;
      const savedMsg = database.saveGroupMessage(uid, {
        messageId,
        groupJid,
        senderJid: isFromMe ? (sock.user?.id || 'admin@s.whatsapp.net') : senderJid,
        senderName,
        messageText,
        replyToJid,
        isFromMe: isFromMe ? 1 : 0,
        timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now(),
      });

      if (savedMsg) {
        emitEvent('chat:message', savedMsg);
      }
    }

    // Stop automated bot actions for messages sent by the bot itself
    if (isFromMe) return;

    // ==========================================
    // INTERACTIVE WORD GAME ANSWER INTERCEPTOR
    // ==========================================
    if (activeWordGames.has(groupJid) && messageText && !trimmedText.startsWith('.')) {
      const game = activeWordGames.get(groupJid);
      const cleanInput = trimmedText.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const targetClean = game.word.toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (cleanInput === targetClean || trimmedText.toUpperCase().includes(game.word.toUpperCase())) {
        if (game.timeoutTimer) clearTimeout(game.timeoutTimer);
        activeWordGames.delete(groupJid);

        const updatedScore = database.addWordGameScore(uid, groupJid, senderJid, senderName, game.points || 1);
        const winnerPhone = senderJid.replace(/:.*@/, '@').split('@')[0];

        const isId = (settings?.game_language || 'en') === 'id';
        let winMsg = isId
          ? `🎉 *BINGO! TEBAKAN BENAR!* 🏆\n\n👤 *Pemenang:* @${winnerPhone} (${senderName || 'Member'})\n🎯 *Kata Rahasia:* *${game.word}*\n⭐ *Hadiah:* +${game.points || 1} Poin (Total Skor: *${updatedScore}* poin)\n\n💡 _Ketik *.leaderboard* untuk lihat peringkat grup atau *.wordgame* untuk ronde baru!_`
          : `🎉 *BINGO! WE HAVE A WINNER!* 🏆\n\n👤 *Winner:* @${winnerPhone} (${senderName || 'Member'})\n🎯 *Secret Word:* *${game.word}*\n⭐ *Reward:* +${game.points || 1} Point (Total Score: *${updatedScore}* pt${updatedScore === 1 ? '' : 's'})\n\n💡 _Type *.leaderboard* to view group rankings or *.wordgame* for another round!_`;

        await sock.sendMessage(groupJid, {
          text: winMsg,
          mentions: [senderJid],
        }, { quoted: msg });

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'WORDGAME_WON',
          details: `${senderName} guessed word "${game.word}" (+1 pt, total: ${updatedScore})`,
        });
        return;
      }
    }

    // ==========================================
    // INTERACTIVE SONG GUESS GAME ANSWER INTERCEPTOR (.guess)
    // ==========================================
    if (activeGuessGames.has(groupJid) && messageText && !trimmedText.startsWith('.')) {
      const game = activeGuessGames.get(groupJid);
      const isQuotedGameMsg =
        contextInfo?.stanzaId === game.botMessageId ||
        (contextInfo?.participant && sock.user?.id && contextInfo.participant.replace(/:.*@/, '@').split('@')[0] === sock.user.id.replace(/:.*@/, '@').split('@')[0]);

      if (evaluateSongGuess(trimmedText, game.song)) {
        if (game.timeoutTimer) clearTimeout(game.timeoutTimer);
        activeGuessGames.delete(groupJid);

        const updatedScore = database.addWordGameScore(uid, groupJid, senderJid, senderName, game.points || 1);
        const winnerPhone = senderJid.replace(/:.*@/, '@').split('@')[0];

        const winMsg = `🎉 *BINGO! TEBAKAN LAGU BENAR!* 🏆\n\n👤 *Pemenang:* @${winnerPhone} (${senderName || 'Member'})\n🎵 *Judul Lagu:* *${game.song.title}*\n🎤 *Artis:* ${game.song.artist} (${game.song.year})\n⭐ *Hadiah:* +${game.points || 1} Poin (Total Skor: *${updatedScore}* poin)\n\n💡 _Ketik *.leaderboard* untuk lihat peringkat grup atau *.guess* untuk lagu baru!_`;

        await sock.sendMessage(groupJid, {
          text: winMsg,
          mentions: [senderJid],
        }, { quoted: msg });

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'SONG_GUESS_WON',
          details: `${senderName} correctly guessed song "${game.song.title}" (+1 pt, total: ${updatedScore})`,
        });
        return;
      } else if (isQuotedGameMsg) {
        // Direct reply to the song game prompt with an incorrect guess
        const senderPhone = senderJid.replace(/:.*@/, '@').split('@')[0];
        const failMsg = `❌ @${senderPhone}, tebakan judul lagumu belum tepat! Coba tebak lagi ya (atau ketik *.guess hint* untuk petunjuk).`;
        try {
          await sock.sendMessage(groupJid, {
            text: failMsg,
            mentions: [senderJid],
          }, { quoted: msg });
        } catch (fErr) { }
      }
    }

    // ==========================================
    // GROUP CLOSED (ADMINS ONLY) ENFORCEMENT
    // ==========================================
    if (settings.group_closed && !isAdmin) {
      try {
        await sock.sendMessage(groupJid, { delete: msg.key });
      } catch (delErr) {
        console.error('[Bot] Could not delete message in closed group:', delErr.message);
      }

      const senderPhone = senderJid.replace(/:.*@/, '@').split('@')[0];
      const warnMsg = `🔒 @${senderPhone}, grup ini sedang ditutup (khusus admin). Hanya admin yang dapat mengirim pesan saat ini!`;
      try {
        await sock.sendMessage(groupJid, {
          text: warnMsg,
          mentions: [senderJid],
        });
      } catch (wErr) {
        console.error('[Bot] Failed to send group closed warning:', wErr.message);
      }

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'CLOSED_GROUP_MSG_PREVENTED',
        details: `Non-admin message prevented: group closed to admins only`,
      });

      return; // Stop processing: do not count or execute commands
    }

    // ==========================================
    // AUTO-DELETE MESSAGES FROM BLOCKED MEMBERS
    // ==========================================
    if (database.isMemberBlocked(uid, groupJid, senderJid) && !isAdmin) {
      try {
        await sock.sendMessage(groupJid, { delete: msg.key });
        console.log(`[Bot] Auto-deleted message from blocked member ${senderJid} in ${groupName}`);

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'BLOCKED_MEMBER_MSG_DELETED',
          details: `Auto-deleted message from blocked member @${senderJid.split('@')[0]}`,
        });

        emitEvent('log:activity', {
          type: 'blocked_user_delete',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Auto-deleted message from blocked member @${senderJid.split('@')[0]}`,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('[Bot] Failed to delete message from blocked user:', err.message);
      }
      return; // Stop processing: do not count chat or trigger commands/replies
    }

    // ==========================================
    // IN-CHAT COMMAND: .help / .menu / .commands
    // ==========================================
    if (/^\.(help|menu|commands|cmd)\b/i.test(trimmedText)) {
      let helpText = `🐾 *CAPYBOT COMMANDS & HELP* 🐾\n`;
      helpText += `_Your friendly WhatsApp Group Assistant_\n\n`;

      helpText += `🤖 *ON-DEVICE AI COMMANDS (No API Key)*\n`;
      helpText += `• *.ask [question]* — Ask AI anything (send or reply to image for vision)\n`;
      helpText += `• *.summarize* — AI summary of last 100 group chat messages\n\n`;

      helpText += `🎮 *GAMES & INTERACTIVE COMMANDS*\n`;
      helpText += `• *.match* — Find who you reply to most frequently in this group\n`;
      helpText += `• *.topic* — Roll a dice for a fresh, unique Gen Z conversation topic\n`;
      helpText += `• *.wordgame* — Start an AI word-guessing riddle game (+1 pt)\n`;
      helpText += `• *.guess* — Song lyric guessing game (100 popular hits, +1 pt)\n`;
      helpText += `• *.leaderboard* — View group game rankings & player scores\n\n`;

      helpText += `📌 *MEMBER COMMANDS*\n`;
      helpText += `• *.help* — Display this command menu\n`;
      helpText += `• *.about* (or *.info*) — View Capybot V1.2 version & latest release info\n`;
      helpText += `• *.ping* — Check bot response latency & speed\n`;
      helpText += `• *.runtime* — View bot uptime & memory telemetry\n`;
      helpText += `• *.peek* — Reply to any View Once image/video to reveal it\n`;
      helpText += `• *.sticker* (or *.s*) — Reply to any image to make a sticker\n`;
      helpText += `• *.passive* — List members with messages below threshold\n`;
      helpText += `• *.blockeduser* — View list of blocked members\n\n`;

      helpText += `🛡️ *ADMIN COMMANDS (Configurable for Members on Dashboard)*\n`;
      helpText += `• *.close* — Restrict group messaging to admins only\n`;
      helpText += `• *.open* — Reopen group messaging to all members\n`;
      helpText += `• *.add [phone]* — Add a new member by phone number (e.g. .add 6281xxxxxxx)\n`;
      helpText += `• *.chatcount* — View group member message leaderboard\n`;
      helpText += `• *.inactive* — List members inactive for > 24 hours\n`;
      helpText += `• *.passive set [num]* — Set passive member chat threshold\n`;
      helpText += `• *.tagall [text]* — Mention all group members with list\n`;
      helpText += `• *.hidetag [text]* — Ghost tag all members silently\n`;
      helpText += `• *.delete* (or *.del*) — Reply to a message to delete it\n`;
      helpText += `• *.kick @user* — Remove a member from the group\n`;
      helpText += `• *.block @user* — Auto-delete all future messages from user\n`;
      helpText += `• *.unblock @user* — Unblock a member\n`;
      helpText += `• *.resetchat [@user]* — Reset message counts (all or single)\n\n`;

      helpText += `⚙️ *AUTOMATIC MODERATION*\n`;
      helpText += `• Auto-chat removal (Image-only or Text-only modes)\n`;
      helpText += `• Auto-deletes unauthorized Instagram & TikTok links\n`;
      helpText += `• Auto-deletes messages from blocked users\n\n`;
      helpText += `💡 _Prefix all commands with a dot (.)_`;

      await sock.sendMessage(groupJid, {
        text: helpText,
      }, { quoted: msg });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'COMMAND_HELP',
        details: `${senderName} requested .help command menu`,
      });

      emitEvent('log:activity', {
        type: 'command_help',
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        text: `${senderName} opened .help menu`,
        timestamp: Date.now(),
      });
      return;
    }

    // ==========================================
    // AI COMMAND 1: .ask [question] (Text & Multimodal Vision)
    // ==========================================
    if (/^\.(ask|ai|tanya|qwen|janus)\b/i.test(trimmedText)) {
      const userAiStatus = database.getUserAIStatus(uid);
      if (!userAiStatus.ai_enabled || !settings.ai_enabled) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ AI features are currently disabled. Please enable AI features in the settings to use this command.',
        }, { quoted: msg });
        return;
      }

      const mediaInfo = extractMediaForSticker(msg, contextInfo);
      let question = trimmedText.replace(/^\.(ask|ai|tanya|qwen|janus)\s*/i, '').trim();

      if (!question && !mediaInfo.isImage) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Please provide a question or reply to an image:\n• *.ask What is quantum computing?*\n• *.ask Describe this image* (reply to image)',
        }, { quoted: msg });
        return;
      }

      try {
        await sock.sendPresenceUpdate('composing', groupJid);
      } catch (pErr) { }

      let imageBuffer = null;
      if (mediaInfo.isImage && mediaInfo.targetNode) {
        try {
          imageBuffer = await downloadMediaBuffer(mediaInfo.targetNode, mediaInfo.mediaType);
        } catch (imgErr) {
          console.warn('[Bot] Failed to download image for .ask:', imgErr.message);
        }
      }

      try {
        const result = await aiService.askQuestion({
          prompt: question,
          imageBuffer,
          mimetype: mediaInfo.targetNode?.mimetype || 'image/jpeg',
          senderName,
        });

        await sock.sendMessage(groupJid, {
          text: result.response,
        }, { quoted: msg });

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'AI_ASK',
          details: `${senderName} asked AI: "${question || '[Image Analysis]'}" (${result.model})`,
        });

        emitEvent('log:activity', {
          type: 'ai_ask',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `${senderName} asked AI: "${question || 'Image analysis'}"`,
          timestamp: Date.now(),
        });
      } catch (aiErr) {
        console.error('[Bot] .ask execution failed:', aiErr.message);
        await sock.sendMessage(groupJid, {
          text: `⚠️ Could not complete AI request: ${aiErr.message}`,
        }, { quoted: msg });
      }
      return;
    }

    // ==========================================
    // AI COMMAND 2: .summarize (Last 100 Group Messages)
    // ==========================================
    if (/^\.(summarize|summary|recap|ringkas)\b/i.test(trimmedText)) {
      const userAiStatus = database.getUserAIStatus(uid);
      if (!userAiStatus.ai_enabled || !settings.ai_enabled) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ AI features are currently disabled. Please enable AI features in the settings to use this command.',
        }, { quoted: msg });
        return;
      }

      try {
        await sock.sendPresenceUpdate('composing', groupJid);
      } catch (pErr) { }

      // Fetch last 100 messages from SQLite
      const messageHistory = database.getGroupMessages(uid, groupJid, { limit: 100 });
      const rawMessages = messageHistory?.messages || [];

      if (rawMessages.length < 3) {
        await sock.sendMessage(groupJid, {
          text: 'ℹ️ Not enough recent messages recorded yet to generate a summary (minimum 3 messages required).',
        }, { quoted: msg });
        return;
      }

      try {
        const summaryResult = await aiService.summarizeGroupMessages(rawMessages, { groupName });

        await sock.sendMessage(groupJid, {
          text: summaryResult.summary,
        }, { quoted: msg });

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'AI_SUMMARIZE',
          details: `${senderName} summarized group chat (${rawMessages.length} messages analyzed)`,
        });

        emitEvent('log:activity', {
          type: 'ai_summarize',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `${senderName} requested AI group summary`,
          timestamp: Date.now(),
        });
      } catch (sumErr) {
        console.error('[Bot] .summarize execution failed:', sumErr.message);
        await sock.sendMessage(groupJid, {
          text: `⚠️ Could not generate summary: ${sumErr.message}`,
        }, { quoted: msg });
      }
      return;
    }



    // ==========================================
    // UTILITY COMMAND 1: .ping / .speed / .latency
    // ==========================================
    if (/^\.(ping|speed|latency)\b/i.test(trimmedText)) {
      const msgTimestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now();
      const latency = Math.max(0, Date.now() - msgTimestamp);
      const mem = process.memoryUsage();
      const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const rssMB = (mem.rss / 1024 / 1024).toFixed(1);

      let pingText = `🏓 *Pong!*\n\n`;
      pingText += `⚡ *Response Latency:* ${latency} ms\n`;
      pingText += `🖥️ *Memory Usage:* ${heapMB} MB / ${rssMB} MB\n`;
      pingText += `✨ *CapyBot Engine:* Active & Healthy`;

      await sock.sendMessage(groupJid, { text: pingText }, { quoted: msg });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'COMMAND_PING',
        details: `${senderName} checked ping (${latency}ms)`,
      });
      return;
    }

    // ==========================================
    // UTILITY COMMAND 2: .runtime / .uptime
    // ==========================================
    if (/^\.(runtime|uptime)\b/i.test(trimmedText)) {
      const uptimeSec = Math.floor(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = uptimeSec % 60;
      const uptimeStr = `${days > 0 ? `${days}d ` : ''}${hours}h ${mins}m ${secs}s`;

      const mem = process.memoryUsage();
      const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const rssMB = (mem.rss / 1024 / 1024).toFixed(1);

      let runText = `⏱️ *BOT RUNTIME & SYSTEM TELEMETRY*\n\n`;
      runText += `• *Total Uptime:* ${uptimeStr}\n`;
      runText += `• *Bot Status:* 🟢 Online & Running\n`;
      runText += `• *Memory (Heap / RSS):* ${heapMB} MB / ${rssMB} MB\n`;
      runText += `• *Platform:* Node.js (${process.version}) on ${process.platform}\n`;
      runText += `• *AI Microservice:* Connected (${process.env.AI_SERVICE_URL || 'http://127.0.0.1:5005'})`;

      await sock.sendMessage(groupJid, { text: runText }, { quoted: msg });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'COMMAND_RUNTIME',
        details: `${senderName} checked bot runtime (${uptimeStr})`,
      });
      return;
    }

    // ==========================================
    // UTILITY COMMAND 3: .about / .info / .version
    // ==========================================
    if (/^\.(about|info|version|v)\b/i.test(trimmedText)) {
      const uptimeSec = Math.floor(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = uptimeSec % 60;
      const uptimeStr = `${days > 0 ? `${days}d ` : ''}${hours}h ${mins}m ${secs}s`;

      let aboutText = `🐾 *CAPYBOT V1.2 (LATEST RELEASE)* 🐾\n`;
      aboutText += `_Your All-in-One WhatsApp Group Manager & On-Device AI_\n\n`;

      aboutText += `📦 *Version:* Capybot V1.2\n`;
      aboutText += `⚡ *AI Engine:* Qwen 3.5 On-Device Multimodal AI (0 API Keys Required)\n`;
      aboutText += `⏱️ *Uptime:* ${uptimeStr}\n`;
      aboutText += `🟢 *Status:* Online & Operational\n\n`;

      aboutText += `🚀 *WHAT'S NEW IN V1.2:*\n`;
      aboutText += `• 🎵 *.guess* — Song lyric guessing game (100 popular hits 2016–2026)\n`;
      aboutText += `• 🔒 *.close* / *.open* — Group messaging lock for admins only\n`;
      aboutText += `• ➕ *.add [phone]* — Add new member directly by phone number\n`;
      aboutText += `• 🛡️ *False-Positive Fix* — Accurate chat removal without emoji react warnings\n`;
      aboutText += `• 🎲 Expanded topic coverage for *.topic* (50+ questions) & *.wordgame* (60+ words)\n`;
      aboutText += `• 💘 *.match* — Group reply partner compatibility analysis\n`;
      aboutText += `• 🏆 *.leaderboard* — Accumulated game player rankings\n`;
      aboutText += `• 🤖 *.ask* & *.summarize* — Multimodal AI Q&A and 100-msg chat summarizer\n`;
      aboutText += `• 👁️ *.peek* — View Once photo/video revealer\n\n`;

      aboutText += `🌐 *Web Admin Dashboard:* http://localhost:3000\n`;
      aboutText += `💡 _Type *.help* to see the full list of all available commands._`;

      await sock.sendMessage(groupJid, { text: aboutText }, { quoted: msg });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'COMMAND_ABOUT',
        details: `${senderName} checked Capybot V1.1 about info`,
      });
      return;
    }

    // ==========================================
    // UTILITY COMMAND 3: .peek / .rvo (Reveal View Once Media)
    // ==========================================
    if (isPeekCommand(trimmedText)) {
      const mediaInfo = extractViewOnceMedia(msg, contextInfo);

      if (!mediaInfo.isMedia || !mediaInfo.targetNode) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Please reply to a View Once ("one time view") photo or video with *.peek* to reveal and resend it.',
        }, { quoted: msg });
        return;
      }

      try {
        await sock.sendPresenceUpdate('composing', groupJid);
      } catch (pErr) { }

      try {
        const mediaBuffer = await downloadMediaBuffer(mediaInfo.targetNode, mediaInfo.mediaType);
        if (!mediaBuffer || mediaBuffer.length === 0) {
          throw new Error('Could not download View Once media.');
        }

        const targetSender = contextInfo?.participant || senderJid;
        const targetClean = targetSender.replace(/:.*@/, '@').split('@')[0];

        let caption = `👁️ *VIEW ONCE MEDIA REVEALED*\n`;
        if (targetClean) {
          caption += `👤 *Sender:* @${targetClean}\n`;
        }
        if (mediaInfo.caption) {
          caption += `📝 *Caption:* ${mediaInfo.caption}\n`;
        }

        if (mediaInfo.mediaType === 'video') {
          await sock.sendMessage(groupJid, {
            video: mediaBuffer,
            caption,
            mentions: [targetSender],
            mimetype: mediaInfo.targetNode?.mimetype || 'video/mp4',
          }, { quoted: msg });
        } else if (mediaInfo.mediaType === 'audio') {
          await sock.sendMessage(groupJid, {
            audio: mediaBuffer,
            mimetype: mediaInfo.targetNode?.mimetype || 'audio/mp4',
          }, { quoted: msg });
        } else {
          await sock.sendMessage(groupJid, {
            image: mediaBuffer,
            caption,
            mentions: [targetSender],
            mimetype: mediaInfo.targetNode?.mimetype || 'image/jpeg',
          }, { quoted: msg });
        }

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'VIEW_ONCE_PEEK',
          details: `${senderName} revealed View Once media (${mediaInfo.mediaType})`,
        });

        emitEvent('log:activity', {
          type: 'view_once_peek',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `${senderName} revealed View Once media`,
          timestamp: Date.now(),
        });
      } catch (peekErr) {
        console.error('[Bot] Failed to execute .peek:', peekErr.message);
        await sock.sendMessage(groupJid, {
          text: `⚠️ Failed to reveal View Once media: ${peekErr.message}`,
        }, { quoted: msg });
      }
      return;
    }

    // ==========================================
    // INTERACTIVE COMMAND 1: .match / .cocok / .ship
    // ==========================================
    if (/^\.(match|cocok|ship|soulmate)\b/i.test(trimmedText)) {
      const partner = database.getTopReplyPartner(uid, groupJid, senderJid);
      const senderPhone = senderJid.replace(/:.*@/, '@').split('@')[0];

      if (!partner) {
        let noMatchText = `💘 *MATCH ANALYSIS: ${groupName}*\n\n`;
        noMatchText += `👤 *You:* @${senderPhone} (${senderName || 'Member'})\n`;
        noMatchText += `ℹ️ *Result:* No reply history or chat quotes recorded for you yet in this group!\n\n`;
        noMatchText += `💡 _Start quoting and replying to other members' messages, then run *.match* again!_`;

        await sock.sendMessage(groupJid, {
          text: noMatchText,
          mentions: [senderJid],
        }, { quoted: msg });
        return;
      }

      const partnerClean = partner.partnerJid.replace(/:.*@/, '@');
      const partnerPhone = partnerClean.split('@')[0];
      const vibe = getChemistryVibe(partner.replyCount);

      let matchText = `💘 *GROUP MATCH ANALYSIS: ${groupName}* 💘\n\n`;
      matchText += `👤 *User:* @${senderPhone}\n`;
      matchText += `🎯 *Top Match:* @${partnerPhone} (${partner.partnerName || 'Member'})\n`;
      matchText += `📊 *Interaction Count:* ${partner.replyCount} direct replies & chat quotes\n`;
      matchText += `🔥 *Chemistry Score:* ${vibe.score}% — ${vibe.label}\n\n`;
      matchText += `💬 _Based on real group chat reply history!_`;

      await sock.sendMessage(groupJid, {
        text: matchText,
        mentions: [senderJid, partner.partnerJid],
      }, { quoted: msg });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'COMMAND_MATCH',
        details: `${senderName} matched with ${partner.partnerName} (${partner.replyCount} replies, ${vibe.score}%)`,
      });
      return;
    }

    // ==========================================
    // INTERACTIVE COMMAND 2: .topic / .topik / .obrolan
    // ==========================================
    if (/^\.(topic|topik|obrolan|icebreaker)\b/i.test(trimmedText)) {
      const gameLang = settings?.game_language || 'en';
      const topicObj = aiService.generateGenZTopic(gameLang);

      await sock.sendMessage(groupJid, {
        text: topicObj.formattedText,
      }, { quoted: msg });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'COMMAND_TOPIC',
        details: `${senderName} rolled dice (${topicObj.roll}/${topicObj.diceSides}) for topic: "${topicObj.prompt.substring(0, 40)}..."`,
      });
      return;
    }

    // ==========================================
    // INTERACTIVE COMMAND 3: .wordgame / .game / .tebakkata
    // ==========================================
    if (/^\.(wordgame|game|tebakkata|riddle)\b/i.test(trimmedText)) {
      const gameLang = settings?.game_language || 'en';
      const isId = gameLang === 'id';
      const subCommand = trimmedText.replace(/^\.(wordgame|game|tebakkata|riddle)\s*/i, '').trim().toLowerCase();

      // Subcommand: .wordgame giveup / surrender
      if (subCommand === 'giveup' || subCommand === 'surrender' || subCommand === 'nyerah') {
        if (!activeWordGames.has(groupJid)) {
          await sock.sendMessage(groupJid, {
            text: isId
              ? '⚠️ Belum ada sesi tebak kata yang aktif. Ketik *.wordgame* untuk memulai ronde baru!'
              : '⚠️ No word game is currently active. Type *.wordgame* to start a new round!',
          }, { quoted: msg });
          return;
        }

        const activeGame = activeWordGames.get(groupJid);
        if (activeGame.timeoutTimer) clearTimeout(activeGame.timeoutTimer);
        activeWordGames.delete(groupJid);

        let giveupText = isId
          ? `🏳️ *SESI TEBAK KATA BERAKHIR (MENYERAH)*\n\n🎯 Kata rahasianya adalah: *${activeGame.word}*\n📌 *Kategori:* ${activeGame.category}\n\n💡 _Tidak ada poin yang diberikan. Ketik *.wordgame* untuk ronde baru!_`
          : `🏳️ *WORD GAME ENDED (GIVE UP)*\n\n🎯 The secret word was: *${activeGame.word}*\n📌 *Category:* ${activeGame.category}\n\n💡 _No points awarded. Type *.wordgame* to start a fresh round!_`;

        await sock.sendMessage(groupJid, { text: giveupText }, { quoted: msg });
        return;
      }

      // Subcommand: .wordgame hint
      if (subCommand === 'hint' || subCommand === 'clue' || subCommand === 'bantuan') {
        if (!activeWordGames.has(groupJid)) {
          await sock.sendMessage(groupJid, {
            text: isId
              ? '⚠️ Belum ada sesi tebak kata yang aktif. Ketik *.wordgame* untuk memulai ronde baru!'
              : '⚠️ No word game is currently active. Type *.wordgame* to start a new round!',
          }, { quoted: msg });
          return;
        }

        const activeGame = activeWordGames.get(groupJid);
        let hintMsg = isId
          ? `🔤 *BANTUAN TAMBAHAN TEBAK KATA*\n\n📌 *Kategori:* ${activeGame.category}\n🔀 *Huruf Acak:* ${activeGame.scramble}\n🔤 *Pola Huruf:* ${activeGame.hint}\n\n👉 _Ketik jawabanmu langsung di grup ini!_`
          : `🔤 *WORD GAME EXTRA HINT*\n\n📌 *Category:* ${activeGame.category}\n🔀 *Scrambled Letters:* ${activeGame.scramble}\n🔤 *Letter Mask:* ${activeGame.hint}\n\n👉 _Reply with your answer in this group!_`;

        await sock.sendMessage(groupJid, { text: hintMsg }, { quoted: msg });
        return;
      }

      // If game is already active in this group
      if (activeWordGames.has(groupJid)) {
        const activeGame = activeWordGames.get(groupJid);
        let activeMsg = isId
          ? `🧩 *GAME TEBAK KATA SEDANG BERLANGSUNG!* ⚡\n\n📌 *Kategori:* ${activeGame.category}\n❓ *Petunjuk:* ${activeGame.clue}\n🔤 *Bantuan:* ${activeGame.hint}\n🔀 *Huruf Acak:* ${activeGame.scramble}\n🏆 *Hadiah:* +1 Poin di Leaderboard\n\n👉 _Ketik jawabanmu di grup ini, atau ketik *.wordgame giveup* untuk menyerah!_`
          : `🧩 *ACTIVE WORD GAME IN PROGRESS!* ⚡\n\n📌 *Category:* ${activeGame.category}\n❓ *Clue:* ${activeGame.clue}\n🔤 *Hint:* ${activeGame.hint}\n🔀 *Letters Scramble:* ${activeGame.scramble}\n🏆 *Reward:* +1 Point on Leaderboard\n\n👉 _Type your answer in this group, or type *.wordgame giveup* to reveal!_`;

        await sock.sendMessage(groupJid, { text: activeMsg }, { quoted: msg });
        return;
      }

      // Start new game round
      const question = aiService.generateWordGameQuestion(gameLang);

      // Timeout after 90 seconds
      const timeoutTimer = setTimeout(async () => {
        if (activeWordGames.has(groupJid)) {
          activeWordGames.delete(groupJid);
          try {
            await sock.sendMessage(groupJid, {
              text: isId
                ? `⏰ *WAKTU HABIS! (Tebak Kata)*\n\n🎯 Kata rahasianya adalah: *${question.word}*\n📌 *Kategori:* ${question.category}\n\n💡 _Tidak ada poin yang diberikan. Ketik *.wordgame* untuk ronde baru!_`
                : `⏰ *TIME'S UP! (Word Game)*\n\n🎯 The secret word was: *${question.word}*\n📌 *Category:* ${question.category}\n\n💡 _No points awarded. Type *.wordgame* to start a new round!_`,
            });
          } catch (tErr) { }
        }
      }, 90000);

      activeWordGames.set(groupJid, {
        word: question.word,
        clue: question.clue,
        hint: question.hint,
        scramble: question.scramble,
        category: question.category,
        points: question.points || 1,
        startedAt: Date.now(),
        timeoutTimer,
      });

      let gameText = isId
        ? `🧩 *CAPYBOT TEBAK KATA* ⚡\n_Bisa tebak kata rahasianya?_\n\n📌 *Kategori:* ${question.category}\n❓ *Petunjuk:* ${question.clue}\n🔤 *Bantuan:* ${question.hint}\n🔀 *Huruf Acak:* ${question.scramble}\n🏆 *Hadiah:* +1 Poin di Leaderboard\n\n👉 _Ketik jawabanmu di grup ini untuk menebak! (Timer 90 detik)_`
        : `🧩 *CAPYBOT WORD GAME* ⚡\n_Can you guess the secret word?_\n\n📌 *Category:* ${question.category}\n❓ *Clue:* ${question.clue}\n🔤 *Hint:* ${question.hint}\n🔀 *Scramble:* ${question.scramble}\n🏆 *Reward:* +1 Point on Leaderboard\n\n👉 _Type your answer in this group to guess! (90s timer)_`;

      await sock.sendMessage(groupJid, { text: gameText }, { quoted: msg });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'WORDGAME_STARTED',
        details: `${senderName} started word game for "${question.word}" (${question.category})`,
      });
      return;
    }

    // ==========================================
    // INTERACTIVE COMMAND 3.5: .guess / .tebaklagu / .songgame
    // ==========================================
    if (/^\.(guess|tebaklagu|songgame|tebaksong)\b/i.test(trimmedText)) {
      const subCommand = trimmedText.replace(/^\.(guess|tebaklagu|songgame|tebaksong)\s*/i, '').trim().toLowerCase();

      // Subcommand: .guess giveup / surrender / nyerah
      if (subCommand === 'giveup' || subCommand === 'surrender' || subCommand === 'nyerah') {
        if (!activeGuessGames.has(groupJid)) {
          await sock.sendMessage(groupJid, {
            text: '⚠️ Belum ada sesi tebak lagu yang aktif. Ketik *.guess* untuk memulai ronde baru!',
          }, { quoted: msg });
          return;
        }

        const activeGame = activeGuessGames.get(groupJid);
        if (activeGame.timeoutTimer) clearTimeout(activeGame.timeoutTimer);
        activeGuessGames.delete(groupJid);

        const giveupMsg =
          `🏳️ *SESI TEBAK LAGU BERAKHIR (MENYERAH)*\n\n` +
          `🎯 Judul lagunya adalah: *${activeGame.song.title}*\n` +
          `🎤 *Artis:* ${activeGame.song.artist} (${activeGame.song.year})\n\n` +
          `💡 _Tidak ada poin yang diberikan. Ketik *.guess* untuk ronde baru!_`;

        await sock.sendMessage(groupJid, { text: giveupMsg }, { quoted: msg });
        return;
      }

      // Subcommand: .guess hint / clue / bantuan
      if (subCommand === 'hint' || subCommand === 'clue' || subCommand === 'bantuan') {
        if (!activeGuessGames.has(groupJid)) {
          await sock.sendMessage(groupJid, {
            text: '⚠️ Belum ada sesi tebak lagu yang aktif. Ketik *.guess* untuk memulai ronde baru!',
          }, { quoted: msg });
          return;
        }

        const activeGame = activeGuessGames.get(groupJid);
        const maskedHint = songBank.createMaskedHint(activeGame.song.title);
        const hintMsg =
          `🔤 *BANTUAN TAMBAHAN TEBAK LAGU*\n\n` +
          `🎤 *Artis:* ${activeGame.song.artist}\n` +
          `📅 *Tahun Rilis:* ${activeGame.song.year}\n` +
          `🔤 *Pola Huruf:* ${maskedHint}\n\n` +
          `👉 _Balas pesan tebakan atau ketik judul lagu langsung di grup ini!_`;

        await sock.sendMessage(groupJid, { text: hintMsg }, { quoted: msg });
        return;
      }

      // If game is already active in this group
      if (activeGuessGames.has(groupJid)) {
        const activeGame = activeGuessGames.get(groupJid);
        const activeMsg =
          `🎵 *GAME TEBAK LAGU SEDANG BERLANGSUNG!* ⚡\n\n` +
          `📜 *Potongan Lirik:*\n` +
          `"${activeGame.song.lyrics}"\n\n` +
          `📅 *Tahun:* ${activeGame.song.year} • 🎤 *Artis:* ${activeGame.song.artist}\n` +
          `🏆 *Hadiah:* +1 Poin di Leaderboard\n\n` +
          `👉 _Ketik jawabanmu di grup ini, atau ketik *.guess giveup* untuk menyerah!_`;

        await sock.sendMessage(groupJid, { text: activeMsg }, { quoted: msg });
        return;
      }

      // Start new song guessing game
      const q = generateSongGuessQuestion();

      // Timeout after 120 seconds
      const timeoutTimer = setTimeout(async () => {
        if (activeGuessGames.has(groupJid)) {
          activeGuessGames.delete(groupJid);
          try {
            await sock.sendMessage(groupJid, {
              text:
                `⏰ *WAKTU HABIS! (Tebak Lagu)*\n\n` +
                `🎯 Judul lagu yang benar: *${q.song.title}* - ${q.song.artist} (${q.song.year})\n\n` +
                `💡 _Tidak ada poin yang diberikan. Ketik *.guess* untuk ronde baru!_`,
            });
          } catch (tErr) { }
        }
      }, 120000);

      const sentMsg = await sock.sendMessage(groupJid, { text: q.formattedPrompt }, { quoted: msg });

      activeGuessGames.set(groupJid, {
        song: q.song,
        roll: q.roll,
        points: q.points || 1,
        botMessageId: sentMsg?.key?.id || null,
        startedAt: Date.now(),
        timeoutTimer,
      });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'SONG_GUESS_STARTED',
        details: `${senderName} started song guessing game for "${q.song.title}" (${q.song.year})`,
      });
      return;
    }

    // ==========================================
    // INTERACTIVE COMMAND 4: .leaderboard / .lb / .score
    // ==========================================
    if (/^\.(leaderboard|lb|score|scores|topgame)\b/i.test(trimmedText)) {
      const topPlayers = database.getWordGameLeaderboard(uid, groupJid, 10);
      const userScore = database.getWordGameUserScore(uid, groupJid, senderJid);
      const senderPhone = senderJid.replace(/:.*@/, '@').split('@')[0];

      let lbText = `🏆 *WORDGAME LEADERBOARD: ${groupName}* 🏆\n`;
      lbText += `_Top Word Masters & Champions_\n\n`;

      if (!topPlayers || topPlayers.length === 0) {
        lbText += `🎮 *No scores recorded yet in this group!*\n`;
        lbText += `💡 _Start playing by typing *.wordgame* to earn the first point on the board!_\n`;
      } else {
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        topPlayers.forEach((player, idx) => {
          const medal = medals[idx] || `${idx + 1}.`;
          const phone = player.user_jid.replace(/:.*@/, '@').split('@')[0];
          const name = player.user_name || phone;
          const isMe = player.user_jid === senderJid;
          lbText += `${medal} *${name}* — ${player.score} pt${player.score === 1 ? '' : 's'}${isMe ? ' 👈 (You)' : ''}\n`;
        });
        lbText += `\n👤 *Your Score:* ${userScore} pt${userScore === 1 ? '' : 's'}\n`;
      }

      lbText += `\n💡 _Type *.wordgame* or *.guess* to start a game and climb the rankings!_`;

      await sock.sendMessage(groupJid, {
        text: lbText,
      }, { quoted: msg });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'COMMAND_LEADERBOARD',
        details: `${senderName} checked word game leaderboard (${topPlayers.length} ranked players)`,
      });
      return;
    }

    // ==========================================
    // ADMIN COMMAND: .passive set [number]
    // ==========================================
    if (/^\.passive\s+set\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('passive_set', isAdmin, settings)) {
        console.log(`[Bot] Non-admin ${senderName} tried to use .passive set in ${groupName}`);
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can change the passive member threshold.',
        }, { quoted: msg });
        return;
      }

      const match = trimmedText.match(/^\.passive\s+set\s+(\d+)/i);
      if (!match) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Please provide a valid minimum message count number:\n*.passive set 10*',
        }, { quoted: msg });
        return;
      }

      const threshold = parseInt(match[1], 10);
      database.updateGroupSettings(uid, groupJid, { passive_threshold: threshold });

      await sock.sendMessage(groupJid, {
        text: `✅ *Passive Member Threshold Updated*\n\nMembers with fewer than *${threshold} messages* will now be classified as passive in this group.\n\nType *.passive* to view the current list of passive members.`,
      }, { quoted: msg });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'ADMIN_SET_PASSIVE_THRESHOLD',
        details: `Admin ${senderName} set passive threshold to ${threshold} messages`,
      });

      emitEvent('log:activity', {
        type: 'admin_set_passive',
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        text: `Admin set passive threshold to ${threshold} msgs`,
        timestamp: Date.now(),
      });
      return;
    }

    // ==========================================
    // IN-CHAT COMMAND: .passive / .pasif
    // ==========================================
    if (/^\.(passive|pasif)\b/i.test(trimmedText)) {
      const threshold = settings.passive_threshold !== undefined ? Number(settings.passive_threshold) : 5;
      const participants = groupMeta?.participants || [];
      const leaderboard = database.getGroupLeaderboard(uid, groupJid) || [];
      const countsMap = new Map();

      for (const entry of leaderboard) {
        const cleanId = entry.user_jid.replace(/:.*@/, '@').split('@')[0];
        countsMap.set(cleanId, entry.chat_count);
      }

      // Find participants whose message count < threshold
      const passiveMembers = [];
      for (const p of participants) {
        const cleanId = (p.id ? p.id.replace(/:.*@/, '@') : '').split('@')[0];
        const count = countsMap.get(cleanId) || 0;
        if (count < threshold) {
          passiveMembers.push({
            jid: p.id,
            phone: cleanId,
            count,
          });
        }
      }

      // Sort by chat count ascending (least active first)
      passiveMembers.sort((a, b) => a.count - b.count);

      if (passiveMembers.length === 0) {
        await sock.sendMessage(groupJid, {
          text: `🎉 *No Passive Members Found!*\n\nAll ${participants.length} group members have sent at least *${threshold} messages*. Great job!`,
        }, { quoted: msg });
        return;
      }

      let passiveText = `💤 *PASSIVE GROUP MEMBERS* 💤\n`;
      passiveText += `📌 *Group:* ${groupName}\n`;
      passiveText += `🎯 *Threshold:* Less than ${threshold} messages\n`;
      passiveText += `👥 *Total Passive:* ${passiveMembers.length} / ${participants.length} members\n\n`;

      const displayLimit = 50;
      const displayed = passiveMembers.slice(0, displayLimit);
      displayed.forEach((m, idx) => {
        passiveText += `${idx + 1}. @${m.phone} — *${m.count}* msgs\n`;
      });

      if (passiveMembers.length > displayLimit) {
        passiveText += `\n_...and ${passiveMembers.length - displayLimit} more passive members._\n`;
      }

      passiveText += `\n💡 _Admins can change the threshold with *.passive set [number]* or on the Web Dashboard._`;

      const mentionJids = displayed.map((m) => m.jid);
      await sock.sendMessage(groupJid, {
        text: passiveText,
        mentions: mentionJids,
      }, { quoted: msg });

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        actionType: 'COMMAND_PASSIVE_CHECK',
        details: `${senderName} checked passive members (${passiveMembers.length} found)`,
      });

      emitEvent('log:activity', {
        type: 'command_passive',
        groupJid,
        groupName,
        userJid: senderJid,
        userName: senderName,
        text: `${senderName} checked passive members (${passiveMembers.length} found)`,
        timestamp: Date.now(),
      });
      return;
    }

    // ==========================================
    // ADMIN COMMAND 1: .delete / .del
    // ==========================================
    if (/^\.(delete|del)\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('delete', isAdmin, settings)) {
        console.log(`[Bot] Non-admin ${senderName} tried to use .delete in ${groupName}`);
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can delete messages with *.delete*.',
        }, { quoted: msg });
        return;
      }

      if (contextInfo && contextInfo.stanzaId) {
        const targetParticipant = contextInfo.participant || null;
        const targetKey = {
          remoteJid: groupJid,
          fromMe: !targetParticipant,
          id: contextInfo.stanzaId,
          participant: targetParticipant,
        };

        try {
          // Delete target replied message
          await sock.sendMessage(groupJid, { delete: targetKey });
          // Delete admin command message
          await sock.sendMessage(groupJid, { delete: msg.key });

          console.log(`[Bot] Admin ${senderName} deleted message ${contextInfo.stanzaId} in ${groupName}`);
          database.logActivity(uid, {
            groupJid,
            groupName,
            userJid: senderJid,
            userName: senderName,
            actionType: 'ADMIN_DELETE_MESSAGE',
            details: `Admin deleted message (${contextInfo.stanzaId.substring(0, 10)}...)`,
          });

          emitEvent('log:activity', {
            type: 'admin_delete',
            groupJid,
            groupName,
            userJid: senderJid,
            userName: senderName,
            text: `Admin deleted a message`,
            timestamp: Date.now(),
          });
        } catch (delErr) {
          console.error('[Bot] Failed to execute .delete command:', delErr.message);
          if (!botAdminStatus) {
            await sock.sendMessage(groupJid, {
              text: '⚠️ Bot must be promoted to Group Admin to delete messages.',
            }, { quoted: msg });
          }
        }
      } else {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Please reply to the message you want to delete with *.delete*',
        }, { quoted: msg });
      }
      return;
    }

    // ==========================================
    // ADMIN COMMAND 2: .kick [@user]
    // ==========================================
    if (/^\.kick\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('kick', isAdmin, settings)) {
        console.log(`[Bot] Non-admin ${senderName} tried to use .kick in ${groupName}`);
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can remove members.',
        }, { quoted: msg });
        return;
      }

      if (!botAdminStatus) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Bot must be a Group Admin to remove members.',
        }, { quoted: msg });
        return;
      }

      // Determine target user to kick
      let targetJids = [];

      // Case A: Mentions in message
      if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length > 0) {
        targetJids = [...contextInfo.mentionedJid];
      }
      // Case B: Quoted message participant
      else if (contextInfo?.participant) {
        targetJids = [contextInfo.participant];
      }
      // Case C: Phone number in text (e.g. .kick 60123456789)
      else {
        const phoneMatch = trimmedText.match(/\.kick\s+@?(\d{7,16})/i);
        if (phoneMatch && phoneMatch[1]) {
          targetJids = [`${phoneMatch[1]}@s.whatsapp.net`];
        }
      }

      if (targetJids.length === 0) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Please tag a user (*.kick @user*) or reply to their message with *.kick* to remove them.',
        }, { quoted: msg });
        return;
      }

      const botJidClean = sock.user.id.replace(/:.*@/, '@').split('@')[0];

      for (const targetJid of targetJids) {
        const targetClean = targetJid.split('@')[0];

        // Guard: Cannot kick the bot itself
        if (targetClean === botJidClean) {
          await sock.sendMessage(groupJid, {
            text: '⚠️ Cannot kick the bot account.',
          }, { quoted: msg });
          continue;
        }

        // Guard: Cannot kick an admin
        if (isParticipantAdmin(groupMeta, targetJid)) {
          await sock.sendMessage(groupJid, {
            text: `⚠️ Cannot kick @${targetClean} because they are a Group Admin!`,
            mentions: [targetJid],
          }, { quoted: msg });
          continue;
        }

        try {
          await sock.groupParticipantsUpdate(groupJid, [targetJid], 'remove');
          await sock.sendMessage(groupJid, { delete: msg.key }); // delete .kick command

          console.log(`[Bot] Admin ${senderName} kicked ${targetJid} from ${groupName}`);
          database.logActivity(uid, {
            groupJid,
            groupName,
            userJid: senderJid,
            userName: senderName,
            actionType: 'ADMIN_KICK_MEMBER',
            details: `Admin kicked @${targetClean} from the group`,
          });

          emitEvent('log:activity', {
            type: 'admin_kick',
            groupJid,
            groupName,
            userJid: senderJid,
            userName: senderName,
            text: `Admin removed @${targetClean}`,
            timestamp: Date.now(),
          });
        } catch (kickErr) {
          console.error(`[Bot] Failed to kick ${targetJid}:`, kickErr.message);
          await sock.sendMessage(groupJid, {
            text: `⚠️ Failed to kick member: ${kickErr.message}`,
          }, { quoted: msg });
        }
      }
      return;
    }

    // ==========================================
    // ADMIN COMMAND 3: .hidetag [message]
    // ==========================================
    if (/^\.hidetag\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('hidetag', isAdmin, settings)) {
        console.log(`[Bot] Non-admin ${senderName} tried to use .hidetag in ${groupName}`);
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can use *.hidetag*.',
        }, { quoted: msg });
        return;
      }

      let textToSend = trimmedText.replace(/^\.hidetag\s*/i, '').trim();

      // If no text was passed, extract from replied message
      if (!textToSend && contextInfo?.quotedMessage) {
        textToSend = extractMessageText(contextInfo.quotedMessage);
      }

      if (!textToSend) {
        textToSend = '📢 Announcement from Admin';
      }

      const allParticipants = (groupMeta?.participants || []).map((p) => p.id);

      try {
        // Send message from bot mentioning all participants
        await sock.sendMessage(groupJid, {
          text: textToSend,
          mentions: allParticipants,
        });

        // Delete the trigger .hidetag command message
        await sock.sendMessage(groupJid, { delete: msg.key });

        console.log(`[Bot] Admin ${senderName} executed .hidetag in ${groupName} (${allParticipants.length} tagged)`);
        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'ADMIN_HIDETAG',
          details: `Admin broadcasted hidetag to ${allParticipants.length} group members`,
        });

        emitEvent('log:activity', {
          type: 'admin_hidetag',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Admin broadcasted hidetag to ${allParticipants.length} members`,
          timestamp: Date.now(),
        });
      } catch (hidetagErr) {
        console.error('[Bot] Failed to send .hidetag:', hidetagErr.message);
      }
      return;
    }

    // ==========================================
    // ADMIN COMMAND 4: .tagall [message]
    // ==========================================
    if (/^\.tagall\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('tagall', isAdmin, settings)) {
        console.log(`[Bot] Non-admin ${senderName} tried to use .tagall in ${groupName}`);
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can use *.tagall*.',
        }, { quoted: msg });
        return;
      }

      const customText = trimmedText.replace(/^\.tagall\s*/i, '').trim();
      const participants = groupMeta?.participants || [];
      const allParticipants = participants.map((p) => p.id);

      if (allParticipants.length === 0) {
        return;
      }

      let tagallMessage = `📢 *TAG ALL* (${participants.length} Members)\n\n`;
      if (customText) {
        tagallMessage += `📝 *Announcement:* ${customText}\n\n`;
      }
      tagallMessage += `👥 *Members:*\n`;

      participants.forEach((p, idx) => {
        const phone = p.id.split('@')[0];
        tagallMessage += `${idx + 1}. @${phone}\n`;
      });

      try {
        await sock.sendMessage(groupJid, {
          text: tagallMessage,
          mentions: allParticipants,
        });

        // Delete trigger .tagall command message
        await sock.sendMessage(groupJid, { delete: msg.key });

        console.log(`[Bot] Admin ${senderName} executed .tagall in ${groupName} (${allParticipants.length} tagged)`);
        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'ADMIN_TAGALL',
          details: `Admin tagged all ${allParticipants.length} members with announcement`,
        });

        emitEvent('log:activity', {
          type: 'admin_tagall',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Admin tagged all ${allParticipants.length} members`,
          timestamp: Date.now(),
        });
      } catch (tagErr) {
        console.error('[Bot] Failed to send .tagall:', tagErr.message);
      }
      return;
    }

    // ==========================================
    // MEMBER COMMAND: .sticker / .s / .stiker
    // ==========================================
    if (isStickerCommand(trimmedText)) {
      const mediaInfo = extractMediaForSticker(msg, contextInfo);

      if (!mediaInfo.isImage || !mediaInfo.targetNode) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Please reply to an image with *.sticker* or send an image with *.sticker* in the caption.',
        }, { quoted: msg });
        return;
      }

      try {
        console.log(`[Bot] Creating sticker for ${senderName} in ${groupName}...`);
        const imageBuffer = await downloadMediaBuffer(mediaInfo.targetNode, mediaInfo.mediaType);

        if (!imageBuffer || imageBuffer.length === 0) {
          throw new Error('Could not download image from message.');
        }

        const stickerWebp = await convertToStickerWebp(imageBuffer);

        await sock.sendMessage(groupJid, {
          sticker: stickerWebp,
        }, { quoted: msg });

        console.log(`[Bot] Sticker sent to ${senderName} in ${groupName}`);

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'STICKER_CREATED',
          details: `${senderName} created a WhatsApp sticker`,
        });

        emitEvent('log:activity', {
          type: 'sticker_created',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `${senderName} created a sticker`,
          timestamp: Date.now(),
        });
      } catch (stickerErr) {
        console.error('[Bot] Failed to create sticker:', stickerErr.message);
        await sock.sendMessage(groupJid, {
          text: `⚠️ Failed to create sticker: ${stickerErr.message}`,
        }, { quoted: msg });
      }
      return;
    }

    // ==========================================
    // IN-CHAT COMMAND 5: .inactive
    // ==========================================
    if (/^\.inactive\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('inactive', isAdmin, settings)) {
        console.log(`[Bot] Non-admin ${senderName} tried to use .inactive in ${groupName}`);
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can check inactive members.\n💡 _Admins can enable member access in the Web Dashboard Settings._',
        }, { quoted: msg });
        return;
      }
      const participants = groupMeta?.participants || [];
      const now = Date.now();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      const inactiveList = [];
      const mentions = [];

      for (const p of participants) {
        const member = database.getMember(uid, groupJid, p.id);
        const lastActive = member?.last_active ? Number(member.last_active) : 0;
        const chatCount = member?.chat_count || 0;

        if (!lastActive || chatCount === 0 || (now - lastActive) > ONE_DAY_MS) {
          const diff = lastActive ? (now - lastActive) : null;
          let timeAgoStr = 'Never sent a message';
          if (diff) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const days = Math.floor(hours / 24);
            timeAgoStr = days >= 1 ? `${days} day${days > 1 ? 's' : ''} ago` : `${hours} hours ago`;
          }
          const phone = p.id.split('@')[0];
          inactiveList.push({
            jid: p.id,
            phone,
            name: member?.user_name || null,
            timeAgo: timeAgoStr,
            lastActive,
          });
          mentions.push(p.id);
        }
      }

      let inactiveMsg = `📋 *INACTIVE MEMBERS REPORT*\n`;
      inactiveMsg += `👥 *Group:* ${groupName}\n`;
      inactiveMsg += `⏳ *Threshold:* Inactive for > 1 Day (24h)\n`;
      inactiveMsg += `📊 *Inactive Count:* ${inactiveList.length} / ${participants.length} members\n\n`;

      if (inactiveList.length === 0) {
        inactiveMsg += `🎉 *All members are active!* No members have been inactive for more than 1 day.`;
      } else {
        inactiveList.forEach((item, idx) => {
          const displayName = item.name ? `${item.name} (@${item.phone})` : `@${item.phone}`;
          inactiveMsg += `${idx + 1}. ${displayName} — _${item.timeAgo}_\n`;
        });
        if (isAdmin) {
          inactiveMsg += `\n💡 _Use *.kick @user* to remove inactive members._`;
        }
      }

      try {
        await sock.sendMessage(groupJid, {
          text: inactiveMsg,
          mentions,
        }, { quoted: msg });

        console.log(`[Bot] Inactive members report sent in ${groupName} (${inactiveList.length} inactive)`);
        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'COMMAND_INACTIVE',
          details: `Requested inactive members list (${inactiveList.length} inactive members found)`,
        });

        emitEvent('log:activity', {
          type: 'command_inactive',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Checked inactive members (${inactiveList.length} found)`,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('[Bot] Failed to send .inactive report:', err.message);
      }
      return;
    }

    // ==========================================
    // ADMIN COMMAND 6: .chatcount
    // ==========================================
    if (/^\.chatcount\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('chatcount', isAdmin, settings)) {
        console.log(`[Bot] Non-admin ${senderName} tried to use .chatcount in ${groupName}`);
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can view chat counts with *.chatcount*.\n💡 _Admins can enable member access in the Web Dashboard Settings._',
        }, { quoted: msg });
        return;
      }
      const leaderboard = database.getGroupLeaderboard(uid, groupJid, 50);
      const totalChats = leaderboard.reduce((sum, m) => sum + (m.chat_count || 0), 0);
      const mentions = [];

      let chatMsg = `📊 *MEMBER CHAT COUNTS*\n`;
      chatMsg += `👥 *Group:* ${groupName}\n`;
      chatMsg += `💬 *Total Messages Tracked:* ${totalChats.toLocaleString()}\n\n`;

      if (leaderboard.length === 0 || totalChats === 0) {
        chatMsg += `_No chat activity recorded yet for this group._`;
      } else {
        leaderboard.forEach((member, idx) => {
          const rank = idx + 1;
          const medal = rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : `${rank}. `;
          const phone = member.user_jid.split('@')[0];
          const displayName = member.user_name ? `${member.user_name} (@${phone})` : `@${phone}`;
          chatMsg += `${medal}${displayName}: *${(member.chat_count || 0).toLocaleString()} chats*\n`;
          mentions.push(member.user_jid);
        });

        if (isAdmin) {
          chatMsg += `\nUse *.resetchat* to reset counts._`;
        }
      }

      try {
        await sock.sendMessage(groupJid, {
          text: chatMsg,
          mentions,
        }, { quoted: msg });

        console.log(`[Bot] Chat count leaderboard sent in ${groupName}`);
        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'COMMAND_CHATCOUNT',
          details: `Requested group chat counts leaderboard`,
        });

        emitEvent('log:activity', {
          type: 'command_chatcount',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Checked chat count leaderboard`,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('[Bot] Failed to send .chatcount:', err.message);
      }
      return;
    }

    // ==========================================
    // ADMIN COMMAND 7: .resetchat [@user]
    // ==========================================
    if (/^\.resetchat\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('resetchat', isAdmin, settings)) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can reset chat counts.',
        }, { quoted: msg });
        return;
      }

      let targetJid = null;
      if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length > 0) {
        targetJid = contextInfo.mentionedJid[0];
      } else if (contextInfo?.participant) {
        targetJid = contextInfo.participant;
      } else {
        const phoneMatch = trimmedText.match(/\.resetchat\s+@?(\d{7,16})/i);
        if (phoneMatch && phoneMatch[1]) {
          targetJid = `${phoneMatch[1]}@s.whatsapp.net`;
        }
      }

      if (targetJid) {
        // Reset single member
        const phone = targetJid.split('@')[0];
        database.resetMemberChatCount(uid, groupJid, targetJid);

        await sock.sendMessage(groupJid, {
          text: `✅ Chat count for @${phone} has been reset to *0*.`,
          mentions: [targetJid],
        }, { quoted: msg });

        console.log(`[Bot] Admin ${senderName} reset chat count for ${targetJid} in ${groupName}`);
        emitEvent('chat:reset', { groupJid, userJid: targetJid });
        emitEvent('log:activity', {
          type: 'admin_reset_chat',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Admin reset chat count for @${phone}`,
          timestamp: Date.now(),
        });
      } else {
        // Reset entire group
        database.resetGroupChatCounts(uid, groupJid, groupName);

        await sock.sendMessage(groupJid, {
          text: `✅ Chat counts have been reset to *0* for all members in *${groupName}*.`,
        }, { quoted: msg });

        console.log(`[Bot] Admin ${senderName} reset all chat counts in ${groupName}`);
        emitEvent('chat:reset', { groupJid, userJid: null });
        emitEvent('log:activity', {
          type: 'admin_reset_group_chats',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Admin reset all chat counts in ${groupName}`,
          timestamp: Date.now(),
        });
      }
      return;
    }

    // ==========================================
    // IN-CHAT COMMAND: .blockeduser / .blockedusers / .blocked
    // ==========================================
    if (/^\.(blockeduser|blockedusers|blocked|listblock)\b/i.test(trimmedText)) {
      const blockedList = database.getBlockedMembers(uid, groupJid);
      if (blockedList.length === 0) {
        await sock.sendMessage(groupJid, {
          text: `📋 *No members are currently blocked in ${groupName}.*\n\n💡 _Use *.block @user* to block a member (auto-delete their messages)._`,
        }, { quoted: msg });
      } else {
        let listMsg = `🚫 *BLOCKED MEMBERS IN ${groupName.toUpperCase()}*\n`;
        listMsg += `_Messages from these members are automatically deleted by CapyBot._\n\n`;
        const mentions = [];
        blockedList.forEach((b, idx) => {
          const phone = b.user_jid.split('@')[0];
          const name = b.user_name ? `${b.user_name} (@${phone})` : `@${phone}`;
          listMsg += `${idx + 1}. ${name}\n`;
          mentions.push(b.user_jid);
        });
        if (isAdmin) {
          listMsg += `\n💡 _Use *.unblock @user* to remove a member from the block list._`;
        }

        await sock.sendMessage(groupJid, {
          text: listMsg,
          mentions,
        }, { quoted: msg });

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'COMMAND_BLOCKED_USERS',
          details: `Requested list of blocked members (${blockedList.length} blocked)`,
        });

        emitEvent('log:activity', {
          type: 'command_blocked_users',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Checked blocked members list (${blockedList.length} blocked)`,
          timestamp: Date.now(),
        });
      }
      return;
    }

    // ==========================================
    // ADMIN COMMAND 8: .block [@user]
    // ==========================================
    if (/^\.block\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('block', isAdmin, settings)) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can block users from sending messages.',
        }, { quoted: msg });
        return;
      }

      let targetJid = null;
      if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length > 0) {
        targetJid = contextInfo.mentionedJid[0];
      } else if (contextInfo?.participant) {
        targetJid = contextInfo.participant;
      } else {
        const phoneMatch = trimmedText.match(/\.block\s+@?(\d{7,16})/i);
        if (phoneMatch && phoneMatch[1]) {
          targetJid = `${phoneMatch[1]}@s.whatsapp.net`;
        }
      }

      if (!targetJid) {
        // List currently blocked members in this group
        const blockedList = database.getBlockedMembers(uid, groupJid);
        if (blockedList.length === 0) {
          await sock.sendMessage(groupJid, {
            text: `📋 *No members are currently blocked in ${groupName}.*\n\n💡 _Use *.block @user* to block a member (their messages will be auto-deleted)._`,
          }, { quoted: msg });
        } else {
          let listMsg = `🚫 *BLOCKED MEMBERS IN ${groupName.toUpperCase()}*\n`;
          listMsg += `_Messages from these members are automatically deleted by CapyBot._\n\n`;
          const mentions = [];
          blockedList.forEach((b, idx) => {
            const phone = b.user_jid.split('@')[0];
            const name = b.user_name ? `${b.user_name} (@${phone})` : `@${phone}`;
            listMsg += `${idx + 1}. ${name}\n`;
            mentions.push(b.user_jid);
          });
          listMsg += `\n💡 _Use *.unblock @user* to remove a member from the block list._`;

          await sock.sendMessage(groupJid, {
            text: listMsg,
            mentions,
          }, { quoted: msg });
        }
        return;
      }

      // Check if target is bot itself
      const botPhone = (sock.user?.id || '').split(':')[0].split('@')[0];
      const targetPhone = targetJid.split('@')[0];
      if (targetPhone === botPhone) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ You cannot block the bot account.',
        }, { quoted: msg });
        return;
      }

      // Check if target is an Admin
      if (isParticipantAdmin(groupMeta, targetJid)) {
        await sock.sendMessage(groupJid, {
          text: `⚠️ Cannot block @${targetPhone} because they are a Group Admin.`,
          mentions: [targetJid],
        }, { quoted: msg });
        return;
      }

      // Retrieve target display name from database if available
      const existingMember = database.getMember(uid, groupJid, targetJid);
      const targetName = existingMember?.user_name || null;

      database.blockMember(uid, groupJid, targetJid, targetName, senderJid);

      await sock.sendMessage(groupJid, {
        text: `🚫 *@${targetPhone} has been blocked.*\n\nAny messages they send in this group will be automatically deleted by CapyBot.\n\n💡 _Use *.unblock @${targetPhone}* to undo._`,
        mentions: [targetJid],
      }, { quoted: msg });

      console.log(`[Bot] Admin ${senderName} blocked member ${targetJid} in ${groupName}`);

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: targetJid,
        userName: targetName || targetPhone,
        actionType: 'ADMIN_BLOCK_MEMBER',
        details: `Admin ${senderName} blocked @${targetPhone} (auto-deletion active)`,
      });

      emitEvent('log:activity', {
        type: 'admin_block_member',
        groupJid,
        groupName,
        userJid: targetJid,
        userName: targetName || targetPhone,
        text: `Admin blocked member @${targetPhone}`,
        timestamp: Date.now(),
      });
      return;
    }

    // ==========================================
    // ADMIN COMMAND 9: .unblock [@user]
    // ==========================================
    if (/^\.unblock\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('unblock', isAdmin, settings)) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can unblock users.',
        }, { quoted: msg });
        return;
      }

      let targetJid = null;
      if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length > 0) {
        targetJid = contextInfo.mentionedJid[0];
      } else if (contextInfo?.participant) {
        targetJid = contextInfo.participant;
      } else {
        const phoneMatch = trimmedText.match(/\.unblock\s+@?(\d{7,16})/i);
        if (phoneMatch && phoneMatch[1]) {
          targetJid = `${phoneMatch[1]}@s.whatsapp.net`;
        }
      }

      if (!targetJid) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Please mention or reply to the user you want to unblock:\n*.unblock @user*',
        }, { quoted: msg });
        return;
      }

      const targetPhone = targetJid.split('@')[0];
      const isBlocked = database.isMemberBlocked(uid, groupJid, targetJid);

      if (!isBlocked) {
        await sock.sendMessage(groupJid, {
          text: `ℹ️ @${targetPhone} is not currently in the block list for this group.`,
          mentions: [targetJid],
        }, { quoted: msg });
        return;
      }

      database.unblockMember(uid, groupJid, targetJid);

      await sock.sendMessage(groupJid, {
        text: `✅ *@${targetPhone} has been unblocked.*\n\nTheir messages will no longer be deleted.`,
        mentions: [targetJid],
      }, { quoted: msg });

      console.log(`[Bot] Admin ${senderName} unblocked member ${targetJid} in ${groupName}`);

      database.logActivity(uid, {
        groupJid,
        groupName,
        userJid: targetJid,
        userName: targetPhone,
        actionType: 'ADMIN_UNBLOCK_MEMBER',
        details: `Admin ${senderName} unblocked @${targetPhone}`,
      });

      emitEvent('log:activity', {
        type: 'admin_unblock_member',
        groupJid,
        groupName,
        userJid: targetJid,
        userName: targetPhone,
        text: `Admin unblocked member @${targetPhone}`,
        timestamp: Date.now(),
      });
      return;
    }

    // ==========================================
    // ADMIN COMMAND 10: .close / .open (Restrict / Reopen Group Messaging)
    // ==========================================
    if (/^\.(close|tutup|lockgroup|grouplock)\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('close', isAdmin, settings)) {
        console.log(`[Bot] Non-admin ${senderName} tried to use .close in ${groupName}`);
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can change group messaging settings.',
        }, { quoted: msg });
        return;
      }

      if (!botAdminStatus) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Bot must be a Group Admin to modify group settings.',
        }, { quoted: msg });
        return;
      }

      try {
        await sock.groupSettingUpdate(groupJid, 'announcement');
        database.updateGroupSettings(uid, groupJid, { group_closed: 1 });

        const confirmMsg =
          `🔒 *GROUP CLOSED (ADMINS ONLY)* 🔒\n\n` +
          `Group settings have been updated. Only administrators can send messages now.\n\n` +
          `💡 _Type *.open* to reopen the group to all members._`;

        await sock.sendMessage(groupJid, { text: confirmMsg }, { quoted: msg });

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'ADMIN_GROUP_CLOSED',
          details: `Admin ${senderName} locked group messaging to admins only`,
        });

        emitEvent('log:activity', {
          type: 'admin_group_closed',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Admin closed group messaging to admins only`,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('[Bot] Failed to close group:', err.message);
        await sock.sendMessage(groupJid, {
          text: `⚠️ Failed to close group: ${err.message}`,
        }, { quoted: msg });
      }
      return;
    }

    if (/^\.(open|buka|unlockgroup)\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('open', isAdmin, settings)) {
        console.log(`[Bot] Non-admin ${senderName} tried to use .open in ${groupName}`);
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can change group messaging settings.',
        }, { quoted: msg });
        return;
      }

      if (!botAdminStatus) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Bot must be a Group Admin to modify group settings.',
        }, { quoted: msg });
        return;
      }

      try {
        await sock.groupSettingUpdate(groupJid, 'not_announcement');
        database.updateGroupSettings(uid, groupJid, { group_closed: 0 });

        const confirmMsg =
          `🔓 *GROUP OPENED (ALL MEMBERS)* 🔓\n\n` +
          `Group settings have been updated. All members can now send messages again.`;

        await sock.sendMessage(groupJid, { text: confirmMsg }, { quoted: msg });

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'ADMIN_GROUP_OPENED',
          details: `Admin ${senderName} opened group messaging to all members`,
        });

        emitEvent('log:activity', {
          type: 'admin_group_opened',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Admin opened group messaging to all members`,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('[Bot] Failed to open group:', err.message);
        await sock.sendMessage(groupJid, {
          text: `⚠️ Failed to open group: ${err.message}`,
        }, { quoted: msg });
      }
      return;
    }

    // ==========================================
    // ADMIN COMMAND 11: .add [phone number]
    // ==========================================
    if (/^\.(add|tambah|invite)\b/i.test(trimmedText)) {
      if (!canExecuteAdminCommand('add', isAdmin, settings)) {
        console.log(`[Bot] Non-admin ${senderName} tried to use .add in ${groupName}`);
        await sock.sendMessage(groupJid, {
          text: '⚠️ Only Group Admins can add new members.',
        }, { quoted: msg });
        return;
      }

      if (!botAdminStatus) {
        await sock.sendMessage(groupJid, {
          text: '⚠️ Bot must be a Group Admin to add new members.',
        }, { quoted: msg });
        return;
      }

      const rawInput = trimmedText.replace(/^\.(add|tambah|invite)\s*/i, '').trim();
      let cleanPhone = rawInput.replace(/[^\d]/g, '');

      // Normalize Indonesian local format 08... -> 628...
      if (cleanPhone.startsWith('08')) {
        cleanPhone = '62' + cleanPhone.slice(1);
      }

      // Validate phone number format (must be 9-15 digits, starting with non-zero country code)
      if (!cleanPhone || !/^[1-9]\d{8,14}$/.test(cleanPhone)) {
        await sock.sendMessage(groupJid, {
          text:
            `⚠️ *Format nomor telepon tidak valid!*\n\n` +
            `📌 Format yang benar: *area/country code + phone number* (tanpa +, spasi, atau tanda strip).\n` +
            `👉 *Contoh:* *.add 628123456789*`,
        }, { quoted: msg });
        return;
      }

      const targetJid = `${cleanPhone}@s.whatsapp.net`;

      // Check if target is already in the group
      const isAlreadyMember = groupMeta?.participants?.some((p) => {
        const pClean = p.id ? p.id.replace(/:.*@/, '@').split('@')[0] : '';
        return pClean === cleanPhone || p.id === targetJid;
      });

      if (isAlreadyMember) {
        await sock.sendMessage(groupJid, {
          text: `⚠️ Pengguna dengan nomor +${cleanPhone} sudah bergabung di grup ini!`,
        }, { quoted: msg });
        return;
      }

      try {
        const response = await sock.groupParticipantsUpdate(groupJid, [targetJid], 'add');
        invalidateGroupMetadataCache(groupJid);

        const status = response && response[0] ? String(response[0].status) : '200';

        if (status === '200') {
          await sock.sendMessage(groupJid, {
            text: `✅ *Berhasil menambahkan anggota baru!* 🎉\n\n👤 *Nomor:* +${cleanPhone}\n📌 *Grup:* ${groupName}`,
          }, { quoted: msg });

          database.logActivity(uid, {
            groupJid,
            groupName,
            userJid: targetJid,
            userName: cleanPhone,
            actionType: 'ADMIN_ADD_MEMBER',
            details: `Admin ${senderName} added +${cleanPhone} to ${groupName}`,
          });

          emitEvent('log:activity', {
            type: 'admin_add_member',
            groupJid,
            groupName,
            userJid: targetJid,
            userName: cleanPhone,
            text: `Admin added member +${cleanPhone}`,
            timestamp: Date.now(),
          });
        } else if (status === '403') {
          await sock.sendMessage(groupJid, {
            text: `⚠️ Tidak dapat menambahkan +${cleanPhone} secara langsung karena pengaturan privasi undangan grup WhatsApp pengguna tersebut. Silakan bagikan link undangan grup.`,
          }, { quoted: msg });
        } else if (status === '408') {
          await sock.sendMessage(groupJid, {
            text: `⚠️ Tidak dapat menambahkan +${cleanPhone} karena nomor tersebut baru saja keluar dari grup.`,
          }, { quoted: msg });
        } else if (status === '409') {
          await sock.sendMessage(groupJid, {
            text: `⚠️ Nomor +${cleanPhone} sudah berada di dalam grup ini.`,
          }, { quoted: msg });
        } else {
          await sock.sendMessage(groupJid, {
            text: `⚠️ Gagal menambahkan +${cleanPhone} (WhatsApp status code: ${status}).`,
          }, { quoted: msg });
        }
      } catch (err) {
        console.error(`[Bot] Failed to add participant ${cleanPhone}:`, err.message);
        await sock.sendMessage(groupJid, {
          text: `⚠️ Gagal menambahkan anggota: ${err.message}`,
        }, { quoted: msg });
      }
      return;
    }

    // ==========================================
    // 1. INCREMENT MEMBER CHAT COUNT
    // ==========================================
    const memberRecord = database.incrementChatCount(uid, groupJid, senderJid, senderName);

    // Save group name in settings if not present
    if (!settings.group_name && groupName) {
      database.updateGroupSettings(uid, groupJid, { group_name: groupName });
    }

    // Emit live stats update to Dashboard UI
    emitEvent('chat:counted', {
      groupJid,
      groupName,
      userJid: senderJid,
      userName: senderName,
      chatCount: memberRecord.chat_count,
      lastActive: memberRecord.last_active,
    });

    // ==========================================
    // 2. AUTOMATIC CHAT REMOVAL (Image Only or Text Only Mode)
    // ==========================================
    if (settings.auto_remove_chat) {
      if (isAdmin) {
        // Group Admin is exempt from auto-chat removal
      } else {
        const hasImg = hasImageMedia(msg);
        const mode = settings.auto_remove_mode || 'remove_image';

        if (mode === 'remove_image' && hasImg) {
          // Mode 1: Remove images automatically (Only text allowed)
          console.log(`[Bot] Auto-removed image from non-admin ${senderName} in ${groupName} (Text only allowed)`);

          try {
            await sock.sendMessage(groupJid, { delete: msg.key });
          } catch (delErr) {
            console.error('[Bot] Could not delete image message:', delErr.message);
          }

          if (settings.warn_user) {
            const userTag = `@${senderJid.split('@')[0]}`;
            const warnMsg = `⚠️ ${userTag}, photos, images and stickers are not allowed in this group! Only text messages are permitted.`;
            try {
              await sock.sendMessage(groupJid, {
                text: warnMsg,
                mentions: [senderJid],
              });
            } catch (wErr) {
              console.error('[Bot] Failed to send image removal warning:', wErr.message);
            }
          }

          database.logActivity(uid, {
            groupJid,
            groupName,
            userJid: senderJid,
            userName: senderName,
            actionType: 'AUTO_REMOVE_IMAGE',
            details: `Non-admin photo/image removed: text-only mode active in group`,
          });

          emitEvent('log:activity', {
            type: 'auto_remove_image',
            groupJid,
            groupName,
            userJid: senderJid,
            userName: senderName,
            text: `Removed image from ${senderName} (Text only allowed)`,
            timestamp: Date.now(),
          });

          return; // Stop further processing
        } else if (mode === 'remove_text' && isActualTextMessage(msg) && !hasImg) {
          // Mode 2: Remove text automatically (Only images allowed)
          console.log(`[Bot] Auto-removed text message from non-admin ${senderName} in ${groupName} (Images only allowed)`);

          try {
            await sock.sendMessage(groupJid, { delete: msg.key });
          } catch (delErr) {
            console.error('[Bot] Could not delete text message:', delErr.message);
          }

          if (settings.warn_user) {
            const userTag = `@${senderJid.split('@')[0]}`;
            const warnMsg = `⚠️ ${userTag}, text-only messages are not allowed in this group! Only photos/images are permitted.`;
            try {
              await sock.sendMessage(groupJid, {
                text: warnMsg,
                mentions: [senderJid],
              });
            } catch (wErr) {
              console.error('[Bot] Failed to send text removal warning:', wErr.message);
            }
          }

          database.logActivity(uid, {
            groupJid,
            groupName,
            userJid: senderJid,
            userName: senderName,
            actionType: 'AUTO_REMOVE_TEXT',
            details: `Non-admin text message removed: image-only mode active in group`,
          });

          emitEvent('log:activity', {
            type: 'auto_remove_text',
            groupJid,
            groupName,
            userJid: senderJid,
            userName: senderName,
            text: `Removed text message from ${senderName} (Images only allowed)`,
            timestamp: Date.now(),
          });

          return; // Stop further processing
        }
      }
    }

    // ==========================================
    // 3. CHECK FOR INSTAGRAM / TIKTOK LINKS
    // ==========================================
    const linkInfo = detectBlockedLinks(messageText);
    const shouldBlockInstagram = settings.block_instagram && linkInfo.hasInstagram;
    const shouldBlockTikTok = settings.block_tiktok && linkInfo.hasTikTok;

    if (shouldBlockInstagram || shouldBlockTikTok) {
      if (isAdmin) {
        // Group Admin is exempt from link blocking
        console.log(`[Bot] Link allowed for Group Admin: ${senderName} (${senderJid}) in ${groupName}`);
        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'LINK_ALLOWED_ADMIN',
          details: `Admin shared ${linkInfo.type} link: ${linkInfo.matchedLinks.join(', ')}`,
        });

        emitEvent('log:activity', {
          type: 'admin_link',
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          text: `Admin shared ${linkInfo.type} link: ${linkInfo.matchedLinks.join(', ')}`,
          timestamp: Date.now(),
        });
      } else {
        // Non-admin sent a blocked link!
        const blockedType = shouldBlockInstagram && shouldBlockTikTok
          ? 'Instagram & TikTok'
          : shouldBlockInstagram
            ? 'Instagram'
            : 'TikTok';

        console.log(`[Bot] Blocked ${blockedType} link from non-admin: ${senderName} in ${groupName}`);

        const actionType = shouldBlockInstagram && shouldBlockTikTok
          ? 'LINK_BLOCKED_BOTH'
          : shouldBlockInstagram
            ? 'LINK_BLOCKED_INSTAGRAM'
            : 'LINK_BLOCKED_TIKTOK';

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType,
          details: `Non-admin shared ${blockedType} link: ${linkInfo.matchedLinks.join(', ')}`,
        });

        // Delete the offending message if delete_links is enabled
        if (settings.delete_links) {
          try {
            await sock.sendMessage(groupJid, { delete: msg.key });
            console.log(`[Bot] Successfully deleted offending message ${msg.key.id}`);
          } catch (deleteErr) {
            console.error(`[Bot] Could not delete message (is bot group admin?):`, deleteErr.message);
          }
        }

        // Send a warning to the user if warn_user is enabled
        if (settings.warn_user) {
          const userTag = `@${senderJid.split('@')[0]}`;
          let warningText = settings.custom_warning ||
            `⚠️ ${userTag}, posting ${blockedType} links is not allowed in this group!`;
          warningText = warningText.replace('{user}', userTag);

          try {
            await sock.sendMessage(groupJid, {
              text: warningText,
              mentions: [senderJid],
            });
          } catch (warnErr) {
            console.error(`[Bot] Failed to send link warning message:`, warnErr.message);
          }
        }

        // Notify dashboard UI
        emitEvent('link:blocked', {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          linkType: blockedType,
          links: linkInfo.matchedLinks,
          timestamp: Date.now(),
        });

        // Stop further processing for blocked link messages
        return;
      }
    }

    // ==========================================
    // 3. AUTO-REPLY "HI"
    // ==========================================
    if (settings.auto_reply_hi && isHiGreeting(messageText)) {
      console.log(`[Bot] "Hi" greeting detected from ${senderName} in ${groupName}`);

      const userTag = `@${senderJid.split('@')[0]}`;
      const defaultReply = `Hi ${userTag}! 👋`;
      let replyText = settings.custom_reply || defaultReply;
      replyText = replyText.replace('{user}', userTag);

      try {
        await sock.sendMessage(
          groupJid,
          {
            text: replyText,
            mentions: [senderJid],
          },
          { quoted: msg }
        );

        database.logActivity(uid, {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          actionType: 'HI_REPLIED',
          details: `Auto-replied to "Hi" greeting`,
        });

        emitEvent('bot:replied', {
          groupJid,
          groupName,
          userJid: senderJid,
          userName: senderName,
          type: 'hi_reply',
          timestamp: Date.now(),
        });
      } catch (replyErr) {
        console.error(`[Bot] Failed to send "Hi" auto-reply:`, replyErr.message);
      }
    }
  } else if (!isGroup && !isFromMe) {
    // ==========================================
    // PRIVATE / DIRECT MESSAGE WORKFLOWS
    // ==========================================
    const remoteJid = msg.key.remoteJid;

    // 1. Private Chat .help
    if (/^\.(help|menu|commands|cmd)\b/i.test(trimmedText)) {
      let helpText = `🐾 *CAPYBOT (Direct AI Assistant)* 🐾\n\n`;
      helpText += `🤖 *ON-DEVICE AI (Qwen 3.5 Multimodal)*\n`;
      helpText += `• *.ask [question]* — Ask AI any question (send or reply to image for image recognition)\n\n`;
      helpText += `📌 *UTILITY COMMANDS*\n`;
      helpText += `• *.help* — Display this command menu\n`;
      helpText += `• *.about* — View Capybot V1.1 version & latest release info\n`;
      helpText += `• *.ping* — Check bot response latency & speed\n`;
      helpText += `• *.runtime* — View bot uptime & memory telemetry\n`;
      helpText += `• *.peek* — Reply to View Once image/video to reveal it\n`;
      helpText += `• *.sticker* (or *.s*) — Convert replied image into a WhatsApp sticker\n\n`;
      helpText += `💡 _Prefix all commands with a dot (.)_`;

      await sock.sendMessage(remoteJid, { text: helpText }, { quoted: msg });
      return;
    }

    // 2. Private Chat .about
    if (/^\.(about|info|version|v)\b/i.test(trimmedText)) {
      const uptimeSec = Math.floor(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = uptimeSec % 60;
      const uptimeStr = `${days > 0 ? `${days}d ` : ''}${hours}h ${mins}m ${secs}s`;

      let aboutText = `🐾 *CAPYBOT V1.1 (LATEST RELEASE)* 🐾\n`;
      aboutText += `_Your All-in-One WhatsApp Group Manager & On-Device AI_\n\n`;

      aboutText += `📦 *Version:* Capybot V1.1\n`;
      aboutText += `⚡ *AI Engine:* Qwen 3.5 On-Device Multimodal AI (0 API Keys Required)\n`;
      aboutText += `⏱️ *Uptime:* ${uptimeStr}\n`;
      aboutText += `🟢 *Status:* Online & Operational\n\n`;

      aboutText += `🚀 *WHAT'S NEW IN V1.1:*\n`;
      aboutText += `• 🤖 *.ask [question]* — Q&A + Multimodal Image Recognition (Qwen 3.5)\n`;
      aboutText += `• 📊 *.summarize* — AI summary of last 100 group messages\n`;
      aboutText += `• 👁️ *.peek* — Reveal & resend View Once ("one-time view") photos/videos\n`;
      aboutText += `• 💤 *.passive* — Show group members below chat threshold\n`;
      aboutText += `• ⚙️ *.passive set [number]* — Set passive threshold (Admin & Web Dashboard)\n`;
      aboutText += `• ⏱️ *.runtime* & *.ping* — Check bot uptime and latency\n`;
      aboutText += `• 🏷️ *.about* — Show version details and feature release notes\n\n`;

      aboutText += `🌐 *Web Admin Dashboard:* http://localhost:3000`;

      await sock.sendMessage(remoteJid, { text: aboutText }, { quoted: msg });
      return;
    }

    // 2. Private Chat .ping
    if (/^\.(ping|speed|latency)\b/i.test(trimmedText)) {
      const msgTimestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now();
      const latency = Math.max(0, Date.now() - msgTimestamp);
      const mem = process.memoryUsage();
      const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const rssMB = (mem.rss / 1024 / 1024).toFixed(1);

      let pingText = `🏓 *Pong!*\n\n`;
      pingText += `⚡ *Response Latency:* ${latency} ms\n`;
      pingText += `🖥️ *Memory Usage:* ${heapMB} MB / ${rssMB} MB\n`;
      pingText += `✨ *CapyBot Engine:* Active & Healthy`;

      await sock.sendMessage(remoteJid, { text: pingText }, { quoted: msg });
      return;
    }

    // 3. Private Chat .runtime
    if (/^\.(runtime|uptime)\b/i.test(trimmedText)) {
      const uptimeSec = Math.floor(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = uptimeSec % 60;
      const uptimeStr = `${days > 0 ? `${days}d ` : ''}${hours}h ${mins}m ${secs}s`;

      const mem = process.memoryUsage();
      const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
      const rssMB = (mem.rss / 1024 / 1024).toFixed(1);

      let runText = `⏱️ *BOT RUNTIME & SYSTEM TELEMETRY*\n\n`;
      runText += `• *Total Uptime:* ${uptimeStr}\n`;
      runText += `• *Bot Status:* 🟢 Online & Running\n`;
      runText += `• *Memory (Heap / RSS):* ${heapMB} MB / ${rssMB} MB\n`;
      runText += `• *Platform:* Node.js (${process.version}) on ${process.platform}`;

      await sock.sendMessage(remoteJid, { text: runText }, { quoted: msg });
      return;
    }

    // 4. Private Chat .peek
    if (isPeekCommand(trimmedText)) {
      const mediaInfo = extractViewOnceMedia(msg, contextInfo);
      if (!mediaInfo.isMedia || !mediaInfo.targetNode) {
        await sock.sendMessage(remoteJid, {
          text: '⚠️ Please reply to a View Once ("one time view") photo or video with *.peek* to reveal and resend it.',
        }, { quoted: msg });
        return;
      }

      try { await sock.sendPresenceUpdate('composing', remoteJid); } catch (pErr) { }

      try {
        const mediaBuffer = await downloadMediaBuffer(mediaInfo.targetNode, mediaInfo.mediaType);
        if (!mediaBuffer || mediaBuffer.length === 0) {
          throw new Error('Could not download View Once media.');
        }

        let caption = `👁️ *VIEW ONCE MEDIA REVEALED*\n`;
        if (mediaInfo.caption) {
          caption += `📝 *Caption:* ${mediaInfo.caption}\n`;
        }
        caption += `⚡ _Unlocked by CapyBot_`;

        if (mediaInfo.mediaType === 'video') {
          await sock.sendMessage(remoteJid, {
            video: mediaBuffer,
            caption,
            mimetype: mediaInfo.targetNode?.mimetype || 'video/mp4',
          }, { quoted: msg });
        } else if (mediaInfo.mediaType === 'audio') {
          await sock.sendMessage(remoteJid, {
            audio: mediaBuffer,
            mimetype: mediaInfo.targetNode?.mimetype || 'audio/mp4',
          }, { quoted: msg });
        } else {
          await sock.sendMessage(remoteJid, {
            image: mediaBuffer,
            caption,
            mimetype: mediaInfo.targetNode?.mimetype || 'image/jpeg',
          }, { quoted: msg });
        }
      } catch (peekErr) {
        console.error('[Bot] Private .peek error:', peekErr.message);
        await sock.sendMessage(remoteJid, { text: `⚠️ Failed to reveal View Once media: ${peekErr.message}` }, { quoted: msg });
      }
      return;
    }

    // 5. Private Chat .ask
    if (/^\.(ask|ai|tanya|qwen|janus)\b/i.test(trimmedText)) {
      const mediaInfo = extractMediaForSticker(msg, contextInfo);
      let question = trimmedText.replace(/^\.(ask|ai|tanya|qwen|janus)\s*/i, '').trim();

      if (!question && !mediaInfo.isImage) {
        await sock.sendMessage(remoteJid, {
          text: '⚠️ Please provide a question or reply to an image:\n• *.ask What is quantum computing?*\n• *.ask Describe this image* (reply to image)',
        }, { quoted: msg });
        return;
      }

      try { await sock.sendPresenceUpdate('composing', remoteJid); } catch (pErr) { }

      let imageBuffer = null;
      if (mediaInfo.isImage && mediaInfo.targetNode) {
        try {
          imageBuffer = await downloadMediaBuffer(mediaInfo.targetNode, mediaInfo.mediaType);
        } catch (imgErr) {
          console.warn('[Bot] Failed to download image for private .ask:', imgErr.message);
        }
      }

      try {
        const result = await aiService.askQuestion({
          prompt: question,
          imageBuffer,
          mimetype: mediaInfo.targetNode?.mimetype || 'image/jpeg',
          senderName,
        });

        await sock.sendMessage(remoteJid, { text: result.response }, { quoted: msg });
      } catch (aiErr) {
        console.error('[Bot] Private .ask error:', aiErr.message);
        await sock.sendMessage(remoteJid, { text: `⚠️ AI request failed: ${aiErr.message}` }, { quoted: msg });
      }
      return;
    }

    // 7. Private Chat .sticker
    if (isStickerCommand(trimmedText)) {
      const mediaInfo = extractMediaForSticker(msg, contextInfo);
      if (!mediaInfo.isImage || !mediaInfo.targetNode) {
        await sock.sendMessage(remoteJid, {
          text: '⚠️ Please reply to an image with *.sticker* or send an image with *.sticker* in the caption.',
        }, { quoted: msg });
        return;
      }

      try {
        const imageBuffer = await downloadMediaBuffer(mediaInfo.targetNode, mediaInfo.mediaType);
        const stickerWebp = await convertToStickerWebp(imageBuffer);
        await sock.sendMessage(remoteJid, { sticker: stickerWebp }, { quoted: msg });
      } catch (stickerErr) {
        console.error('[Bot] Failed to create private sticker:', stickerErr.message);
        await sock.sendMessage(remoteJid, { text: `⚠️ Failed to create sticker: ${stickerErr.message}` }, { quoted: msg });
      }
      return;
    }
  }
}

export default {
  handleIncomingMessage,
  extractMessageText,
  hasImageMedia,
  isReactionMessage,
  isSystemOrStubMessage,
  isActualTextMessage,
  getCachedGroupMetadata,
  invalidateGroupMetadataCache,
  isParticipantAdmin,
  isBotAdmin,
  canExecuteAdminCommand,
};

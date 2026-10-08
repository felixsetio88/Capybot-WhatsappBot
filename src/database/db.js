import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createDatabaseHelper(dbInstanceOrPath = null) {
  let db;
  if (dbInstanceOrPath && typeof dbInstanceOrPath === 'object') {
    db = dbInstanceOrPath;
  } else {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = dbInstanceOrPath || path.join(dataDir, 'bot.sqlite');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }

  // Initialize database schema (Base Tables)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      ai_enabled INTEGER NOT NULL DEFAULT 0,
      ai_prompted INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_login INTEGER
    );

    CREATE TABLE IF NOT EXISTS member_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      group_jid TEXT NOT NULL,
      user_jid TEXT NOT NULL,
      user_name TEXT,
      chat_count INTEGER NOT NULL DEFAULT 0,
      last_active INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      group_jid TEXT NOT NULL,
      group_name TEXT,
      block_instagram INTEGER DEFAULT 1,
      block_tiktok INTEGER DEFAULT 1,
      auto_reply_hi INTEGER DEFAULT 1,
      delete_links INTEGER DEFAULT 1,
      warn_user INTEGER DEFAULT 1,
      custom_warning TEXT,
      custom_reply TEXT,
      ai_enabled INTEGER DEFAULT 0,
      ai_image_gen_enabled INTEGER DEFAULT 1,
      passive_threshold INTEGER DEFAULT 5,
      allow_non_admin_commands INTEGER DEFAULT 0,
      allowed_non_admin_commands TEXT DEFAULT '',
      auto_remove_chat INTEGER DEFAULT 0,
      auto_remove_mode TEXT DEFAULT 'remove_image',
      group_closed INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      message_id TEXT,
      group_jid TEXT NOT NULL,
      sender_jid TEXT NOT NULL,
      sender_name TEXT,
      message_text TEXT NOT NULL,
      is_from_me INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      group_jid TEXT,
      group_name TEXT,
      user_jid TEXT,
      user_name TEXT,
      action_type TEXT NOT NULL,
      details TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocked_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      group_jid TEXT NOT NULL,
      user_jid TEXT NOT NULL,
      user_name TEXT,
      blocked_by TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, group_jid, user_jid)
    );

    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      model_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 1,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      image_base64 TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wordgame_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      group_jid TEXT NOT NULL,
      user_jid TEXT NOT NULL,
      user_name TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, group_jid, user_jid)
    );

    CREATE TABLE IF NOT EXISTS crash_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      crash_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      stack_trace TEXT,
      metadata TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_chat_sessions(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_chat_messages(session_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_wordgame_scores_rank ON wordgame_scores(user_id, group_jid, score DESC);
    CREATE INDEX IF NOT EXISTS idx_crash_logs_timestamp ON crash_logs(timestamp DESC);
  `);

  // Safe column migrations for pre-existing databases
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS crash_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      crash_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      stack_trace TEXT,
      metadata TEXT,
      timestamp INTEGER NOT NULL
    );`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_messages ADD COLUMN message_id TEXT;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_messages ADD COLUMN reply_to_jid TEXT;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_messages ADD COLUMN reply_to_name TEXT;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 0;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN ai_prompted INTEGER NOT NULL DEFAULT 0;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE member_chats ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_settings ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_settings ADD COLUMN ai_enabled INTEGER DEFAULT 0;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_settings ADD COLUMN ai_image_gen_enabled INTEGER DEFAULT 1;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_settings ADD COLUMN passive_threshold INTEGER DEFAULT 5;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_settings ADD COLUMN allow_non_admin_commands INTEGER DEFAULT 0;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_settings ADD COLUMN allowed_non_admin_commands TEXT DEFAULT '';`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_settings ADD COLUMN auto_remove_chat INTEGER DEFAULT 0;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_settings ADD COLUMN auto_remove_mode TEXT DEFAULT 'remove_image';`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_settings ADD COLUMN group_closed INTEGER DEFAULT 0;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_messages ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE activity_logs ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;`);
  } catch (e) { }

  try {
    db.exec(`ALTER TABLE group_settings ADD COLUMN game_language TEXT DEFAULT 'en';`);
  } catch (e) { }

  // Safe table schema migrations for legacy single-tenant databases
  try {
    const tableInfo = db.prepare("PRAGMA table_info(group_settings)").all();
    const groupJidCol = tableInfo.find(c => c.name === 'group_jid');
    if (groupJidCol && groupJidCol.pk > 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS group_settings_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL DEFAULT 1,
          group_jid TEXT NOT NULL,
          group_name TEXT,
          block_instagram INTEGER DEFAULT 1,
          block_tiktok INTEGER DEFAULT 1,
          auto_reply_hi INTEGER DEFAULT 1,
          delete_links INTEGER DEFAULT 1,
          warn_user INTEGER DEFAULT 1,
          custom_warning TEXT,
          custom_reply TEXT,
          ai_enabled INTEGER DEFAULT 0,
          ai_image_gen_enabled INTEGER DEFAULT 1,
          passive_threshold INTEGER DEFAULT 5,
          allow_non_admin_commands INTEGER DEFAULT 0,
          allowed_non_admin_commands TEXT DEFAULT '',
          auto_remove_chat INTEGER DEFAULT 0,
          auto_remove_mode TEXT DEFAULT 'remove_image',
          game_language TEXT DEFAULT 'en',
          updated_at INTEGER NOT NULL,
          UNIQUE(user_id, group_jid)
        );

        INSERT OR REPLACE INTO group_settings_v2 (
          user_id, group_jid, group_name, block_instagram, block_tiktok,
          auto_reply_hi, delete_links, warn_user, custom_warning, custom_reply,
          ai_enabled, ai_image_gen_enabled, passive_threshold,
          allow_non_admin_commands, allowed_non_admin_commands,
          auto_remove_chat, auto_remove_mode, game_language, updated_at
        )
        SELECT 
          COALESCE(user_id, 1), group_jid, group_name, block_instagram, block_tiktok,
          auto_reply_hi, delete_links, warn_user, custom_warning, custom_reply,
          COALESCE(ai_enabled, 0), COALESCE(ai_image_gen_enabled, 1), COALESCE(passive_threshold, 5),
          COALESCE(allow_non_admin_commands, 0), COALESCE(allowed_non_admin_commands, ''),
          COALESCE(auto_remove_chat, 0), COALESCE(auto_remove_mode, 'remove_image'),
          COALESCE(game_language, 'en'), updated_at
        FROM group_settings;

        DROP TABLE group_settings;
        ALTER TABLE group_settings_v2 RENAME TO group_settings;
      `);
    }
  } catch (e) { }

  try {
    const indexes = db.prepare("PRAGMA index_list(member_chats)").all();
    let hasOldUnique = false;
    for (const idx of indexes) {
      if (idx.unique) {
        const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all().map(c => c.name);
        if (cols.length === 2 && cols.includes('group_jid') && cols.includes('user_jid') && !cols.includes('user_id')) {
          hasOldUnique = true;
          break;
        }
      }
    }

    if (hasOldUnique) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS member_chats_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL DEFAULT 1,
          group_jid TEXT NOT NULL,
          user_jid TEXT NOT NULL,
          user_name TEXT,
          chat_count INTEGER NOT NULL DEFAULT 0,
          last_active INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(user_id, group_jid, user_jid)
        );

        INSERT OR REPLACE INTO member_chats_v2 (
          user_id, group_jid, user_jid, user_name, chat_count, last_active, created_at, updated_at
        )
        SELECT 
          COALESCE(user_id, 1), group_jid, user_jid, user_name, chat_count, last_active, created_at, updated_at
        FROM member_chats;

        DROP TABLE member_chats;
        ALTER TABLE member_chats_v2 RENAME TO member_chats;
      `);
    }
  } catch (e) { }

  // Create indices and unique constraints after columns are guaranteed to exist
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_member_chats_user_group_jid ON member_chats(user_id, group_jid, user_jid);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_group_settings_user_group_uniq ON group_settings(user_id, group_jid);
      CREATE INDEX IF NOT EXISTS idx_member_chats_user_group ON member_chats(user_id, group_jid);
      CREATE INDEX IF NOT EXISTS idx_member_chats_user_count ON member_chats(user_id, group_jid, chat_count DESC);
      CREATE INDEX IF NOT EXISTS idx_group_settings_user_group ON group_settings(user_id, group_jid);
      CREATE INDEX IF NOT EXISTS idx_group_messages_user_group ON group_messages(user_id, group_jid, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_blocked_members_group ON blocked_members(user_id, group_jid);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_ts ON activity_logs(user_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_group ON activity_logs(user_id, group_jid);
    `);
  } catch (e) { }

  // Prepared Statements - Users
  const stmtCreateUser = db.prepare(`
    INSERT INTO users (phone_number, password_hash, display_name, ai_enabled, ai_prompted, created_at, last_login)
    VALUES (@phone_number, @password_hash, @display_name, @ai_enabled, @ai_prompted, @created_at, @last_login)
  `);

  const stmtGetUserByPhone = db.prepare(`
    SELECT * FROM users WHERE phone_number = ? LIMIT 1
  `);

  const stmtGetUserById = db.prepare(`
    SELECT id, phone_number, display_name, ai_enabled, ai_prompted, created_at, last_login FROM users WHERE id = ? LIMIT 1
  `);

  const stmtUpdateUserLogin = db.prepare(`
    UPDATE users SET last_login = ? WHERE id = ?
  `);

  const stmtUpdateUserAiStatus = db.prepare(`
    UPDATE users SET
      ai_enabled = COALESCE(@ai_enabled, ai_enabled),
      ai_prompted = COALESCE(@ai_prompted, ai_prompted)
    WHERE id = @id
  `);

  const stmtGetAllUsers = db.prepare(`
    SELECT id, phone_number, display_name, ai_enabled, ai_prompted, created_at, last_login FROM users ORDER BY id ASC
  `);

  const stmtDeleteUser = db.prepare(`
    DELETE FROM users WHERE id = ?
  `);

  const stmtDeleteUserMemberChats = db.prepare(`
    DELETE FROM member_chats WHERE user_id = ?
  `);

  const stmtDeleteUserGroupSettings = db.prepare(`
    DELETE FROM group_settings WHERE user_id = ?
  `);

  const stmtDeleteUserBlockedMembers = db.prepare(`
    DELETE FROM blocked_members WHERE user_id = ?
  `);

  const stmtDeleteUserGroupMessages = db.prepare(`
    DELETE FROM group_messages WHERE user_id = ?
  `);

  const stmtDeleteUserActivityLogs = db.prepare(`
    DELETE FROM activity_logs WHERE user_id = ?
  `);

  const stmtDeleteUserAiSessions = db.prepare(`
    DELETE FROM ai_chat_sessions WHERE user_id = ?
  `);

  const stmtDeleteUserAiMessages = db.prepare(`
    DELETE FROM ai_chat_messages WHERE user_id = ?
  `);

  // Prepared Statements - Member Chats
  const stmtIncrementChat = db.prepare(`
    INSERT INTO member_chats (user_id, group_jid, user_jid, user_name, chat_count, last_active, created_at, updated_at)
    VALUES (@user_id, @group_jid, @user_jid, @user_name, 1, @now, @now, @now)
    ON CONFLICT(user_id, group_jid, user_jid) DO UPDATE SET
      chat_count = chat_count + 1,
      user_name = COALESCE(@user_name, member_chats.user_name),
      last_active = @now,
      updated_at = @now
  `);

  const stmtGetMember = db.prepare(`
    SELECT * FROM member_chats WHERE user_id = ? AND group_jid = ? AND user_jid = ?
  `);

  const stmtGetGroupLeaderboard = db.prepare(`
    SELECT id, user_id, group_jid, user_jid, user_name, chat_count, last_active, updated_at
    FROM member_chats
    WHERE user_id = ? AND group_jid = ?
    ORDER BY chat_count DESC, last_active DESC
    LIMIT ?
  `);

  const stmtResetMemberCount = db.prepare(`
    UPDATE member_chats
    SET chat_count = 0, updated_at = ?
    WHERE user_id = ? AND group_jid = ? AND user_jid = ?
  `);

  const stmtResetGroupCounts = db.prepare(`
    UPDATE member_chats
    SET chat_count = 0, updated_at = ?
    WHERE user_id = ? AND group_jid = ?
  `);

  // Prepared Statements - Group Settings
  const stmtGetGroupSettings = db.prepare(`
    SELECT * FROM group_settings WHERE user_id = ? AND group_jid = ?
  `);

  const stmtUpsertGroupSettings = db.prepare(`
    INSERT INTO group_settings (
      user_id, group_jid, group_name, block_instagram, block_tiktok,
      auto_reply_hi, delete_links, warn_user, custom_warning, custom_reply,
      ai_enabled, ai_image_gen_enabled, passive_threshold,
      allow_non_admin_commands, allowed_non_admin_commands,
      auto_remove_chat, auto_remove_mode, group_closed, updated_at
    )
    VALUES (
      @user_id, @group_jid, @group_name, @block_instagram, @block_tiktok,
      @auto_reply_hi, @delete_links, @warn_user, @custom_warning, @custom_reply,
      @ai_enabled, @ai_image_gen_enabled, @passive_threshold,
      @allow_non_admin_commands, @allowed_non_admin_commands,
      @auto_remove_chat, @auto_remove_mode, @group_closed, @updated_at
    )
    ON CONFLICT(user_id, group_jid) DO UPDATE SET
      group_name = COALESCE(@group_name, group_settings.group_name),
      block_instagram = COALESCE(@block_instagram, group_settings.block_instagram),
      block_tiktok = COALESCE(@block_tiktok, group_settings.block_tiktok),
      auto_reply_hi = COALESCE(@auto_reply_hi, group_settings.auto_reply_hi),
      delete_links = COALESCE(@delete_links, group_settings.delete_links),
      warn_user = COALESCE(@warn_user, group_settings.warn_user),
      custom_warning = COALESCE(@custom_warning, group_settings.custom_warning),
      custom_reply = COALESCE(@custom_reply, group_settings.custom_reply),
      ai_enabled = COALESCE(@ai_enabled, group_settings.ai_enabled),
      ai_image_gen_enabled = COALESCE(@ai_image_gen_enabled, group_settings.ai_image_gen_enabled),
      passive_threshold = COALESCE(@passive_threshold, group_settings.passive_threshold),
      allow_non_admin_commands = COALESCE(@allow_non_admin_commands, group_settings.allow_non_admin_commands),
      allowed_non_admin_commands = COALESCE(@allowed_non_admin_commands, group_settings.allowed_non_admin_commands),
      auto_remove_chat = COALESCE(@auto_remove_chat, group_settings.auto_remove_chat),
      auto_remove_mode = COALESCE(@auto_remove_mode, group_settings.auto_remove_mode),
      group_closed = COALESCE(@group_closed, group_settings.group_closed),
      updated_at = @updated_at
  `);

  // Prepared Statements - Group Messages
  const stmtFindGroupMessageById = db.prepare(`
    SELECT * FROM group_messages WHERE user_id = ? AND message_id = ? LIMIT 1
  `);

  const stmtSaveGroupMessage = db.prepare(`
    INSERT INTO group_messages (user_id, message_id, group_jid, sender_jid, sender_name, message_text, reply_to_jid, reply_to_name, is_from_me, timestamp)
    VALUES (@user_id, @message_id, @group_jid, @sender_jid, @sender_name, @message_text, @reply_to_jid, @reply_to_name, @is_from_me, @timestamp)
  `);

  // Prepared Statements - Word Game Scores
  const stmtAddWordGameScore = db.prepare(`
    INSERT INTO wordgame_scores (user_id, group_jid, user_jid, user_name, score, created_at, updated_at)
    VALUES (@user_id, @group_jid, @user_jid, @user_name, @score, @now, @now)
    ON CONFLICT(user_id, group_jid, user_jid) DO UPDATE SET
      score = score + @score,
      user_name = COALESCE(@user_name, wordgame_scores.user_name),
      updated_at = @now
  `);

  const stmtGetWordGameLeaderboard = db.prepare(`
    SELECT user_jid, user_name, score, updated_at
    FROM wordgame_scores
    WHERE user_id = ? AND group_jid = ? AND score > 0
    ORDER BY score DESC, updated_at ASC
    LIMIT ?
  `);

  const stmtGetWordGameUserScore = db.prepare(`
    SELECT score FROM wordgame_scores WHERE user_id = ? AND group_jid = ? AND user_jid = ?
  `);

  const stmtResetWordGameScores = db.prepare(`
    DELETE FROM wordgame_scores WHERE user_id = ? AND group_jid = ?
  `);

  const stmtDeleteUserWordGameScores = db.prepare(`
    DELETE FROM wordgame_scores WHERE user_id = ?
  `);

  // Prepared Statements - Crash Logs
  const stmtInsertCrashLog = db.prepare(`
    INSERT INTO crash_logs (user_id, crash_type, error_message, stack_trace, metadata, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const stmtGetCrashLogs = db.prepare(`
    SELECT * FROM crash_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?
  `);

  const stmtGetAllCrashLogs = db.prepare(`
    SELECT * FROM crash_logs ORDER BY timestamp DESC LIMIT ?
  `);

  const stmtClearCrashLogs = db.prepare(`
    DELETE FROM crash_logs WHERE user_id = ?
  `);

  const stmtClearAllCrashLogs = db.prepare(`
    DELETE FROM crash_logs
  `);

  const stmtGetCrashCount = db.prepare(`
    SELECT COUNT(*) as count FROM crash_logs WHERE user_id = ?
  `);

  const stmtGetAllCrashCount = db.prepare(`
    SELECT COUNT(*) as count FROM crash_logs
  `);

  const stmtDeleteUserCrashLogs = db.prepare(`
    DELETE FROM crash_logs WHERE user_id = ?
  `);

  // Prepared Statements - Activity Logs
  const stmtLogActivity = db.prepare(`
    INSERT INTO activity_logs (user_id, group_jid, group_name, user_jid, user_name, action_type, details, timestamp)
    VALUES (@user_id, @group_jid, @group_name, @user_jid, @user_name, @action_type, @details, @timestamp)
  `);

  const stmtGetRecentLogs = db.prepare(`
    SELECT * FROM activity_logs
    WHERE user_id = ?
    ORDER BY timestamp DESC, id DESC
    LIMIT ?
  `);

  const stmtGetRecentLogsByGroup = db.prepare(`
    SELECT * FROM activity_logs
    WHERE user_id = ? AND group_jid = ?
    ORDER BY timestamp DESC, id DESC
    LIMIT ?
  `);

  // Prepared Statements - Blocked Members (Auto-deletion)
  const stmtBlockMember = db.prepare(`
    INSERT INTO blocked_members (user_id, group_jid, user_jid, user_name, blocked_by, created_at)
    VALUES (@user_id, @group_jid, @user_jid, @user_name, @blocked_by, @created_at)
    ON CONFLICT(user_id, group_jid, user_jid) DO UPDATE SET
      user_name = COALESCE(@user_name, user_name),
      blocked_by = @blocked_by,
      created_at = @created_at
  `);

  const stmtUnblockMember = db.prepare(`
    DELETE FROM blocked_members WHERE user_id = ? AND group_jid = ? AND user_jid = ?
  `);

  const stmtIsMemberBlocked = db.prepare(`
    SELECT id FROM blocked_members WHERE user_id = ? AND group_jid = ? AND user_jid = ?
  `);

  const stmtGetBlockedMembers = db.prepare(`
    SELECT * FROM blocked_members WHERE user_id = ? AND group_jid = ? ORDER BY created_at DESC
  `);

  // Prepared Statements - KPI & Overview Aggregations
  const stmtGetTotalMessages = db.prepare(`
    SELECT COALESCE(SUM(chat_count), 0) as total FROM member_chats WHERE user_id = ?
  `);

  const stmtGetGroupMessageCount = db.prepare(`
    SELECT COALESCE(SUM(chat_count), 0) as total FROM member_chats WHERE user_id = ? AND group_jid = ?
  `);

  const stmtGetGroupMessagesCount = db.prepare(`
    SELECT COUNT(*) as total FROM group_messages WHERE user_id = ? AND group_jid = ?
  `);

  const stmtGetTotalGroups = db.prepare(`
    SELECT COUNT(DISTINCT group_jid) as total FROM member_chats WHERE user_id = ?
  `);

  const stmtGetTotalBlockedLinks = db.prepare(`
    SELECT COUNT(*) as total FROM activity_logs
    WHERE user_id = ? AND action_type LIKE 'LINK_BLOCKED_%'
  `);

  const stmtGetTopChatter = db.prepare(`
    SELECT user_jid, user_name, chat_count, group_jid
    FROM member_chats
    WHERE user_id = ?
    ORDER BY chat_count DESC
    LIMIT 1
  `);

  const stmtGetAllDistinctGroups = db.prepare(`
    SELECT 
      mc.group_jid,
      COALESCE(gs.group_name, mc.group_jid) as group_name,
      COUNT(mc.user_jid) as member_count,
      SUM(mc.chat_count) as total_messages,
      MAX(mc.last_active) as last_activity
    FROM member_chats mc
    LEFT JOIN group_settings gs ON (mc.user_id = gs.user_id AND mc.group_jid = gs.group_jid)
    WHERE mc.user_id = ?
    GROUP BY mc.group_jid
    ORDER BY total_messages DESC
  `);

  // Prepared Statements - AI Chatbot Sessions & Multi-Device Sync
  const stmtGetChatbotSessions = db.prepare(`
    SELECT * FROM ai_chat_sessions WHERE user_id = ? ORDER BY updated_at DESC
  `);

  const stmtGetChatbotMessages = db.prepare(`
    SELECT id, session_id, role, content, image_base64, created_at
    FROM ai_chat_messages
    WHERE user_id = ? AND session_id = ?
    ORDER BY created_at ASC, id ASC
  `);

  const stmtUpsertChatbotSession = db.prepare(`
    INSERT INTO ai_chat_sessions (id, user_id, title, model_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      model_id = excluded.model_id,
      updated_at = excluded.updated_at
  `);

  const stmtUpdateChatbotSessionTitle = db.prepare(`
    UPDATE ai_chat_sessions SET title = ?, updated_at = ? WHERE user_id = ? AND id = ?
  `);

  const stmtDeleteChatbotSession = db.prepare(`
    DELETE FROM ai_chat_sessions WHERE user_id = ? AND id = ?
  `);

  const stmtDeleteChatbotMessagesBySession = db.prepare(`
    DELETE FROM ai_chat_messages WHERE user_id = ? AND session_id = ?
  `);

  const stmtClearAllChatbotSessions = db.prepare(`
    DELETE FROM ai_chat_sessions WHERE user_id = ?
  `);

  const stmtClearAllChatbotMessages = db.prepare(`
    DELETE FROM ai_chat_messages WHERE user_id = ?
  `);

  const stmtInsertChatbotMessage = db.prepare(`
    INSERT INTO ai_chat_messages (session_id, user_id, role, content, image_base64, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const stmtTouchChatbotSession = db.prepare(`
    UPDATE ai_chat_sessions SET updated_at = ? WHERE user_id = ? AND id = ?
  `);

  return {
    raw: db,

    // ==========================================
    // USER AUTHENTICATION & MANAGEMENT
    // ==========================================
    createUser({ phoneNumber, passwordHash, displayName = null, aiEnabled = 0, aiPrompted = 0 }) {
      const now = Date.now();
      const result = stmtCreateUser.run({
        phone_number: String(phoneNumber).trim(),
        password_hash: passwordHash,
        display_name: displayName || null,
        ai_enabled: aiEnabled ? 1 : 0,
        ai_prompted: aiPrompted ? 1 : 0,
        created_at: now,
        last_login: now,
      });
      return this.getUserById(result.lastInsertRowid);
    },

    getUserByPhone(phoneNumber) {
      if (!phoneNumber) return null;
      return stmtGetUserByPhone.get(String(phoneNumber).trim()) || null;
    },

    getUserById(id) {
      if (!id) return null;
      return stmtGetUserById.get(Number(id)) || null;
    },

    getUserAIStatus(userId) {
      const user = this.getUserById(userId);
      if (!user) return { ai_enabled: false, ai_prompted: false };
      return {
        ai_enabled: Boolean(user.ai_enabled),
        ai_prompted: Boolean(user.ai_prompted),
      };
    },

    updateUserAIStatus(userId, { aiEnabled, aiPrompted }) {
      const uid = Number(userId);
      if (!uid) return false;
      stmtUpdateUserAiStatus.run({
        id: uid,
        ai_enabled: aiEnabled !== undefined ? (aiEnabled ? 1 : 0) : null,
        ai_prompted: aiPrompted !== undefined ? (aiPrompted ? 1 : 0) : null,
      });
      return true;
    },

    isAnyUserAIEnabled() {
      try {
        const row = db.prepare('SELECT COUNT(*) as count FROM users WHERE ai_enabled = 1').get();
        return (row?.count || 0) > 0;
      } catch (e) {
        return false;
      }
    },

    disableAllGroupSettingsAI(userId) {
      const uid = Number(userId) || 1;
      try {
        db.prepare('UPDATE group_settings SET ai_enabled = 0 WHERE user_id = ?').run(uid);
      } catch (e) { }
    },

    disableAllUsersAI() {
      try {
        db.prepare('UPDATE users SET ai_enabled = 0').run();
        db.prepare('UPDATE group_settings SET ai_enabled = 0').run();
        return true;
      } catch (e) {
        console.error('[DB] Error in disableAllUsersAI:', e.message);
        return false;
      }
    },

    updateUserLastLogin(id) {
      if (!id) return;
      stmtUpdateUserLogin.run(Date.now(), Number(id));
    },

    getAllUsers() {
      return stmtGetAllUsers.all();
    },

    deleteUser(userId) {
      const uid = Number(userId);
      if (!uid) return false;

      const deleteTx = db.transaction((id) => {
        stmtDeleteUserMemberChats.run(id);
        stmtDeleteUserGroupSettings.run(id);
        stmtDeleteUserBlockedMembers.run(id);
        stmtDeleteUserGroupMessages.run(id);
        stmtDeleteUserActivityLogs.run(id);
        stmtDeleteUserAiSessions.run(id);
        stmtDeleteUserAiMessages.run(id);
        stmtDeleteUserWordGameScores.run(id);
        stmtDeleteUserCrashLogs.run(id);
        const result = stmtDeleteUser.run(id);
        return result.changes > 0;
      });

      return deleteTx(uid);
    },

    // ==========================================
    // MEMBER CHAT TRACKING (Per User Account)
    // ==========================================
    incrementChatCount(userId = 1, groupJid, userJid, userName) {
      const now = Date.now();
      const uid = Number(userId) || 1;
      stmtIncrementChat.run({
        user_id: uid,
        group_jid: groupJid,
        user_jid: userJid,
        user_name: userName || null,
        now,
      });
      return this.getMember(uid, groupJid, userJid);
    },

    getMember(userId = 1, groupJid, userJid) {
      const uid = Number(userId) || 1;
      return stmtGetMember.get(uid, groupJid, userJid) || null;
    },

    getGroupLeaderboard(userId = 1, groupJid, limit = 100) {
      const uid = Number(userId) || 1;
      return stmtGetGroupLeaderboard.all(uid, groupJid, limit);
    },

    resetMemberChatCount(userId = 1, groupJid, userJid) {
      const now = Date.now();
      const uid = Number(userId) || 1;
      const result = stmtResetMemberCount.run(now, uid, groupJid, userJid);
      this.logActivity(uid, {
        groupJid,
        userJid,
        actionType: 'RESET_MEMBER_COUNT',
        details: `Chat count reset to 0 for user ${userJid}`,
      });
      return result.changes > 0;
    },

    resetGroupChatCounts(userId = 1, groupJid, groupName = null) {
      const now = Date.now();
      const uid = Number(userId) || 1;
      const result = stmtResetGroupCounts.run(now, uid, groupJid);
      this.logActivity(uid, {
        groupJid,
        groupName,
        actionType: 'RESET_GROUP_COUNT',
        details: `Chat counts reset for all members in group ${groupName || groupJid}`,
      });
      return result.changes;
    },

    // ==========================================
    // GROUP MODERATION SETTINGS (Per User Account)
    // ==========================================
    getGroupSettings(userId = 1, groupJid) {
      const uid = Number(userId) || 1;
      const defaultSettings = {
        user_id: uid,
        group_jid: groupJid,
        group_name: null,
        block_instagram: 1,
        block_tiktok: 1,
        auto_reply_hi: 1,
        delete_links: 1,
        warn_user: 1,
        custom_warning: null,
        custom_reply: null,
        ai_enabled: 0,
        ai_image_gen_enabled: 1,
        passive_threshold: 5,
        allow_non_admin_commands: 0,
        allowed_non_admin_commands: '',
        auto_remove_chat: 0,
        auto_remove_mode: 'remove_image',
        group_closed: 0,
        updated_at: Date.now(),
      };

      const row = stmtGetGroupSettings.get(uid, groupJid);
      return row ? { ...defaultSettings, ...row } : defaultSettings;
    },

    updateGroupSettings(userId = 1, groupJid, settings) {
      const uid = Number(userId) || 1;
      const current = this.getGroupSettings(uid, groupJid);
      const updated = {
        user_id: uid,
        group_jid: groupJid,
        group_name: settings.group_name !== undefined ? settings.group_name : current.group_name,
        block_instagram: settings.block_instagram !== undefined ? (settings.block_instagram ? 1 : 0) : current.block_instagram,
        block_tiktok: settings.block_tiktok !== undefined ? (settings.block_tiktok ? 1 : 0) : current.block_tiktok,
        auto_reply_hi: settings.auto_reply_hi !== undefined ? (settings.auto_reply_hi ? 1 : 0) : current.auto_reply_hi,
        delete_links: settings.delete_links !== undefined ? (settings.delete_links ? 1 : 0) : current.delete_links,
        warn_user: settings.warn_user !== undefined ? (settings.warn_user ? 1 : 0) : current.warn_user,
        custom_warning: settings.custom_warning !== undefined ? settings.custom_warning : current.custom_warning,
        custom_reply: settings.custom_reply !== undefined ? settings.custom_reply : current.custom_reply,
        ai_enabled: settings.ai_enabled !== undefined ? (settings.ai_enabled ? 1 : 0) : (current.ai_enabled ?? 0),
        ai_image_gen_enabled: settings.ai_image_gen_enabled !== undefined ? (settings.ai_image_gen_enabled ? 1 : 0) : (current.ai_image_gen_enabled ?? 1),
        passive_threshold: settings.passive_threshold !== undefined ? Number(settings.passive_threshold) : (current.passive_threshold ?? 5),
        allow_non_admin_commands: settings.allow_non_admin_commands !== undefined ? (settings.allow_non_admin_commands ? 1 : 0) : (current.allow_non_admin_commands ?? 0),
        allowed_non_admin_commands: settings.allowed_non_admin_commands !== undefined
          ? (Array.isArray(settings.allowed_non_admin_commands) ? settings.allowed_non_admin_commands.filter(Boolean).join(',') : String(settings.allowed_non_admin_commands).trim())
          : (current.allowed_non_admin_commands ?? ''),
        auto_remove_chat: settings.auto_remove_chat !== undefined ? (settings.auto_remove_chat ? 1 : 0) : (current.auto_remove_chat ?? 0),
        auto_remove_mode: settings.auto_remove_mode !== undefined ? String(settings.auto_remove_mode) : (current.auto_remove_mode || 'remove_image'),
        group_closed: settings.group_closed !== undefined ? (settings.group_closed ? 1 : 0) : (current.group_closed ?? 0),
        updated_at: Date.now(),
      };

      stmtUpsertGroupSettings.run(updated);
      this.logActivity(uid, {
        groupJid,
        groupName: updated.group_name,
        actionType: 'SETTINGS_UPDATED',
        details: `Settings updated: IG=${Boolean(updated.block_instagram)}, TikTok=${Boolean(updated.block_tiktok)}, AutoReply=${Boolean(updated.auto_reply_hi)}, AI=${Boolean(updated.ai_enabled)}, AutoRemove=${Boolean(updated.auto_remove_chat)} (${updated.auto_remove_mode})`,
      });
      return updated;
    },

    // ==========================================
    // GROUP CHAT MESSAGES (Per User Account)
    // ==========================================
    saveGroupMessage(userId = 1, { messageId = null, groupJid, senderJid, senderName, messageText, replyToJid = null, replyToName = null, isFromMe = 0, timestamp = Date.now() }) {
      if (!groupJid || !messageText) return null;
      const uid = Number(userId) || 1;

      if (messageId) {
        const existing = stmtFindGroupMessageById.get(uid, messageId);
        if (existing) return existing;
      }

      const result = stmtSaveGroupMessage.run({
        user_id: uid,
        message_id: messageId || null,
        group_jid: groupJid,
        sender_jid: senderJid || '',
        sender_name: senderName || null,
        message_text: messageText,
        reply_to_jid: replyToJid || null,
        reply_to_name: replyToName || null,
        is_from_me: isFromMe ? 1 : 0,
        timestamp,
      });

      return {
        id: result.lastInsertRowid,
        user_id: uid,
        message_id: messageId,
        group_jid: groupJid,
        sender_jid: senderJid,
        sender_name: senderName,
        message_text: messageText,
        reply_to_jid: replyToJid || null,
        reply_to_name: replyToName || null,
        is_from_me: isFromMe ? 1 : 0,
        timestamp,
      };
    },

    getGroupMessages(userId = 1, groupJid, options = {}) {
      if (!groupJid) return { messages: [], totalCount: 0, hasMore: false };
      const uid = Number(userId) || 1;

      const limit = typeof options === 'number' ? options : (parseInt(options.limit) || 50);
      const before = options.before ? Number(options.before) : null;
      const search = options.search ? String(options.search).trim() : null;

      let sql = `SELECT * FROM group_messages WHERE user_id = ? AND group_jid = ?`;
      const params = [uid, groupJid];

      if (before) {
        sql += ` AND timestamp < ?`;
        params.push(before);
      }

      if (search) {
        sql += ` AND (message_text LIKE ? OR sender_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }

      sql += ` ORDER BY timestamp DESC, id DESC LIMIT ?`;
      params.push(limit + 1);

      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);

      const hasMore = rows.length > limit;
      const resultRows = hasMore ? rows.slice(0, limit) : rows;

      // Total message count
      let countSql = `SELECT COUNT(*) as total FROM group_messages WHERE user_id = ? AND group_jid = ?`;
      const countParams = [uid, groupJid];
      if (search) {
        countSql += ` AND (message_text LIKE ? OR sender_name LIKE ?)`;
        countParams.push(`%${search}%`, `%${search}%`);
      }
      const totalCount = db.prepare(countSql).get(...countParams)?.total || 0;

      // Reverse to chronological order (oldest first)
      const chronological = [...resultRows].reverse();

      return {
        messages: chronological,
        totalCount,
        hasMore,
        oldestTimestamp: chronological.length > 0 ? chronological[0].timestamp : null,
      };
    },

    // ==========================================
    // ACTIVITY AUDIT LOGS (Per User Account)
    // ==========================================
    logActivity(userId = 1, { groupJid = null, groupName = null, userJid = null, userName = null, actionType, details = '' }) {
      const timestamp = Date.now();
      const uid = Number(userId) || 1;

      stmtLogActivity.run({
        user_id: uid,
        group_jid: groupJid,
        group_name: groupName,
        user_jid: userJid,
        user_name: userName,
        action_type: actionType,
        details,
        timestamp,
      });

      return {
        user_id: uid,
        group_jid: groupJid,
        group_name: groupName,
        user_jid: userJid,
        user_name: userName,
        action_type: actionType,
        details,
        timestamp,
      };
    },

    getRecentLogs(userId = 1, limit = 100, groupJid = null) {
      const uid = Number(userId) || 1;
      if (groupJid) {
        return stmtGetRecentLogsByGroup.all(uid, groupJid, limit);
      }
      return stmtGetRecentLogs.all(uid, limit);
    },

    // ==========================================
    // BLOCKED MEMBERS (Auto-deletion per group)
    // ==========================================
    blockMember(userId = 1, groupJid, userJid, userName = null, blockedBy = null) {
      const uid = Number(userId) || 1;
      const now = Date.now();
      stmtBlockMember.run({
        user_id: uid,
        group_jid: groupJid,
        user_jid: userJid,
        user_name: userName || null,
        blocked_by: blockedBy || null,
        created_at: now,
      });
      return true;
    },

    unblockMember(userId = 1, groupJid, userJid) {
      const uid = Number(userId) || 1;
      const result = stmtUnblockMember.run(uid, groupJid, userJid);
      return result.changes > 0;
    },

    isMemberBlocked(userId = 1, groupJid, userJid) {
      const uid = Number(userId) || 1;
      const row = stmtIsMemberBlocked.get(uid, groupJid, userJid);
      return Boolean(row);
    },

    getBlockedMembers(userId = 1, groupJid) {
      const uid = Number(userId) || 1;
      return stmtGetBlockedMembers.all(uid, groupJid);
    },

    // ==========================================
    // AGGREGATIONS & METRICS (Per User Account)
    // ==========================================
    getAllGroups(userId = 1) {
      const uid = Number(userId) || 1;
      return stmtGetAllDistinctGroups.all(uid);
    },

    getGroupTotalMessages(userId = 1, groupJid) {
      const uid = Number(userId) || 1;
      if (!groupJid) return 0;
      const countA = stmtGetGroupMessageCount.get(uid, groupJid)?.total || 0;
      const countB = stmtGetGroupMessagesCount.get(uid, groupJid)?.total || 0;
      return Math.max(countA, countB);
    },

    getStatsSummary(userId = 1) {
      const uid = Number(userId) || 1;
      const totalMessages = stmtGetTotalMessages.get(uid)?.total || 0;
      const totalGroups = stmtGetTotalGroups.get(uid)?.total || 0;
      const totalBlockedLinks = stmtGetTotalBlockedLinks.get(uid)?.total || 0;
      const topChatter = stmtGetTopChatter.get(uid) || null;

      return {
        totalMessages,
        totalGroups,
        totalBlockedLinks,
        topChatter,
      };
    },

    // ==========================================
    // AI CHATBOT SESSIONS & MULTI-DEVICE SYNC
    // ==========================================
    getChatbotSessions(userId = 1) {
      const uid = Number(userId) || 1;
      const sessions = stmtGetChatbotSessions.all(uid);
      return sessions.map((s) => ({
        id: s.id,
        title: s.title,
        modelId: s.model_id,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        messages: stmtGetChatbotMessages.all(uid, s.id).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          imageBase64: m.image_base64,
          createdAt: m.created_at,
        })),
      }));
    },

    saveChatbotSession(userId = 1, session) {
      const uid = Number(userId) || 1;
      if (!session || !session.id) return false;
      const now = Date.now();
      stmtUpsertChatbotSession.run(
        session.id,
        uid,
        session.title || 'New Conversation',
        session.modelId || 'qwen-3.5-0.8b-q4',
        session.createdAt || now,
        session.updatedAt || now
      );
      return true;
    },

    updateChatbotSessionTitle(userId = 1, sessionId, title) {
      const uid = Number(userId) || 1;
      const now = Date.now();
      return stmtUpdateChatbotSessionTitle.run(title, now, uid, sessionId).changes > 0;
    },

    deleteChatbotSession(userId = 1, sessionId) {
      const uid = Number(userId) || 1;
      stmtDeleteChatbotMessagesBySession.run(uid, sessionId);
      return stmtDeleteChatbotSession.run(uid, sessionId).changes > 0;
    },

    clearAllChatbotSessions(userId = 1) {
      const uid = Number(userId) || 1;
      stmtClearAllChatbotMessages.run(uid);
      stmtClearAllChatbotSessions.run(uid);
      return true;
    },

    saveChatbotMessage(userId = 1, sessionId, msg) {
      const uid = Number(userId) || 1;
      if (!sessionId || !msg) return null;
      const now = msg.createdAt || Date.now();
      const info = stmtInsertChatbotMessage.run(
        sessionId,
        uid,
        msg.role || 'user',
        msg.content || '',
        msg.imageBase64 || null,
        now
      );
      stmtTouchChatbotSession.run(now, uid, sessionId);
      return { id: info.lastInsertRowid, ...msg, createdAt: now };
    },

    // ==========================================
    // INTERACTIVE COMMANDS: WORDGAME & MATCH
    // ==========================================
    addWordGameScore(userId = 1, groupJid, userJid, userName = null, points = 1) {
      if (!groupJid || !userJid) return null;
      const uid = Number(userId) || 1;
      const now = Date.now();
      stmtAddWordGameScore.run({
        user_id: uid,
        group_jid: groupJid,
        user_jid: userJid,
        user_name: userName || null,
        score: Number(points) || 1,
        now,
      });
      return this.getWordGameUserScore(uid, groupJid, userJid);
    },

    getWordGameLeaderboard(userId = 1, groupJid, limit = 10) {
      if (!groupJid) return [];
      const uid = Number(userId) || 1;
      return stmtGetWordGameLeaderboard.all(uid, groupJid, Math.min(Number(limit) || 10, 50));
    },

    getWordGameUserScore(userId = 1, groupJid, userJid) {
      if (!groupJid || !userJid) return 0;
      const uid = Number(userId) || 1;
      const row = stmtGetWordGameUserScore.get(uid, groupJid, userJid);
      return row ? row.score : 0;
    },

    resetWordGameScores(userId = 1, groupJid) {
      if (!groupJid) return false;
      const uid = Number(userId) || 1;
      stmtResetWordGameScores.run(uid, groupJid);
      return true;
    },

    getTopReplyPartner(userId = 1, groupJid, userJid) {
      if (!groupJid || !userJid) return null;
      const uid = Number(userId) || 1;

      // 1. Check explicit quote / reply references
      try {
        const directReply = db.prepare(`
          SELECT reply_to_jid, reply_to_name, COUNT(*) as reply_count
          FROM group_messages
          WHERE user_id = ? AND group_jid = ? AND sender_jid = ? AND reply_to_jid IS NOT NULL AND reply_to_jid != ? AND reply_to_jid != ''
          GROUP BY reply_to_jid
          ORDER BY reply_count DESC, MAX(timestamp) DESC
          LIMIT 1
        `).get(uid, groupJid, userJid, userJid);

        if (directReply && directReply.reply_to_jid) {
          return {
            partnerJid: directReply.reply_to_jid,
            partnerName: directReply.reply_to_name || directReply.reply_to_jid.split('@')[0],
            replyCount: directReply.reply_count,
            type: 'quote_reply',
          };
        }
      } catch (e) { }

      // 2. Conversational proximity: sequence of messages sent in the group
      try {
        const proximityReply = db.prepare(`
          WITH msg_seq AS (
            SELECT sender_jid, sender_name, timestamp,
                   LAG(sender_jid) OVER (ORDER BY timestamp ASC, id ASC) as prev_jid,
                   LAG(sender_name) OVER (ORDER BY timestamp ASC, id ASC) as prev_name
            FROM group_messages
            WHERE user_id = ? AND group_jid = ?
          )
          SELECT prev_jid, prev_name, COUNT(*) as reply_count
          FROM msg_seq
          WHERE sender_jid = ? AND prev_jid IS NOT NULL AND prev_jid != ? AND prev_jid != ''
          GROUP BY prev_jid
          ORDER BY reply_count DESC
          LIMIT 1
        `).get(uid, groupJid, userJid, userJid);

        if (proximityReply && proximityReply.prev_jid) {
          return {
            partnerJid: proximityReply.prev_jid,
            partnerName: proximityReply.prev_name || proximityReply.prev_jid.split('@')[0],
            replyCount: proximityReply.reply_count,
            type: 'conversational_thread',
          };
        }
      } catch (e) { }

      return null;
    },

    // ==========================================
    // CRASH LOGS & SYSTEM HEALTH
    // ==========================================
    recordCrashLog({ userId = 1, crashType, errorMessage, stackTrace = '', metadata = null, timestamp = null }) {
      const uid = Number(userId) || 1;
      const ts = timestamp || Date.now();
      const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || null);
      const result = stmtInsertCrashLog.run(
        uid,
        crashType || 'uncaught_exception',
        String(errorMessage || 'Unknown system crash'),
        String(stackTrace || ''),
        metaStr,
        ts
      );
      return {
        id: result.lastInsertRowid,
        userId: uid,
        crashType: crashType || 'uncaught_exception',
        errorMessage: String(errorMessage || 'Unknown system crash'),
        stackTrace: String(stackTrace || ''),
        metadata: metaStr,
        timestamp: ts,
      };
    },

    getCrashLogs(userId = null, limit = 50) {
      const lim = Math.max(1, Math.min(Number(limit) || 50, 200));
      const parseRow = (row) => {
        let parsedMeta = null;
        if (row.metadata) {
          try {
            parsedMeta = JSON.parse(row.metadata);
          } catch (e) {
            parsedMeta = { raw: row.metadata };
          }
        }
        return {
          ...row,
          parsedMetadata: parsedMeta,
        };
      };

      if (userId !== null && userId !== undefined) {
        const uid = Number(userId) || 1;
        return stmtGetCrashLogs.all(uid, lim).map(parseRow);
      }
      return stmtGetAllCrashLogs.all(lim).map(parseRow);
    },

    clearCrashLogs(userId = null) {
      if (userId !== null && userId !== undefined) {
        const uid = Number(userId) || 1;
        const res = stmtClearCrashLogs.run(uid);
        return res.changes;
      }
      const res = stmtClearAllCrashLogs.run();
      return res.changes;
    },

    getCrashCount(userId = null) {
      if (userId !== null && userId !== undefined) {
        const uid = Number(userId) || 1;
        const row = stmtGetCrashCount.get(uid);
        return row ? row.count : 0;
      }
      const row = stmtGetAllCrashCount.get();
      return row ? row.count : 0;
    },
  };
}

export const database = createDatabaseHelper();
export default database;

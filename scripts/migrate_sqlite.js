import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'bot.sqlite');
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);
console.log(`Database connected at: ${dbPath}`);

// 1. Migrate group_settings
try {
  const tableInfo = db.prepare('PRAGMA table_info(group_settings)').all();
  const groupJidCol = tableInfo.find((c) => c.name === 'group_jid');
  if (groupJidCol && groupJidCol.pk > 0) {
    console.log('Migrating group_settings to remove legacy PRIMARY KEY...');
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
        auto_remove_chat, auto_remove_mode, updated_at
      )
      SELECT 
        COALESCE(user_id, 1), group_jid, group_name, block_instagram, block_tiktok,
        auto_reply_hi, delete_links, warn_user, custom_warning, custom_reply,
        COALESCE(ai_enabled, 0), COALESCE(ai_image_gen_enabled, 1), COALESCE(passive_threshold, 5),
        COALESCE(allow_non_admin_commands, 0), COALESCE(allowed_non_admin_commands, ''),
        COALESCE(auto_remove_chat, 0), COALESCE(auto_remove_mode, 'remove_image'),
        updated_at
      FROM group_settings;

      DROP TABLE group_settings;
      ALTER TABLE group_settings_v2 RENAME TO group_settings;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_group_settings_user_group_uniq ON group_settings(user_id, group_jid);
      CREATE INDEX IF NOT EXISTS idx_group_settings_user_group ON group_settings(user_id, group_jid);
    `);
    console.log('✅ group_settings migrated successfully!');
  } else {
    console.log('✅ group_settings already has modern schema.');
  }
} catch (e) {
  console.error('group_settings migration notice:', e.message);
}

// 2. Migrate member_chats
try {
  const indexes = db.prepare('PRAGMA index_list(member_chats)').all();
  let hasOldUnique = false;
  for (const idx of indexes) {
    if (idx.unique) {
      const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all().map((c) => c.name);
      if (cols.length === 2 && cols.includes('group_jid') && cols.includes('user_jid') && !cols.includes('user_id')) {
        hasOldUnique = true;
        break;
      }
    }
  }

  if (hasOldUnique) {
    console.log('Migrating member_chats to multi-tenant schema...');
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
      CREATE UNIQUE INDEX IF NOT EXISTS idx_member_chats_user_group_jid ON member_chats(user_id, group_jid, user_jid);
      CREATE INDEX IF NOT EXISTS idx_member_chats_user_group ON member_chats(user_id, group_jid);
      CREATE INDEX IF NOT EXISTS idx_member_chats_user_count ON member_chats(user_id, group_jid, chat_count DESC);
    `);
    console.log('✅ member_chats migrated successfully!');
  } else {
    console.log('✅ member_chats already has modern schema.');
  }
} catch (e) {
  console.error('member_chats migration notice:', e.message);
}

// 3. Delete stale users 1 and 6 so only user 9 runs
try {
  const users = db.prepare('SELECT id, phone_number FROM users').all();
  console.log('Current users in DB:', users);
  const hasUser9 = users.some((u) => u.id === 9);
  if (hasUser9) {
    db.exec('DELETE FROM users WHERE id IN (1, 6)');
    console.log('✅ Removed stale background users 1 & 6.');
  }
} catch (e) {
  console.error('User cleanup notice:', e.message);
}

db.close();
console.log('🎉 All migrations completed successfully!');

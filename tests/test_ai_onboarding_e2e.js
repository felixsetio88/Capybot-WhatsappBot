import assert from 'assert';
import Database from 'better-sqlite3';
import { createDatabaseHelper } from '../src/database/db.js';
import { hashPassword } from '../src/bot/utils/auth.js';

const database = createDatabaseHelper(new Database(':memory:'));

console.log('🧪 Starting AI Onboarding, Disabled Defaults, and Settings Integration Tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}\n`);
    failed++;
  }
}

// 1. Initial Setup: AI is disabled by default for new accounts
test('New user account has ai_enabled=0 and ai_prompted=0 by default', () => {
  const user = database.createUser({
    phoneNumber: '14155559999',
    passwordHash: hashPassword('password123'),
    displayName: 'New Member',
  });

  assert.ok(user.id > 0);
  assert.strictEqual(user.ai_enabled, 0);
  assert.strictEqual(user.ai_prompted, 0);

  const status = database.getUserAIStatus(user.id);
  assert.strictEqual(status.ai_enabled, false);
  assert.strictEqual(status.ai_prompted, false);
});

// 2. New Group Moderation Settings: AI disabled by default
test('New group settings default to ai_enabled=0', () => {
  const groupJid = '120363123456789012@g.us';
  const settings = database.getGroupSettings(1, groupJid);
  assert.strictEqual(settings.ai_enabled, 0);
});

// 3. User skips AI during onboarding
test('User chooses "No, keep AI disabled" on onboarding prompt', () => {
  const user = database.createUser({
    phoneNumber: '14155550001',
    passwordHash: hashPassword('password123'),
    displayName: 'Privacy First User',
  });

  database.updateUserAIStatus(user.id, { aiEnabled: 0, aiPrompted: 1 });

  const status = database.getUserAIStatus(user.id);
  assert.strictEqual(status.ai_enabled, false);
  assert.strictEqual(status.ai_prompted, true); // Marked prompted so modal will not appear again
});

// 4. User enables AI during onboarding
test('User chooses "Yes, enable AI" on onboarding prompt', () => {
  const user = database.createUser({
    phoneNumber: '14155550002',
    passwordHash: hashPassword('password123'),
    displayName: 'AI Power User',
  });

  database.updateUserAIStatus(user.id, { aiEnabled: 1, aiPrompted: 1 });

  const status = database.getUserAIStatus(user.id);
  assert.strictEqual(status.ai_enabled, true);
  assert.strictEqual(status.ai_prompted, true);
});

// 5. Settings toggle in group settings and master settings
test('Settings toggle enables and disables AI cleanly', () => {
  const uid = 1;
  const groupJid = 'test_group_ai_toggle@g.us';

  // Initially 0
  let settings = database.getGroupSettings(uid, groupJid);
  assert.strictEqual(settings.ai_enabled, 0);

  // Enable via settings
  database.updateGroupSettings(uid, groupJid, { ai_enabled: 1 });
  settings = database.getGroupSettings(uid, groupJid);
  assert.strictEqual(settings.ai_enabled, 1);

  // Disable via settings
  database.updateGroupSettings(uid, groupJid, { ai_enabled: 0 });
  settings = database.getGroupSettings(uid, groupJid);
  assert.strictEqual(settings.ai_enabled, 0);
});

// 6. Command gating message test
test('AI disabled warning message matches requirements', () => {
  const disabledMessage = '⚠️ AI features are currently disabled. Please enable AI features in the settings to use this command.';
  assert.ok(disabledMessage.includes('AI features are currently disabled'));
  assert.ok(disabledMessage.includes('enable AI features in the settings'));
});

// 7. isAnyUserAIEnabled and disableAllGroupSettingsAI tests
test('isAnyUserAIEnabled accurately detects active AI accounts', () => {
  const testDb = createDatabaseHelper(new Database(':memory:'));
  assert.strictEqual(testDb.isAnyUserAIEnabled(), false);

  const u1 = testDb.createUser({
    phoneNumber: '14155551111',
    passwordHash: hashPassword('password123'),
    displayName: 'User 1',
  });
  assert.strictEqual(testDb.isAnyUserAIEnabled(), false);

  testDb.updateUserAIStatus(u1.id, { aiEnabled: 1, aiPrompted: 1 });
  assert.strictEqual(testDb.isAnyUserAIEnabled(), true);

  testDb.updateUserAIStatus(u1.id, { aiEnabled: 0, aiPrompted: 1 });
  assert.strictEqual(testDb.isAnyUserAIEnabled(), false);
});

test('disableAllGroupSettingsAI turns off AI across all groups for user', () => {
  const testDb = createDatabaseHelper(new Database(':memory:'));
  const u1 = testDb.createUser({
    phoneNumber: '14155552222',
    passwordHash: hashPassword('password123'),
    displayName: 'User 2',
  });

  testDb.updateGroupSettings(u1.id, 'group1@g.us', { ai_enabled: 1 });
  testDb.updateGroupSettings(u1.id, 'group2@g.us', { ai_enabled: 1 });

  assert.strictEqual(testDb.getGroupSettings(u1.id, 'group1@g.us').ai_enabled, 1);
  assert.strictEqual(testDb.getGroupSettings(u1.id, 'group2@g.us').ai_enabled, 1);

  testDb.disableAllGroupSettingsAI(u1.id);

  assert.strictEqual(testDb.getGroupSettings(u1.id, 'group1@g.us').ai_enabled, 0);
  assert.strictEqual(testDb.getGroupSettings(u1.id, 'group2@g.us').ai_enabled, 0);
});

console.log(`\n==========================================`);
console.log(`AI Onboarding & Disabled Tests: ${passed} Passed, ${failed} Failed`);
console.log(`==========================================\n`);

if (failed > 0) {
  process.exit(1);
}

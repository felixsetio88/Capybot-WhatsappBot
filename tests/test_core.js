import assert from 'assert';
import Database from 'better-sqlite3';
import { createDatabaseHelper } from '../src/database/db.js';
import { detectBlockedLinks, isHiGreeting } from '../src/bot/utils/linkDetector.js';
import { isParticipantAdmin, extractMessageText, canExecuteAdminCommand } from '../src/bot/handlers/messageHandler.js';
import {
  isStickerCommand,
  extractMediaForSticker,
  extractViewOnceMedia,
  isPeekCommand,
  convertToStickerWebp,
} from '../src/bot/utils/stickerConverter.js';
import {
  hashPassword,
  verifyPassword,
  formatPhoneNumber,
  createAuthToken,
  verifyAuthToken,
} from '../src/bot/utils/auth.js';
import { runAITests } from './test_ai.js';
import { runAutoRemoveTests } from './test_auto_remove.js';

// Use isolated in-memory database so tests never touch production data
const database = createDatabaseHelper(new Database(':memory:'));

let passedTests = 0;
let failedTests = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}\n`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('🧪 Starting WhatsApp Bot Unit & Integration Tests...\n');

  // ==========================================
  // 1. AUTHENTICATION & MULTI-USER SECURITY
  // ==========================================
  console.log('--- 1. Authentication & Multi-User Security Tests ---');

  await runTest('Format phone numbers cleanly', () => {
    assert.strictEqual(formatPhoneNumber('+60 12-345 6789'), '60123456789');
    assert.strictEqual(formatPhoneNumber('(1415) 555-2671'), '14155552671');
    assert.strictEqual(formatPhoneNumber('60123456789'), '60123456789');
  });

  await runTest('Password hashing and verification with scrypt salt', () => {
    const password = 'mySecretPassword123';
    const hash = hashPassword(password);
    assert.ok(hash.includes(':'));

    // Correct password
    assert.strictEqual(verifyPassword(password, hash), true);
    // Wrong password
    assert.strictEqual(verifyPassword('wrongPassword', hash), false);
  });

  await runTest('Create and verify secure signed auth tokens', () => {
    const token = createAuthToken({ userId: 42, phoneNumber: '60123456789' });
    assert.ok(typeof token === 'string');

    const decoded = verifyAuthToken(token);
    assert.strictEqual(decoded.userId, 42);
    assert.strictEqual(decoded.phoneNumber, '60123456789');
    assert.ok(decoded.exp > Date.now());

    // Invalid token
    assert.strictEqual(verifyAuthToken('invalid.tampered.token'), null);
  });

  await runTest('Create users in SQLite and query by phone / ID', () => {
    const user1 = database.createUser({
      phoneNumber: '6011111111',
      passwordHash: hashPassword('pass123'),
      displayName: 'Alice Admin',
    });
    assert.ok(user1.id > 0);
    assert.strictEqual(user1.phone_number, '6011111111');

    const fetched = database.getUserByPhone('6011111111');
    assert.strictEqual(fetched.id, user1.id);
    assert.strictEqual(fetched.display_name, 'Alice Admin');
  });

  await runTest('Multi-user database isolation (User 1 vs User 2)', () => {
    const user2 = database.createUser({
      phoneNumber: '6022222222',
      passwordHash: hashPassword('pass456'),
      displayName: 'Bob Admin',
    });

    const groupJid = 'shared_group@g.us';

    // User 1 tracks chat and configures settings
    database.incrementChatCount(1, groupJid, 'member1@s.whatsapp.net', 'Member 1');
    database.incrementChatCount(1, groupJid, 'member1@s.whatsapp.net', 'Member 1');
    database.updateGroupSettings(1, groupJid, { block_instagram: 0, group_name: 'User 1 Group' });

    // User 2 tracks chat and configures different settings
    database.incrementChatCount(user2.id, groupJid, 'member2@s.whatsapp.net', 'Member 2');
    database.updateGroupSettings(user2.id, groupJid, { block_instagram: 1, group_name: 'User 2 Group' });

    // Verify isolation
    const leaderboard1 = database.getGroupLeaderboard(1, groupJid);
    const leaderboard2 = database.getGroupLeaderboard(user2.id, groupJid);

    assert.strictEqual(leaderboard1.length, 1);
    assert.strictEqual(leaderboard1[0].user_jid, 'member1@s.whatsapp.net');
    assert.strictEqual(leaderboard1[0].chat_count, 2);

    assert.strictEqual(leaderboard2.length, 1);
    assert.strictEqual(leaderboard2[0].user_jid, 'member2@s.whatsapp.net');
    assert.strictEqual(leaderboard2[0].chat_count, 1);

    const settings1 = database.getGroupSettings(1, groupJid);
    const settings2 = database.getGroupSettings(user2.id, groupJid);

    assert.strictEqual(settings1.block_instagram, 0);
    assert.strictEqual(settings1.group_name, 'User 1 Group');

    assert.strictEqual(settings2.block_instagram, 1);
    assert.strictEqual(settings2.group_name, 'User 2 Group');
  });

  await runTest('Permanent user deletion and cascade cleanup', () => {
    const tempUser = database.createUser({
      phoneNumber: '6099999999',
      passwordHash: hashPassword('pass999'),
      displayName: 'Temporary User',
    });

    const testGroup = 'temp_group@g.us';
    database.incrementChatCount(tempUser.id, testGroup, 'member@s.whatsapp.net', 'Test');
    database.updateGroupSettings(tempUser.id, testGroup, { group_name: 'Temp Group' });
    database.blockMember(tempUser.id, testGroup, 'blocked@s.whatsapp.net', 'Blocked', 'Admin');

    assert.ok(database.getUserById(tempUser.id));
    assert.strictEqual(database.getGroupLeaderboard(tempUser.id, testGroup).length, 1);

    // Delete user
    const deleted = database.deleteUser(tempUser.id);
    assert.strictEqual(deleted, true);

    // Verify user and data are wiped
    assert.strictEqual(database.getUserById(tempUser.id), null);
    assert.strictEqual(database.getUserByPhone('6099999999'), null);
    assert.strictEqual(database.getGroupLeaderboard(tempUser.id, testGroup).length, 0);
    assert.strictEqual(database.getBlockedMembers(tempUser.id, testGroup).length, 0);
  });

  // ==========================================
  // 2. LINK DETECTOR TESTS
  // ==========================================
  console.log('\n--- 2. Link Detector & URL Tests ---');

  await runTest('Detect Instagram standard post link', () => {
    const result = detectBlockedLinks('Check this out https://www.instagram.com/p/C7X90123/ so cool!');
    assert.strictEqual(result.hasInstagram, true);
    assert.strictEqual(result.hasTikTok, false);
    assert.strictEqual(result.isBlocked, true);
    assert.strictEqual(result.type, 'INSTAGRAM');
  });

  await runTest('Detect Instagram reel and shortened link', () => {
    const result1 = detectBlockedLinks('https://instagram.com/reel/C8abcde/');
    assert.strictEqual(result1.hasInstagram, true);

    const result2 = detectBlockedLinks('Check https://instagr.am/p/123 and https://ig.me/j/abc');
    assert.strictEqual(result2.hasInstagram, true);
  });

  await runTest('Detect TikTok standard and short links', () => {
    const result1 = detectBlockedLinks('Watch this https://www.tiktok.com/@user/video/731234567890');
    assert.strictEqual(result1.hasTikTok, true);
    assert.strictEqual(result1.hasInstagram, false);
    assert.strictEqual(result1.isBlocked, true);
    assert.strictEqual(result1.type, 'TIKTOK');

    const result2 = detectBlockedLinks('Look at https://vt.tiktok.com/ZSNxxxxxx/');
    assert.strictEqual(result2.hasTikTok, true);

    const result3 = detectBlockedLinks('Look at https://vm.tiktok.com/ZMMxxxxxx/');
    assert.strictEqual(result3.hasTikTok, true);
  });

  await runTest('Detect both Instagram and TikTok in one message', () => {
    const result = detectBlockedLinks('Here is IG: instagram.com/p/123 and TT: https://vt.tiktok.com/abc');
    assert.strictEqual(result.hasInstagram, true);
    assert.strictEqual(result.hasTikTok, true);
    assert.strictEqual(result.type, 'BOTH');
  });

  await runTest('Ignore safe links and normal text', () => {
    const result1 = detectBlockedLinks('Hey everyone, meeting is at 5pm tomorrow!');
    assert.strictEqual(result1.isBlocked, false);

    const result2 = detectBlockedLinks('Check out https://www.google.com and https://youtube.com/watch?v=123');
    assert.strictEqual(result2.isBlocked, false);
  });

  // ==========================================
  // 3. GREETING "HI" MATCHING TESTS
  // ==========================================
  console.log('\n--- 3. "Hi" Greeting Matcher Tests ---');

  await runTest('Match "Hi" variations', () => {
    assert.strictEqual(isHiGreeting('Hi'), true);
    assert.strictEqual(isHiGreeting('hi'), true);
    assert.strictEqual(isHiGreeting('HI'), true);
    assert.strictEqual(isHiGreeting('Hi!'), true);
    assert.strictEqual(isHiGreeting('Hello'), true);
    assert.strictEqual(isHiGreeting('hey'), true);
    assert.strictEqual(isHiGreeting('  hi  '), true);
    assert.strictEqual(isHiGreeting('hi???'), true);
  });

  await runTest('Reject non-greeting messages', () => {
    assert.strictEqual(isHiGreeting('Higher education'), false);
    assert.strictEqual(isHiGreeting('Going for hiking today'), false);
    assert.strictEqual(isHiGreeting('Who is this?'), false);
    assert.strictEqual(isHiGreeting(''), false);
  });

  // ==========================================
  // 4. ADMIN PRIVILEGE CHECK TESTS
  // ==========================================
  console.log('\n--- 4. Admin Exemption & Group Metadata Tests ---');

  const mockGroupMetadata = {
    id: '120363000000000000@g.us',
    subject: 'Test WhatsApp Group',
    participants: [
      { id: '60123456789@s.whatsapp.net', admin: 'admin' },
      { id: '60198765432@s.whatsapp.net', admin: 'superadmin' },
      { id: '60111222333@s.whatsapp.net', admin: null },
      { id: '60155566677@s.whatsapp.net' },
    ],
  };

  await runTest('Identify regular group admin', () => {
    const isAdmin = isParticipantAdmin(mockGroupMetadata, '60123456789@s.whatsapp.net');
    assert.strictEqual(isAdmin, true);
  });

  await runTest('Identify group superadmin (creator)', () => {
    const isAdmin = isParticipantAdmin(mockGroupMetadata, '60198765432@s.whatsapp.net');
    assert.strictEqual(isAdmin, true);
  });

  await runTest('Identify non-admin members correctly', () => {
    const isNormalMemberAdmin = isParticipantAdmin(mockGroupMetadata, '60111222333@s.whatsapp.net');
    assert.strictEqual(isNormalMemberAdmin, false);

    const isOtherMemberAdmin = isParticipantAdmin(mockGroupMetadata, '60155566677@s.whatsapp.net');
    assert.strictEqual(isOtherMemberAdmin, false);
  });

  // ==========================================
  // 5. DATABASE OPERATIONS & CHAT COUNTER TESTS
  // ==========================================
  console.log('\n--- 5. SQLite Database & Chat Counter Tests ---');

  const testGroupJid = 'test_group_12345@g.us';
  const userAlice = '6011111111@s.whatsapp.net';
  const userBob = '6022222222@s.whatsapp.net';

  await runTest('Increment chat count for users', () => {
    database.incrementChatCount(1, testGroupJid, userAlice, 'Alice');
    database.incrementChatCount(1, testGroupJid, userAlice, 'Alice');
    const aliceRecord = database.incrementChatCount(1, testGroupJid, userAlice, 'Alice');
    const bobRecord = database.incrementChatCount(1, testGroupJid, userBob, 'Bob');

    assert.strictEqual(aliceRecord.chat_count, 3);
    assert.strictEqual(bobRecord.chat_count, 1);
  });

  await runTest('Retrieve group leaderboard sorted by message count', () => {
    const leaderboard = database.getGroupLeaderboard(1, testGroupJid);
    assert.ok(leaderboard.length >= 2);
    assert.strictEqual(leaderboard[0].user_jid, userAlice);
    assert.strictEqual(leaderboard[0].chat_count, 3);
    assert.strictEqual(leaderboard[1].user_jid, userBob);
    assert.strictEqual(leaderboard[1].chat_count, 1);
  });

  await runTest('Reset single member chat count', () => {
    const resetResult = database.resetMemberChatCount(1, testGroupJid, userAlice);
    assert.strictEqual(resetResult, true);

    const member = database.getMember(1, testGroupJid, userAlice);
    assert.strictEqual(member.chat_count, 0);

    const bob = database.getMember(1, testGroupJid, userBob);
    assert.strictEqual(bob.chat_count, 1);
  });

  await runTest('Reset all chat counts in group', () => {
    database.incrementChatCount(1, testGroupJid, userAlice, 'Alice');
    database.incrementChatCount(1, testGroupJid, userBob, 'Bob');

    const rows = database.resetGroupChatCounts(1, testGroupJid, 'Test Group');
    assert.ok(rows > 0);

    const leaderboard = database.getGroupLeaderboard(1, testGroupJid);
    assert.strictEqual(leaderboard[0].chat_count, 0);
    assert.strictEqual(leaderboard[1].chat_count, 0);
  });

  await runTest('Calculate group total message count', () => {
    database.incrementChatCount(1, testGroupJid, userAlice, 'Alice');
    database.incrementChatCount(1, testGroupJid, userAlice, 'Alice');
    database.incrementChatCount(1, testGroupJid, userBob, 'Bob');

    const total = database.getGroupTotalMessages(1, testGroupJid);
    assert.ok(total >= 3);
  });

  await runTest('Update and retrieve group settings', () => {
    database.updateGroupSettings(1, testGroupJid, {
      group_name: 'Super Squad',
      block_instagram: 0,
      block_tiktok: 1,
      auto_reply_hi: 1,
      custom_warning: 'No TikTok allowed here!',
    });

    const settings = database.getGroupSettings(1, testGroupJid);
    assert.strictEqual(settings.group_name, 'Super Squad');
    assert.strictEqual(settings.block_instagram, 0);
    assert.strictEqual(settings.block_tiktok, 1);
    assert.strictEqual(settings.auto_reply_hi, 1);
    assert.strictEqual(settings.custom_warning, 'No TikTok allowed here!');
  });

  await runTest('Log and query activity events', () => {
    database.logActivity(1, {
      groupJid: testGroupJid,
      groupName: 'Super Squad',
      userJid: userAlice,
      userName: 'Alice',
      actionType: 'LINK_BLOCKED_TIKTOK',
      details: 'Blocked TikTok video link',
    });

    const logs = database.getRecentLogs(1, 10, testGroupJid);
    assert.ok(logs.length > 0);
    assert.strictEqual(logs[0].action_type, 'LINK_BLOCKED_TIKTOK');
  });

  await runTest('Extract message text helper', () => {
    assert.strictEqual(extractMessageText({ conversation: 'Hello world' }), 'Hello world');
    assert.strictEqual(extractMessageText({ extendedTextMessage: { text: 'Extended text link' } }), 'Extended text link');
    assert.strictEqual(extractMessageText({ imageMessage: { caption: 'Image caption with IG' } }), 'Image caption with IG');
    assert.strictEqual(extractMessageText(null), '');
  });

  // ==========================================
  // 6. ADMIN & MEMBER COMMANDS TESTS
  // ==========================================
  console.log('\n--- 6. Admin & Member Commands Tests ---');

  await runTest('Match .delete and .del command triggers', () => {
    assert.ok(/^\.(delete|del)\b/i.test('.delete'));
    assert.ok(/^\.(delete|del)\b/i.test('.del'));
    assert.ok(/^\.(delete|del)\b/i.test('.DELETE'));
    assert.ok(/^\.(delete|del)\b/i.test('.del please'));
    assert.strictEqual(/^\.(delete|del)\b/i.test('.deletion'), false);
    assert.strictEqual(/^\.(delete|del)\b/i.test('hello .delete'), false);
  });

  await runTest('Match .kick command triggers & extract targets', () => {
    assert.ok(/^\.kick\b/i.test('.kick @user'));
    assert.ok(/^\.kick\b/i.test('.kick 60123456789'));
    assert.ok(/^\.kick\b/i.test('.KICK'));
    assert.strictEqual(/^\.kick\b/i.test('kick him'), false);

    const phoneMatch = '.kick 60123456789'.match(/\.kick\s+@?(\d{7,16})/i);
    assert.strictEqual(phoneMatch[1], '60123456789');
  });

  await runTest('Match .hidetag command & extract text', () => {
    assert.ok(/^\.hidetag\b/i.test('.hidetag Meeting at 5pm'));
    assert.ok(/^\.hidetag\b/i.test('.HIDETAG'));

    const text = '.hidetag Announcement: All hands meeting'.replace(/^\.hidetag\s*/i, '').trim();
    assert.strictEqual(text, 'Announcement: All hands meeting');
  });

  await runTest('Match .tagall command & format members list', () => {
    assert.ok(/^\.tagall\b/i.test('.tagall Urgent announcement'));
    assert.ok(/^\.tagall\b/i.test('.TAGALL'));
    assert.strictEqual(/^\.tagall\b/i.test('tagall everyone'), false);

    const customText = '.tagall Meeting starts now!'.replace(/^\.tagall\s*/i, '').trim();
    assert.strictEqual(customText, 'Meeting starts now!');
  });

  await runTest('Save and retrieve group chat messages in database with pagination and search', () => {
    const msg1 = database.saveGroupMessage(1, {
      messageId: 'MSG_001',
      groupJid: testGroupJid,
      senderJid: userAlice,
      senderName: 'Alice',
      messageText: 'Hello everyone!',
      isFromMe: 0,
      timestamp: 1000,
    });

    const msg2 = database.saveGroupMessage(1, {
      messageId: 'MSG_002',
      groupJid: testGroupJid,
      senderJid: 'admin@s.whatsapp.net',
      senderName: 'Admin',
      messageText: 'Welcome Alice to the group!',
      isFromMe: 1,
      timestamp: 2000,
    });

    const msg3 = database.saveGroupMessage(1, {
      messageId: 'MSG_003',
      groupJid: testGroupJid,
      senderJid: userAlice,
      senderName: 'Alice',
      messageText: 'Check out the announcement today.',
      isFromMe: 0,
      timestamp: 3000,
    });

    // Deduplication check
    const duplicate = database.saveGroupMessage(1, {
      messageId: 'MSG_001',
      groupJid: testGroupJid,
      senderJid: userAlice,
      senderName: 'Alice',
      messageText: 'Hello everyone!',
      isFromMe: 0,
      timestamp: 1000,
    });
    assert.strictEqual(duplicate.id, msg1.id);

    // 1. Basic retrieval
    const history = database.getGroupMessages(1, testGroupJid, { limit: 10 });
    assert.strictEqual(history.messages.length, 3);
    assert.strictEqual(history.totalCount, 3);
    assert.strictEqual(history.hasMore, false);
    assert.strictEqual(history.messages[0].message_text, 'Hello everyone!');
    assert.strictEqual(history.messages[1].message_text, 'Welcome Alice to the group!');
    assert.strictEqual(history.messages[2].message_text, 'Check out the announcement today.');

    // 2. Pagination with before timestamp
    const olderHistory = database.getGroupMessages(1, testGroupJid, { limit: 2, before: 3000 });
    assert.strictEqual(olderHistory.messages.length, 2);
    assert.strictEqual(olderHistory.messages[1].message_text, 'Welcome Alice to the group!');

    // 3. Search query filter
    const searchResults = database.getGroupMessages(1, testGroupJid, { search: 'announcement' });
    assert.strictEqual(searchResults.messages.length, 1);
    assert.strictEqual(searchResults.messages[0].message_text, 'Check out the announcement today.');
    assert.strictEqual(searchResults.totalCount, 1);
  });

  await runTest('Verify admin command execution activity logging', () => {
    database.logActivity(1, {
      groupJid: testGroupJid,
      groupName: 'Super Squad',
      userJid: userAlice,
      userName: 'Alice',
      actionType: 'ADMIN_DELETE_MESSAGE',
      details: 'Admin deleted message ABC12345',
    });

    database.logActivity(1, {
      groupJid: testGroupJid,
      groupName: 'Super Squad',
      userJid: userAlice,
      userName: 'Alice',
      actionType: 'ADMIN_KICK_MEMBER',
      details: 'Admin kicked user 6019999999',
    });

    database.logActivity(1, {
      groupJid: testGroupJid,
      groupName: 'Super Squad',
      userJid: userAlice,
      userName: 'Alice',
      actionType: 'ADMIN_HIDETAG',
      details: 'Admin broadcasted hidetag to 15 members',
    });

    database.logActivity(1, {
      groupJid: testGroupJid,
      groupName: 'Super Squad',
      userJid: userAlice,
      userName: 'Alice',
      actionType: 'ADMIN_TAGALL',
      details: 'Admin tagged all 15 members',
    });

    const logs = database.getRecentLogs(1, 4, testGroupJid);
    assert.strictEqual(logs[0].action_type, 'ADMIN_TAGALL');
    assert.strictEqual(logs[1].action_type, 'ADMIN_HIDETAG');
    assert.strictEqual(logs[2].action_type, 'ADMIN_KICK_MEMBER');
    assert.strictEqual(logs[3].action_type, 'ADMIN_DELETE_MESSAGE');
  });

  await runTest('Match .sticker command triggers', () => {
    assert.ok(isStickerCommand('.sticker'));
    assert.ok(isStickerCommand('.s'));
    assert.ok(isStickerCommand('.stiker'));
    assert.ok(isStickerCommand('.STICKER'));
    assert.ok(isStickerCommand('.s my cool sticker'));
    assert.strictEqual(isStickerCommand('make a sticker'), false);
    assert.strictEqual(isStickerCommand('hello .sticker'), false);
  });

  await runTest('Extract media node for sticker from quoted context and direct message', () => {
    // Quoted image message
    const quotedMsg = {
      message: { extendedTextMessage: { text: '.sticker' } },
      quotedMessage: { imageMessage: { url: 'https://example.com/img.jpg' } },
    };
    const contextInfo = { quotedMessage: quotedMsg.quotedMessage };
    const res1 = extractMediaForSticker(quotedMsg, contextInfo);
    assert.strictEqual(res1.isImage, true);
    assert.strictEqual(res1.mediaType, 'image');

    // Direct image message with caption
    const directMsg = {
      message: { imageMessage: { caption: '.sticker', url: 'https://example.com/direct.jpg' } },
    };
    const res2 = extractMediaForSticker(directMsg, null);
    assert.strictEqual(res2.isImage, true);
    assert.strictEqual(res2.mediaType, 'image');
  });

  await runTest('Convert image buffer to 512x512 WebP sticker format', async () => {
    const sampleSvg = Buffer.from('<svg width="200" height="200"><rect width="200" height="200" fill="blue"/><circle cx="100" cy="100" r="50" fill="yellow"/></svg>');
    
    const webpBuffer = await convertToStickerWebp(sampleSvg);
    assert.ok(Buffer.isBuffer(webpBuffer));
    assert.ok(webpBuffer.length > 100);

    // Validate WebP header
    const header = webpBuffer.subarray(0, 4).toString('ascii');
    const webpTag = webpBuffer.subarray(8, 12).toString('ascii');
    assert.strictEqual(header, 'RIFF');
    assert.strictEqual(webpTag, 'WEBP');
  });

  await runTest('Match .inactive command trigger & calculate inactivity > 1 day', () => {
    assert.ok(/^\.inactive\b/i.test('.inactive'));
    assert.ok(/^\.inactive\b/i.test('.INACTIVE'));
    assert.strictEqual(/^\.inactive\b/i.test('inactive members'), false);

    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // Active member (chatted 2 hours ago)
    const activeMember = { chat_count: 10, last_active: now - (2 * 60 * 60 * 1000) };
    const isInactive1 = !activeMember.last_active || activeMember.chat_count === 0 || (now - activeMember.last_active) > ONE_DAY_MS;
    assert.strictEqual(isInactive1, false);

    // Inactive member (chatted 2 days ago)
    const inactiveMember = { chat_count: 5, last_active: now - (2 * ONE_DAY_MS) };
    const isInactive2 = !inactiveMember.last_active || inactiveMember.chat_count === 0 || (now - inactiveMember.last_active) > ONE_DAY_MS;
    assert.strictEqual(isInactive2, true);

    // Never active member (0 chats or null last_active)
    const neverActive = { chat_count: 0, last_active: 0 };
    const isInactive3 = !neverActive.last_active || neverActive.chat_count === 0 || (now - neverActive.last_active) > ONE_DAY_MS;
    assert.strictEqual(isInactive3, true);
  });

  await runTest('Match .chatcount command trigger & calculate leaderboards', () => {
    assert.ok(/^\.chatcount\b/i.test('.chatcount'));
    assert.ok(/^\.chatcount\b/i.test('.CHATCOUNT'));
    assert.strictEqual(/^\.chatcount\b/i.test('chat count please'), false);

    // Track test messages
    database.incrementChatCount(1, 'group_chatcount_test@g.us', '6010000001@s.whatsapp.net', 'User 1');
    database.incrementChatCount(1, 'group_chatcount_test@g.us', '6010000001@s.whatsapp.net', 'User 1');
    database.incrementChatCount(1, 'group_chatcount_test@g.us', '6010000002@s.whatsapp.net', 'User 2');

    const leaderboard = database.getGroupLeaderboard(1, 'group_chatcount_test@g.us');
    assert.strictEqual(leaderboard.length, 2);
    assert.strictEqual(leaderboard[0].chat_count, 2);
    assert.strictEqual(leaderboard[1].chat_count, 1);
  });

  await runTest('Match .resetchat command trigger & reset chat statistics', () => {
    assert.ok(/^\.resetchat\b/i.test('.resetchat'));
    assert.ok(/^\.resetchat\b/i.test('.resetchat @user'));
    assert.ok(/^\.resetchat\b/i.test('.resetchat 6010000001'));
    assert.strictEqual(/^\.resetchat\b/i.test('reset chat'), false);

    // Reset single member
    const singleSuccess = database.resetMemberChatCount(1, 'group_chatcount_test@g.us', '6010000001@s.whatsapp.net');
    assert.strictEqual(singleSuccess, true);
    const member1 = database.getMember(1, 'group_chatcount_test@g.us', '6010000001@s.whatsapp.net');
    assert.strictEqual(member1.chat_count, 0);

    // Reset all members
    const groupSuccess = database.resetGroupChatCounts(1, 'group_chatcount_test@g.us', 'Test Group');
    assert.ok(groupSuccess > 0);
    const member2 = database.getMember(1, 'group_chatcount_test@g.us', '6010000002@s.whatsapp.net');
    assert.strictEqual(member2.chat_count, 0);
  });

  await runTest('Match .block and .unblock command triggers & blocked members SQLite storage', () => {
    assert.ok(/^\.block\b/i.test('.block'));
    assert.ok(/^\.block\b/i.test('.block @user'));
    assert.ok(/^\.block\b/i.test('.BLOCK 60123456789'));
    assert.strictEqual(/^\.block\b/i.test('block user'), false);

    assert.ok(/^\.unblock\b/i.test('.unblock'));
    assert.ok(/^\.unblock\b/i.test('.unblock @user'));
    assert.ok(/^\.unblock\b/i.test('.UNBLOCK 60123456789'));
    assert.strictEqual(/^\.unblock\b/i.test('unblock user'), false);

    assert.ok(/^\.(blockeduser|blockedusers|blocked|listblock)\b/i.test('.blockeduser'));
    assert.ok(/^\.(blockeduser|blockedusers|blocked|listblock)\b/i.test('.blockedusers'));
    assert.ok(/^\.(blockeduser|blockedusers|blocked|listblock)\b/i.test('.blocked'));
    assert.ok(/^\.(blockeduser|blockedusers|blocked|listblock)\b/i.test('.listblock'));
    assert.strictEqual(/^\.(blockeduser|blockedusers|blocked|listblock)\b/i.test('blocked user list'), false);

    const testBlockGroup = 'group_block_test@g.us';
    const testSpammer = '6018888888@s.whatsapp.net';

    // Initially not blocked
    assert.strictEqual(database.isMemberBlocked(1, testBlockGroup, testSpammer), false);

    // Block member
    database.blockMember(1, testBlockGroup, testSpammer, 'Spam User', '6011111111@s.whatsapp.net');
    assert.strictEqual(database.isMemberBlocked(1, testBlockGroup, testSpammer), true);

    // Check list of blocked members
    const blockedList = database.getBlockedMembers(1, testBlockGroup);
    assert.strictEqual(blockedList.length, 1);
    assert.strictEqual(blockedList[0].user_jid, testSpammer);
    assert.strictEqual(blockedList[0].user_name, 'Spam User');

    // Unblock member
    const unblocked = database.unblockMember(1, testBlockGroup, testSpammer);
    assert.strictEqual(unblocked, true);
    assert.strictEqual(database.isMemberBlocked(1, testBlockGroup, testSpammer), false);

    // Unblock non-blocked returns false
    const unblockAgain = database.unblockMember(1, testBlockGroup, testSpammer);
    assert.strictEqual(unblockAgain, false);
  });

  await runTest('Match .help, .menu, and .commands command triggers', () => {
    assert.ok(/^\.(help|menu|commands|cmd)\b/i.test('.help'));
    assert.ok(/^\.(help|menu|commands|cmd)\b/i.test('.HELP'));
    assert.ok(/^\.(help|menu|commands|cmd)\b/i.test('.menu'));
    assert.ok(/^\.(help|menu|commands|cmd)\b/i.test('.commands'));
    assert.ok(/^\.(help|menu|commands|cmd)\b/i.test('.cmd'));
    assert.strictEqual(/^\.(help|menu|commands|cmd)\b/i.test('help me please'), false);
    assert.strictEqual(/^\.(help|menu|commands|cmd)\b/i.test('menu'), false);
  });

  // ==========================================
  // 7. UTILITY & PASSIVE COMMANDS TESTS
  // ==========================================
  console.log('\n--- 7. Utility & Passive Commands (.ping, .runtime, .peek, .passive) ---');

  await runTest('Match .ping, .speed, and .latency command triggers', () => {
    assert.ok(/^\.(ping|speed|latency)\b/i.test('.ping'));
    assert.ok(/^\.(ping|speed|latency)\b/i.test('.PING'));
    assert.ok(/^\.(ping|speed|latency)\b/i.test('.speed'));
    assert.ok(/^\.(ping|speed|latency)\b/i.test('.latency'));
    assert.strictEqual(/^\.(ping|speed|latency)\b/i.test('ping pong'), false);
  });

  await runTest('Match .runtime and .uptime command triggers', () => {
    assert.ok(/^\.(runtime|uptime)\b/i.test('.runtime'));
    assert.ok(/^\.(runtime|uptime)\b/i.test('.RUNTIME'));
    assert.ok(/^\.(runtime|uptime)\b/i.test('.uptime'));
    assert.strictEqual(/^\.(runtime|uptime)\b/i.test('runtime check'), false);
  });

  await runTest('Match .about, .info, and .version command triggers', () => {
    assert.ok(/^\.(about|info|version|v)\b/i.test('.about'));
    assert.ok(/^\.(about|info|version|v)\b/i.test('.ABOUT'));
    assert.ok(/^\.(about|info|version|v)\b/i.test('.info'));
    assert.ok(/^\.(about|info|version|v)\b/i.test('.version'));
    assert.ok(/^\.(about|info|version|v)\b/i.test('.v'));
    assert.strictEqual(/^\.(about|info|version|v)\b/i.test('about this bot'), false);
  });

  await runTest('Match .peek, .rvo, and .viewonce command triggers via isPeekCommand', () => {
    assert.ok(isPeekCommand('.peek'));
    assert.ok(isPeekCommand('.PEEK'));
    assert.ok(isPeekCommand('.rvo'));
    assert.ok(isPeekCommand('.viewonce'));
    assert.ok(isPeekCommand('.reveal'));
    assert.ok(isPeekCommand('.intip'));
    assert.strictEqual(isPeekCommand('peek a boo'), false);
    assert.strictEqual(isPeekCommand(''), false);
    assert.strictEqual(isPeekCommand(null), false);
  });

  await runTest('Extract View Once image and video nodes using extractViewOnceMedia', () => {
    // 1. Quoted View Once Image (viewOnceMessage format)
    const quotedVOImg = {
      quotedMessage: {
        viewOnceMessage: {
          message: {
            imageMessage: {
              url: 'https://mock.whatsapp.net/vo_img',
              mimetype: 'image/jpeg',
              caption: 'Secret photo',
            },
          },
        },
      },
    };
    const res1 = extractViewOnceMedia({}, quotedVOImg);
    assert.strictEqual(res1.isMedia, true);
    assert.strictEqual(res1.mediaType, 'image');
    assert.strictEqual(res1.isViewOnce, true);
    assert.strictEqual(res1.caption, 'Secret photo');

    // 2. Quoted View Once Video (viewOnceMessageV2 format)
    const quotedVOVid = {
      quotedMessage: {
        viewOnceMessageV2: {
          message: {
            videoMessage: {
              url: 'https://mock.whatsapp.net/vo_vid',
              mimetype: 'video/mp4',
              caption: 'Secret clip',
            },
          },
        },
      },
    };
    const res2 = extractViewOnceMedia({}, quotedVOVid);
    assert.strictEqual(res2.isMedia, true);
    assert.strictEqual(res2.mediaType, 'video');
    assert.strictEqual(res2.isViewOnce, true);
    assert.strictEqual(res2.caption, 'Secret clip');

    // 3. Direct message with View Once image
    const directVOMsg = {
      message: {
        viewOnceMessage: {
          message: {
            imageMessage: {
              url: 'https://mock.whatsapp.net/direct_vo',
              mimetype: 'image/jpeg',
            },
          },
        },
      },
    };
    const res3 = extractViewOnceMedia(directVOMsg, {});
    assert.strictEqual(res3.isMedia, true);
    assert.strictEqual(res3.mediaType, 'image');
    assert.strictEqual(res3.isViewOnce, true);

    // 4. Non-media message returns isMedia: false
    const textMsg = { message: { conversation: 'Hello world' } };
    const res4 = extractViewOnceMedia(textMsg, {});
    assert.strictEqual(res4.isMedia, false);
    assert.strictEqual(res4.targetNode, null);
  });

  await runTest('Match .passive set [number] and extract threshold integer', () => {
    assert.ok(/^\.passive\s+set\b/i.test('.passive set 10'));
    assert.ok(/^\.passive\s+set\b/i.test('.PASSIVE SET 25'));

    const match1 = '.passive set 15'.match(/^\.passive\s+set\s+(\d+)/i);
    assert.ok(match1);
    assert.strictEqual(parseInt(match1[1], 10), 15);

    const match2 = '.passive set invalid'.match(/^\.passive\s+set\s+(\d+)/i);
    assert.strictEqual(match2, null);
  });

  await runTest('Match .passive and .pasif command triggers', () => {
    assert.ok(/^\.(passive|pasif)\b/i.test('.passive'));
    assert.ok(/^\.(passive|pasif)\b/i.test('.PASSIVE'));
    assert.ok(/^\.(passive|pasif)\b/i.test('.pasif'));
    assert.strictEqual(/^\.(passive|pasif)\b/i.test('passive income'), false);
  });

  await runTest('Database storage and update of passive_threshold setting', () => {
    const testGroup = '120363888888888888@g.us';

    // Default threshold should be 5
    const defaults = database.getGroupSettings(1, testGroup);
    assert.strictEqual(defaults.passive_threshold, 5);

    // Update threshold to 12
    const updated = database.updateGroupSettings(1, testGroup, {
      passive_threshold: 12,
    });
    assert.strictEqual(updated.passive_threshold, 12);

    // Verify persisted
    const fetched = database.getGroupSettings(1, testGroup);
    assert.strictEqual(fetched.passive_threshold, 12);
  });

  await runTest('Passive members filtering and leaderboard calculation', () => {
    const testGroup = '120363777777777777@g.us';
    const threshold = 10;

    // Simulate members chatting
    database.incrementChatCount(1, testGroup, 'active_user@s.whatsapp.net', 'Active Alice');
    for (let i = 0; i < 15; i++) {
      database.incrementChatCount(1, testGroup, 'active_user@s.whatsapp.net', 'Active Alice');
    }

    database.incrementChatCount(1, testGroup, 'passive_user1@s.whatsapp.net', 'Low Bob');
    database.incrementChatCount(1, testGroup, 'passive_user1@s.whatsapp.net', 'Low Bob'); // 2 msgs

    // Mock participants: Active Alice, Low Bob, Silent Charlie (0 msgs)
    const participants = [
      { id: 'active_user@s.whatsapp.net' },
      { id: 'passive_user1@s.whatsapp.net' },
      { id: 'silent_user@s.whatsapp.net' },
    ];

    const leaderboard = database.getGroupLeaderboard(1, testGroup) || [];
    const countsMap = new Map();
    for (const entry of leaderboard) {
      const cleanId = entry.user_jid.replace(/:.*@/, '@').split('@')[0];
      countsMap.set(cleanId, entry.chat_count);
    }

    const passiveMembers = [];
    for (const p of participants) {
      const cleanId = (p.id ? p.id.replace(/:.*@/, '@') : '').split('@')[0];
      const count = countsMap.get(cleanId) || 0;
      if (count < threshold) {
        passiveMembers.push({ jid: p.id, phone: cleanId, count });
      }
    }
    passiveMembers.sort((a, b) => a.count - b.count);

    assert.strictEqual(passiveMembers.length, 2);
    assert.strictEqual(passiveMembers[0].phone, 'silent_user');
    assert.strictEqual(passiveMembers[0].count, 0);
    assert.strictEqual(passiveMembers[1].phone, 'passive_user1');
    assert.strictEqual(passiveMembers[1].count, 2);
  });

  // ==========================================
  // 7B. ADMIN COMMAND ACCESS DELEGATION & .CHATCOUNT RESTRICTION TESTS
  // ==========================================
  await runTest('canExecuteAdminCommand allows admins full access to all commands', () => {
    const settings = { allow_non_admin_commands: 0, allowed_non_admin_commands: '' };
    assert.strictEqual(canExecuteAdminCommand('chatcount', true, settings), true);
    assert.strictEqual(canExecuteAdminCommand('kick', true, settings), true);
    assert.strictEqual(canExecuteAdminCommand('tagall', true, settings), true);
    assert.strictEqual(canExecuteAdminCommand('delete', true, settings), true);
    assert.strictEqual(canExecuteAdminCommand('resetchat', true, settings), true);
  });

  await runTest('canExecuteAdminCommand blocks non-admins when delegation toggle is disabled', () => {
    const settings = { allow_non_admin_commands: 0, allowed_non_admin_commands: 'chatcount,tagall' };
    assert.strictEqual(canExecuteAdminCommand('chatcount', false, settings), false);
    assert.strictEqual(canExecuteAdminCommand('tagall', false, settings), false);
    assert.strictEqual(canExecuteAdminCommand('kick', false, settings), false);
    assert.strictEqual(canExecuteAdminCommand('delete', false, settings), false);
  });

  await runTest('canExecuteAdminCommand delegates only authorized admin commands to non-admins', () => {
    const settings = {
      allow_non_admin_commands: 1,
      allowed_non_admin_commands: 'chatcount,tagall,inactive',
    };
    // Authorized commands pass
    assert.strictEqual(canExecuteAdminCommand('chatcount', false, settings), true);
    assert.strictEqual(canExecuteAdminCommand('tagall', false, settings), true);
    assert.strictEqual(canExecuteAdminCommand('inactive', false, settings), true);

    // Dangerous/non-authorized commands remain strictly blocked
    assert.strictEqual(canExecuteAdminCommand('kick', false, settings), false);
    assert.strictEqual(canExecuteAdminCommand('delete', false, settings), false);
    assert.strictEqual(canExecuteAdminCommand('resetchat', false, settings), false);
    assert.strictEqual(canExecuteAdminCommand('block', false, settings), false);
  });

  await runTest('Database persists allow_non_admin_commands and allowed_non_admin_commands', () => {
    const testGroup = '120363999999999999@g.us';

    // Default settings: non-admin delegation off
    const defaults = database.getGroupSettings(1, testGroup);
    assert.strictEqual(defaults.allow_non_admin_commands, 0);
    assert.strictEqual(defaults.allowed_non_admin_commands, '');

    // Enable delegation with specific commands as array
    const updated = database.updateGroupSettings(1, testGroup, {
      allow_non_admin_commands: 1,
      allowed_non_admin_commands: ['chatcount', 'tagall'],
    });
    assert.strictEqual(updated.allow_non_admin_commands, 1);
    assert.strictEqual(updated.allowed_non_admin_commands, 'chatcount,tagall');

    // Retrieve and verify persistence
    const fetched = database.getGroupSettings(1, testGroup);
    assert.strictEqual(fetched.allow_non_admin_commands, 1);
    assert.strictEqual(fetched.allowed_non_admin_commands, 'chatcount,tagall');

    // Update with comma-separated string
    database.updateGroupSettings(1, testGroup, {
      allowed_non_admin_commands: 'chatcount,inactive,hidetag',
    });
    const fetched2 = database.getGroupSettings(1, testGroup);
    assert.strictEqual(fetched2.allowed_non_admin_commands, 'chatcount,inactive,hidetag');
  });

  // ==========================================
  // 8. ON-DEVICE AI COMMANDS & SERVICE TESTS
  // ==========================================
  await runAITests();

  // ==========================================
  // 9. CROSS-DEVICE AI CHATBOT & MULTI-ACCOUNT ISOLATION
  // ==========================================
  console.log('\n--- 9. Cross-Device AI Chatbot & Multi-Account Isolation Tests ---');

  await runTest('AI Chatbot: Save session, update title, add messages, and retrieve across devices', () => {
    const sessionId = 'session_test_123';
    // User 1 creates session
    const saved = database.saveChatbotSession(1, {
      id: sessionId,
      title: 'Brainstorming Ideas',
      modelId: 'qwen-3.5-0.8b-q4',
      createdAt: 1000000,
      updatedAt: 1000000,
    });
    assert.strictEqual(saved, true);

    // User 1 adds user prompt and assistant response
    const msg1 = database.saveChatbotMessage(1, sessionId, {
      role: 'user',
      content: 'How does multi-device sync work?',
      imageBase64: null,
      createdAt: 1000010,
    });
    assert.ok(msg1.id);
    assert.strictEqual(msg1.role, 'user');

    const msg2 = database.saveChatbotMessage(1, sessionId, {
      role: 'assistant',
      content: 'It synchronizes conversations with SQLite database.',
      createdAt: 1000020,
    });
    assert.ok(msg2.id);

    // Retrieve sessions for user 1 (as if logging in from second device)
    const sessions = database.getChatbotSessions(1);
    const session = sessions.find((s) => s.id === sessionId);
    assert.ok(session);
    assert.strictEqual(session.title, 'Brainstorming Ideas');
    assert.strictEqual(session.messages.length, 2);
    assert.strictEqual(session.messages[0].content, 'How does multi-device sync work?');
    assert.strictEqual(session.messages[1].content, 'It synchronizes conversations with SQLite database.');

    // Update title
    const renamed = database.updateChatbotSessionTitle(1, sessionId, 'Renamed Brainstorm');
    assert.strictEqual(renamed, true);
    const updatedSessions = database.getChatbotSessions(1);
    assert.strictEqual(updatedSessions.find((s) => s.id === sessionId).title, 'Renamed Brainstorm');

    // Delete session
    const deleted = database.deleteChatbotSession(1, sessionId);
    assert.strictEqual(deleted, true);
    const afterDelete = database.getChatbotSessions(1);
    assert.strictEqual(afterDelete.find((s) => s.id === sessionId), undefined);
  });

  await runTest('Multi-Account & Multi-Phone Number Complete Data Isolation', () => {
    // Register Account 1 (Phone 1: 14155551111)
    const user1 = database.createUser({
      phoneNumber: '14155551111',
      passwordHash: 'hash1',
      displayName: 'Sales Bot Admin',
    });

    // Register Account 2 (Phone 2: 14155552222)
    const user2 = database.createUser({
      phoneNumber: '14155552222',
      passwordHash: 'hash2',
      displayName: 'Support Bot Admin',
    });

    assert.notStrictEqual(user1.id, user2.id);

    // User 1 manages Sales Group
    database.incrementChatCount(user1.id, 'sales_group@g.us', 'buyer1@s.whatsapp.net', 'Buyer 1');
    database.updateGroupSettings(user1.id, 'sales_group@g.us', { block_instagram: 1, passive_threshold: 10 });
    database.saveChatbotSession(user1.id, { id: 'session_sales', title: 'Sales Chatbot' });

    // User 2 manages Support Group
    database.incrementChatCount(user2.id, 'support_group@g.us', 'client1@s.whatsapp.net', 'Client 1');
    database.updateGroupSettings(user2.id, 'support_group@g.us', { block_instagram: 0, passive_threshold: 3 });
    database.saveChatbotSession(user2.id, { id: 'session_support', title: 'Support Chatbot' });

    // Verify isolation: User 1 sees only sales group and sales chatbot
    const user1Groups = database.getAllGroups(user1.id);
    assert.strictEqual(user1Groups.length, 1);
    assert.strictEqual(user1Groups[0].group_jid, 'sales_group@g.us');

    const user1Sessions = database.getChatbotSessions(user1.id);
    assert.strictEqual(user1Sessions.length, 1);
    assert.strictEqual(user1Sessions[0].id, 'session_sales');

    // Verify isolation: User 2 sees only support group and support chatbot
    const user2Groups = database.getAllGroups(user2.id);
    assert.strictEqual(user2Groups.length, 1);
    assert.strictEqual(user2Groups[0].group_jid, 'support_group@g.us');

    const user2Sessions = database.getChatbotSessions(user2.id);
    assert.strictEqual(user2Sessions.length, 1);
    assert.strictEqual(user2Sessions[0].id, 'session_support');

    // Clean up
    database.deleteUser(user1.id);
    database.deleteUser(user2.id);
  });

  // Run Automatic Chat Removal Moderation Tests
  await runAutoRemoveTests();

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n==========================================');
  console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('==========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests();

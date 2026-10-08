import assert from 'assert';
import database from '../src/database/db.js';
import {
  hasImageMedia,
  isReactionMessage,
  isSystemOrStubMessage,
  isActualTextMessage,
  handleIncomingMessage,
} from '../src/bot/handlers/messageHandler.js';

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}\n`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
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

export async function runAutoRemoveTests() {
  console.log('🛡️ Starting Automatic Chat Removal Unit & Integration Tests...\n');

  // ==========================================
  // 1. HAS IMAGE MEDIA HELPER TESTS
  // ==========================================
  console.log('--- 1. hasImageMedia Detector Tests ---');

  runTest('hasImageMedia returns false for text-only messages', () => {
    assert.strictEqual(hasImageMedia({ message: { conversation: 'Hello world' } }), false);
    assert.strictEqual(hasImageMedia({ message: { extendedTextMessage: { text: 'https://example.com' } } }), false);
    assert.strictEqual(hasImageMedia({ message: {} }), false);
    assert.strictEqual(hasImageMedia(null), false);
  });

  runTest('hasImageMedia returns true for direct photo imageMessage', () => {
    const msg = { message: { imageMessage: { caption: 'Look at this photo', mimetype: 'image/jpeg' } } };
    assert.strictEqual(hasImageMedia(msg), true);
  });

  runTest('hasImageMedia returns true for View Once image', () => {
    const msg = {
      message: {
        viewOnceMessage: {
          message: {
            imageMessage: { caption: 'Secret pic' },
          },
        },
      },
    };
    assert.strictEqual(hasImageMedia(msg), true);
  });

  runTest('hasImageMedia returns true for Sticker message', () => {
    const msg = { message: { stickerMessage: { isAnimated: false } } };
    assert.strictEqual(hasImageMedia(msg), true);
  });

  runTest('hasImageMedia returns true for image documents and false for PDFs', () => {
    const imgDoc = { message: { documentMessage: { mimetype: 'image/png', fileName: 'sample.png' } } };
    assert.strictEqual(hasImageMedia(imgDoc), true);

    const pdfDoc = { message: { documentMessage: { mimetype: 'application/pdf', fileName: 'document.pdf' } } };
    assert.strictEqual(hasImageMedia(pdfDoc), false);
  });

  // ==========================================
  // 2. DATABASE PERSISTENCE TESTS
  // ==========================================
  console.log('\n--- 2. Database Settings Persistence Tests ---');

  runTest('Group settings default auto_remove_chat=0 and auto_remove_mode=remove_image', () => {
    const groupJid = '120363000000000001@g.us';
    const settings = database.getGroupSettings(1, groupJid);
    assert.strictEqual(settings.auto_remove_chat, 0);
    assert.strictEqual(settings.auto_remove_mode, 'remove_image');
  });

  runTest('Update group settings with auto_remove_chat enabled and mode=remove_text', () => {
    const groupJid = '120363000000000001@g.us';
    database.updateGroupSettings(1, groupJid, {
      auto_remove_chat: 1,
      auto_remove_mode: 'remove_text',
    });

    const updated = database.getGroupSettings(1, groupJid);
    assert.strictEqual(updated.auto_remove_chat, 1);
    assert.strictEqual(updated.auto_remove_mode, 'remove_text');
  });

  runTest('Update group settings with mode=remove_image and toggle off', () => {
    const groupJid = '120363000000000001@g.us';
    database.updateGroupSettings(1, groupJid, {
      auto_remove_chat: 1,
      auto_remove_mode: 'remove_image',
    });

    let settings = database.getGroupSettings(1, groupJid);
    assert.strictEqual(settings.auto_remove_chat, 1);
    assert.strictEqual(settings.auto_remove_mode, 'remove_image');

    // Toggle off
    database.updateGroupSettings(1, groupJid, {
      auto_remove_chat: 0,
    });
    settings = database.getGroupSettings(1, groupJid);
    assert.strictEqual(settings.auto_remove_chat, 0);
  });

  // ==========================================
  // 3. AUTO-REMOVAL MESSAGE PIPELINE INTEGRATION
  // ==========================================
  console.log('\n--- 3. Message Moderation Pipeline Execution Tests ---');

  await runAsyncTest('Mode 1: Non-admin sends image when remove_image is active -> Message is deleted', async () => {
    const groupJid = '120363888888888888@g.us';
    const nonAdminJid = '60123456789@s.whatsapp.net';

    database.updateGroupSettings(1, groupJid, {
      auto_remove_chat: 1,
      auto_remove_mode: 'remove_image',
      warn_user: 1,
    });

    const sentMessages = [];
    const mockSock = {
      user: { id: 'bot@s.whatsapp.net', name: 'Capybot' },
      groupMetadata: async () => ({
        id: groupJid,
        subject: 'Test Group',
        participants: [
          { id: 'admin@s.whatsapp.net', admin: 'admin' },
          { id: nonAdminJid, admin: null },
        ],
      }),
      sendMessage: async (jid, content, options) => {
        sentMessages.push({ jid, content, options });
      },
    };

    const imageMsg = {
      key: { remoteJid: groupJid, participant: nonAdminJid, id: 'IMG_MSG_1', fromMe: false },
      message: {
        imageMessage: { caption: 'Photo not allowed' },
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: 'Charlie',
    };

    await handleIncomingMessage(mockSock, imageMsg, null, 1);

    // Verify deletion was executed
    const deleteAction = sentMessages.find((m) => m.content?.delete?.id === 'IMG_MSG_1');
    assert.ok(deleteAction, 'Expected image message to be deleted');

    // Verify warning was sent
    const warningAction = sentMessages.find((m) => m.content?.text && m.content.text.includes('photos, images and stickers are not allowed'));
    assert.ok(warningAction, 'Expected warning message for image deletion');
  });

  await runAsyncTest('Mode 2: Non-admin sends text when remove_text is active -> Message is deleted', async () => {
    const groupJid = '120363888888888888@g.us';
    const nonAdminJid = '60123456789@s.whatsapp.net';

    database.updateGroupSettings(1, groupJid, {
      auto_remove_chat: 1,
      auto_remove_mode: 'remove_text',
      warn_user: 1,
    });

    const sentMessages = [];
    const mockSock = {
      user: { id: 'bot@s.whatsapp.net', name: 'Capybot' },
      groupMetadata: async () => ({
        id: groupJid,
        subject: 'Test Group',
        participants: [
          { id: 'admin@s.whatsapp.net', admin: 'admin' },
          { id: nonAdminJid, admin: null },
        ],
      }),
      sendMessage: async (jid, content, options) => {
        sentMessages.push({ jid, content, options });
      },
    };

    const textMsg = {
      key: { remoteJid: groupJid, participant: nonAdminJid, id: 'TEXT_MSG_1', fromMe: false },
      message: {
        conversation: 'Hey is text allowed?',
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: 'Charlie',
    };

    await handleIncomingMessage(mockSock, textMsg, null, 1);

    // Verify deletion was executed
    const deleteAction = sentMessages.find((m) => m.content?.delete?.id === 'TEXT_MSG_1');
    assert.ok(deleteAction, 'Expected text message to be deleted in remove_text mode');

    // Verify warning was sent
    const warningAction = sentMessages.find((m) => m.content?.text && m.content.text.includes('text-only messages are not allowed'));
    assert.ok(warningAction, 'Expected warning message for text deletion');
  });

  await runAsyncTest('Admins are exempt from auto-chat removal in both modes', async () => {
    const groupJid = '120363888888888888@g.us';
    const adminJid = 'admin@s.whatsapp.net';

    database.updateGroupSettings(1, groupJid, {
      auto_remove_chat: 1,
      auto_remove_mode: 'remove_image',
      warn_user: 1,
    });

    const sentMessages = [];
    const mockSock = {
      user: { id: 'bot@s.whatsapp.net', name: 'Capybot' },
      groupMetadata: async () => ({
        id: groupJid,
        subject: 'Test Group',
        participants: [
          { id: adminJid, admin: 'admin' },
        ],
      }),
      sendMessage: async (jid, content, options) => {
        sentMessages.push({ jid, content, options });
      },
    };

    const adminImageMsg = {
      key: { remoteJid: groupJid, participant: adminJid, id: 'ADMIN_IMG_1', fromMe: false },
      message: {
        imageMessage: { caption: 'Official Admin Photo' },
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: 'Boss Admin',
    };

    await handleIncomingMessage(mockSock, adminImageMsg, null, 1);

    // Admin message must NOT be deleted
    const deleteAction = sentMessages.find((m) => m.content?.delete?.id === 'ADMIN_IMG_1');
    assert.strictEqual(deleteAction, undefined, 'Admin image message must not be deleted');
  });

  await runAsyncTest('Mode 2 Bug Fix: Emoji reactions to images do NOT trigger text deletion or warning', async () => {
    const groupJid = '120363888888888888@g.us';
    const nonAdminJid = '60123456789@s.whatsapp.net';

    database.updateGroupSettings(1, groupJid, {
      auto_remove_chat: 1,
      auto_remove_mode: 'remove_text',
      warn_user: 1,
    });

    const sentMessages = [];
    const mockSock = {
      user: { id: 'bot@s.whatsapp.net', name: 'Capybot' },
      groupMetadata: async () => ({
        id: groupJid,
        subject: 'Test Group',
        participants: [
          { id: 'admin@s.whatsapp.net', admin: 'admin' },
          { id: nonAdminJid, admin: null },
        ],
      }),
      sendMessage: async (jid, content, options) => {
        sentMessages.push({ jid, content, options });
      },
    };

    // User reacts with heart emoji ❤️ to a photo
    const reactionMsg = {
      key: { remoteJid: groupJid, participant: nonAdminJid, id: 'REACT_MSG_1', fromMe: false },
      message: {
        reactionMessage: {
          key: { remoteJid: groupJid, id: 'SOME_PHOTO_ID' },
          text: '❤️',
          senderTimestampMs: Date.now(),
        },
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: 'Charlie',
    };

    await handleIncomingMessage(mockSock, reactionMsg, null, 1);

    // Ensure NO message was deleted and NO warning was sent to the user
    const deleteAction = sentMessages.find((m) => m.content?.delete);
    assert.strictEqual(deleteAction, undefined, 'Emoji reactions must NOT be deleted');

    const warningAction = sentMessages.find((m) => m.content?.text && m.content.text.includes('text-only messages are not allowed'));
    assert.strictEqual(warningAction, undefined, 'Bot must NOT send text warning when user reacts to an image');
  });

  await runAsyncTest('Mode 2 Bug Fix: WhatsApp stub / system events do NOT trigger random member tagging', async () => {
    const groupJid = '120363888888888888@g.us';
    const targetMemberJid = '60199998888@s.whatsapp.net';

    database.updateGroupSettings(1, groupJid, {
      auto_remove_chat: 1,
      auto_remove_mode: 'remove_text',
      warn_user: 1,
    });

    const sentMessages = [];
    const mockSock = {
      user: { id: 'bot@s.whatsapp.net', name: 'Capybot' },
      groupMetadata: async () => ({
        id: groupJid,
        subject: 'Test Group',
        participants: [
          { id: 'admin@s.whatsapp.net', admin: 'admin' },
          { id: targetMemberJid, admin: null },
        ],
      }),
      sendMessage: async (jid, content, options) => {
        sentMessages.push({ jid, content, options });
      },
    };

    // WhatsApp group stub event (e.g. member added/promoted, no message body)
    const stubEvent = {
      key: { remoteJid: groupJid, participant: targetMemberJid, id: 'STUB_EVENT_1', fromMe: false },
      messageStubType: 28, // GROUP_PARTICIPANT_CHANGE
      messageStubParameters: [targetMemberJid],
      message: null,
      messageTimestamp: Math.floor(Date.now() / 1000),
    };

    await handleIncomingMessage(mockSock, stubEvent, null, 1);

    // Ensure bot did not tag the member or delete anything
    const deleteAction = sentMessages.find((m) => m.content?.delete);
    assert.strictEqual(deleteAction, undefined, 'Stub events must NOT trigger message deletion');

    const warningAction = sentMessages.find((m) => m.content?.text && m.content.text.includes('text-only messages are not allowed'));
    assert.strictEqual(warningAction, undefined, 'Bot must NOT tag random members on system stub events');
  });

  runTest('Helper: isReactionMessage, isSystemOrStubMessage, and isActualTextMessage', () => {
    assert.strictEqual(isReactionMessage({ message: { reactionMessage: { text: '👍' } } }), true);
    assert.strictEqual(isReactionMessage({ message: { encReactionMessage: {} } }), true);
    assert.strictEqual(isReactionMessage({ message: { conversation: 'hello' } }), false);

    assert.strictEqual(isSystemOrStubMessage({ messageStubType: 28 }), true);
    assert.strictEqual(isSystemOrStubMessage({ message: { protocolMessage: { type: 0 } } }), true);
    assert.strictEqual(isSystemOrStubMessage({ message: {} }), true);
    assert.strictEqual(isSystemOrStubMessage({ message: { conversation: 'hello' } }), false);

    assert.strictEqual(isActualTextMessage({ message: { conversation: 'hello' } }), true);
    assert.strictEqual(isActualTextMessage({ message: { extendedTextMessage: { text: 'testing 123' } } }), true);
    assert.strictEqual(isActualTextMessage({ message: { reactionMessage: { text: '❤️' } } }), false);
    assert.strictEqual(isActualTextMessage({ messageStubType: 28 }), false);
    assert.strictEqual(isActualTextMessage({ message: { conversation: '   ' } }), false);
  });

  console.log(`\n==========================================`);
  console.log(`Auto Remove Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log(`==========================================\n`);

  if (failedTests > 0) {
    throw new Error(`${failedTests} tests failed.`);
  }
}

import { fileURLToPath } from 'url';

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runAutoRemoveTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

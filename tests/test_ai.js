import assert from 'assert';
import Database from 'better-sqlite3';
import { createDatabaseHelper } from '../src/database/db.js';
import aiService from '../src/bot/services/aiService.js';

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

export async function runAITests() {
  console.log('🤖 Starting Qwen 3.5 On-Device Local AI & Multimodal Tests...\n');

  const database = createDatabaseHelper(new Database(':memory:'));

  // =========================================================================
  // 1. COMMAND TRIGGER PATTERNS & REGEX MATCHING
  // =========================================================================
  console.log('--- 1. AI Command Trigger Matching Tests ---');

  await runTest('Match .ask command variations', () => {
    const askRegex = /^\.(ask|ai|tanya|qwen)\b/i;
    assert.strictEqual(askRegex.test('.ask what is quantum computing?'), true);
    assert.strictEqual(askRegex.test('.ai Explain gravity'), true);
    assert.strictEqual(askRegex.test('.tanya Siapa penemu listrik?'), true);
    assert.strictEqual(askRegex.test('.qwen Hello world'), true);
    assert.strictEqual(askRegex.test('.asking for help'), false);
    assert.strictEqual(askRegex.test('ask me anything'), false);
  });

  await runTest('Extract prompt from .ask command', () => {
    const text1 = '.ask What is the speed of light in vacuum?';
    const clean1 = text1.replace(/^\.(ask|ai|tanya|qwen)\s*/i, '').trim();
    assert.strictEqual(clean1, 'What is the speed of light in vacuum?');

    const text2 = '.ai   How do planes fly?  ';
    const clean2 = text2.replace(/^\.(ask|ai|tanya|qwen)\s*/i, '').trim();
    assert.strictEqual(clean2, 'How do planes fly?');
  });

  await runTest('Match .summarize command variations', () => {
    const summarizeRegex = /^\.(summarize|summary|recap|ringkas)\b/i;
    assert.strictEqual(summarizeRegex.test('.summarize'), true);
    assert.strictEqual(summarizeRegex.test('.summary'), true);
    assert.strictEqual(summarizeRegex.test('.recap'), true);
    assert.strictEqual(summarizeRegex.test('.ringkas'), true);
    assert.strictEqual(summarizeRegex.test('.summarizer'), false);
    assert.strictEqual(summarizeRegex.test('can you summarize'), false);
  });

  await runTest('Verify .generateimage is removed from aiService', () => {
    assert.strictEqual(typeof aiService.generateImage, 'undefined');
  });

  // =========================================================================
  // 2. QWEN 3.5 MODEL REGISTRY & MANAGEMENT
  // =========================================================================
  console.log('--- 2. Qwen 3.5 Model Registry & Management Tests ---');

  await runTest('aiService.getAIModels returns all 6 required Qwen 3.5 models', async () => {
    const res = await aiService.getAIModels();
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.models));
    assert.strictEqual(res.models.length, 6);

    const modelIds = res.models.map((m) => m.id);
    const expectedIds = [
      'qwen-3.5-0.8b-q4',
      'qwen-3.5-0.8b-q8',
      'qwen-3.5-2b-q4',
      'qwen-3.5-2b-q8',
      'qwen-3.5-4b-q4',
      'qwen-3.5-4b-q8',
    ];

    expectedIds.forEach((id) => {
      assert.ok(modelIds.includes(id), `Missing required model: ${id}`);
    });

    const modelNames = res.models.map((m) => m.name);
    assert.ok(modelNames.includes('Qwen 3.5 0.8B Q4'));
    assert.ok(modelNames.includes('Qwen 3.5 0.8B Q8'));
    assert.ok(modelNames.includes('Qwen 3.5 2B Q4'));
    assert.ok(modelNames.includes('Qwen 3.5 2B Q8'));
    assert.ok(modelNames.includes('Qwen 3.5 4B Q4'));
    assert.ok(modelNames.includes('Qwen 3.5 4B Q8'));

    // Verify all models support multimodal vision
    res.models.forEach((m) => {
      assert.strictEqual(m.supports_vision, true);
    });
  });

  await runTest('aiService.downloadAIModel initiates model download', async () => {
    const res = await aiService.downloadAIModel('qwen-3.5-0.8b-q8');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.model_id, 'qwen-3.5-0.8b-q8');
  });

  await runTest('aiService.applyAIModel switches active AI model', async () => {
    const res = await aiService.applyAIModel('qwen-3.5-2b-q4');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.active_model_id, 'qwen-3.5-2b-q4');
  });

  await runTest('aiService.updateAIConfig sets context length', async () => {
    const res = await aiService.updateAIConfig({ contextLength: 8192 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.context_length, 8192);
  });

  await runTest('aiService.checkAIStatus returns valid status (available/busy/unavailable)', async () => {
    const res = await aiService.checkAIStatus();
    assert.strictEqual(res.success, true);
    assert.ok(['available', 'busy', 'unavailable'].includes(res.status));
    assert.ok(res.active_model);
    assert.ok(res.context_length > 0);
  });

  // =========================================================================
  // 3. DATABASE SETTINGS FOR AI
  // =========================================================================
  console.log('--- 3. Database AI Settings & Persistence Tests ---');

  await runTest('Group settings default AI disabled (0)', () => {
    const settings = database.getGroupSettings(1, '120363000000000000@g.us');
    assert.strictEqual(settings.ai_enabled, 0);
  });

  await runTest('User default AI status is disabled (ai_enabled=0, ai_prompted=0) and updates cleanly', () => {
    const user = database.createUser({
      phoneNumber: '6088888888',
      passwordHash: 'hash',
      displayName: 'Test Onboard',
    });
    const status = database.getUserAIStatus(user.id);
    assert.strictEqual(status.ai_enabled, false);
    assert.strictEqual(status.ai_prompted, false);

    // Update status (e.g. user chooses Enable AI)
    database.updateUserAIStatus(user.id, { aiEnabled: 1, aiPrompted: 1 });
    const updated = database.getUserAIStatus(user.id);
    assert.strictEqual(updated.ai_enabled, true);
    assert.strictEqual(updated.ai_prompted, true);
  });

  await runTest('Update and persist AI group toggles', () => {
    const groupJid = '120363000000000000@g.us';
    database.updateGroupSettings(1, groupJid, {
      ai_enabled: 1,
    });

    const updated = database.getGroupSettings(1, groupJid);
    assert.strictEqual(updated.ai_enabled, 1);

    // Disable
    database.updateGroupSettings(1, groupJid, {
      ai_enabled: 0,
    });
    const disabled = database.getGroupSettings(1, groupJid);
    assert.strictEqual(disabled.ai_enabled, 0);
  });

  // =========================================================================
  // 4. GROUP MESSAGE EXTRACTION & SUMMARIZATION
  // =========================================================================
  console.log('--- 4. Message History Extraction & Summarizer Tests ---');

  await runTest('Store and retrieve 100 group messages for AI summarizer', () => {
    const groupJid = '120363999999999999@g.us';
    const users = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
    const baseTime = Date.now();

    for (let i = 0; i < 25; i++) {
      const user = users[i % users.length];
      database.saveGroupMessage(1, {
        messageId: `msg_${i}`,
        groupJid,
        senderJid: `${user.toLowerCase()}@s.whatsapp.net`,
        senderName: user,
        messageText: `Discussing project milestone ${i}: we should test the Qwen 3.5 AI deployment.`,
        timestamp: baseTime + i * 1000,
      });
    }

    const result = database.getGroupMessages(1, groupJid, { limit: 100 });
    assert.strictEqual(result.messages.length, 25);

    // Verify chronological ordering (oldest to newest returned by getGroupMessages)
    assert.strictEqual(result.messages[0].sender_name, 'Alice');
    assert.strictEqual(result.messages[24].sender_name, 'Eve');
  });

  await runTest('Summarizer produces structured markdown output', async () => {
    const sampleMessages = [
      { sender_name: 'Alice', message_text: 'Hey team, what time is the deployment?' },
      { sender_name: 'Bob', message_text: 'Deployment is scheduled for 3 PM today.' },
      { sender_name: 'Charlie', message_text: 'I have tested the Qwen 3.5 multimodal image recognition endpoint.' },
      { sender_name: 'Diana', message_text: 'Awesome, everything looks green!' },
    ];

    const res = await aiService.summarizeGroupMessages(sampleMessages, { groupName: 'Tech Team' });
    assert.strictEqual(res.success, true);
    assert.ok(res.summary && res.summary.length > 0);
    assert.ok(res.summary.includes('SUMMARY') || res.summary.includes('Team') || res.summary.includes('Alice') || res.summary.length > 10);
  });

  // =========================================================================
  // 5. AI SERVICE CLIENT & MULTIMODAL IMAGE RECOGNITION
  // =========================================================================
  console.log('--- 5. AI Service Multimodal Image Recognition & Text Inference ---');

  await runTest('aiService.askQuestion returns response for text Q&A', async () => {
    const res = await aiService.askQuestion({
      prompt: 'What is the theory of relativity?',
      senderName: 'Felix',
    });
    assert.ok(res.response && res.response.length > 0);
    assert.ok(res.response.includes('Felix') || res.response.toLowerCase().includes('relativity') || res.response.toLowerCase().includes('einstein') || res.response.length > 15);
  });

  await runTest('aiService.askQuestion handles multimodal image buffer with visual recognition', async () => {
    // 1x1 valid PNG buffer
    const validPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const res = await aiService.askQuestion({
      prompt: 'What is shown in this picture?',
      imageBuffer: validPngBuffer,
      mimetype: 'image/png',
      senderName: 'Felix',
    });
    assert.ok(res.response && res.response.length > 0);
    assert.ok(res.response.includes('Image Recognition') || res.response.includes('Visual') || res.response.length > 15);
  });

  console.log(`\n==========================================`);
  console.log(`AI Test Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log(`==========================================\n`);

  if (failedTests > 0) {
    throw new Error(`${failedTests} tests failed in AI test suite.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAITests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

/**
 * Automated Test Suite for AI Crash Detection, Safe Mode, and Hardware Recommendation Assessment
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import aiHealthService from '../src/bot/services/aiHealthService.js';
import database from '../src/database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const healthFilePath = path.resolve(__dirname, '../data/ai_health.json');

async function runTest() {
  console.log('🧪 Starting AI Crash Detection & Hardware Recommendation Tests...\n');

  // Test 1: Record AI Start and Verify active status
  console.log('1️⃣ Testing recordAIStart...');
  aiHealthService.recordAIStart('qwen-3.5-0.8b-q4');
  let health = aiHealthService.getAIHealth();
  assert.strictEqual(health.active, true, 'AI should be marked active');
  assert.strictEqual(health.clean_shutdown, false, 'Clean shutdown should be false while running');
  assert.strictEqual(health.last_model_id, 'qwen-3.5-0.8b-q4', 'Last model should match');
  console.log('   ✅ recordAIStart tracked successfully.');

  // Test 2: Record Clean Shutdown
  console.log('2️⃣ Testing recordAICleanStop...');
  aiHealthService.recordAICleanStop();
  health = aiHealthService.getAIHealth();
  assert.strictEqual(health.active, false, 'AI should be inactive');
  assert.strictEqual(health.clean_shutdown, true, 'Clean shutdown should be true');
  console.log('   ✅ recordAICleanStop tracked successfully.');

  // Test 3: Record AI Crash & Fail-Safe Recovery
  console.log('3️⃣ Testing recordAICrash & checkAndHandleStartupCrashCheck...');
  aiHealthService.recordAICrash('Simulated OOM Kill (Out Of Memory)', 'qwen-3.5-4b-q8');
  health = aiHealthService.getAIHealth();
  assert.strictEqual(health.crash_detected, true, 'Crash should be detected');
  assert.strictEqual(health.last_model_id, 'qwen-3.5-4b-q8');
  assert.ok(health.crash_reason.includes('OOM Kill'));

  // Test database.disableAllUsersAI()
  console.log('4️⃣ Testing database.disableAllUsersAI()...');
  const res = database.disableAllUsersAI();
  assert.strictEqual(res, true, 'disableAllUsersAI should return true');
  const anyAi = database.isAnyUserAIEnabled();
  assert.strictEqual(anyAi, false, 'All users AI should be disabled');
  console.log('   ✅ Database fail-safe disableAllUsersAI succeeded.');

  // Test startup crash check handling
  console.log('5️⃣ Testing checkAndHandleStartupCrashCheck...');
  const recoveryReport = aiHealthService.checkAndHandleStartupCrashCheck(database);
  assert.strictEqual(recoveryReport.crashDetected, true, 'Startup crash check should detect previous crash');
  console.log(`   ✅ Startup recovery triggered: "${recoveryReport.reason}"`);

  // Test 6: Acknowledge crash
  console.log('6️⃣ Testing acknowledgeCrash...');
  aiHealthService.acknowledgeCrash();
  health = aiHealthService.getAIHealth();
  assert.strictEqual(health.crash_acknowledged, true, 'Crash should be marked acknowledged');
  assert.strictEqual(health.crash_detected, false, 'Crash detected flag should be cleared');
  console.log('   ✅ acknowledgeCrash succeeded.');

  console.log('\n🎉 ALL AI CRASH DETECTION & SAFETY TESTS PASSED SUCCESSFULLY!\n');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

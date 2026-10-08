import assert from 'assert';
import Database from 'better-sqlite3';
import { createDatabaseHelper } from '../src/database/db.js';
import { crashLogger } from '../src/bot/services/crashLogger.js';

console.log('🧪 Starting Crash Logger & System Diagnostics Unit Tests...\n');

const testDb = createDatabaseHelper(new Database(':memory:'));

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}\n`);
    failed++;
  }
}

async function runTests() {
  await test('Database schema creates crash_logs table and index', () => {
    const tableCheck = testDb.getCrashCount(1);
    assert.strictEqual(tableCheck, 0);
  });

  await test('Record crash log with telemetry and metadata in SQLite', () => {
    const recorded = testDb.recordCrashLog({
      userId: 1,
      crashType: 'uncaught_exception',
      errorMessage: 'ReferenceError: invalidFunction is not defined',
      stackTrace: 'ReferenceError: invalidFunction is not defined\n    at index.js:42:5',
      metadata: { component: 'test_runner', ramMB: 256 },
    });

    assert.ok(recorded.id > 0);
    assert.strictEqual(recorded.crashType, 'uncaught_exception');
    assert.strictEqual(recorded.errorMessage, 'ReferenceError: invalidFunction is not defined');

    const logs = testDb.getCrashLogs(1, 10);
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].parsedMetadata.component, 'test_runner');
  });

  await test('crashLogger service parses and analyzes root causes accurately', () => {
    // 1. OOM error
    crashLogger.recordCrash({
      userId: 1,
      crashType: 'unclean_exit_or_oom',
      errorMessage: 'Process terminated abruptly without clean shutdown (Probable Linux Out-Of-Memory OOM Killer).',
      stackTrace: 'JavaScript heap out of memory',
    }, testDb);

    // 2. Network socket disconnect
    crashLogger.recordCrash({
      userId: 1,
      crashType: 'uncaught_exception',
      errorMessage: 'WebSocket error: ECONNRESET',
      stackTrace: 'Error: ECONNRESET at Socket.onclose',
    }, testDb);

    // 3. AI microservice crash
    crashLogger.recordCrash({
      userId: 1,
      crashType: 'ai_microservice_crash',
      errorMessage: 'Python process died while running qwen-3.5-4b',
      stackTrace: 'Model inference killed',
    }, testDb);

    const history = crashLogger.getCrashHistory(1, 10, testDb);
    assert.ok(history.length >= 4);

    // Check AI microservice analysis
    const aiCrash = history.find(h => h.crashType === 'ai_microservice_crash');
    assert.ok(aiCrash);
    assert.strictEqual(aiCrash.analysis.category, 'AI Microservice Crash');

    // Check OOM analysis
    const oomCrash = history.find(h => h.crashType === 'unclean_exit_or_oom');
    assert.ok(oomCrash);
    assert.strictEqual(oomCrash.analysis.category, 'Memory Exhaustion (OOM)');
    assert.ok(oomCrash.analysis.recommendation.includes('Swap'));

    // Check Network analysis
    const netCrash = history.find(h => h.errorMessage.includes('ECONNRESET'));
    assert.ok(netCrash);
    assert.strictEqual(netCrash.analysis.category, 'Network / Socket Interruption');
  });

  await test('Clear crash logs empties history', () => {
    assert.ok(testDb.getCrashCount() > 0);
    testDb.clearCrashLogs();
    assert.strictEqual(testDb.getCrashCount(), 0);
  });

  console.log(`\n==========================================`);
  console.log(`Crash Logger Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`==========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();

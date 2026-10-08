import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');
const healthFilePath = path.join(projectRoot, 'data', 'ai_health.json');

function ensureDataDir() {
  const dir = path.dirname(healthFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const DEFAULT_HEALTH = {
  active: false,
  clean_shutdown: true,
  last_model_id: 'qwen-3.5-0.8b-q4',
  crash_detected: false,
  crash_reason: null,
  crash_timestamp: null,
  crash_acknowledged: false,
  last_start_time: null,
};

export function getAIHealth() {
  try {
    ensureDataDir();
    if (fs.existsSync(healthFilePath)) {
      const data = JSON.parse(fs.readFileSync(healthFilePath, 'utf-8'));
      return { ...DEFAULT_HEALTH, ...data };
    }
  } catch (e) {
    console.warn('[AIHealth] Could not read health state file:', e.message);
  }
  return { ...DEFAULT_HEALTH };
}

export function saveAIHealth(health) {
  try {
    ensureDataDir();
    fs.writeFileSync(healthFilePath, JSON.stringify(health, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[AIHealth] Could not save health state file:', e.message);
  }
}

/**
 * Called when Python AI microservice starts up.
 */
export function recordAIStart(modelId) {
  const health = getAIHealth();
  health.active = true;
  health.clean_shutdown = false;
  const mId = typeof modelId === 'object' && modelId ? (modelId.id || 'qwen-3.5-0.8b-q4') : modelId;
  health.last_model_id = mId || health.last_model_id;
  health.last_start_time = Date.now();
  saveAIHealth(health);
}

/**
 * Called on intentional clean stop (e.g. toggle off).
 */
export function recordAICleanStop() {
  const health = getAIHealth();
  health.active = false;
  health.clean_shutdown = true;
  health.crash_detected = false;
  saveAIHealth(health);
}

/**
 * Called when Python AI microservice crashes unexpectedly.
 */
export function recordAICrash(errorMessage = null) {
  const health = getAIHealth();
  health.active = false;
  health.clean_shutdown = false;
  health.crash_detected = true;
  health.crash_reason = errorMessage || 'Python AI microservice process terminated unexpectedly.';
  health.crash_timestamp = Date.now();
  health.crash_acknowledged = false;
  saveAIHealth(health);

  try {
    import('./crashLogger.js').then(({ default: crashLogger }) => {
      crashLogger.recordCrash({
        userId: 1,
        crashType: 'ai_microservice_crash',
        errorMessage: health.crash_reason,
        stackTrace: `AI Model Microservice (${health.last_model_id || 'unknown'}) terminated unexpectedly.`,
        metadata: { modelId: health.last_model_id },
      });
    }).catch(() => {});
  } catch (e) { }
}

/**
 * Checks on application startup whether a crash occurred in the previous session.
 * If a crash is detected, disables AI features for all accounts to guarantee safe boot.
 */
export function checkAndHandleStartupCrashCheck(database) {
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5005';
  const isRemoteAIService = AI_SERVICE_URL && !AI_SERVICE_URL.includes('localhost') && !AI_SERVICE_URL.includes('127.0.0.1');

  // If connected to a dedicated remote AI instance, local OOM fail-safe is not applicable
  if (isRemoteAIService) {
    return {
      crashDetected: false,
      reason: null,
      modelId: 'qwen-3.5-0.8b-q4',
      timestamp: null,
    };
  }

  const health = getAIHealth();

  // If marked crashed OR if left running without clean shutdown
  const hadUncleanExit = health.active && !health.clean_shutdown;
  const isCrashed = health.crash_detected || hadUncleanExit;

  if (isCrashed) {
    health.crash_detected = true;
    health.active = false;
    health.clean_shutdown = true;
    if (!health.crash_reason) {
      health.crash_reason = `The application stopped unexpectedly while running ${health.last_model_id || 'the AI model'} (possible OOM, high memory pressure, or crash).`;
    }
    if (!health.crash_timestamp) {
      health.crash_timestamp = Date.now();
    }
    health.crash_acknowledged = false;
    saveAIHealth(health);

    // Fail-Safe Recovery: automatically disable AI features across all users
    if (database && typeof database.disableAllUsersAI === 'function') {
      try {
        database.disableAllUsersAI();
        console.warn(`[AIHealth] 🛡️ FAIL-SAFE RECOVERY ACTIVATED: AI features automatically disabled across all accounts.`);
      } catch (err) {
        console.error('[AIHealth] Failed to disable AI during recovery:', err.message);
      }
    }

    return {
      crashDetected: true,
      reason: health.crash_reason,
      modelId: health.last_model_id,
      timestamp: health.crash_timestamp,
    };
  }

  return {
    crashDetected: false,
    reason: null,
    modelId: health.last_model_id,
    timestamp: null,
  };
}

/**
 * Acknowledges and dismisses the crash notification.
 */
export function acknowledgeCrash() {
  const health = getAIHealth();
  health.crash_detected = false;
  health.crash_acknowledged = true;
  health.crash_reason = null;
  saveAIHealth(health);
  return health;
}

export default {
  getAIHealth,
  saveAIHealth,
  recordAIStart,
  recordAICleanStop,
  recordAICrash,
  checkAndHandleStartupCrashCheck,
  acknowledgeCrash,
};

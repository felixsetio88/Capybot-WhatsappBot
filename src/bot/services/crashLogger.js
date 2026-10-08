import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import database from '../../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');
const dataDir = path.join(projectRoot, 'data');
const sessionStateFile = path.join(dataDir, 'app_session_state.json');
const fallbackCrashFile = path.join(dataDir, 'crash_logs_backup.json');

let heartbeatTimer = null;
let ioInstance = null;

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Categorize error into human-understandable cause and recommended fix
 */
function analyzeCrashCause(errorMessage = '', stackTrace = '', crashType = '') {
  const text = `${errorMessage} ${stackTrace} ${crashType}`.toLowerCase();

  if (text.includes('heap out of memory') || text.includes('javascript heap') || text.includes('oom') || crashType === 'unclean_exit_or_oom') {
    return {
      category: 'Memory Exhaustion (OOM)',
      summary: 'Process was killed by the OS or exceeded V8 heap ceiling.',
      cause: 'The available physical RAM was exhausted, causing Linux Out-Of-Memory Killer or Node.js heap limit termination.',
      recommendation: 'Add a 2GB–4GB Swap file on your VPS (e.g. `sudo fallocate -l 2G /swapfile`) and avoid running heavy local AI models simultaneously.',
      severity: 'critical',
    };
  }

  if (text.includes('econnreset') || text.includes('connection reset') || text.includes('websocket') || text.includes('connection lost') || text.includes('etimedout')) {
    return {
      category: 'Network / Socket Interruption',
      summary: 'WhatsApp Web socket or network connection was dropped by server/peer.',
      cause: 'Temporary network disconnect or WhatsApp Web server renegotiation.',
      recommendation: 'Normal transient network behavior. Automatic reconnection will safely restore the session.',
      severity: 'warning',
    };
  }

  if (text.includes('sqlite') || text.includes('busy') || text.includes('locked')) {
    return {
      category: 'Database Concurrency Lock',
      summary: 'SQLite database encountered a concurrent write or lock.',
      cause: 'Multiple asynchronous operations attempted conflicting write locks.',
      recommendation: 'Capybot WAL mode handles this gracefully; ensure disk has sufficient free storage.',
      severity: 'warning',
    };
  }

  if (text.includes('python') || text.includes('ai') || text.includes('microservice') || crashType === 'ai_microservice_crash') {
    return {
      category: 'AI Microservice Crash',
      summary: 'The local Python AI inference engine stopped unexpectedly.',
      cause: 'Insufficient RAM for model weights or missing Python packages.',
      recommendation: 'Check that active model fits your server RAM, or use 0.8B quantized model.',
      severity: 'high',
    };
  }

  if (text.includes('cannot read propert') || text.includes('is not a function') || text.includes('typeerror')) {
    return {
      category: 'Application Logic Error (TypeError)',
      summary: 'A JavaScript runtime error occurred in application code.',
      cause: 'An undefined variable or unexpected data format was encountered.',
      recommendation: 'Review the stack trace below to identify the originating function.',
      severity: 'high',
    };
  }

  return {
    category: 'Runtime Exception',
    summary: 'Unexpected process termination or unhandled exception.',
    cause: errorMessage || 'Unknown runtime error occurred.',
    recommendation: 'Review error details and stack trace below for diagnostic information.',
    severity: 'medium',
  };
}

/**
 * Capture detailed snapshot of machine telemetry at time of crash
 */
function captureTelemetry() {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return {
    nodeVersion: process.version,
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    processUptimeSec: Math.round(process.uptime()),
    systemUptimeSec: Math.round(os.uptime()),
    pid: process.pid,
    memory: {
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      externalBytes: mem.external,
      systemFreeBytes: freeMem,
      systemTotalBytes: totalMem,
      systemFreeMB: Math.round(freeMem / 1024 / 1024),
      systemTotalMB: Math.round(totalMem / 1024 / 1024),
      systemUsedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    },
  };
}

class CrashLoggerService {
  constructor() {
    this.initialized = false;
  }

  setSocketIO(io) {
    ioInstance = io;
  }

  /**
   * Initialize session heartbeat and check for previous unclean exits (OOM kills)
   */
  init(db = database) {
    if (this.initialized) return;
    this.initialized = true;

    ensureDataDir();

    // 1. Inspect previous session state for unclean exit / OOM kill
    this.checkPreviousSessionExit(db);

    // 2. Register current session heartbeat
    this.startHeartbeat();

    // 3. Register graceful shutdown hooks to record clean exit
    const recordCleanExit = (signal) => {
      try {
        ensureDataDir();
        fs.writeFileSync(
          sessionStateFile,
          JSON.stringify({
            running: false,
            cleanShutdown: true,
            exitSignal: signal,
            exitTime: Date.now(),
            pid: process.pid,
          }, null, 2),
          'utf-8'
        );
      } catch (e) { }
    };

    process.once('SIGINT', () => recordCleanExit('SIGINT'));
    process.once('SIGTERM', () => recordCleanExit('SIGTERM'));
    process.once('beforeExit', () => recordCleanExit('beforeExit'));
  }

  checkPreviousSessionExit(db) {
    try {
      if (!fs.existsSync(sessionStateFile)) {
        this.writeSessionState(true);
        return;
      }

      const prev = JSON.parse(fs.readFileSync(sessionStateFile, 'utf-8'));
      if (prev && prev.running && !prev.cleanShutdown) {
        const lastHb = prev.lastHeartbeat || prev.startTime || Date.now();
        const durationSec = Math.round((lastHb - (prev.startTime || lastHb)) / 1000);
        const crashTs = lastHb;

        const crashData = {
          userId: 1,
          crashType: 'unclean_exit_or_oom',
          errorMessage: 'Application terminated abruptly without clean shutdown (Probable Linux Out-Of-Memory OOM Killer or server reboot).',
          stackTrace: `Process PID ${prev.pid || 'unknown'} was terminated unexpectedly without triggering exit hooks.\n` +
            `Active duration: ${durationSec}s before abrupt halt.\n` +
            `Last recorded heartbeat: ${new Date(lastHb).toISOString()}`,
          metadata: {
            probableCause: 'Linux Kernel Out-Of-Memory (OOM) Killer sent SIGKILL, or the server power-cycled.',
            lastHeartbeat: lastHb,
            previousPid: prev.pid,
            telemetry: captureTelemetry(),
          },
          timestamp: crashTs,
        };

        this.recordCrash(crashData, db);
        console.warn(`[CrashLogger] ⚠️ Previous session terminated abruptly (OOM/kill). Logged to crash history.`);
      }
    } catch (err) {
      console.warn('[CrashLogger] Failed checking previous session exit:', err.message);
    }

    this.writeSessionState(true);
  }

  writeSessionState(running) {
    try {
      ensureDataDir();
      fs.writeFileSync(
        sessionStateFile,
        JSON.stringify({
          running,
          cleanShutdown: !running,
          startTime: Date.now(),
          lastHeartbeat: Date.now(),
          pid: process.pid,
        }, null, 2),
        'utf-8'
      );
    } catch (e) { }
  }

  startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      try {
        if (!fs.existsSync(sessionStateFile)) return;
        const current = JSON.parse(fs.readFileSync(sessionStateFile, 'utf-8'));
        current.lastHeartbeat = Date.now();
        fs.writeFileSync(sessionStateFile, JSON.stringify(current, null, 2), 'utf-8');
      } catch (e) { }
    }, 15000);

    if (heartbeatTimer.unref) {
      heartbeatTimer.unref(); // Don't prevent Node process from exiting
    }
  }

  /**
   * Log a crash or runtime error with full diagnostics
   */
  recordCrash({
    userId = 1,
    crashType = 'uncaught_exception',
    errorMessage = 'Unknown crash',
    stackTrace = '',
    metadata = {},
    timestamp = null,
  }, db = database) {
    const ts = timestamp || Date.now();
    const telemetry = captureTelemetry();
    const analysis = analyzeCrashCause(errorMessage, stackTrace, crashType);

    const mergedMetadata = {
      analysis,
      telemetry,
      ...(typeof metadata === 'object' ? metadata : { raw: metadata }),
    };

    let savedEntry = null;

    // 1. Primary: Save in SQLite database
    try {
      if (db && typeof db.recordCrashLog === 'function') {
        savedEntry = db.recordCrashLog({
          userId,
          crashType,
          errorMessage,
          stackTrace,
          metadata: mergedMetadata,
          timestamp: ts,
        });
      }
    } catch (dbErr) {
      console.error('[CrashLogger] SQLite insert failed, using JSON backup:', dbErr.message);
    }

    // 2. Secondary: Synchronous JSON fallback backup
    try {
      ensureDataDir();
      let backupLogs = [];
      if (fs.existsSync(fallbackCrashFile)) {
        try {
          backupLogs = JSON.parse(fs.readFileSync(fallbackCrashFile, 'utf-8')) || [];
        } catch (e) {
          backupLogs = [];
        }
      }

      const backupEntry = {
        id: savedEntry?.id || Date.now(),
        user_id: userId,
        crash_type: crashType,
        error_message: errorMessage,
        stack_trace: stackTrace,
        metadata: JSON.stringify(mergedMetadata),
        timestamp: ts,
      };

      backupLogs.unshift(backupEntry);
      if (backupLogs.length > 50) backupLogs = backupLogs.slice(0, 50);
      fs.writeFileSync(fallbackCrashFile, JSON.stringify(backupLogs, null, 2), 'utf-8');
    } catch (fsErr) {
      console.error('[CrashLogger] Failed writing JSON backup log:', fsErr.message);
    }

    // 3. Emit real-time update to web dashboards via Socket.IO
    if (ioInstance) {
      try {
        ioInstance.emit('system:crash_logged', {
          id: savedEntry?.id || Date.now(),
          crashType,
          errorMessage,
          timestamp: ts,
          analysis,
        });
      } catch (e) { }
    }

    return savedEntry;
  }

  /**
   * Retrieve list of past crashes
   */
  getCrashHistory(userId = null, limit = 50, db = database) {
    let logs = [];
    try {
      if (db && typeof db.getCrashLogs === 'function') {
        logs = db.getCrashLogs(userId, limit);
      }
    } catch (e) {
      console.warn('[CrashLogger] Database query failed, checking backup JSON:', e.message);
    }

    // If SQLite returned empty or had an issue, attempt reading fallback JSON
    if ((!logs || logs.length === 0) && fs.existsSync(fallbackCrashFile)) {
      try {
        const backup = JSON.parse(fs.readFileSync(fallbackCrashFile, 'utf-8'));
        logs = (backup || []).map(row => {
          let parsed = null;
          try { parsed = JSON.parse(row.metadata); } catch (e) { }
          return { ...row, parsedMetadata: parsed };
        });
      } catch (e) { }
    }

    // Enrich logs with parsed analysis
    return (logs || []).map(item => {
      const meta = item.parsedMetadata || {};
      const analysis = meta.analysis || analyzeCrashCause(item.error_message, item.stack_trace, item.crash_type);
      return {
        id: item.id,
        userId: item.user_id,
        crashType: item.crash_type,
        errorMessage: item.error_message,
        stackTrace: item.stack_trace,
        timestamp: item.timestamp,
        formattedTime: new Date(item.timestamp).toLocaleString(),
        analysis,
        telemetry: meta.telemetry || null,
        metadata: meta,
      };
    });
  }

  /**
   * Clear all crash logs
   */
  clearCrashHistory(userId = null, db = database) {
    let deleted = 0;
    try {
      if (db && typeof db.clearCrashLogs === 'function') {
        deleted = db.clearCrashLogs(userId);
      }
    } catch (e) { }

    try {
      if (fs.existsSync(fallbackCrashFile)) {
        fs.unlinkSync(fallbackCrashFile);
      }
    } catch (e) { }

    return { success: true, count: deleted };
  }
}

export const crashLogger = new CrashLoggerService();
export default crashLogger;

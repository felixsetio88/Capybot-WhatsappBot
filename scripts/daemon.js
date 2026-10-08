#!/usr/bin/env node

/**
 * Capybot Self-Healing Auto-Restart Supervisor
 * Automatically monitors and restarts Capybot if it crashes or exits unexpectedly.
 * Limits memory ceiling to 450MB for smooth operation on 1GB RAM instances.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serverScript = path.join(rootDir, 'src', 'server.js');
const backupCrashFile = path.join(rootDir, 'data', 'crash_logs_backup.json');

let childProcess = null;
let restartCount = 0;
let lastCrashTime = 0;
let isShuttingDown = false;

function startBot() {
  if (isShuttingDown) return;

  const now = Date.now();
  if (now - lastCrashTime < 10000) {
    restartCount++;
  } else {
    restartCount = 0;
  }
  lastCrashTime = now;

  // If crashing in rapid succession (more than 5 times in 10s), add exponential delay
  const delay = restartCount > 5 ? 10000 : 2000;

  console.log(`\n======================================================`);
  console.log(`🛡️  [Supervisor] Launching Capybot V1.1 (Memory limit: 450MB)...`);
  console.log(`======================================================\n`);

  // Launch Node with memory limits to prevent Linux OOM freezes on 1GB VMs
  const args = [
    '--max-old-space-size=450',
    serverScript,
  ];

  childProcess = spawn(process.execPath, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: process.env.PORT || '3000',
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
  });

  childProcess.on('exit', (code, signal) => {
    childProcess = null;

    if (isShuttingDown) {
      console.log('[Supervisor] Bot stopped cleanly.');
      process.exit(0);
    }

    console.warn(`\n⚠️  [Supervisor] Capybot exited (Exit code: ${code}, Signal: ${signal}).`);
    console.log(`🔄 [Supervisor] Automatically restarting in ${delay / 1000}s... (Crash count: ${restartCount + 1})\n`);

    // Record supervisor crash entry for dashboard visibility
    try {
      let list = [];
      if (fs.existsSync(backupCrashFile)) {
        try { list = JSON.parse(fs.readFileSync(backupCrashFile, 'utf-8')) || []; } catch (e) { list = []; }
      }
      list.unshift({
        id: Date.now(),
        user_id: 1,
        crash_type: 'supervisor_auto_restart',
        error_message: `Capybot process exited with code ${code}${signal ? ` (Signal: ${signal})` : ''}. Auto-restarted by supervisor.`,
        stack_trace: `Supervisor restart attempt #${restartCount + 1}\nExit Code: ${code}\nTermination Signal: ${signal || 'none'}`,
        metadata: JSON.stringify({
          exitCode: code,
          signal,
          restartCount: restartCount + 1,
          analysis: {
            category: 'Supervisor Process Recovery',
            summary: `Process terminated with exit code ${code}.`,
            cause: signal === 'SIGKILL' ? 'Kernel killed process (OOM memory exhaustion)' : `Process exited with code ${code}`,
            recommendation: 'Check that memory limits are not exceeded and swap memory is active.',
            severity: 'high',
          },
        }),
        timestamp: Date.now(),
      });
      if (list.length > 50) list = list.slice(0, 50);
      fs.writeFileSync(backupCrashFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) { }

    setTimeout(startBot, delay);
  });

  childProcess.on('error', (err) => {
    console.error('[Supervisor] Failed to start bot process:', err);
  });
}

// Graceful shutdown handling
function handleShutdown(signal) {
  isShuttingDown = true;
  console.log(`\n[Supervisor] Received ${signal}. Gracefully stopping Capybot...`);
  if (childProcess) {
    childProcess.kill(signal);
  }
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Start initial process
startBot();

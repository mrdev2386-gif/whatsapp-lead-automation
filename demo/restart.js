#!/usr/bin/env node

/**
 * Production Restart Wrapper
 * Handles automatic restarts on crashes with exponential backoff
 */

const { spawn } = require('child_process');
const path = require('path');

const MAX_RESTARTS = 5;
const RESTART_DELAY_BASE = 5000; // 5 seconds
let restartCount = 0;
let lastRestartTime = Date.now();

function startApp() {
  console.log(`[RESTART] Starting application (attempt ${restartCount + 1})...`);
  
  const child = spawn('node', [path.join(__dirname, 'dist', 'index.js')], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  child.on('exit', (code, signal) => {
    const now = Date.now();
    const timeSinceLastRestart = now - lastRestartTime;
    
    // Reset counter if app ran for more than 5 minutes
    if (timeSinceLastRestart > 5 * 60 * 1000) {
      restartCount = 0;
    }

    console.log(`\n[RESTART] Application exited with code ${code} (signal: ${signal})`);
    console.log(`[RESTART] Uptime: ${Math.round(timeSinceLastRestart / 1000)}s`);

    if (code === 0) {
      console.log('[RESTART] Clean exit - stopping');
      process.exit(0);
    }

    restartCount++;
    lastRestartTime = now;

    if (restartCount > MAX_RESTARTS) {
      console.error(`[RESTART] Max restart attempts (${MAX_RESTARTS}) exceeded - stopping`);
      process.exit(1);
    }

    const delay = RESTART_DELAY_BASE * Math.pow(2, restartCount - 1);
    console.log(`[RESTART] Restarting in ${Math.round(delay / 1000)}s...`);
    
    setTimeout(startApp, delay);
  });

  // Handle parent process signals
  const sigTermHandler = () => {
    console.log('[RESTART] SIGTERM received - shutting down gracefully');
    child.kill('SIGTERM');
  };

  const sigIntHandler = () => {
    console.log('[RESTART] SIGINT received - shutting down gracefully');
    child.kill('SIGINT');
  };

  process.once('SIGTERM', sigTermHandler);
  process.once('SIGINT', sigIntHandler);

  child.on('exit', () => {
    process.removeListener('SIGTERM', sigTermHandler);
    process.removeListener('SIGINT', sigIntHandler);
  });
}

console.log('[RESTART] WhatsApp Automation Wrapper Started');
console.log('[RESTART] Max restarts: ' + MAX_RESTARTS);
console.log('[RESTART] Base restart delay: ' + RESTART_DELAY_BASE + 'ms');

startApp();

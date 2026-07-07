/**
 * Process Manager
 * Manages child process tracking and session cancellation state
 */

const activeProcesses = new Map();
const cancelledSessions = new Set();
const activeSessions = new Set(); // Track currently running audit sessions

/**
 * Register a child process for tracking
 */
function registerProcess(processId, childProcess) {
  activeProcesses.set(processId, childProcess);
}

/**
 * Get a tracked child process by ID
 */
function getProcess(processId) {
  return activeProcesses.get(processId);
}

/**
 * Unregister a child process (usually when it completes)
 */
function unregisterProcess(processId) {
  activeProcesses.delete(processId);
}

/**
 * Get all active process IDs and their child processes
 */
function getAllProcesses() {
  return activeProcesses;
}

/**
 * Kill all active child processes
 * Used when cancelling audits or before app quit
 * Platform-aware: Windows doesn't support SIGTERM
 */
function killAllProcesses() {
  const isWindows = process.platform === 'win32';

  for (const [id, childProcess] of activeProcesses) {
    try {
      if (isWindows) {
        // Windows: Use taskkill to forcefully terminate process tree
        const spawn = require('child_process').spawn;
        spawn('taskkill', ['/pid', childProcess.pid, '/T', '/F']);
      } else {
        // Unix: Use SIGTERM for graceful shutdown
        childProcess.kill('SIGTERM');
      }
      console.log(`[CLEANUP] Killed process ${id} (PID: ${childProcess.pid})`);
    } catch (err) {
      console.error(`[CLEANUP] Failed to kill process ${id}:`, err.message);
    }
    activeProcesses.delete(id);
  }
}

/**
 * Register a new audit session
 */
function startSession(sessionId) {
  activeSessions.add(sessionId);
}

/**
 * Mark a session as cancelled
 */
function cancelSession(sessionId) {
  cancelledSessions.add(sessionId);
}

/**
 * Check if a session has been cancelled
 */
function isSessionCancelled(sessionId) {
  return cancelledSessions.has(sessionId);
}

/**
 * Clean up a session (remove from both active and cancelled sets)
 */
function endSession(sessionId) {
  activeSessions.delete(sessionId);
  cancelledSessions.delete(sessionId);
}

/**
 * Mark all active sessions as cancelled
 * Used when user clicks "Cancel All Audits"
 */
function cancelAllSessions() {
  for (const sessionId of activeSessions) {
    cancelledSessions.add(sessionId);
    console.log(`[CANCEL] Marked session ${sessionId} as cancelled`);
  }
}

module.exports = {
  registerProcess,
  getProcess,
  unregisterProcess,
  getAllProcesses,
  killAllProcesses,
  startSession,
  cancelSession,
  isSessionCancelled,
  endSession,
  cancelAllSessions
};

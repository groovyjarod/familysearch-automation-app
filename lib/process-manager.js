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
 * Used when cancelling audits
 */
function killAllProcesses() {
  for (const [id, process] of activeProcesses) {
    process.kill("SIGTERM");
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

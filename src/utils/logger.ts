import { saveLogToFirebase, type AppErrorLog } from "../firebase";
export type { AppErrorLog };

// In-memory cache for fast local access in the developer overlay console
let memoryLogs: AppErrorLog[] = [];
let onLogsUpdatedListeners: Array<(logs: AppErrorLog[]) => void> = [];

// Rate limiting for Firestore writes to prevent payload explosions
let logCountInCurrentWindow = 0;
let lastLogWindowStart = Date.now();
const LOG_WINDOW_MS = 10000; // 10 seconds
const MAX_LOGS_PER_WINDOW = 10;

export function registerLogsListener(listener: (logs: AppErrorLog[]) => void) {
  onLogsUpdatedListeners.push(listener);
  // Initial fire
  listener([...memoryLogs]);
  return () => {
    onLogsUpdatedListeners = onLogsUpdatedListeners.filter(l => l !== listener);
  };
}

function notifyListeners() {
  onLogsUpdatedListeners.forEach(listener => {
    try {
      listener([...memoryLogs]);
    } catch (e) {
      // Ignored
    }
  });
}

/**
 * Capture an error programmatically and send it to Firestore.
 */
export async function captureAppError(
  message: string,
  stack?: string,
  component: string = "Console",
  userEmail: string = "n.lohberger.pro@gmail.com",
  shouldSyncToFirebase: boolean = true
) {
  const now = new Date();
  
  // Rate limit check
  if (now.getTime() - lastLogWindowStart > LOG_WINDOW_MS) {
    lastLogWindowStart = now.getTime();
    logCountInCurrentWindow = 0;
  }
  
  if (logCountInCurrentWindow >= MAX_LOGS_PER_WINDOW) {
    console.warn("Log rate limit exceeded, dropping log to prevent Firestore batch explosion");
    return;
  }
  
  logCountInCurrentWindow++;

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  // Truncate message and stack to prevent Firestore size limit errors
  const strMessage = typeof message === 'string' ? message : (message ? JSON.stringify(message) : "Unknown Error");
  const safeMessage = strMessage.length > 5000 ? strMessage.substring(0, 5000) + "... [TRUNCATED]" : strMessage;
  const strStack = typeof stack === 'string' ? stack : (stack ? JSON.stringify(stack) : new Error().stack || "");
  const safeStack = strStack.length > 5000 ? strStack.substring(0, 5000) + "... [TRUNCATED]" : strStack;

  const logEntry: AppErrorLog = {
    message: safeMessage,
    stack: safeStack,
    email: userEmail,
    timestamp: now.toISOString(),
    createdAt: null, // Will be set by serverTimestamp() in firebase.ts
    component,
    dateStr
  };

  // Add to local list (prepend so newest is first)
  memoryLogs = [logEntry, ...memoryLogs].slice(0, 300);
  notifyListeners();

  // Async push to firebase if specified (unhandled exceptions sync, console errors stay in memory to save quota)
  if (shouldSyncToFirebase) {
    await saveLogToFirebase(logEntry);
  }
}

/**
 * Set up global error interception for uncaught JS errors and unhandled promise rejections
 */
export function setupGlobalErrorInterception(getCurrentUserEmail: () => string) {
  // 1. Intercept window error events
  window.addEventListener("error", (event) => {
    const errorMsg = event.message || "Unknown error";
    // Filter out uninformative cross-origin script error noise from iframes or browser extensions
    if (errorMsg === "Script error." && !event.filename && !event.error) {
      console.warn("Ignored cross-origin unhandled script event");
      return;
    }
    const srcFile = event.filename ? ` in ${event.filename}:${event.lineno}` : "";
    const stack = event.error ? event.error.stack : "";
    captureAppError(`${errorMsg}${srcFile}`, stack, "UnhandledRuntimeError", getCurrentUserEmail(), false);
  });

  // 2. Intercept unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : "";
    captureAppError(`Promise Rejection: ${msg}`, stack, "UnhandledPromiseRejection", getCurrentUserEmail());
  });

  // 3. Patch console.error to capture warnings/errors
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Call original so it displays in developer tools
    originalConsoleError.apply(console, args);

    // Convert arguments to a single message string
    const message = args
      .map((arg) => {
        if (arg instanceof Error) {
          return `${arg.message}\nStack: ${arg.stack}`;
        } else if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    // Only log if not originating from Firebase itself (to avoid infinite loop of firebase connection warnings)
    if (!message.includes("Unable to save log to Firebase") && !message.includes("FirebaseError") && !message.includes("firestoreDatabaseId") && !message.includes("Firestore Error") && !message.includes("Request payload size exceeds the limit")) {
      // Find stack trace if possible
      const stack = new Error().stack || "";
      // Set shouldSyncToFirebase=false so console.error messages stay in memory for local administration but do not consume Firebase write quota
      captureAppError(message, stack, "ConsoleError", getCurrentUserEmail(), false);
    }
  };
}

export function clearMemoryLogs() {
  memoryLogs = [];
  notifyListeners();
}

/**
 * Format helper for copying logs list to clipboard
 */
export function formatLogsForClipboard(logs: AppErrorLog[]): string {
  if (logs.length === 0) return "Aucun log à copier.";
  return logs
    .map((log) => {
      return `[${log.timestamp}] [${log.component}] [User: ${log.email}]\nMessage: ${log.message}\n${
        log.stack ? `Stack: ${log.stack}\n` : ""
      }--------------------------------------------------`;
    })
    .join("\n");
}

/**
 * Filter logs to the last hour
 */
export function filterLogsLastHour(logs: AppErrorLog[]): AppErrorLog[] {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return logs.filter((log) => new Date(log.timestamp) >= oneHourAgo);
}

/**
 * Filter logs to a specific date string (YYYY-MM-DD)
 */
export function filterLogsByDate(logs: AppErrorLog[], targetDate: string): AppErrorLog[] {
  return logs.filter((log) => log.dateStr === targetDate);
}

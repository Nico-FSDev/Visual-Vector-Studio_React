import { get, set, del, keys } from 'idb-keyval';
import { captureAppError } from './logger';

// --- Multi-Layer Persistence Architecture ---
// Layer 1: In-memory (React State)
// Layer 2: Synchronous LocalStorage (Instant snapshot for immediate recovery)
// Layer 3: IndexedDB (idb-keyval) for large datasets (Images, SVG elements, robust session state)
// Layer 4: Server-side (Firebase Firestore for remote sync)

const STORE_VERSION = 3;
const SESSION_STATE_KEY = "vvs_active_session_state";
const SESSION_LOCAL_KEY = "vvs_active_session_local_backup";
const SESSION_CHECKPOINT_KEY = "vvs_checkpoint_state";
const PENDING_CHANGES_KEY = "vvs_pending_sync";
const LATEST_MOTIF_KEY = "vvs_latest_imported_motif";

export interface SessionState {
  version: number;
  lastUpdated: number;
  globalTab: "qr" | "logo" | "card" | "pdf" | "settings" | "corporate" | "pro";
  appTheme: "visual-studio" | "cyber-punk";
  qrStyleState: any; 
  qrUrl?: string;
  qrAiPrompt?: string;
  pdfDraftId?: string;
  pdfElements?: any[];
  logoDraftState?: any;
  cardDraftState?: any;
  isDirty?: boolean;
  corporateSubTab?: "qr" | "card" | "career";
}

/**
 * Sanitizes an individual vector element to prevent undefined property crashes
 */
export function sanitizeVectorElement(el: any): any {
  if (!el || typeof el !== 'object') return null;
  return {
    id: el.id || `el-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: el.name || "Élément",
    type: el.type || "rect",
    shapeType: el.shapeType || undefined,
    x: typeof el.x === 'number' && !isNaN(el.x) ? el.x : 0,
    y: typeof el.y === 'number' && !isNaN(el.y) ? el.y : 0,
    width: typeof el.width === 'number' && !isNaN(el.width) ? Math.max(1, el.width) : 100,
    height: typeof el.height === 'number' && !isNaN(el.height) ? Math.max(1, el.height) : 100,
    rotate: typeof el.rotate === 'number' && !isNaN(el.rotate) ? el.rotate : 0,
    opacity: typeof el.opacity === 'number' && !isNaN(el.opacity) ? Math.min(1, Math.max(0, el.opacity)) : 1,
    fill: typeof el.fill === 'string' ? el.fill : "#E2BA5A",
    fillGradient: !!el.fillGradient,
    fillGradientColors: Array.isArray(el.fillGradientColors) ? el.fillGradientColors : ["#E2BA5A", "#A5802E"],
    fillGradientType: el.fillGradientType === "radial" ? "radial" : "linear",
    fillGradientAngle: typeof el.fillGradientAngle === 'number' ? el.fillGradientAngle : 0,
    stroke: typeof el.stroke === 'string' ? el.stroke : "none",
    strokeWidth: typeof el.strokeWidth === 'number' ? Math.max(0, el.strokeWidth) : 0,
    strokeDash: el.strokeDash === "dashed" ? "dashed" : "solid",
    imageUrl: typeof el.imageUrl === 'string' ? el.imageUrl : undefined,
    pathData: typeof el.pathData === 'string' ? el.pathData : undefined,
    clipPathData: typeof el.clipPathData === 'string' ? el.clipPathData : undefined,
    eraserStrokes: Array.isArray(el.eraserStrokes) ? el.eraserStrokes : [],
    isHidden: !!el.isHidden,
    isLocked: !!el.isLocked,
    rx: typeof el.rx === 'number' ? el.rx : 0,
    points: typeof el.points === 'number' ? el.points : 5,
    arcAngle: typeof el.arcAngle === 'number' ? el.arcAngle : 90,
    flipX: !!el.flipX,
    flipY: !!el.flipY,
    textValue: typeof el.textValue === 'string' ? el.textValue : "",
    fontFamily: typeof el.fontFamily === 'string' ? el.fontFamily : "sans-serif",
    fontWeight: typeof el.fontWeight === 'string' ? el.fontWeight : "normal"
  };
}

/**
 * Sanitizes vector document structure
 */
export function sanitizeProjectDocument(doc: any): any {
  if (!doc || typeof doc !== 'object') {
    return {
      id: `doc-${Date.now()}`,
      name: "nouveau-motif.ai",
      elements: [],
      history: [[]],
      historyPointer: 0,
      canvasWidth: 500,
      canvasHeight: 500,
      canvasBgColor: "transparent"
    };
  }

  const sanitizedElements = Array.isArray(doc.elements) 
    ? doc.elements.map(sanitizeVectorElement).filter(Boolean)
    : [];

  return {
    id: doc.id || `doc-${Date.now()}`,
    name: doc.name || "motif.ai",
    elements: sanitizedElements,
    history: Array.isArray(doc.history) && doc.history.length > 0
      ? doc.history.map((h: any) => Array.isArray(h) ? h.map(sanitizeVectorElement).filter(Boolean) : [])
      : [sanitizedElements],
    historyPointer: typeof doc.historyPointer === 'number' ? doc.historyPointer : 0,
    canvasWidth: typeof doc.canvasWidth === 'number' ? doc.canvasWidth : 500,
    canvasHeight: typeof doc.canvasHeight === 'number' ? doc.canvasHeight : 500,
    canvasBgColor: doc.canvasBgColor || "transparent"
  };
}

/**
 * Validates data integrity before writing to storage
 */
function validateSessionState(state: Partial<SessionState>): boolean {
  if (state.globalTab && !["qr", "logo", "card", "pdf", "settings", "corporate", "pro"].includes(state.globalTab)) return false;
  if (state.appTheme && !["visual-studio", "cyber-punk"].includes(state.appTheme)) return false;
  if (state.corporateSubTab && !["qr", "card", "career"].includes(state.corporateSubTab)) return false;
  return true;
}

let debounceTimeout: NodeJS.Timeout | null = null;
let checkpointInterval: NodeJS.Timeout | null = null;
let currentSessionCache: SessionState | null = null;

/**
 * Asynchronously hydrates image elements cached in IndexedDB
 */
export async function hydrateCachedImages(elements: any[]): Promise<any[]> {
  if (!Array.isArray(elements)) return elements;
  return Promise.all(
    elements.map(async (el) => {
      if (el && el.type === 'image') {
        if (!el.imageUrl || (typeof el.imageUrl === 'string' && (el.imageUrl.startsWith('idb-cached:') || el.imageUrl.length < 50))) {
          try {
            const cachedImg = (await get(`vvs_img_${el.id}`)) || (el.name ? await get(`vvs_img_name_${el.name}`) : null);
            if (cachedImg && typeof cachedImg === 'string' && cachedImg.length > 50) {
              return { ...el, imageUrl: cachedImg };
            }
          } catch (e) {}
        }
      }
      return el;
    })
  );
}

/**
 * Automagically persist session state with debounce to both IndexedDB and LocalStorage
 */
export function autosaveSessionState(state: Partial<SessionState>) {
  if (!validateSessionState(state)) {
    console.warn("[Persistence] Validation failed on state update", state);
    return;
  }

  // Update in-memory cache immediately (O(1) allocation)
  const base = currentSessionCache || {
    version: STORE_VERSION,
    lastUpdated: Date.now(),
    globalTab: "logo",
    appTheme: "visual-studio",
    qrStyleState: {},
  };

  const payload: SessionState = {
    ...base,
    ...state,
    lastUpdated: Date.now(),
    isDirty: true,
    version: STORE_VERSION
  };

  currentSessionCache = payload;

  if (debounceTimeout) clearTimeout(debounceTimeout);
  
  // Debounce I/O & serialization (350ms) to preserve 60fps interaction during dragging/zooming
  debounceTimeout = setTimeout(async () => {
    // 1. Lightweight backup to localStorage
    try {
      const lightCopy = { ...payload };
      if (lightCopy.logoDraftState) {
        const lightweightElements = Array.isArray(payload.logoDraftState.elements)
          ? payload.logoDraftState.elements.map((el: any) => {
              if (el.type === 'image' && typeof el.imageUrl === 'string') {
                // Cache valid image payload to IndexedDB in background
                if (el.imageUrl.length > 500 && (el.imageUrl.startsWith('data:image') || el.imageUrl.startsWith('blob:') || el.imageUrl.startsWith('http'))) {
                  set(`vvs_img_${el.id}`, el.imageUrl).catch(() => {});
                  if (el.name) set(`vvs_img_name_${el.name}`, el.imageUrl).catch(() => {});
                }
                return { ...el, imageUrl: `idb-cached:${el.id}` };
              }
              return el;
            })
          : [];

        lightCopy.logoDraftState = {
          activeDocId: payload.logoDraftState.activeDocId,
          canvasWidth: payload.logoDraftState.canvasWidth,
          canvasHeight: payload.logoDraftState.canvasHeight,
          canvasBgColor: payload.logoDraftState.canvasBgColor,
          elements: lightweightElements,
          documentsCount: payload.logoDraftState.documents?.length || 0,
        };
      }
      localStorage.setItem(SESSION_LOCAL_KEY, JSON.stringify(lightCopy));
    } catch (e) {
      // LocalStorage write quota exceeded, non-critical
    }

    // 2. Full fidelity write to IndexedDB
    try {
      await set(SESSION_STATE_KEY, payload);
      startCheckpointing(payload);
    } catch (error: any) {
      console.error("[Persistence] Failed to autosave state to IndexedDB:", error);
      captureAppError(error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : undefined, "PersistenceEngine");
    }
  }, 350);
}

export async function markSessionClean() {
  try {
     const state = await get<SessionState>(SESSION_STATE_KEY);
     if (state) {
        currentSessionCache = { ...state, isDirty: false };
        await set(SESSION_STATE_KEY, currentSessionCache);
     }
  } catch (err) {}
}

/**
 * Periodic safety checkpoints in the background
 */
function startCheckpointing(state: SessionState) {
  if (checkpointInterval) return;
  checkpointInterval = setInterval(async () => {
     try {
       await set(SESSION_CHECKPOINT_KEY, state);
     } catch (err: any) {
       console.error("[Persistence] Checkpoint failed", err);
     }
  }, 3 * 60 * 1000); // 3 minutes periodic safety backup
}

/**
 * Recovers the previous session on startup
 * Fully resilient: Checks IndexedDB -> Checkpoint -> LocalStorage backup
 */
export async function recoverSessionState(): Promise<{state: SessionState | null, wasInterrupted: boolean}> {
  let loadedState: SessionState | null = null;
  let wasInterrupted = false;

  // 1. Try Primary IndexedDB State
  try {
    const rawState = await get<SessionState>(SESSION_STATE_KEY);
    if (rawState && validateSessionState(rawState)) {
      loadedState = rawState;
      wasInterrupted = !!rawState.isDirty;
    }
  } catch (error) {
    console.warn("[Persistence] IndexedDB read issue, checking checkpoint...", error);
  }

  // 2. Fallback to Checkpoint
  if (!loadedState) {
    try {
      const checkpoint = await get<SessionState>(SESSION_CHECKPOINT_KEY);
      if (checkpoint && validateSessionState(checkpoint)) {
        loadedState = checkpoint;
        wasInterrupted = true;
      }
    } catch (err) {}
  }

  // 3. Fallback to LocalStorage
  if (!loadedState) {
    try {
      const localStr = localStorage.getItem(SESSION_LOCAL_KEY);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        if (parsed && validateSessionState(parsed)) {
          loadedState = parsed;
          wasInterrupted = true;
        }
      }
    } catch (err) {}
  }

  if (loadedState) {
    // Sanitize and hydrate logoDraftState if present
    if (loadedState.logoDraftState) {
      if (Array.isArray(loadedState.logoDraftState.elements)) {
        const sanitized = loadedState.logoDraftState.elements.map(sanitizeVectorElement).filter(Boolean);
        loadedState.logoDraftState.elements = await hydrateCachedImages(sanitized);
      }
      if (Array.isArray(loadedState.logoDraftState.documents)) {
        const sanitizedDocs = loadedState.logoDraftState.documents.map(sanitizeProjectDocument);
        loadedState.logoDraftState.documents = await Promise.all(
          sanitizedDocs.map(async (doc: any) => {
            if (Array.isArray(doc.elements)) {
              doc.elements = await hydrateCachedImages(doc.elements);
            }
            return doc;
          })
        );
      }
    }

    currentSessionCache = loadedState;
    console.log("[Persistence] Session recovered successfully, updated at:", new Date(loadedState.lastUpdated || Date.now()).toLocaleTimeString());
    return { state: loadedState, wasInterrupted };
  }

  return { state: null, wasInterrupted: false };
}

/**
 * Persists and retrieves motif locally with full fidelity
 */
export async function saveLocalMotif(motif: {
  id?: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  canvasBgColor?: string;
}) {
  try {
    await set(LATEST_MOTIF_KEY, {
      ...motif,
      updatedAt: Date.now()
    });
  } catch (e) {
    console.warn("[Persistence] Failed saving motif to IndexedDB:", e);
  }
}

export async function getLocalMotif(): Promise<any | null> {
  try {
    return await get(LATEST_MOTIF_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Queue offline updates for the "offline-first" synchronizer
 */
export async function queueOfflineUpdate(action: string, payload: any) {
  try {
    const pending = await get<any[]>(PENDING_CHANGES_KEY) || [];
    pending.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action,
      payload
    });
    await set(PENDING_CHANGES_KEY, pending);
  } catch (err: any) {
    console.error("[Persistence] Failed to queue offline update", err);
  }
}

export async function flushOfflineUpdates(syncWithServer: (action: string, payload: any) => Promise<void>) {
  if (!navigator.onLine) return;
  try {
    const pending = await get<any[]>(PENDING_CHANGES_KEY) || [];
    if (pending.length === 0) return;
    const failed = [];
    for (const item of pending) {
      try {
        await syncWithServer(item.action, item.payload);
      } catch (e: any) {
        failed.push(item);
      }
    }
    await set(PENDING_CHANGES_KEY, failed);
  } catch (err: any) {}
}

if (typeof window !== "undefined") {
  window.addEventListener('online', () => {
    console.log("[Persistence] Network restored.");
  });

  window.addEventListener("beforeunload", () => {
     if (currentSessionCache) {
       currentSessionCache.isDirty = false;
       set(SESSION_STATE_KEY, currentSessionCache).catch(() => {});
     }
  });
}

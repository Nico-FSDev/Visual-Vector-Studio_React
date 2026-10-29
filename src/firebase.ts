import { initializeApp } from "firebase/app";
import { getFirestore, clearIndexedDbPersistence, collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with Database ID from the config
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

export interface AppErrorLog {
  id?: string;
  message: string;
  stack?: string;
  email: string;
  timestamp: string; // ISO string for local UI classification
  createdAt: any; // Firestore Server Timestamp
  component?: string;
  dateStr: string; // YYYY-MM-DD for easy administrative date filtering
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errString = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errString,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  if (errString.includes("client is offline") || errString.includes("network error")) {
    console.warn("Firebase client is currently offline. Action deferred or failed gracefully.");
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

/**
 * Saves a log entry to Firebase under the 'logs' collection.
 */
export async function saveLogToFirebase(log: Omit<AppErrorLog, "createdAt">): Promise<void> {
  const pathForWrite = "logs";
  try {
    const logsRef = collection(db, pathForWrite);
    await addDoc(logsRef, {
      ...log,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Fail silently in the console to prevent infinite logging loops
    console.warn("Unable to save log to Firebase:", error);
    try {
      handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    } catch (e) {
      // Protect app from throwing during silent log attempts
    }
  }
}

/**
 * Ensures a user profile exists in Firestore (split collection: public vs private)
 */
export async function ensureUserProfile(user: any) {
  if (!user || !user.uid) return;
  const publicPath = `users/${user.uid}/public/profile`;
  const privatePath = `users/${user.uid}/private/info`;

  try {
    const publicRef = doc(db, 'users', user.uid, 'public', 'profile');
    const privateRef = doc(db, 'users', user.uid, 'private', 'info');
    
    // Test if public profile exists
    const publicDoc = await getDoc(publicRef);
    if (!publicDoc.exists()) {
      await setDoc(publicRef, {
        userId: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || "User",
        photoURL: user.photoURL || "",
        createdAt: serverTimestamp()
      });
    }

    // Test if private info exists
    const privateDoc = await getDoc(privateRef);
    if (!privateDoc.exists()) {
      await setDoc(privateRef, {
        userId: user.uid,
        email: user.email || "",
        emailVerified: user.emailVerified || false,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.warn("ensureUserProfile non-blocking warning:", error);
    try {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } catch (e) {
      // Catch to prevent crashing the auth state observer
    }
  }
}

/**
 * Syncs a Project Document to Firestore with multi-layer persistence and smart compression
 */
export async function syncDocumentToFirebase(documentData: any): Promise<void> {
  const user = auth.currentUser;
  
  // 1. Always store the pristine full-resolution document in IndexedDB for 100% local fidelity
  try {
    const { set } = await import("idb-keyval");
    await set(`vvs_project_doc_${documentData.id}`, {
      ...documentData,
      localUpdatedAt: Date.now()
    });
  } catch (idbErr) {
    console.warn("[Persistence] Failed to store full project document to IndexedDB:", idbErr);
  }

  if (!user) return; // Only sync to cloud if authenticated
  
  const pathForWrite = `users/${user.uid}/documents/${documentData.id}`;
  try {
    const rawElements = Array.isArray(documentData.elements) ? documentData.elements : [];
    
    // Process image elements with valid compression rather than destructive string slicing
    const processedElements = await Promise.all(
      rawElements.map(async (el: any) => {
        if (!el) return null;
        if (el.type === 'image' && typeof el.imageUrl === 'string' && el.imageUrl.startsWith('data:image')) {
          try {
            // Compress image to a valid JPEG/PNG that fits within document limits
            const compressed = await compressMotifImageForFirestore(el.imageUrl, 1200, 0.82);
            return {
              ...el,
              imageUrl: compressed
            };
          } catch (compErr) {
            console.warn("[Persistence] Image compression warning:", compErr);
            return el;
          }
        }
        return el;
      })
    );

    const safeElements = processedElements.filter(Boolean);
    let serializedElements = JSON.stringify(safeElements);
    let serializedHistory = JSON.stringify((documentData.history || []).slice(-2)); // Keep 2 recent history steps to save space
    
    const totalPayloadBytes = new Blob([serializedElements, serializedHistory]).size;

    // If still oversized for Firestore's 1MB hard limit, strip heavy data from cloud payload but keep local IndexedDB intact
    if (totalPayloadBytes > 850000) {
      console.warn(`[Persistence] Document payload (${Math.round(totalPayloadBytes / 1024)} KB) exceeds Firestore 850KB threshold. Safeguarding full image in IndexedDB.`);
      import("./utils/logger").then(({ captureAppError }) => {
        captureAppError(
          `Document ${documentData.name || documentData.id} payload size (${Math.round(totalPayloadBytes / 1024)} KB) exceeds Firestore threshold. Saved full fidelity in IndexedDB.`,
          undefined,
          "FirestoreSyncEngine",
          user.email || "user@studio.local",
          false
        );
      });

      // Create a lightweight cloud copy with indexeddb references for high-res images
      const lightElements = safeElements.map((el: any) => {
        if (el.type === 'image' && el.imageUrl && el.imageUrl.length > 50000) {
          return {
            ...el,
            imageUrl: `idb-cached:${documentData.id}:${el.id}`
          };
        }
        return el;
      });
      serializedElements = JSON.stringify(lightElements);
      serializedHistory = JSON.stringify([]);
    }

    const docRef = doc(db, 'users', user.uid, 'documents', documentData.id);
    await setDoc(docRef, {
      userId: user.uid,
      id: documentData.id,
      name: documentData.name || "motif.ai",
      elements: serializedElements,
      history: serializedHistory,
      historyPointer: documentData.historyPointer || 0,
      canvasWidth: documentData.canvasWidth || 500,
      canvasHeight: documentData.canvasHeight || 500,
      canvasBgColor: documentData.canvasBgColor || "transparent",
      updatedAt: serverTimestamp()
    });

    console.log(`[Persistence] Document "${documentData.name || documentData.id}" successfully synced to Firestore (${Math.round(totalPayloadBytes / 1024)} KB)`);
  } catch (error: any) {
    console.error("[Persistence] syncDocumentToFirebase error:", error);
    import("./utils/logger").then(({ captureAppError }) => {
      captureAppError(
        `Failed to sync document ${documentData.id} to Firestore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        "FirestoreSyncEngine",
        user.email || "user@studio.local",
        false
      );
    });
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

/**
 * Deletes a Project Document from Firestore
 */
export async function deleteDocumentFromFirebase(documentId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  
  const pathForDelete = `users/${user.uid}/documents/${documentId}`;
  try {
    const docRef = doc(db, 'users', user.uid, 'documents', documentId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, pathForDelete);
  }
}

/**
 * Fetches all Project Documents for the current user from Firestore with IndexedDB reconciliation
 */
export async function fetchUserDocuments(): Promise<any[]> {
  const user = auth.currentUser;
  if (!user) return [];
  
  const pathForGet = `users/${user.uid}/documents`;
  try {
    const docsRef = collection(db, 'users', user.uid, 'documents');
    const q = query(docsRef, orderBy("updatedAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    const docs: any[] = [];
    const { get } = await import("idb-keyval");

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      let parsedElements: any[] = [];
      if (typeof data.elements === 'string') {
        try {
          parsedElements = JSON.parse(data.elements);
        } catch (e) {
          parsedElements = [];
        }
      } else if (Array.isArray(data.elements)) {
        parsedElements = data.elements;
      }

      // Check if any element needs reconciliation from local IndexedDB
      const localDoc = await get(`vvs_project_doc_${data.id}`);
      if (localDoc && Array.isArray(localDoc.elements) && localDoc.elements.length > 0) {
        parsedElements = parsedElements.map((el: any) => {
          if (el.type === 'image' && (typeof el.imageUrl !== 'string' || el.imageUrl.startsWith('idb-cached:') || el.imageUrl.length < 100)) {
            const matchLocalEl = localDoc.elements.find((le: any) => le.id === el.id);
            if (matchLocalEl && matchLocalEl.imageUrl && matchLocalEl.imageUrl.startsWith('data:image')) {
              return { ...el, imageUrl: matchLocalEl.imageUrl };
            }
          }
          return el;
        });
      }

      data.elements = parsedElements;
      docs.push(data);
    }
    
    return docs;
  } catch (error) {
    console.error("[Persistence] fetchUserDocuments error:", error);
    import("./utils/logger").then(({ captureAppError }) => {
      captureAppError(
        `Failed to fetch user documents from Firestore: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        "FirestoreSyncEngine",
        user?.email || "user@studio.local",
        false
      );
    });
    handleFirestoreError(error, OperationType.LIST, pathForGet);
    return [];
  }
}

/**
 * Retrieves logs from Firebase Firestore.
 */
export async function fetchLogsFromFirebase(maxCount: number = 250): Promise<AppErrorLog[]> {
  const pathForGet = "logs";
  try {
    const logsRef = collection(db, pathForGet);
    const q = query(logsRef, orderBy("createdAt", "desc"), limit(maxCount));
    const querySnapshot = await getDocs(q);
    
    const logs: AppErrorLog[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push({
        id: docSnap.id,
        message: data.message || "",
        stack: data.stack || "",
        email: data.email || "anonymous",
        timestamp: data.timestamp || new Date().toISOString(),
        dateStr: data.dateStr || "",
        createdAt: data.createdAt,
        component: data.component || "App"
      });
    });
    return logs;
  } catch (error) {
    if (error instanceof Error && (error.message.includes("client is offline") || error.message.includes("network error"))) {
      console.warn("Unable to fetch logs: Firebase client is currently offline.");
    } else if (typeof error === 'string' && (error.includes("client is offline") || error.includes("network error"))) {
      console.warn("Unable to fetch logs: Firebase client is currently offline.");
    } else {
      console.error("Error fetching logs from Firebase:", error);
    }
    handleFirestoreError(error, OperationType.GET, pathForGet);
    return [];
  }
}

/**
 * Helper to downscale and compress image Data URLs to fit within Firestore's 1MB document size limit.
 */
async function compressMotifImageForFirestore(dataUrl: string, maxDimension: number = 1024, quality: number = 0.8): Promise<string> {
  if (!dataUrl || dataUrl.length < 500000) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, width, height);
      
      let compressed = canvas.toDataURL("image/png");
      if (compressed.length > 800000) {
        compressed = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Saves an imported image motif to Firestore (and local IndexedDB) for reinitialization
 */
export async function saveMotifToFirebase(motifData: {
  id?: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  canvasBgColor?: string;
}): Promise<void> {
  // Always save locally to IndexedDB for offline and unauthenticated instant access with full fidelity
  try {
    const { set } = await import("idb-keyval");
    await set("vvs_latest_imported_motif", {
      ...motifData,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn("Unable to save motif locally:", err);
  }

  const user = auth.currentUser;
  if (!user) return; // Authenticated user sync

  const motifId = "current";
  const pathForWrite = `users/${user.uid}/motifs/${motifId}`;
  try {
    const compressedUrl = await compressMotifImageForFirestore(motifData.imageUrl);
    
    // If string still exceeds 850KB, skip remote write to avoid Firestore 1MB document limit error
    if (compressedUrl.length > 850000) {
      console.warn("Motif image is too large for Firestore document limit (1MB). Retained in local IndexedDB storage.");
      return;
    }

    const docRef = doc(db, 'users', user.uid, 'motifs', motifId);
    await setDoc(docRef, {
      userId: user.uid,
      id: motifId,
      name: motifData.name || "Motif Importé",
      imageUrl: compressedUrl,
      width: motifData.width,
      height: motifData.height,
      canvasBgColor: motifData.canvasBgColor || "transparent",
      updatedAt: serverTimestamp()
    });
  } catch (error: any) {
    if (error?.message?.includes("exceeds the maximum allowed size") || error?.toString?.()?.includes("exceeds the maximum allowed size")) {
      console.warn("Motif exceeds Firestore 1MB limit. Kept safely in local IndexedDB storage.");
    } else {
      handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    }
  }
}

/**
 * Fetches the latest saved motif from Firestore or local IndexedDB fallback
 */
export async function fetchLatestMotifFromFirebase(): Promise<any | null> {
  const user = auth.currentUser;
  let remoteMotif: any = null;

  if (user) {
    const pathForGet = `users/${user.uid}/motifs/current`;
    try {
      const docRef = doc(db, 'users', user.uid, 'motifs', 'current');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        remoteMotif = docSnap.data();
      } else {
        const motifsRef = collection(db, 'users', user.uid, 'motifs');
        const q = query(motifsRef, orderBy("updatedAt", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((d) => {
          remoteMotif = d.data();
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, pathForGet);
    }
  }

  if (remoteMotif && remoteMotif.imageUrl) {
    return remoteMotif;
  }

  // Fallback to IndexedDB
  try {
    const { get } = await import("idb-keyval");
    const localMotif = await get("vvs_latest_imported_motif");
    if (localMotif && localMotif.imageUrl) return localMotif;
  } catch (err) {
    console.warn("Unable to fetch local motif:", err);
  }

  return null;
}


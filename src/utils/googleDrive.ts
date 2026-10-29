import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

// In-memory cache for token
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize onAuthStateChanged to clear the cache when signed out
onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

export const getCachedAccessToken = () => cachedAccessToken;
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export async function googleSignInForDrive(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  if (isSigningIn) {
    throw new Error("Authentification Google déjà en cours.");
  }
  
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/drive.readonly");
    provider.addScope("https://www.googleapis.com/auth/drive.metadata.readonly");
    
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Impossible d'obtenir le jeton d'accès Google Drive.");
    }
    
    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
  } catch (error) {
    console.error("Error signing in for Google Drive:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  size?: string;
  iconLink?: string;
}

export async function listDriveFiles(accessToken: string, fileType: 'pdf_image' | 'json'): Promise<GoogleDriveFile[]> {
  // Build query to list only PDFs or JSON files based on the requested category
  let q = "";
  if (fileType === 'pdf_image') {
    q = "mimeType = 'application/pdf' or mimeType starts with 'image/'";
  } else if (fileType === 'json') {
    q = "name contains '.json' or mimeType = 'application/json' or mimeType = 'text/plain'";
  }
  
  // Exclude trashed files
  q = q ? `(${q}) and trashed = false` : "trashed = false";
  
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,createdTime,size,iconLink)&pageSize=50&orderBy=createdTime%20desc`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      // Clear token as it is likely expired
      cachedAccessToken = null;
      throw new Error("Session Google expirée. Veuillez vous reconnecter.");
    }
    const errData = await response.text();
    throw new Error(`Erreur lors de la récupération des fichiers (${response.status}): ${errData}`);
  }
  
  const data = await response.json();
  return data.files || [];
}

export async function downloadDriveFileAsBlob(accessToken: string, fileId: string): Promise<Blob> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      cachedAccessToken = null;
      throw new Error("Session Google expirée. Veuillez vous reconnecter.");
    }
    throw new Error(`Erreur lors du téléchargement du fichier (${response.status})`);
  }
  
  return await response.blob();
}

export async function downloadDriveFileAsText(accessToken: string, fileId: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      cachedAccessToken = null;
      throw new Error("Session Google expirée. Veuillez vous reconnecter.");
    }
    throw new Error(`Erreur lors du téléchargement du fichier (${response.status})`);
  }
  
  return await response.text();
}

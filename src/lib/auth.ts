import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  UserCredential,
} from "firebase/auth";
import { auth } from "../firebase";

import firebaseConfig from "../../firebase-applet-config.json";

export const GOOGLE_SERVER_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_SERVER_CLIENT_ID ||
  (firebaseConfig as any)?.oAuthClientId ||
  "719425329038-hd4d86qjcoedr7r6hfhd34gjd9nfnkm7.apps.googleusercontent.com";

let isInitialized = false;

/**
 * Initialize Google Auth for Capacitor Native and Web
 */
export async function initGoogleAuth(): Promise<void> {
  if (isInitialized) return;
  try {
    if (Capacitor.isNativePlatform()) {
      GoogleAuth.initialize({
        clientId: GOOGLE_SERVER_CLIENT_ID,
        serverClientId: GOOGLE_SERVER_CLIENT_ID,
        scopes: ["profile", "email"],
        grantOfflineAccess: false,
      } as any);
      isInitialized = true;
    }
  } catch (error) {
    console.warn("[GoogleAuth] Initialization note:", error);
  }
}

/**
 * Check whether the application is running in a native mobile wrapper (Android / iOS)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Native Google Auth Bridge:
 * - When running natively on Android, uses @codetrix-studio/capacitor-google-auth
 * - Bridges idToken/accessToken directly into Firebase signInWithCredential
 * - Gracefully absorbs cancellation errors (12501)
 * - Strictly prevents falling through to web popup redirects on mobile devices
 * - In web browser context, uses standard Firebase signInWithPopup
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      await initGoogleAuth();
      const googleUser = await GoogleAuth.signIn();

      const idToken =
        googleUser?.authentication?.idToken || (googleUser as any)?.idToken;
      const accessToken =
        googleUser?.authentication?.accessToken ||
        (googleUser as any)?.accessToken;

      if (!idToken) {
        console.warn("[GoogleAuth] No idToken received from native GoogleAuth");
        return null;
      }

      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential;
    } catch (error: any) {
      const errorMsg = String(error?.message || error || "");
      const errorCode = error?.code || "";

      // 12501 is the standard Android Google Play Services user cancellation error code
      const isCancellation =
        errorCode === 12501 ||
        errorCode === "12501" ||
        errorMsg.includes("12501") ||
        errorMsg.toLowerCase().includes("cancel") ||
        errorMsg.toLowerCase().includes("abort") ||
        errorMsg.toLowerCase().includes("closed");

      if (isCancellation) {
        console.log("[GoogleAuth] User cancelled Google Sign-In.");
        return null;
      }

      console.error("[GoogleAuth] Native Sign-In failed:", error);
      const detail = errorMsg || errorCode ? ` (${errorCode || errorMsg})` : "";
      throw new Error(`Erreur de connexion Google${detail}. Vérifiez Play Services.`);
    }
  }

  // Web platform flow
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    provider.setCustomParameters({
      prompt: "select_account",
    });
    const userCredential = await signInWithPopup(auth, provider);
    return userCredential;
  } catch (error: any) {
    const errorMsg = String(error?.message || error || "");
    if (
      error?.code === "auth/popup-closed-by-user" ||
      error?.code === "auth/cancelled-popup-request" ||
      errorMsg.includes("popup-closed")
    ) {
      console.log("[GoogleAuth] Web popup closed by user.");
      return null;
    }
    console.error("[GoogleAuth] Web Sign-In failed:", error);
    throw error;
  }
}

/**
 * Unified Sign-out for Native & Web Firebase Auth
 */
export async function signOutUser(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await GoogleAuth.signOut().catch(() => {});
    }
  } catch (e) {
    console.warn("[GoogleAuth] Native signOut warning:", e);
  }
  await firebaseSignOut(auth);
}

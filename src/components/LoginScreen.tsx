import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase";
import { signInWithGoogle, isNativePlatform } from "../lib/auth";
import { VisualVectorStudioLogo } from "./VisualVectorStudioLogo";
import { LogIn, UserPlus, AlertCircle, CheckCircle2, ShieldCheck, X } from "lucide-react";

interface LoginScreenProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  isOpen = true,
  onClose,
  onSuccess,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await signInWithGoogle();
      if (res?.user) {
        setSuccessMsg("Connexion Google réussie !");
        setTimeout(() => {
          onSuccess?.();
          onClose?.();
        }, 300);
      }
    } catch (err: any) {
      console.error("Erreur Google Auth:", err);
      setError(err?.message || "Échec de l'authentification Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Veuillez saisir un email et un mot de passe.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccessMsg("Compte créé avec succès !");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccessMsg("Connexion réussie !");
      }
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 300);
    } catch (err: any) {
      console.error("Erreur Email Auth:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Identifiants incorrects. Veuillez vérifier votre email ou mot de passe.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Cette adresse email est déjà associée à un compte.");
      } else if (err.code === "auth/weak-password") {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
      } else {
        setError(err.message || "Erreur lors de la connexion.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#18181b] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 text-neutral-200">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#ff5722]/10 border border-[#ff5722]/30 flex items-center justify-center mb-3">
            <VisualVectorStudioLogo className="w-8 h-8" variant="primary" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {isSignUp ? "Créer un compte Studio" : "Connexion Visual Vector Studio"}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            {isNativePlatform()
              ? "Authentification native Android avec Google Play Services"
              : "Synchronisez vos designs, maquettes et polices vectorielles"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 flex items-start gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Bouton Google Sign-In Native & Web */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer mb-5"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continuer avec Google</span>
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-neutral-800" />
          <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
            ou avec email
          </span>
          <div className="flex-1 h-px bg-neutral-800" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          <div>
            <label className="block text-xs text-neutral-400 font-medium mb-1">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
              required
              className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5722] transition"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 font-medium mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff5722] transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-[#ff5722] hover:bg-[#f4511e] text-white font-semibold text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {isSignUp ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Créer mon compte</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Se connecter</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-xs text-neutral-400 hover:text-white transition underline underline-offset-4"
          >
            {isSignUp
              ? "Vous avez déjà un compte ? Se connecter"
              : "Pas encore de compte ? Créer un profil"}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-neutral-800/80 flex items-center justify-center gap-2 text-[11px] text-neutral-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Protection SSL & Chiffrement Firebase Firestore</span>
        </div>
      </div>
    </div>
  );
};

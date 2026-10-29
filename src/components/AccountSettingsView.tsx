import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updatePassword, 
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { signInWithGoogle, signOutUser } from "../lib/auth";
import { motion } from "motion/react";
import { Lock, User as UserIcon, LogOut, Check, RefreshCw, AlertTriangle, Info, Copy, ExternalLink, QrCode } from "lucide-react";
import { QRCodeCanvas } from "./QRCodeCanvas";
import { QRStyle } from "../types";

export function AccountSettingsView({ isVS, triggerToast }: { isVS: boolean, triggerToast: (msg: string) => void }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoginOrSignup, setIsLoginOrSignup] = useState<"login" | "signup">("login");
  const [hasCopiedUrl, setHasCopiedUrl] = useState(false);

  // App URL for the web app
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://ai.studio/build";

  // Load User state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  const handleCopyAppUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setHasCopiedUrl(true);
    triggerToast("L'URL de l'application a été copiée !");
    setTimeout(() => setHasCopiedUrl(false), 2500);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await signInWithGoogle();
      if (res?.user) {
        triggerToast("Connexion Google réussie !");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Une erreur est survenue lors de l'authentification Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!email || !password) return;
    
    setIsLoading(true);
    try {
      if (isLoginOrSignup === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        triggerToast("Connexion réussie !");
      } else {
        if (password !== confirmPassword) {
          throw new Error("Les mots de passe ne correspondent pas.");
        }
        await createUserWithEmailAndPassword(auth, email, password);
        triggerToast("Compte créé avec succès !");
      }
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Une erreur s'est produite lors de l'authentification.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!password || !confirmPassword) return;
    if (password !== confirmPassword) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }
    
    setIsLoading(true);
    try {
      if (currentUser) {
        await updatePassword(currentUser, password);
        triggerToast("Mot de passe mis à jour avec succès !");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erreur de mise à jour du mot de passe. Vous devez peut-être vous reconnecter.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      triggerToast("Déconnexion réussie !");
    } catch (err) {
      console.error(err);
    }
  };

  // Custom personalized QR Style for the About section
  const aboutQrStyle: QRStyle = {
    dotStyle: "circle",
    backgroundColor: "#181818",
    backgroundGradient: false,
    backgroundGradientType: "linear",
    backgroundGradientColors: ["#181818", "#181818"],
    dotColor: isVS ? "#f05a28" : "#06b6d4",
    dotGradient: true,
    dotGradientType: "linear",
    dotGradientColors: isVS ? ["#f05a28", "#ff8c00"] : ["#06b6d4", "#3b82f6"],
    eyeOuterStyle: "rounded",
    eyeInnerStyle: "circle",
    eyeOuterColor: isVS ? "#f05a28" : "#06b6d4",
    eyeInnerColor: "#ffffff",
    logoType: "preset",
    logoValue: "globe",
    logoSize: 0.22,
    logoBgColor: "#181818",
    logoBgShape: "circle",
    frameStyle: "minimalist",
    frameText: "VISUAL VECTOR STUDIO",
    frameTextColor: isVS ? "#f05a28" : "#06b6d4",
    frameBgColor: "#222222"
  };

  return (
    <motion.div
       initial={{ opacity: 0, x: 10 }}
       animate={{ opacity: 1, x: 0 }}
       className="space-y-6"
    >
      <div className="p-3 bg-[#1e1e1e]/40 border border-[#3c3c3c] rounded-lg text-neutral-200 text-xs flex gap-2 leading-relaxed">
        <UserIcon className={`w-5 h-5 ${isVS ? "text-[#f05a28]" : "text-cyan-500"} shrink-0 mt-0.5`} />
        <div>
          <span className="font-bold text-neutral-100">Compte Utilisateur</span>
          <p className="text-[10px] text-neutral-400 mt-1">
            Gérez vos paramètres de connexion et de sécurité ici. Vous pouvez ajouter un mot de passe ou vous déconnecter.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded text-[10px] flex items-start gap-1.5 font-mono leading-relaxed bg-red-500/10 text-red-400 border border-red-500/15">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {currentUser ? (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 bg-[#141414] border border-[#2d2d2d] rounded-lg relative overflow-hidden">
            <h3 className="text-sm font-bold text-neutral-300 mb-1">Mail du compte connecté :</h3>
            <p className="text-[11px] text-neutral-400 font-mono mb-4 break-all">{currentUser.email || "Utilisateur Google"}</p>
            
            <button
              onClick={handleSignOut}
              className={`w-full py-2 px-3 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isVS 
                  ? "bg-[#1c1c1c] hover:bg-red-950/30 border-red-900/30 text-red-400 hover:border-red-500/55" 
                  : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-rose-400"
              }`}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Se déconnecter de la session</span>
            </button>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-3 bg-[#141414] p-4 border border-[#2d2d2d] rounded-lg">
            <h3 className="text-sm font-bold text-neutral-300 mb-2">Modifier le mot de passe</h3>
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Nouveau mot de passe :</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-800 focus:border-[#f05a28] text-neutral-150 rounded px-3 py-2 text-xs outline-none transition font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Confirmer le nouveau mot de passe :</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#181818] border border-neutral-800 focus:border-[#f05a28] text-neutral-150 rounded px-3 py-2 text-xs outline-none transition font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !password || !confirmPassword}
              className={`px-4 py-2 mt-2 font-black text-xs rounded transition shrink-0 flex items-center gap-1.5 ${
                isVS ? "bg-[#f05a28] hover:bg-[#ff723f] text-white" : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              } disabled:opacity-50 cursor-pointer`}
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Mettre à jour</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <form onSubmit={handleAuthAction} className="space-y-3 bg-[#141414] p-4 border border-[#2d2d2d] rounded-lg">
             <div className="flex gap-4 mb-4 border-b border-[#2d2d2d]">
                <button
                   type="button"
                   onClick={() => { setIsLoginOrSignup("login"); setErrorMsg(""); }}
                   className={`pb-2 text-xs font-bold uppercase transition ${isLoginOrSignup === "login" ? "text-white border-b-2 border-white" : "text-neutral-500 hover:text-neutral-300"} cursor-pointer`}
                >
                   Connexion
                </button>
                <button
                   type="button"
                   onClick={() => { setIsLoginOrSignup("signup"); setErrorMsg(""); }}
                   className={`pb-2 text-xs font-bold uppercase transition ${isLoginOrSignup === "signup" ? "text-white border-b-2 border-white" : "text-neutral-500 hover:text-neutral-300"} cursor-pointer`}
                >
                   Créer un compte
                </button>
             </div>
             
             <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Adresse e-mail :</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#f05a28] text-neutral-150 rounded px-3 py-2 text-xs outline-none transition font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Mot de passe :</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#181818] border border-neutral-800 focus:border-[#f05a28] text-neutral-150 rounded px-3 py-2 text-xs outline-none transition font-mono"
                />
              </div>
              
              {isLoginOrSignup === "signup" && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Confirmer le mot de passe :</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-800 focus:border-[#f05a28] text-neutral-150 rounded px-3 py-2 text-xs outline-none transition font-mono"
                  />
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading || !email || !password || (isLoginOrSignup === "signup" && !confirmPassword)}
                className={`px-4 py-2 mt-4 font-black text-xs rounded transition flex items-center justify-center gap-1.5 w-full cursor-pointer ${
                  isVS ? "bg-[#f05a28] hover:bg-[#ff723f] text-white" : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                } disabled:opacity-50`}
              >
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (isLoginOrSignup === "login" ? <Lock className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />)}
                <span>{isLoginOrSignup === "login" ? "Se connecter" : "S'inscrire"}</span>
              </button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-[#2d2d2d]" />
            <span className="flex-shrink mx-3 text-[10px] text-neutral-500 font-mono font-bold uppercase">OU</span>
            <div className="flex-grow border-t border-[#2d2d2d]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className={`w-full py-2.5 px-3 text-xs font-bold rounded-lg border cursor-pointer transition-all flex items-center justify-center gap-2 ${
              isVS 
                ? "bg-[#1f1f1f] hover:bg-[#282828] border-neutral-700/60 text-neutral-200" 
                : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-150"
            }`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                stroke="none"
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.253-3.133C18.31 1.214 15.514 0 12.24 0c-6.63 0-12 5.37-12 12s5.37 12 12 12c6.924 0 11.52-4.864 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24H12.241z"
              />
            </svg>
            <span>Connexion directe Google</span>
          </button>
        </div>
      )}

      {/* SECTION ABOUT / À PROPOS */}
      <div className="p-4 bg-[#141414] border border-[#2d2d2d] rounded-lg space-y-3">
        <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
          <Info className={`w-4 h-4 ${isVS ? "text-[#f05a28]" : "text-cyan-400"}`} />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-200">
            About / À propos
          </h3>
        </div>

        <p className="text-[11px] text-neutral-400 leading-relaxed">
          <strong className="text-neutral-200">Visual Vector Studio</strong> (v2.5 Pro) est la suite de création vectorielle, QR codes personnalisés, cartes de visite et portfolios interactifs.
        </p>

        {/* Web App URL Block */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
            URL de l'application web :
          </span>
          <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#333333] rounded-md p-1.5 pl-2.5">
            <span className="text-[10px] font-mono text-neutral-300 truncate flex-1 select-all">
              {appUrl}
            </span>
            <button
              onClick={handleCopyAppUrl}
              className={`p-1.5 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                hasCopiedUrl
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : isVS
                  ? "bg-[#282828] hover:bg-[#333333] text-neutral-300 hover:text-white border border-neutral-700"
                  : "bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
              }`}
              title="Copier l'URL"
            >
              {hasCopiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-[#282828] hover:bg-[#333333] text-neutral-300 hover:text-white border border-neutral-700 rounded transition shrink-0"
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Personalized QR Code Section */}
        <div className="pt-2 border-t border-[#262626] flex flex-col items-center text-center space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            <QrCode className={`w-3.5 h-3.5 ${isVS ? "text-[#f05a28]" : "text-cyan-400"}`} />
            <span>QR Code Personnalisé de l'App</span>
          </div>

          <div className="p-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl flex items-center justify-center shadow-inner">
            <QRCodeCanvas
              value={appUrl}
              style={aboutQrStyle}
              size={150}
            />
          </div>

          <p className="text-[9.5px] text-neutral-500 font-mono">
            Scannez ce QR Code pour partager ou ouvrir l'application sur mobile.
          </p>
        </div>
      </div>
    </motion.div>
  );
}


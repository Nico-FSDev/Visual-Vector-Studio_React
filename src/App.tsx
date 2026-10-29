import React, { useState, useEffect, useRef } from "react";
import { ThemedSelect } from "./components/ThemedSelect";
import { 
  Link as LinkIcon, 
  Sparkles, 
  Sliders, 
  Download, 
  Check, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Image as ImageIcon, 
  Compass, 
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  FileDown,
  Maximize2,
  Plus,
  Minus,
  QrCode,
  Palette,
  CreditCard,
  Briefcase,
  Settings,
  FileText,
  Copy,
  X,
  User,
  Terminal,
  LogOut,
  Activity,
  Calendar,
  Upload,
  Presentation
} from "lucide-react";
import { QRCodeCanvas } from "./components/QRCodeCanvas";
import { PRESET_STYLES, DEFAULT_QR_STYLE } from "./presets";
import { QRStyle } from "./types";
import { getContrastRatio, getSmartStyleLibraryFallback } from "./utils";
import { motion, AnimatePresence } from "motion/react";
import { IllustratorCanvas } from "./components/IllustratorCanvas";
import { BusinessCardGenerator } from "./components/BusinessCardGenerator";
import { AccountSettingsView } from "./components/AccountSettingsView";
import { PDFEditor } from "./components/PDFEditor";
import { WhiteboardStudio } from "./components/WhiteboardStudio";
import { CareerStudio } from "./components/CareerStudio";
import {   setupGlobalErrorInterception, 
  registerLogsListener, 
  captureAppError, 
  formatLogsForClipboard,
  filterLogsLastHour,
  filterLogsByDate,
  AppErrorLog
} from "./utils/logger";
import { fetchLogsFromFirebase, ensureUserProfile } from "./firebase";

import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { initGoogleAuth } from "./lib/auth";
import { recoverSessionState, autosaveSessionState, flushOfflineUpdates } from "./utils/persistence";
import { VisualVectorStudioLogo } from "./components/VisualVectorStudioLogo";
import { InstallPrompt } from "./components/InstallPrompt";

export default function App() {
  // --- CORE STATE ---
  const [globalTab, setGlobalTab] = useState<"logo" | "pro" | "corporate" | "pdf" | "settings">("logo");
  const [corporateSubTab, setCorporateSubTab] = useState<"qr" | "card" | "career">("qr");
  const [appTheme, setAppTheme] = useState<"visual-studio" | "cyber-punk">("visual-studio");
  const [customDesignedLogo, setCustomDesignedLogo] = useState<string | null>(null);
  const [isProFullscreen, setIsProFullscreen] = useState(false);

  // --- COMPLETED SETTINGS & RELATIONAL STATES ---
  const [settingsActiveSubTab, setSettingsActiveSubTab] = useState<"appearance" | "performance" | "gemini" | "language">("appearance");
  const [appLanguage, setAppLanguage] = useState<"fr" | "en">("fr");

  const [hasRecovered, setHasRecovered] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem("gemini_api_key") || "");
  const [maxHistorySteps, setMaxHistorySteps] = useState<number>(() => {
    const saved = localStorage.getItem("max_history_steps");
    return saved ? parseInt(saved, 10) : 30;
  });
  const [enableCanvasGridPerf, setEnableCanvasGridPerf] = useState<boolean>(() => {
    const saved = localStorage.getItem("enable_canvas_grid_perf");
    return saved !== "false";
  });
  const [performanceQuality, setPerformanceQuality] = useState<"eco" | "standard" | "high">(() => {
    return (localStorage.getItem("performance_quality") as any) || "standard";
  });
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [keyTestResult, setKeyTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  // --- USER AUTH & CONSOLE STATES ---
  const [userEmail, setUserEmail] = useState<string>("");
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [showVSMenu, setShowVSMenu] = useState<boolean>(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState<boolean>(false);
  const [logs, setLogs] = useState<AppErrorLog[]>([]);
  const [selectedLogsDate, setSelectedLogsDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [searchLogQuery, setSearchLogQuery] = useState<string>("");
  const [adminActiveTab, setAdminActiveTab] = useState<"console" | "options">("console");
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  const emailRef = useRef(userEmail);
  const isAdmin = userEmail?.toLowerCase() === "n.lohberger.pro@gmail.com";

  useEffect(() => {
    emailRef.current = userEmail;
  }, [userEmail]);

  useEffect(() => {
    // Initialize Capacitor Google Auth bridge
    initGoogleAuth().catch((e) => console.warn("Google Auth init note:", e));

    // Start global error interception
    setupGlobalErrorInterception(() => emailRef.current);

    // Register simple in-memory logs subscription
    const unsubscribe = registerLogsListener((updatedLogs) => {
      setLogs(updatedLogs);
    });

    // Test connectivity & Pre-fetch Firebase historic logs on load
    const testFirebaseConnection = async () => {
      try {
        const { getDoc, doc } = await import("firebase/firestore");
        await getDoc(doc(db, "test", "connection"));
        setIsFirebaseConnected(true);
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg.includes("offline") || msg.includes("network")) {
          setIsFirebaseConnected(false);
        } else {
          setIsFirebaseConnected(true);
        }
      }

      if (auth.currentUser?.email === "n.lohberger.pro@gmail.com") {
        await loadFirebaseLogs();
      }
    };
    testFirebaseConnection();

    // Sync Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        setUserEmail(user.email);
        ensureUserProfile(user).catch((err) => {
          console.warn("Could not sync user profile:", err);
        });
        if (user.email === "n.lohberger.pro@gmail.com") {
          loadFirebaseLogs().catch((err) => {
            console.warn("Could not load admin logs:", err);
          });
        }
      } else {
        setUserEmail("invite@creative-studio.fr");
      }
      setAuthReady(true);
    });

    return () => {
      unsubscribe();
      unsubscribeAuth();
    };
  }, []);

  const loadFirebaseLogs = async () => {
    // Only load from Firebase if we have an authenticated user who is the admin
    if (!auth.currentUser || auth.currentUser.email !== "n.lohberger.pro@gmail.com") {
      console.log("Skipping loading historic Firebase logs: user is not the authenticated administrator.");
      return;
    }
    try {
      const historicalLogs = await fetchLogsFromFirebase(250);
      if (historicalLogs.length > 0) {
        setIsFirebaseConnected(true);
        setLogs((current) => {
          const combined = [...current];
          historicalLogs.forEach((hl) => {
            const exists = combined.some(
              (cl) => cl.message === hl.message && cl.timestamp === hl.timestamp
            );
            if (!exists) {
              combined.push(hl);
            }
          });
          return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        });
      }
    } catch (e) {
      setIsFirebaseConnected(false);
      console.warn("Error background fetching firebase logs:", e);
    }
  };

  // Helper to trigger simulated error for instant logging validation
  const triggerSimulatedError = () => {
    // Capture manual or call an error
    try {
      throw new Error("Simulated Administrative Sandbox Error - Captured inside Visual Vector Studio console.");
    } catch (err: any) {
      console.error(err.message, err.stack);
      triggerToast("Erreur simulée capturée et sauvegardée !");
    }
  };

  // Additional logs console states & computed filters
  const [consoleFilterMode, setConsoleFilterMode] = useState<"all" | "hour" | "date">("all");
  const [expandedLogId, setExpandedLogId] = useState<string | number | null>(null);

  const logsLastHour = filterLogsLastHour(logs);
  const logsForSelectedDate = filterLogsByDate(logs, selectedLogsDate);

  const activeFilteredLogs = logs.filter((log) => {
    // Search query constraint
    const msgLower = (log.message || "").toLowerCase();
    const queryLower = searchLogQuery.toLowerCase();
    const matchesSearch = msgLower.includes(queryLower) || (log.component || "").toLowerCase().includes(queryLower);
    if (!matchesSearch) return false;

    if (consoleFilterMode === "hour") {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return new Date(log.timestamp) >= oneHourAgo;
    }
    if (consoleFilterMode === "date") {
      return log.dateStr === selectedLogsDate;
    }
    return true; // "all"
  });

  const handleCopyAll = () => {
    const formatted = formatLogsForClipboard(logs);
    navigator.clipboard.writeText(formatted);
    triggerToast("Tous les logs copiés !");
  };

  const handleCopyLastHour = () => {
    const formatted = formatLogsForClipboard(logsLastHour);
    if (logsLastHour.length === 0) {
      triggerToast("Aucun log durant la dernière heure.");
      return;
    }
    navigator.clipboard.writeText(formatted);
    triggerToast(`${logsLastHour.length} log(s) de la dernière heure copiés !`);
  };

  const handleCopySelectedDate = () => {
    const formatted = formatLogsForClipboard(logsForSelectedDate);
    if (logsForSelectedDate.length === 0) {
      triggerToast(`Aucun log pour le ${selectedLogsDate}.`);
      return;
    }
    navigator.clipboard.writeText(formatted);
    triggerToast(`${logsForSelectedDate.length} log(s) pour la date du ${selectedLogsDate} copiés !`);
  };



  // --- THEME ENGINE VALUES ---
  const isVS = appTheme === "visual-studio";

  // Dynamic Theme Styling Classes
  const bgClass = isVS ? "bg-[#1E1E1E] text-neutral-200" : "bg-slate-950 text-slate-100";
  const headerClass = isVS ? "bg-[#252525] border-b border-[#353535] text-[#dfdfdf]" : "border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40";
  const headerTitleClass = isVS ? "text-[#f05a28] font-black tracking-tight" : "bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 bg-clip-text text-transparent font-extrabold tracking-tight";
  const panelClass = isVS ? "bg-[#252525] border border-[#353535] rounded-lg shadow-lg relative overflow-hidden group p-6 text-neutral-200" : "bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group text-slate-300";
  const panelNoGroupClass = isVS ? "bg-[#252525] border border-[#353535] rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.6)] relative overflow-hidden p-6 text-neutral-200" : "bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden text-slate-300";
  const innerBgClass = isVS ? "bg-[#141414] border border-[#2d2d2d]" : "bg-slate-950 border border-slate-800";
  const labelClass = isVS ? "text-[#f05a28] text-xs font-bold tracking-wider uppercase" : "text-cyan-400 text-sm font-semibold tracking-wider uppercase";
  const buttonPrimaryClass = isVS ? "bg-[#f05a28] hover:bg-[#ff6c3a] text-white font-bold px-6 py-2.5 rounded-md shadow-md transition duration-150 cursor-pointer text-xs" : "bg-gradient-to-r from-cyan-400 to-indigo-500 hover:opacity-95 text-slate-950 font-black text-xs py-3.5 px-6 rounded-xl transition duration-150 cursor-pointer shadow-lg";
  const buttonSecondaryClass = isVS ? "bg-[#333333] hover:bg-[#444444] border border-[#444444] text-neutral-200 font-semibold px-4 py-2 rounded-md transition duration-150 text-xs flex items-center gap-2 text-center justify-center cursor-pointer" : "px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-xl transition flex items-center gap-2 border border-slate-700/30 cursor-pointer";
  const inputClass = isVS ? "w-full bg-[#1c1c1c] border border-[#444444] focus:border-[#f05a28] text-white rounded-md py-3 px-4 text-xs font-mono outline-none transition" : "w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 text-white rounded-xl py-3.5 pl-4 pr-12 text-sm font-medium transition outline-none";
  const activePillClass = isVS ? "bg-[#f05a28]/10 border border-[#f05a28] text-[#ff6d39] rounded-md" : "bg-cyan-500/10 border border-cyan-500 text-cyan-300 rounded-xl";
  const inactivePillClass = isVS ? "bg-[#222222] border border-[#333333] hover:border-neutral-500 text-neutral-400 hover:text-white rounded-md" : "bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl";
  const borderHighlightClass = isVS ? "border-[#f05a28]" : "border-cyan-500";
  const textHighlightClass = isVS ? "text-[#f05a28]" : "text-cyan-400";
  const fontClass = isVS ? "font-sans text-xs" : "font-sans text-sm";

  const [url, setUrl] = useState("https://ai.studio/build");
  const [style, setStyle] = useState<QRStyle>({ ...PRESET_STYLES[0].style });
  const [qrActiveLeftMenu, setQrActiveLeftMenu] = useState<"lien" | "ai" | "manuel" | "export">("lien");
  const [isQrLeftCollapsed, setIsQrLeftCollapsed] = useState(true);
  const [isQrRightCollapsed, setIsQrRightCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"points" | "yeux" | "logo" | "cadre" | "fond">("points");
  
  // Custom logo state
  const [customLogoFile, setCustomLogoFile] = useState<string | null>(null);
  const [uploadedLogos, setUploadedLogos] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // AI Prompter states
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiReasoning, setAiReasoning] = useState<string | null>(
    "Ambiance initiale : Style futuriste et dynamique s'appuyant sur des lumières néons électriques pour capter l'intérêt immédiat."
  );
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isKeyMissingWarning, setIsKeyMissingWarning] = useState(false);

  // Preview options
  const [simulateScan, setSimulateScan] = useState(false);
  const [exportSize, setExportSize] = useState<number>(1024);
  const [downloadReadyDataUrl, setDownloadReadyDataUrl] = useState<string>("");
  const [downloadTrigger, setDownloadTrigger] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Quick Preset Selection Feedback
  const [selectedPresetId, setSelectedPresetId] = useState<string>("neon-cyber");

  useEffect(() => {
    // Session Recovery
    recoverSessionState().then(({state, wasInterrupted}) => {
      if (state) {
        if (state.globalTab) {
          if (state.globalTab === "qr" || state.globalTab === "card") {
            setGlobalTab("corporate");
            setCorporateSubTab(state.globalTab as any);
          } else {
            setGlobalTab(state.globalTab as any);
          }
        }
        if (state.corporateSubTab) {
          setCorporateSubTab(state.corporateSubTab);
        }
        if (state.appTheme) setAppTheme(state.appTheme);
        if (state.qrUrl) setUrl(state.qrUrl);
        if (state.qrAiPrompt) setAiPrompt(state.qrAiPrompt);
        if (state.qrStyleState) setStyle(prev => ({ ...prev, ...state.qrStyleState }));
        // We'll trust the user state to take over
      }
      
      if (wasInterrupted) {
         console.warn("[Session] Recovered an interrupted or crashed session.");
         setToastMessage("Reprise de session automatique: brouillon récupéré.");
         setShowToast(true);
         setTimeout(() => setShowToast(false), 4000);
      }
      
      setHasRecovered(true);
    });

    // Setup network recovery flush
    const handleOnline = () => {
      flushOfflineUpdates(async (action, payload) => {
        console.log("Mock syncing action to server", action, payload);
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [setGlobalTab, setCorporateSubTab, setAppTheme, setUrl, setAiPrompt, setStyle, setToastMessage, setShowToast]);

  // Autosave when important state changes
  useEffect(() => {
    if (!hasRecovered) return;
    autosaveSessionState({
      globalTab,
      corporateSubTab,
      appTheme,
      qrUrl: url,
      qrStyleState: style,
      qrAiPrompt: aiPrompt
    });
  }, [globalTab, corporateSubTab, appTheme, url, style, aiPrompt, hasRecovered]);

  // Real-time Scanability Contrast Check
  const primaryFgColor = style.dotGradient ? style.dotGradientColors[0] : style.dotColor;
  const primaryBgColor = style.backgroundGradient ? style.backgroundGradientColors[0] : style.backgroundColor;
  const contrastRatio = getContrastRatio(primaryFgColor, primaryBgColor);

  let scannabilityStatus: { label: string; colorClass: string; textClass: string; bgClass: string; desc: string } = {
    label: "Excellent",
    colorClass: "bg-emerald-500",
    textClass: "text-emerald-500",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/20",
    desc: "Contraste optimal. Tous les smartphones décoderont instantanément ce QR code."
  };

  if (contrastRatio < 2.0) {
    scannabilityStatus = {
      label: "Très Difficile",
      colorClass: "bg-rose-500",
      textClass: "text-rose-500",
      bgClass: "bg-rose-50 dark:bg-rose-950/20",
      desc: "Contraste critique. Les smartphones risquent de ne pas pouvoir lire ce QR code. Assombrissez les points ou éclaircissez l'arrière-plan."
    };
  } else if (contrastRatio < 3.5) {
    scannabilityStatus = {
      label: "Moyen",
      colorClass: "bg-amber-500",
      textClass: "text-amber-500",
      bgClass: "bg-amber-50 dark:bg-amber-950/20",
      desc: "Contraste passable. Peut nécessiter une bonne luminosité pour être scanné correctement."
    };
  }

  // --- ACTIONS ---

  // Select a style preset
  const handleSelectPreset = (presetId: string, presetStyle: QRStyle) => {
    setSelectedPresetId(presetId);
    setStyle({ ...presetStyle });
    // Keep custom logo path if previously loaded
    if (presetStyle.logoType === "custom" && customLogoFile) {
      setStyle(prev => ({ ...prev, logoUrl: customLogoFile }));
    }
  };

  // Drag & Drop logo handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      processSelectedImageFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedImageFile(file);
    }
  };

  const processSelectedImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === "string") {
        const dataUrl = event.target.result;
        setCustomLogoFile(dataUrl);
        setUploadedLogos(prev => [dataUrl, ...prev.filter(l => l !== dataUrl)].slice(0, 10));
        setStyle(prev => ({
          ...prev,
          logoType: "custom",
          logoUrl: dataUrl
        }));
        triggerToast("Logo personnalisé intégré !");
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // API Call to style-qr endpoint
  const handleAISuggestStyle = async () => {
    if (!aiPrompt.trim()) return;
    setIsLoadingAI(true);
    setAiError(null);
    setIsKeyMissingWarning(false);

    try {
      const response = await fetch("/api/style-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: aiPrompt,
          customApiKey: geminiApiKey || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la communication");
      }

      const data = await response.json();
      if (data.style) {
        setStyle(data.style);
        setAiReasoning(data.reasoning);
        setSelectedPresetId("");
        triggerToast("Style IA appliqué à votre QR code !");
      }
    } catch (err: any) {
      console.warn("API Error, attempting offline library matcher...", err);
      // Let's call our ultra-smart offline library search
      const fallbackResult = getSmartStyleLibraryFallback(aiPrompt);
      
      // Look for a key-missing indicator
      setIsKeyMissingWarning(true);
      
      // Apply offline matched style
      setStyle(prev => ({
        ...prev,
        ...fallbackResult.style
      }));
      setAiReasoning(
        `${fallbackResult.reasoning} (Note : Clé d'API absente ou incorrecte dans vos Secrets, le moteur d'association locale a pris le relais !)`
      );
      triggerToast("Style intelligent de secours appliqué !");
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Fire Canvas download trigger
  const handleDownloadClick = () => {
    if (!downloadReadyDataUrl) return;

    // Create virtual anchor link and download PNG
    const link = document.createElement("a");
    link.href = downloadReadyDataUrl;
    link.download = `AI-QR-Code-${exportSize}px.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(`Téléchargement lancé (${exportSize}x${exportSize}px) !`);
  };

  // Reset current styles to default
  const handleResetToDefault = () => {
    setStyle({ ...DEFAULT_QR_STYLE });
    setSelectedPresetId("");
    setAiReasoning("Style réinitialisé aux paramètres de lisibilité par défaut.");
    triggerToast("Style d'origine réappliqué.");
  };

  // Dynamic test of Gemini API Key input
  const handleTestApiKey = async (customKey: string) => {
    setIsTestingKey(true);
    setKeyTestResult(null);
    try {
      const response = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customApiKey: customKey || undefined }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setKeyTestResult({ success: true, message: data.message });
        triggerToast("Clé d'API configurée avec succès ! ✨");
      } else {
        throw new Error(data.error || "La validation de la clé d'API a échoué.");
      }
    } catch (err: any) {
      setKeyTestResult({ success: false, message: err.message || "Impossible de joindre le service de test." });
      triggerToast("Échec de connexion de clé d'API. ❌");
    } finally {
      setIsTestingKey(false);
    }
  };

  if (!authReady) {
    return (
      <div className={`${bgClass} min-h-screen flex items-center justify-center p-6 text-xs font-bold text-neutral-500`}>
        <RefreshCw className="animate-spin w-4 h-4 mr-2" />
        Vérification de l'authentification...
      </div>
    );
  }

  if (!auth.currentUser || userEmail === "invite@creative-studio.fr") {
    return (
      <div className={`${bgClass} min-h-screen flex flex-col items-center justify-center p-6`}>
        <div className="max-w-md w-full">
          <div className="mb-6 text-center shadow-lg p-6 rounded-xl border border-neutral-800 bg-[#121212]/50">
            <h1 className={`text-2xl font-black mb-2 flex items-center justify-center gap-2 ${headerTitleClass}`}>
              <VisualVectorStudioLogo className="w-8 h-8" variant={isVS ? 'primary' : 'monochrome'} />
              Visual Vector Studio
            </h1>
            <p className="text-xs text-neutral-400">Veuillez vous connecter pour accéder à l'éditeur.</p>
          </div>
          <div className={panelClass}>
            <AccountSettingsView isVS={isVS} triggerToast={triggerToast} />
          </div>
        </div>
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 font-semibold px-6 py-3 rounded-xl shadow-2xl ${
                isVS ? "bg-[#252525] border border-[#353535] text-neutral-100" : "bg-slate-800 border-slate-700 text-white"
              }`}
            >
              <CheckCircle className={`w-5 h-5 ${isVS ? "text-[#f05a28]" : "text-emerald-400"}`} />
              <span className="text-sm tracking-wide">{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={`${bgClass} ${globalTab === "pro" ? "h-screen h-[100dvh] overflow-hidden pb-0" : "min-h-screen pb-28"} flex flex-col transition-colors duration-300 relative`}>
      
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 font-semibold px-6 py-3 rounded-xl shadow-2xl ${
              isVS 
                ? "bg-[#f05a28] text-white shadow-[#f05a28]/25" 
                : "bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 shadow-indigo-500/10"
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Application Header with Admin Icon, Settings Icon, and Avatar Icon in Top Right */}
      {!(globalTab === "pro" && isProFullscreen) && (
        <header className={`sticky top-0 z-40 w-full border-b backdrop-blur-md px-6 py-2.5 flex items-center justify-between transition-colors duration-300 ${
          isVS ? "bg-[#181818]/95 border-[#333333] text-neutral-200" : "bg-slate-900/95 border-slate-800 text-slate-200"
        }`}>
          {/* Left: Branding & App Title */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setGlobalTab("logo")}
              className="flex items-center gap-2.5 hover:opacity-90 transition cursor-pointer text-left"
            >
              <VisualVectorStudioLogo className="w-7 h-7" variant={isVS ? 'primary' : 'monochrome'} />
              <div>
                <h1 className={`text-sm font-black tracking-tight leading-none ${
                  isVS ? "text-[#f05a28]" : "text-cyan-400"
                }`}>
                  Visual Vector Studio
                </h1>
                <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block mt-0.5">
                  Workspace Pro
                </span>
              </div>
            </button>
          </div>

          {/* Right Header Navigation: [ Admin Icon ]  [ Settings Symbol ]  [ Avatar Icon ] */}
          <div className="flex items-center gap-2">
            {/* 1. Admin Menu Icon (Left of Settings) */}
            <button
              onClick={() => {
                setIsAdminMenuOpen(!isAdminMenuOpen);
                setShowVSMenu(false);
                if (!isAdminMenuOpen) {
                  triggerToast("Console Administrateur ouverte.");
                  loadFirebaseLogs();
                }
              }}
              title="Console Administrateur"
              className={`relative p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                isAdminMenuOpen
                  ? isVS
                    ? "bg-[#f05a28]/15 border-[#f05a28] text-[#f05a28] shadow-[0_0_12px_rgba(240,90,40,0.25)]"
                    : "bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                  : isVS
                    ? "bg-[#222222] border-[#333333] text-neutral-400 hover:text-white hover:border-neutral-500 hover:bg-[#2a2a2a]"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <Terminal className="w-4 h-4" />
              {isAdmin && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#181818]" />
              )}
            </button>

            {/* 2. Settings Symbol (Next to left of Avatar) */}
            <button
              onClick={() => {
                setGlobalTab("settings");
                setShowVSMenu(false);
                triggerToast("Paramètres de l'application");
              }}
              title="Paramètres de l'application"
              className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                globalTab === "settings"
                  ? isVS
                    ? "bg-[#f05a28]/15 border-[#f05a28] text-[#f05a28] shadow-[0_0_12px_rgba(240,90,40,0.25)]"
                    : "bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                  : isVS
                    ? "bg-[#222222] border-[#333333] text-neutral-400 hover:text-white hover:border-neutral-500 hover:bg-[#2a2a2a]"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* 3. Avatar Icon (Far Right Corner) */}
            <button
              onClick={() => {
                setShowVSMenu(!showVSMenu);
                loadFirebaseLogs();
              }}
              title="Mon Compte & Studio"
              className={`relative p-1.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                showVSMenu
                  ? isVS
                    ? "bg-[#f05a28]/20 border-[#f05a28] shadow-[0_0_12px_rgba(240,90,40,0.3)]"
                    : "bg-cyan-500/20 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  : isVS
                    ? "bg-[#222222] border-[#333333] hover:border-neutral-500 hover:bg-[#2a2a2a]"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shadow-inner ${
                isVS ? "bg-gradient-to-br from-[#f05a28] to-[#ff7a00] text-white" : "bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950"
              }`}>
                {userEmail ? userEmail.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <span className="hidden sm:block text-xs font-bold text-neutral-200 max-w-[100px] truncate pr-1">
                {userEmail ? userEmail.split('@')[0] : "Mon Compte"}
              </span>
            </button>
          </div>
        </header>
      )}

      {globalTab === "pro" ? (
        <div className="flex-1 flex flex-col overflow-hidden h-full w-full min-h-0">
          <WhiteboardStudio
            isFullscreen={isProFullscreen}
            onToggleFullscreen={setIsProFullscreen}
            triggerToast={triggerToast}
            isAdmin={isAdmin}
          />
        </div>
      ) : globalTab === "corporate" ? (
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          {/* Subheader */}
          <div className={`shrink-0 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-3 gap-3 ${
            isVS ? "bg-[#181818]/90 border-[#333333]" : "bg-slate-900/95 border-slate-800"
          }`}>
            <div className="flex items-center gap-3">
              <Briefcase className={`w-5 h-5 ${isVS ? "text-[#f05a28]" : "text-cyan-400"}`} />
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-white">Corporate Studio</h2>
                <p className="text-[10px] text-neutral-400">Génération de supports de communication & identité de marque</p>
              </div>
            </div>
            
            <div className="flex bg-neutral-900/60 p-1 rounded-lg border border-neutral-800/80 gap-1.5 shadow-inner self-start sm:self-auto">
              <button
                onClick={() => {
                  setCorporateSubTab("qr");
                  triggerToast("Corporate Studio : Éditeur de QR Code");
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition cursor-pointer select-none ${
                  corporateSubTab === "qr"
                    ? isVS
                      ? "bg-[#2d2d2d] text-[#f05a28] border border-[#f05a28]/20"
                      : "bg-cyan-500/10 text-cyan-400 border border-cyan-400/20"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/40"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Éditeur QR</span>
              </button>
              
              <button
                onClick={() => {
                  setCorporateSubTab("card");
                  triggerToast("Corporate Studio : Cartes de Visite");
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition cursor-pointer select-none ${
                  corporateSubTab === "card"
                    ? isVS
                      ? "bg-[#2d2d2d] text-[#f05a28] border border-[#f05a28]/20"
                      : "bg-cyan-500/10 text-cyan-400 border border-cyan-400/20"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/40"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Cartes de Visite</span>
              </button>

              <button
                onClick={() => {
                  setCorporateSubTab("career");
                  triggerToast("Corporate Studio : Carrière & Recrutement Pro");
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition cursor-pointer select-none ${
                  corporateSubTab === "career"
                    ? isVS
                      ? "bg-[#2d2d2d] text-[#f05a28] border border-[#f05a28]/20"
                      : "bg-cyan-500/10 text-cyan-400 border border-cyan-400/20"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/40"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Carrière & Portfolio</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {corporateSubTab === "qr" ? (
              <main className="flex-1 w-full flex flex-col md:flex-row overflow-hidden md:h-[calc(100vh-8.5rem)] relative">
          
          {/* LEFT PANEL: Menu Navigation */}
          <div className={`border-b md:border-b-0 md:border-r border-[#333333] flex flex-row md:flex-col bg-[#141414] z-10 shrink-0 overflow-visible transition-all duration-300 relative ${isQrLeftCollapsed ? "w-full md:w-16" : "w-full md:w-64"}`}>
            <div className="p-4 border-b border-[#333333] hidden md:flex items-center justify-between">
              {!isQrLeftCollapsed && <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Éditeur QR</h2>}
              <button onClick={() => setIsQrLeftCollapsed(!isQrLeftCollapsed)} className="text-neutral-500 hover:text-white mx-auto">
                {isQrLeftCollapsed ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex flex-row md:flex-col py-0 md:py-2 flex-1 relative">
              <button 
                onClick={() => setQrActiveLeftMenu("lien")} 
                title={isQrLeftCollapsed ? "Le Lien Cible" : ""}
                className={`flex items-center ${isQrLeftCollapsed ? "justify-center px-4" : "gap-3 px-4"} py-3 md:py-4 transition cursor-pointer whitespace-nowrap group ${qrActiveLeftMenu === "lien" ? (isVS ? "bg-[#f05a28]/10 text-[#f05a28] border-b-2 md:border-b-0 md:border-r-2 border-[#f05a28]" : "bg-cyan-500/10 text-cyan-400 border-b-2 md:border-b-0 md:border-r-2 border-cyan-400") : "text-neutral-500 hover:bg-[#252525] hover:text-neutral-300"}`}
              >
                <LinkIcon className="w-5 h-5 shrink-0" />
                {!isQrLeftCollapsed && <span className="text-xs font-bold uppercase transition-opacity">Le Lien Cible</span>}
                {isQrLeftCollapsed && <div className="hidden group-hover:block absolute left-14 bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50 whitespace-nowrap">Le Lien Cible</div>}
              </button>
              <button 
                onClick={() => setQrActiveLeftMenu("ai")} 
                title={isQrLeftCollapsed ? "Stylisation" : ""}
                className={`flex items-center ${isQrLeftCollapsed ? "justify-center px-4" : "gap-3 px-4"} py-3 md:py-4 transition cursor-pointer whitespace-nowrap group ${qrActiveLeftMenu === "ai" ? (isVS ? "bg-[#f05a28]/10 text-[#f05a28] border-b-2 md:border-b-0 md:border-r-2 border-[#f05a28]" : "bg-cyan-500/10 text-cyan-400 border-b-2 md:border-b-0 md:border-r-2 border-cyan-400") : "text-neutral-500 hover:bg-[#252525] hover:text-neutral-300"}`}
              >
                <Sparkles className="w-5 h-5 shrink-0" />
                {!isQrLeftCollapsed && <span className="text-xs font-bold uppercase transition-opacity">Stylisation</span>}
                {isQrLeftCollapsed && <div className="hidden group-hover:block absolute left-14 bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50 whitespace-nowrap">Stylisation</div>}
              </button>
              <button 
                onClick={() => setQrActiveLeftMenu("manuel")} 
                title={isQrLeftCollapsed ? "Personnalisation" : ""}
                className={`flex items-center ${isQrLeftCollapsed ? "justify-center px-4" : "gap-3 px-4"} py-3 md:py-4 transition cursor-pointer whitespace-nowrap group ${qrActiveLeftMenu === "manuel" ? (isVS ? "bg-[#f05a28]/10 text-[#f05a28] border-b-2 md:border-b-0 md:border-r-2 border-[#f05a28]" : "bg-cyan-500/10 text-cyan-400 border-b-2 md:border-b-0 md:border-r-2 border-cyan-400") : "text-neutral-500 hover:bg-[#252525] hover:text-neutral-300"}`}
              >
                <Sliders className="w-5 h-5 shrink-0" />
                {!isQrLeftCollapsed && <span className="text-xs font-bold uppercase transition-opacity">Personnalisation</span>}
                {isQrLeftCollapsed && <div className="hidden group-hover:block absolute left-14 bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50 whitespace-nowrap">Personnalisation</div>}
              </button>
              <button 
                onClick={() => setQrActiveLeftMenu("export")} 
                title={isQrLeftCollapsed ? "Exportation" : ""}
                className={`flex items-center ${isQrLeftCollapsed ? "justify-center px-4" : "gap-3 px-4"} py-3 md:py-4 transition cursor-pointer whitespace-nowrap group ${qrActiveLeftMenu === "export" ? (isVS ? "bg-[#f05a28]/10 text-[#f05a28] border-b-2 md:border-b-0 md:border-r-2 border-[#f05a28]" : "bg-cyan-500/10 text-cyan-400 border-b-2 md:border-b-0 md:border-r-2 border-cyan-400") : "text-neutral-500 hover:bg-[#252525] hover:text-neutral-300"}`}
              >
                <Download className="w-5 h-5 shrink-0" />
                {!isQrLeftCollapsed && <span className="text-xs font-bold uppercase transition-opacity">Exportation</span>}
                {isQrLeftCollapsed && <div className="hidden group-hover:block absolute left-14 bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg z-50 whitespace-nowrap">Exportation</div>}
              </button>
            </div>
          </div>

          {/* CENTER PANEL: Canvas */}
          <div className="flex-1 flex flex-col items-center justify-start p-4 md:px-8 md:pt-[49px] relative overflow-y-auto" style={{ backgroundColor: isVS ? "#1a1a1a" : "#0f172a", backgroundImage: `url('data:image/svg+xml;utf8,<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><circle cx="2" cy="2" r="1" fill="${isVS ? "%23333333" : "%23334155"}"/></svg>')` }}>
            {/* We will move the Preview Canvas here later. Temporarily placing a placeholder. */}
            
            <div className={`w-full max-w-sm flex flex-col items-center shrink-0 ${isVS ? "bg-[#141414] border border-[#333333]" : "bg-slate-900 border border-slate-800"} p-8 rounded-xl shadow-2xl`}>
              <div className="w-full flex items-center justify-between mb-6 pb-4 border-b border-[#333333]">
                <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase flex items-center gap-1.5">
                  <Eye className={`w-4 h-4 ${textHighlightClass}`} /> Aperçu
                </span>
              </div>

              <div className="relative flex items-center justify-center p-2 bg-white rounded-lg">
                <QRCodeCanvas 
                  value={url || "https://ai.studio"} 
                  style={style} 
                  size={280}
                  customLogoFile={style.logoType === "custom" ? style.logoUrl : null}
                  onDownloadReady={(dataUrl) => setDownloadReadyDataUrl(dataUrl)}
                />
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Properties */}
          <div className={`border-l border-[#333333] bg-[#141414] flex flex-col hidden-scrollbar z-10 shrink-0 transition-all duration-300 relative ${isQrRightCollapsed ? "w-full md:w-12 items-center" : "w-full md:w-[400px]"}`}>
            <button 
              onClick={() => setIsQrRightCollapsed(!isQrRightCollapsed)} 
              className={`absolute top-4 ${isQrRightCollapsed ? "left-1/2 -translate-x-1/2" : "right-4"} z-20 text-neutral-500 hover:text-white bg-[#141414] p-1 rounded-sm`}
            >
              {isQrRightCollapsed ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
            </button>
            <div className={`p-4 md:p-6 space-y-6 overflow-y-auto w-full h-full ${isQrRightCollapsed ? "hidden" : "block"}`}>
            
            <div className={qrActiveLeftMenu === "lien" ? "block" : "hidden"}>

          <div className={panelClass}>
            <div className={`absolute top-0 left-0 w-1 h-full ${isVS ? "bg-[#f05a28]" : "bg-gradient-to-b from-cyan-400 to-indigo-500"}`} />
            <div className="flex items-center gap-2 mb-3">
              <LinkIcon className={`w-5 h-5 ${textHighlightClass}`} />
              <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase">Le Lien Cible</h2>
            </div>
            <p className="text-xs text-slate-450 mb-4">
              Collez l'adresse web que le QR code ouvrira instantanément au scan.
            </p>
            <div className="relative">
              <input
                id="target-link-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://votre-site-magnifique.com"
                className={inputClass}
              />
              <div className={`absolute right-4 top-1/2 -translate-y-1/2 ${isVS ? "text-[#f05a28]" : "text-cyan-400/60 group-hover:text-cyan-400"} transition`}>
                <Check className="w-5 h-5" />
              </div>
            </div>
          </div>

            </div>
            
            <div className={qrActiveLeftMenu === "ai" ? "block" : "hidden"}>

          {/* Card 2: AI Designer Refinement & Easy Presets */}
          <div className={panelNoGroupClass}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${isVS ? "bg-[#f05a28]" : "bg-indigo-500"}`} />
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-5 h-5 ${isVS ? "text-[#f05a28]" : "text-indigo-400"}`} />
                <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase">Stylisation Magique (IA / Modèles)</h2>
              </div>
            </div>

            {/* AI Text prompter */}
            <div className={`${innerBgClass} rounded-xl p-4.5 mb-5 space-y-3`}>
              <label htmlFor="ai-prompt-input" className="block text-xs font-semibold text-slate-350">
                Décrivez l'ambiance désirée à l'IA Gemini :
              </label>
              <div className="flex flex-wrap sm:flex-nowrap gap-3">
                <input
                  id="ai-prompt-input"
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ex: Style café cozy, tons marrons torréfiés et miel biologique..."
                  className={`flex-1 min-w-[200px] ${isVS ? "bg-[#1c1c1c] border border-[#444444] focus:border-[#f05a28] text-white" : "bg-slate-900 border border-slate-800 focus:border-indigo-400 text-slate-100"} text-sm py-2.5 px-4 rounded-xl outline-none transition`}
                  onKeyDown={(e) => e.key === "Enter" && handleAISuggestStyle()}
                />
                <button
                  onClick={handleAISuggestStyle}
                  disabled={isLoadingAI || !aiPrompt.trim()}
                  className={`sm:px-5 shrink-0 py-2.5 w-full sm:w-auto ${isVS ? "bg-[#f05a28] hover:bg-[#ff6c3a] text-white" : "bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 text-slate-950"} disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 font-semibold rounded-xl text-sm transition hover:opacity-90 flex items-center justify-center gap-2 active:scale-95 duration-200 cursor-pointer`}
                >
                  {isLoadingAI ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Métamorphoser</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Notre IA configure instantanément le style de points, les dégradés optimaux, les angles et intègre un emoji/icône correspondant pour un rendu unique.
              </p>
            </div>

            {/* Quick Presets Carousel Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-350">Ou sélectionnez l'un de nos thèmes d'auteur :</span>
                {selectedPresetId && (
                  <span className={`text-[10px] ${isVS ? "bg-[#f05a28]/15 text-[#ff6d39] border-[#f05a28]/25" : "bg-cyan-500/15 text-cyan-300 border-cyan-500/20"} px-2.5 py-0.5 rounded-full font-semibold border`}>
                    Actif
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {PRESET_STYLES.map((pt) => {
                  const isActive = selectedPresetId === pt.id;
                  return (
                    <button
                      key={pt.id}
                      onClick={() => handleSelectPreset(pt.id, pt.style)}
                      className={`text-left p-3 rounded-xl border text-xs transition relative group flex flex-col justify-between h-[82px] cursor-pointer ${
                        isActive 
                          ? isVS
                            ? "bg-[#f05a28]/10 border-[#f05a28] ring-1 ring-[#f05a28]/35"
                            : "bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/35"
                          : isVS
                            ? "bg-[#141414] border-[#333333] hover:border-neutral-500 text-neutral-300"
                            : "bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-100"
                      }`}
                    >
                      <div>
                        <div className={`font-semibold ${isVS ? "text-neutral-200 group-hover:text-[#ff6d39]" : "text-slate-100 group-hover:text-indigo-300"} transition line-clamp-1`}>
                          {pt.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {pt.description}
                        </div>
                      </div>
                      
                      {/* Presets miniature preview color swatches */}
                      <div className="flex items-center justify-between w-full mt-1.5">
                        <div className="flex gap-1">
                          <span 
                            className={`w-2.5 h-2.5 rounded-full inline-block border ${isVS ? "border-neutral-800" : "border-slate-800"}`} 
                            style={{ backgroundColor: pt.style.backgroundColor }} 
                          />
                          <span 
                            className="w-2.5 h-2.5 rounded-full inline-block" 
                            style={{ backgroundColor: pt.style.dotColor }} 
                          />
                        </div>
                        {isActive && <Check className={`w-3.5 h-3.5 ${isVS ? "text-[#f05a28]" : "text-indigo-400"}`} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Logo Upload Section inside Step 2 */}
              <div className={`mt-5 p-4 rounded-xl border ${isVS ? "bg-[#141414] border-[#333333]" : "bg-slate-900 border-slate-800"}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-350">Logo personnalisé (remplace le logo du thème)</span>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="step2-custom-logo-upload"
                  />
                  <label 
                    htmlFor="step2-custom-logo-upload"
                    className={`px-4 py-2 ${isVS ? "bg-[#252525] hover:bg-[#333333] border border-[#444444]" : "bg-slate-800 hover:bg-slate-700 border border-slate-700"} rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-2`}
                  >
                    <Upload size={14} />
                    Importer un Logo
                  </label>
                  {(style.logoType === "custom" && style.logoUrl) && (
                    <button 
                      onClick={() => setStyle({ ...style, logoType: "none", logoUrl: undefined })}
                      className="text-xs text-red-400 hover:text-red-300 transition"
                    >
                      Retirer le logo
                    </button>
                  )}
                </div>
                
                {uploadedLogos.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800/50">
                    <span className="text-[10px] text-slate-500 mb-2 block">Bibliothèque de logos (historique) :</span>
                    <div className="flex flex-wrap gap-2">
                      {uploadedLogos.map((logoDataUrl, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setCustomLogoFile(logoDataUrl);
                            setStyle({ ...style, logoType: "custom", logoUrl: logoDataUrl, logoSize: 0.2, logoBgShape: "none" });
                          }}
                          className={`w-10 h-10 rounded border overflow-hidden transition ${style.logoUrl === logoDataUrl ? (isVS ? "border-[#f05a28] ring-2 ring-[#f05a28]/30" : "border-indigo-400 ring-2 ring-indigo-400/30") : (isVS ? "border-[#333333] hover:border-neutral-500" : "border-slate-800 hover:border-slate-600")} cursor-pointer`}
                        >
                          <img src={logoDataUrl} alt="Logo UI" className="w-full h-full object-contain" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* AI Designer Explanation & Feedback Panel */}
            <div className={`mt-3 w-full ${isVS ? "bg-[#141414]" : "bg-slate-900"} p-4 rounded-xl space-y-3 text-xs leading-relaxed`}>
              <div className="flex items-start gap-2.5">
                <Sparkles className={`w-5 h-5 shrink-0 mt-0.5 ${isVS ? "text-[#f05a28]" : "text-indigo-400"}`} />
                <div>
                  <span className="font-bold text-slate-350">Directives d'ambiance de l'IA :</span>
                  <p className="text-slate-400 mt-1">{aiReasoning || "Ajustez le prompt pour que Gemini compose le style idéal."}</p>
                </div>
              </div>
            </div>

          </div>

            </div>
            
            <div className={qrActiveLeftMenu === "manuel" ? "block" : "hidden"}>

          {/* Card 3: Precise Manual Designer Controls */}
          <div className={panelNoGroupClass}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${isVS ? "bg-[#f05a28]" : "bg-pink-500"}`} />
            
            <div className="flex items-center gap-2 mb-4">
              <Sliders className={`w-5 h-5 ${isVS ? "text-[#f05a28]" : "text-pink-400"}`} />
              <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase">Personnalisation Manuelle Précise</h2>
            </div>

            {/* Horizontal Sub-tabs */}
            <div className={`flex overflow-x-auto gap-1 border-b ${isVS ? "border-neutral-800" : "border-slate-800"} pb-2 mb-5 no-scrollbar`}>
              {[
                { id: "points", label: "Points" },
                { id: "yeux", label: "Angles (Yeux)" },
                { id: "logo", label: "Badge / Logo" },
                { id: "cadre", label: "Cadre & Texte" },
                { id: "fond", label: "Arrière-Plan" },
              ].map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setActiveTab(tb.id as any)}
                  className={`px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    activeTab === tb.id
                      ? isVS
                        ? "bg-[#f05a28]/15 text-[#ff6d39] border border-[#f05a28]/35 rounded-md"
                        : "bg-pink-500/10 text-pink-400 border border-pink-500/30 rounded-lg"
                      : isVS
                        ? "text-neutral-400 hover:text-white rounded-md"
                        : "text-slate-400 hover:text-white rounded-lg"
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="space-y-5">
              
              {/* TAB 1: POINTS */}
              {activeTab === "points" && (
                <div className="space-y-4 animate-fadeIn">
                  
                  {/* Dot Shapes Choice */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">Style des Points (Modules) :</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { id: "square", label: "Carrés" },
                        { id: "circle", label: "Ronds" },
                        { id: "dots", label: "Fin" },
                        { id: "diamond", label: "Diamants" },
                        { id: "star", label: "Étoiles" },
                        { id: "rounded-connect", label: "Fluide" },
                      ].map((sh) => (
                        <button
                          key={sh.id}
                          onClick={() => setStyle(prev => ({ ...prev, dotStyle: sh.id as any }))}
                          className={`p-2.5 text-center text-xs border transition ${
                            style.dotStyle === sh.id
                              ? isVS
                                ? "bg-[#f05a28]/10 border-[#f05a28] text-[#ff6d39] rounded-md"
                                : "bg-pink-500/10 border-pink-500 text-pink-300 rounded-xl"
                              : isVS
                                ? "bg-[#141414] border-[#333333] hover:border-neutral-500 text-neutral-400 rounded-md"
                                : "bg-slate-950 border-slate-800 hover:border-slate-700 rounded-xl"
                          }`}
                        >
                          <div className="font-medium">{sh.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gradient Switch for dots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">Coloration des Points :</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStyle(prev => ({ ...prev, dotGradient: false }))}
                          className={`flex-1 py-2 text-xs font-semibold border transition ${
                            !style.dotGradient
                              ? isVS
                                ? "bg-[#f05a28]/10 border-[#f05a28]/40 text-[#ff6d39] rounded-md"
                                : "bg-slate-800 border-slate-700 text-white rounded-xl"
                              : isVS
                                ? "bg-[#141414] border-[#333333] text-neutral-400 rounded-md"
                                : "bg-slate-950 border-slate-800 text-slate-400 rounded-xl"
                          }`}
                        >
                          Unie
                        </button>
                        <button
                          onClick={() => setStyle(prev => ({ ...prev, dotGradient: true }))}
                          className={`flex-1 py-2 text-xs font-semibold border transition ${
                            style.dotGradient
                              ? isVS
                                ? "bg-[#f05a28]/10 border-[#f05a28]/40 text-[#ff6d39] rounded-md"
                                : "bg-slate-800 border-slate-700 text-white rounded-xl"
                              : isVS
                                ? "bg-[#141414] border-[#333333] text-neutral-400 rounded-md"
                                : "bg-slate-950 border-slate-800 text-slate-405 rounded-xl"
                          }`}
                        >
                          Dégradé
                        </button>
                      </div>
                    </div>

                    {style.dotGradient && (
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-2">Forme du Dégradé :</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setStyle(prev => ({ ...prev, dotGradientType: "linear" }))}
                            className={`flex-1 py-2 text-xs font-semibold border transition ${
                              style.dotGradientType === "linear"
                                ? isVS
                                  ? "bg-[#ff9a00]/10 border-[#ff9a00]/30 text-[#ff9a00] rounded-md"
                                  : "bg-slate-800 border-slate-700 text-white rounded-xl"
                                : isVS
                                  ? "bg-[#141414] border-[#333333] text-neutral-400 rounded-md"
                                  : "bg-slate-950 border-slate-800 text-slate-400 rounded-xl"
                            }`}
                          >
                            Linéaire
                          </button>
                          <button
                            onClick={() => setStyle(prev => ({ ...prev, dotGradientType: "radial" }))}
                            className={`flex-1 py-2 text-xs font-semibold border transition ${
                              style.dotGradientType === "radial"
                                ? isVS
                                  ? "bg-[#ff9a00]/10 border-[#ff9a00]/30 text-[#ff9a00] rounded-md"
                                  : "bg-slate-800 border-slate-700 text-white rounded-xl"
                                : isVS
                                  ? "bg-[#141414] border-[#333333] text-neutral-400 rounded-md"
                                  : "bg-slate-950 border-slate-800 text-slate-400 rounded-xl"
                            }`}
                          >
                            Radial
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dot Color Selection */}
                  <div className={`${isVS ? "bg-[#141414] border border-[#2d2d2d] rounded-md" : "bg-slate-950 border border-slate-800 rounded-xl"} p-4 space-y-3`}>
                    <label className="block text-xs font-bold text-slate-300">Sélection des Couleurs :</label>
                    
                    {!style.dotGradient ? (
                      <div className="flex items-center gap-3">
                        <input
                          id="dot-color-picker"
                          type="color"
                          value={style.dotColor}
                          onChange={(e) => setStyle(prev => ({ ...prev, dotColor: e.target.value }))}
                          className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <div className="space-y-0.5">
                          <label htmlFor="dot-color-picker" className="text-xs font-medium text-slate-300">Couleur unie des points</label>
                          <p className="text-[10px] text-slate-500">{style.dotColor.toUpperCase()}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <input
                            id="dot-grad-1"
                            type="color"
                            value={style.dotGradientColors[0] || "#3B82F6"}
                            onChange={(e) => {
                              const colors = [...style.dotGradientColors];
                              colors[0] = e.target.value;
                              setStyle(prev => ({ ...prev, dotGradientColors: colors }));
                            }}
                            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <div className="space-y-0.5">
                            <label htmlFor="dot-grad-1" className="text-xs font-medium text-slate-300">Couleur Départ (Haut/Gauche)</label>
                            <p className="text-[10px] text-slate-500">{(style.dotGradientColors[0] || "#3B82F6").toUpperCase()}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            id="dot-grad-2"
                            type="color"
                            value={style.dotGradientColors[1] || "#8B5CF6"}
                            onChange={(e) => {
                              const colors = [...style.dotGradientColors];
                              colors[1] = e.target.value;
                              setStyle(prev => ({ ...prev, dotGradientColors: colors }));
                            }}
                            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <div className="space-y-0.5">
                            <label htmlFor="dot-grad-2" className="text-xs font-medium text-slate-300">Couleur Arrivée (Bas/Droite)</label>
                            <p className="text-[10px] text-slate-500">{(style.dotGradientColors[1] || "#8B5CF6").toUpperCase()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 2: COINS (YEUX) */}
              {activeTab === "yeux" && (
                <div className="space-y-5 animate-fadeIn">
                  
                  {/* Outer Frame Shape */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">Forme Extérieure de l'œil :</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: "square", label: "Carré classique" },
                        { id: "rounded", label: "Doucement arrondi" },
                        { id: "extra-rounded", label: "Forte courbure" },
                        { id: "circle", label: "Cercle complet" },
                      ].map((eo) => (
                        <button
                          key={eo.id}
                          onClick={() => setStyle(prev => ({ ...prev, eyeOuterStyle: eo.id as any }))}
                          className={`p-3 text-center text-xs border transition ${
                            style.eyeOuterStyle === eo.id
                              ? isVS
                                ? "bg-[#f05a28]/10 border-[#f05a28] text-[#ff6d39] rounded-md"
                                : "bg-pink-500/10 border-pink-500 text-pink-300 rounded-xl"
                              : isVS
                                ? "bg-[#141414] border-[#333333] hover:border-neutral-500 text-neutral-400 rounded-md"
                                : "bg-slate-950 border-slate-800 hover:border-slate-700 rounded-xl"
                          }`}
                        >
                          <div className="font-semibold">{eo.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Inner Frame Shape */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">Pupille Intérieure de l'œil :</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: "square", label: "Carré" },
                        { id: "rounded", label: "Arrondi" },
                        { id: "circle", label: "Cercle" },
                        { id: "diamond", label: "Diamant" },
                      ].map((ei) => (
                        <button
                          key={ei.id}
                          onClick={() => setStyle(prev => ({ ...prev, eyeInnerStyle: ei.id as any }))}
                          className={`p-3 text-center text-xs border transition ${
                            style.eyeInnerStyle === ei.id
                              ? isVS
                                ? "bg-[#f05a28]/10 border-[#f05a28] text-[#ff6d39] rounded-md"
                                : "bg-pink-500/10 border-pink-500 text-pink-300 rounded-xl"
                              : isVS
                                ? "bg-[#141414] border-[#333333] hover:border-neutral-500 text-neutral-400 rounded-md"
                                : "bg-slate-950 border-slate-800 hover:border-slate-700 rounded-xl"
                          }`}
                        >
                          <div className="font-semibold">{ei.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Angle Colors */}
                  <div className={`${isVS ? "bg-[#141414] border border-[#2d2d2d] rounded-md" : "bg-slate-950 border border-slate-800 rounded-xl"} p-4 grid grid-cols-1 sm:grid-cols-2 gap-4`}>
                    <div className="flex items-center gap-3">
                      <input
                        id="eye-outer-color-picker"
                        type="color"
                        value={style.eyeOuterColor}
                        onChange={(e) => setStyle(prev => ({ ...prev, eyeOuterColor: e.target.value }))}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <div className="space-y-0.5">
                        <label htmlFor="eye-outer-color-picker" className="text-xs font-medium text-slate-300">Bord extérieur de l'œil</label>
                        <p className="text-[10px] text-slate-500">{style.eyeOuterColor.toUpperCase()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        id="eye-inner-color-picker"
                        type="color"
                        value={style.eyeInnerColor}
                        onChange={(e) => setStyle(prev => ({ ...prev, eyeInnerColor: e.target.value }))}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <div className="space-y-0.5">
                        <label htmlFor="eye-inner-color-picker" className="text-xs font-medium text-slate-300">Pupille intérieure</label>
                        <p className="text-[10px] text-slate-500">{style.eyeInnerColor.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 3: LOGO & BADGE CENTRAL */}
              {activeTab === "logo" && (
                <div className="space-y-5 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">Type d'icône centrale (Logo) :</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "none", label: "Aucun" },
                        { id: "emoji", label: "Emoji libre" },
                        { id: "preset", label: "Vecteurs" },
                        { id: "custom", label: "Fichier Image" },
                      ].map((lg) => (
                        <button
                          key={lg.id}
                          onClick={() => setStyle(prev => ({ ...prev, logoType: lg.id as any }))}
                          className={`p-2.5 text-center text-xs border transition ${
                            style.logoType === lg.id
                              ? isVS
                                ? "bg-[#f05a28]/10 border-[#f05a28] text-[#ff6d39] rounded-md"
                                : "bg-pink-500/10 border-pink-500 text-pink-300 rounded-xl"
                              : isVS
                                ? "bg-[#141414] border-[#333333] hover:border-neutral-500 text-neutral-400 rounded-md"
                                : "bg-slate-950 border-slate-800 hover:border-slate-700 rounded-xl"
                          }`}
                        >
                          <div className="font-semibold">{lg.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Parameters according to selected Logo Type */}
                  {style.logoType === "emoji" && (
                    <div className={`${isVS ? "bg-[#141414] border border-[#2d2d2d] rounded-md" : "bg-slate-950 border border-slate-800 rounded-xl"} p-4.5 space-y-3`}>
                      <label htmlFor="logo-emoji-input" className="block text-xs font-bold text-slate-300">Emoji Central :</label>
                      <div className="flex gap-2.5">
                        <input
                          id="logo-emoji-input"
                          type="text"
                          value={style.logoValue}
                          onChange={(e) => setStyle(prev => ({ ...prev, logoValue: e.target.value.substring(0, 4) }))}
                          placeholder="🚀"
                          className={`w-16 bg-slate-900 border border-slate-800 ${isVS ? "rounded-md focus:border-[#f05a28]" : "rounded-xl focus:border-pink-500"} py-2 px-3 text-center text-xl`}
                        />
                        <div className="flex-1 flex gap-1.5 flex-wrap items-center">
                          {["🚀", "☕", "🌿", "🛒", "✨", "🔥", "🚲", "🏠", "🍕", "👔", "🎓"].map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => setStyle(prev => ({ ...prev, logoValue: em }))}
                              className={`w-8 h-8 ${isVS ? "rounded-md hover:bg-neutral-800" : "rounded-lg hover:bg-slate-800"} bg-slate-900 text-sm flex items-center justify-center transition border border-slate-800/80 active:scale-90`}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {style.logoType === "preset" && (
                    <div className={`${isVS ? "bg-[#141414] border border-[#2d2d2d] rounded-md" : "bg-slate-950 border border-slate-800 rounded-xl"} p-4.5 space-y-3`}>
                      <label className="block text-xs font-bold text-slate-300 mb-2">Choisir un icône preset :</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: "globe", label: "Internet" },
                          { id: "phone", label: "Téléphone" },
                          { id: "mail", label: "E-mail" },
                          { id: "wifi", label: "Wi-Fi" },
                          { id: "heart", label: "Favori" },
                          { id: "star", label: "Prestige" },
                        ].map((pr) => (
                          <button
                            key={pr.id}
                            type="button"
                            onClick={() => setStyle(prev => ({ ...prev, logoValue: pr.id }))}
                            className={`p-2 text-[10px] sm:text-xs border transition ${
                              style.logoValue === pr.id
                                ? isVS
                                  ? "bg-[#f05a28]/10 border-[#f05a28] text-[#ff6d39] rounded-md"
                                  : "bg-indigo-500/10 border-indigo-500 text-indigo-300 rounded-xl"
                                : isVS
                                  ? "bg-[#141414] border-neutral-800 text-neutral-400 rounded-md"
                                  : "bg-slate-900 border-slate-800 text-slate-400 rounded-xl"
                            }`}
                          >
                            {pr.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {style.logoType === "custom" && (
                    <div className="space-y-3 animate-fadeIn">
                      <label className="block text-xs font-bold text-slate-300">Uploader votre image (Logo personnalisé) :</label>
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed p-5 text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                          isVS ? "rounded-md" : "rounded-xl"
                        } ${
                          isDragging
                            ? isVS
                              ? "bg-[#f05a28]/10 border-[#f05a28]"
                              : "bg-indigo-500/10 border-indigo-400"
                            : customLogoFile
                            ? isVS
                              ? "bg-[#141414] border-neutral-700 hover:bg-[#1E1E1E]"
                              : "bg-slate-950 border-slate-700 hover:bg-slate-900"
                            : isVS
                              ? "bg-[#141414] border-neutral-800 hover:border-neutral-700"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700"
                        }`}
                        onClick={() => document.getElementById("hidden-file-input")?.click()}
                      >
                        <input
                          id="hidden-file-input"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        {customLogoFile ? (
                          <div className="flex items-center gap-3">
                            <img src={customLogoFile} alt="Custom logo preview" className="w-12 h-12 object-contain rounded-lg bg-white p-1 border border-slate-800" />
                            <div className="text-left font-medium text-xs">
                              <span className="text-emerald-400">Prêt à l'emploi</span>
                              <p className="text-[10px] text-slate-500">Cliquez pour modifier le logo</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-slate-500" />
                            <p className="text-xs font-medium text-slate-300">
                              Faites glisser votre logo ici
                            </p>
                            <p className="text-[10px] text-slate-500">Ou cliquez pour explorer vos fichiers (.png, .jpg)</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cutout Shape & Scale, only visible if a logo is active */}
                  {style.logoType !== "none" && (
                    <div className={`${isVS ? "bg-[#141414] border border-[#2d2d2d] rounded-md" : "bg-slate-950 border border-slate-800 rounded-xl"} p-4.5 space-y-4`}>
                      
                      {/* Logo Size slider */}
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
                          <span>Taille de l'Icône :</span>
                          <span className={`font-mono ${isVS ? "text-[#ff6d39]" : "text-pink-400"}`}>{Math.round(style.logoSize * 100)} %</span>
                        </div>
                        <input
                          type="range"
                          min="0.15"
                          max="0.25"
                          step="0.01"
                          value={style.logoSize}
                          onChange={(e) => setStyle(prev => ({ ...prev, logoSize: parseFloat(e.target.value) }))}
                          className={`w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer ${isVS ? "accent-[#f05a28]" : "accent-pink-500"}`}
                        />
                      </div>

                      {/* Cutout Background details */}
                      <div className="pt-3 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-2">Forme de découpe de fond :</label>
                          <div className="flex gap-2">
                            {["circle", "square", "none"].map((sh) => (
                              <button
                                key={sh}
                                type="button"
                                onClick={() => setStyle(prev => ({ ...prev, logoBgShape: sh as any }))}
                                className={`flex-1 py-1.5 text-xs font-semibold border transition ${
                                  style.logoBgShape === sh
                                    ? isVS
                                      ? "bg-[#f05a28]/15 border-[#f05a28]/35 text-[#ff6d39] rounded-md"
                                      : "bg-slate-850 border-slate-700 text-white rounded-lg"
                                    : isVS
                                      ? "bg-[#141414] border-neutral-800 text-neutral-400 rounded-md"
                                      : "bg-slate-900 border-slate-800 text-slate-400 rounded-lg"
                                }`}
                              >
                                {sh === "circle" ? "Cercle" : sh === "square" ? "Carré" : "Aucune"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {style.logoBgShape !== "none" && (
                          <div className="flex items-center gap-3">
                            <input
                              id="logo-bg-color-picker"
                              type="color"
                              value={style.logoBgColor}
                              onChange={(e) => setStyle(prev => ({ ...prev, logoBgColor: e.target.value }))}
                              className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                            />
                            <div className="space-y-0.5">
                              <label htmlFor="logo-bg-color-picker" className="text-xs font-medium text-slate-300">Couleur de fond du badge</label>
                              <p className="text-[10px] text-slate-500">{style.logoBgColor.toUpperCase()}</p>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* TAB 4: CADRE & TEXTE */}
              {activeTab === "cadre" && (
                <div className="space-y-4 animate-fadeIn">
                  
                  {/* Select Frame Style */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">Style du cadre d'habillage :</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: "none", label: "Sans" },
                        { id: "classic", label: "Classique" },
                        { id: "bubble", label: "Bulle" },
                        { id: "badge", label: "Badge" },
                        { id: "minimalist", label: "Sleek" },
                      ].map((fs) => (
                        <button
                          key={fs.id}
                          onClick={() => setStyle(prev => ({ ...prev, frameStyle: fs.id as any }))}
                          className={`p-2.5 text-center text-xs border transition ${
                            style.frameStyle === fs.id
                              ? isVS
                                ? "bg-[#f05a28]/10 border-[#f05a28] text-[#ff6d39] rounded-md"
                                : "bg-pink-500/10 border-pink-500 text-pink-300 rounded-xl"
                              : isVS
                                ? "bg-[#141414] border-[#333333] hover:border-neutral-500 text-neutral-400 rounded-md"
                                : "bg-slate-950 border-slate-800 hover:border-slate-700 rounded-xl"
                          }`}
                        >
                          <div className="font-semibold">{fs.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {style.frameStyle !== "none" && (
                    <div className={`${isVS ? "bg-[#141414] border border-[#2d2d2d] rounded-md" : "bg-slate-950 border border-slate-800 rounded-xl"} p-4.5 space-y-4 animate-fadeIn`}>
                      
                      {/* Frame text label */}
                      <div>
                        <label htmlFor="frame-text-input" className="block text-xs font-bold text-slate-300 mb-2">Texte d'incitation (Majuscules recommandées) :</label>
                        <input
                          id="frame-text-input"
                          type="text"
                          maxLength={16}
                          value={style.frameText}
                          onChange={(e) => setStyle(prev => ({ ...prev, frameText: e.target.value }))}
                          placeholder="EX: SCAN ME !"
                          className={`w-full bg-slate-900 border border-slate-800 ${isVS ? "focus:border-[#f05a28] rounded-md" : "focus:border-pink-500 rounded-xl"} py-2 px-3 text-sm font-semibold uppercase text-slate-100 outline-none`}
                        />
                      </div>

                      {/* Frame Colors */}
                      <div className="pt-2 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <input
                            id="frame-bg-color-picker"
                            type="color"
                            value={style.frameBgColor}
                            onChange={(e) => setStyle(prev => ({ ...prev, frameBgColor: e.target.value }))}
                            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <div className="space-y-0.5">
                            <label htmlFor="frame-bg-color-picker" className="text-xs font-medium text-slate-300">Fond du cadre</label>
                            <p className="text-[10px] text-slate-500">{style.frameBgColor.toUpperCase()}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            id="frame-text-color-picker"
                            type="color"
                            value={style.frameTextColor}
                            onChange={(e) => setStyle(prev => ({ ...prev, frameTextColor: e.target.value }))}
                            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <div className="space-y-0.5">
                            <label htmlFor="frame-text-color-picker" className="text-xs font-medium text-slate-300">Texte du cadre</label>
                            <p className="text-[10px] text-slate-500">{style.frameTextColor.toUpperCase()}</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* TAB 5: ARRIÈRE-PLAN QR */}
              {activeTab === "fond" && (
                <div className="space-y-4 animate-fadeIn">
                  
                  {/* Select Flat or Gradient Background */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">Style de Fond du Code :</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStyle(prev => ({ ...prev, backgroundGradient: false }))}
                          className={`flex-1 py-1.5 text-xs font-semibold border transition ${
                            !style.backgroundGradient
                              ? isVS
                                ? "bg-[#f05a28]/10 border-[#f05a28]/40 text-[#ff6d39] rounded-md"
                                : "bg-slate-800 border-slate-700 text-white rounded-xl"
                              : isVS
                                ? "bg-[#141414] border-[#333333] text-neutral-400 rounded-md"
                                : "bg-slate-950 border-slate-800 text-slate-400 rounded-xl"
                          }`}
                        >
                          Uni
                        </button>
                        <button
                          onClick={() => setStyle(prev => ({ ...prev, backgroundGradient: true }))}
                          className={`flex-1 py-1.5 text-xs font-semibold border transition ${
                            style.backgroundGradient
                              ? isVS
                                ? "bg-[#f05a28]/10 border-[#f05a28]/40 text-[#ff6d39] rounded-md"
                                : "bg-slate-800 border-slate-700 text-white rounded-xl"
                              : isVS
                                ? "bg-[#141414] border-[#333333] text-neutral-400 rounded-md"
                                : "bg-slate-950 border-slate-800 text-slate-400 rounded-xl"
                          }`}
                        >
                          Dégradé
                        </button>
                      </div>
                    </div>

                    {style.backgroundGradient && (
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-2">Structure du dégradé :</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setStyle(prev => ({ ...prev, backgroundGradientType: "linear" }))}
                            className={`flex-1 py-1.5 text-xs font-semibold border transition ${
                              style.backgroundGradientType === "linear"
                                ? isVS
                                  ? "bg-[#ff9a00]/10 border-[#ff9a00]/30 text-[#ff9a00] rounded-md"
                                  : "bg-slate-800 border-slate-700 text-white rounded-xl"
                                : isVS
                                  ? "bg-[#141414] border-[#333333] text-neutral-400 rounded-md"
                                  : "bg-slate-950 border-slate-800 text-slate-400"
                            }`}
                          >
                            Linéaire
                          </button>
                          <button
                            onClick={() => setStyle(prev => ({ ...prev, backgroundGradientType: "radial" }))}
                            className={`flex-1 py-1.5 text-xs font-semibold border transition ${
                              style.backgroundGradientType === "radial"
                                ? isVS
                                  ? "bg-[#ff9a00]/10 border-[#ff9a00]/30 text-[#ff9a00] rounded-md"
                                  : "bg-slate-800 border-slate-700 text-white rounded-xl"
                                : isVS
                                  ? "bg-[#141414] border-[#333333] text-neutral-400 rounded-md"
                                  : "bg-slate-950 border-slate-800 text-slate-400"
                            }`}
                          >
                            Radial
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Color pickers */}
                  <div className={`${isVS ? "bg-[#141414] border border-[#2d2d2d] rounded-md" : "bg-slate-950 border border-slate-800 rounded-xl"} p-4 space-y-3`}>
                    <label className="block text-xs font-bold text-slate-300">Sélectionner les couleurs de fond :</label>
                    
                    {!style.backgroundGradient ? (
                      <div className="flex items-center gap-3">
                        <input
                          id="bg-color-picker"
                          type="color"
                          value={style.backgroundColor}
                          onChange={(e) => setStyle(prev => ({ ...prev, backgroundColor: e.target.value }))}
                          className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <div className="space-y-0.5">
                          <label htmlFor="bg-color-picker" className="text-xs font-medium text-slate-300">Couleur unique</label>
                          <p className="text-[10px] text-slate-500">{style.backgroundColor.toUpperCase()}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <input
                            id="bg-grad-1"
                            type="color"
                            value={style.backgroundGradientColors[0] || "#FFFFFF"}
                            onChange={(e) => {
                              const colors = [...style.backgroundGradientColors];
                              colors[0] = e.target.value;
                              setStyle(prev => ({ ...prev, backgroundGradientColors: colors, backgroundColor: colors[0] }));
                            }}
                            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <div className="space-y-0.5">
                            <label htmlFor="bg-grad-1" className="text-xs font-medium text-slate-300">Couleur Départ</label>
                            <p className="text-[10px] text-slate-500">{(style.backgroundGradientColors[0] || "#FFFFFF").toUpperCase()}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            id="bg-grad-2"
                            type="color"
                            value={style.backgroundGradientColors[1] || "#F3F4F6"}
                            onChange={(e) => {
                              const colors = [...style.backgroundGradientColors];
                              colors[1] = e.target.value;
                              setStyle(prev => ({ ...prev, backgroundGradientColors: colors }));
                            }}
                            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <div className="space-y-0.5">
                            <label htmlFor="bg-grad-2" className="text-xs font-medium text-slate-300">Couleur Arrivée</label>
                            <p className="text-[10px] text-slate-500">{(style.backgroundGradientColors[1] || "#F3F4F6").toUpperCase()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          </div>
            </div> {/* End of Personnalisation Manuelle panel */}
            
            <div className={qrActiveLeftMenu === "export" ? "block" : "hidden"}>

          {/* Card: Export & Deliverability Check */}
          <div className={`${panelNoGroupClass} space-y-5`}>
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Paramètres d'export</span>
              <span className="text-[10px] text-slate-500 font-mono">PNG Lossless</span>
            </div>

            {/* Real-time Contrast Score Indicator */}
            <div className={`p-4 rounded-xl flex items-start gap-3 border ${scannabilityStatus.bgClass} ${contrastRatio < 2.0 ? "border-rose-500/20" : isVS ? "border-neutral-800" : "border-slate-800"}`}>
              {contrastRatio < 2.0 ? (
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">Scanabilité :</span>
                  <span className={`text-xs font-black ${scannabilityStatus.textClass}`}>{scannabilityStatus.label}</span>
                  <span className="text-[10px] text-slate-500 font-mono">(Score: {contrastRatio})</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {scannabilityStatus.desc}
                </p>
              </div>
            </div>

            {/* Selector size */}
            <div>
              <label htmlFor="export-size-selector" className="block text-xs font-bold text-slate-300 mb-2">Taille / Résolution finale :</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { size: 512, label: "512 x 512 px", tag: "Web" },
                  { size: 1024, label: "1K HD", tag: "Print" },
                  { size: 2048, label: "2K Ultra HD", tag: "Vector Crisp" },
                ].map((sz) => (
                  <button
                    key={sz.size}
                    id="export-size-selector"
                    onClick={() => setExportSize(sz.size)}
                    className={`py-2 px-1 text-center border transition relative flex flex-col justify-center cursor-pointer ${
                      exportSize === sz.size
                        ? isVS
                          ? "bg-[#f05a28]/10 border-[#f05a28] text-[#ff6d39] rounded-md"
                          : "bg-cyan-500/10 border-cyan-500 text-cyan-300 rounded-xl"
                        : isVS
                          ? "bg-[#141414] border-[#333333] hover:border-neutral-500 text-neutral-400 rounded-md"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 rounded-xl"
                    }`}
                  >
                    <span className="text-xs font-bold">{sz.size}px</span>
                    <span className="text-[9px] text-slate-500 mt-0.5">{sz.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Real Export triggers */}
            <button
              onClick={handleDownloadClick}
              disabled={!downloadReadyDataUrl}
              className={`w-full ${isVS ? "bg-[#f05a28] hover:bg-[#ff6c3a] text-white rounded-md" : "bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 text-slate-950 rounded-xl"} font-extrabold text-sm py-4 transition active:scale-95 duration-100 shadow-2xl flex items-center justify-center gap-2.5 cursor-pointer disabled:bg-slate-850 disabled:text-neutral-500 disabled:from-transparent disabled:to-transparent`}
            >
              <Download className="w-5 h-5 shrink-0" />
              <span>Télécharger le QR Code</span>
            </button>

            {/* Quick alert if background is gradient/custom */}
            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
              Le QR code intègre le cadre, le texte de bas-page et l'icône dans l'image finale.
            </p>

          </div>
          </div>
          </div>
        </div>

      </main>
            ) : corporateSubTab === "card" ? (
              <main className="flex-1 w-full p-0 overflow-y-auto">
                <BusinessCardGenerator qrCodeUrlValue={url} qrCodeStyle={style} customDesignedLogo={customDesignedLogo || undefined} isVS={isVS} />
              </main>
            ) : (
              <main className="flex-1 w-full p-0 overflow-hidden h-full">
                <CareerStudio isVS={isVS} geminiApiKey={geminiApiKey} triggerToast={triggerToast} />
              </main>
            )}
          </div>
        </div>
      ) : globalTab === "logo" ? (
        <main className="flex-1 w-full p-0">
          <IllustratorCanvas 
            onExportAsLogoUrl={(url) => { 
              setCustomDesignedLogo(url); 
              // Also inject directly into style as Custom Logo!
              setStyle(prev => ({
                ...prev,
                logoType: "custom",
                logoUrl: url
              }));
              triggerToast("Logo personnalisé enregistré avec succès !"); 
            }}
            geminiApiKey={geminiApiKey}
            maxHistorySteps={maxHistorySteps}
            enableCanvasGridPerf={enableCanvasGridPerf}
            performanceQuality={performanceQuality}
          />
        </main>
      ) : globalTab === "pdf" ? (
        <main className="flex-1 w-full p-0">
          <PDFEditor 
            isVS={isVS} 
            geminiApiKey={geminiApiKey} 
            triggerToast={triggerToast} 
            setGlobalTab={setGlobalTab}
            setSettingsActiveSubTab={setSettingsActiveSubTab}
          />
        </main>
      ) : (
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={panelNoGroupClass}
          >
            {/* Header */}
            <div className="flex items-center gap-3 pb-5 border-b border-neutral-800/40 mb-6">
              <div className={`p-2.5 rounded-lg ${isVS ? "bg-[#f05a28]/15 text-[#f05a28]" : "bg-cyan-500/10 text-cyan-400"}`}>
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Paramètres de l'Application</h2>
                <p className="text-xs text-neutral-400">Ajustez l'espace de travail et changez l'apparence générale de Visual Vector Studio.</p>
              </div>
            </div>

            {/* Custom Settings Tabs Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              
              {/* Left Settings Sidebar Option Grid */}
              <div className="md:col-span-4 space-y-2">
                <button
                  onClick={() => setSettingsActiveSubTab("appearance")}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 border transition-all duration-150 cursor-pointer ${
                    settingsActiveSubTab === "appearance"
                      ? isVS
                        ? "bg-[#2d2d2d] border-[#f05a28] text-neutral-100 shadow-md shadow-[#f05a28]/5"
                        : "bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/5"
                      : "bg-[#181818]/40 border-transparent text-neutral-400 hover:text-white hover:bg-[#252525]/50"
                  }`}
                >
                  <Palette className="w-4 h-4" />
                  <span className="text-xs font-bold font-mono">🎨 Apparence</span>
                </button>

                <button
                  onClick={() => setSettingsActiveSubTab("performance")}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 border transition-all duration-150 cursor-pointer ${
                    settingsActiveSubTab === "performance"
                      ? isVS
                        ? "bg-[#2d2d2d] border-[#f05a28] text-neutral-100 shadow-md shadow-[#f05a28]/5"
                        : "bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/5"
                      : "bg-[#181818]/40 border-transparent text-neutral-400 hover:text-white hover:bg-[#252525]/50"
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span className="text-xs font-bold font-mono">⚙️ Performances</span>
                </button>

                <button
                  onClick={() => setSettingsActiveSubTab("gemini")}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 border transition-all duration-150 cursor-pointer ${
                    settingsActiveSubTab === "gemini"
                      ? isVS
                        ? "bg-[#2d2d2d] border-[#f05a28] text-neutral-100 shadow-md shadow-[#f05a28]/5"
                        : "bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/5"
                      : "bg-[#181818]/40 border-transparent text-neutral-400 hover:text-white hover:bg-[#252525]/50"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="text-xs font-bold font-mono">🤖 Clés d'API Gemini</span>
                </button>

                <button
                  onClick={() => setSettingsActiveSubTab("language")}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 border transition-all duration-150 cursor-pointer ${
                    settingsActiveSubTab === "language"
                      ? isVS
                        ? "bg-[#2d2d2d] border-[#f05a28] text-neutral-100 shadow-md shadow-[#f05a28]/5"
                        : "bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/5"
                      : "bg-[#181818]/40 border-transparent text-neutral-400 hover:text-white hover:bg-[#252525]/50"
                  }`}
                >
                  <span className="text-xs font-bold font-mono">🌐 Langues / Languages</span>
                </button>
              </div>

              {/* Right Settings Window Core Panels */}
              <div className="md:col-span-8 space-y-6">
                
                {settingsActiveSubTab === "appearance" && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    {/* Theme Selection choice */}
                    <div className="space-y-4">
                      <span className="text-xs font-bold uppercase tracking-wider block">Option de Thème :</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        
                        {/* Theme 1: Visual Studio UI */}
                        <button
                          onClick={() => {
                            setAppTheme("visual-studio");
                            triggerToast("Thème 'Visual Studio UI' appliqué.");
                          }}
                          className={`text-left p-4 rounded-lg border transition-all duration-200 cursor-pointer flex flex-col justify-between h-40 group relative overflow-hidden ${
                            isVS
                              ? "bg-[#1e1e1e] border-[#f05a28] shadow-[0_4px_12px_rgba(240,90,40,0.15)]"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/40"
                          }`}
                        >
                          <div className="space-y-1 z-10">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold uppercase tracking-wider ${isVS ? "text-[#f05a28]" : "text-neutral-300"}`}>
                                Visual Studio UI
                              </span>
                              {isVS && <span className="bg-[#f05a28]/10 text-[#f05a28] border border-[#f05a28]/20 px-1.5 py-0.5 text-[8px] font-bold rounded">ACTIF</span>}
                            </div>
                            <p className="text-[10px] text-neutral-400 leading-relaxed max-w-[210px] mt-2">
                              Nuances de gris technique, repères d'alignement rectilignes, coins profilés et bouton d'accent orange électrique.
                            </p>
                          </div>

                          {/* Mimic color boxes */}
                          <div className="flex gap-2 mt-auto z-10">
                            <div className="w-6 h-6 rounded bg-[#1e1e1e] border border-neutral-700 flex items-center justify-center text-[7px] font-mono font-bold text-neutral-400">#1E</div>
                            <div className="w-6 h-6 rounded bg-[#252525] border border-neutral-700 flex items-center justify-center text-[7px] font-mono font-bold text-neutral-400">#25</div>
                            <div className="w-6 h-6 rounded bg-[#f05a28] border border-neutral-700 flex items-center justify-center text-[7px] font-mono font-bold text-white">OR</div>
                          </div>
                          
                          {/* Subtle line grids */}
                          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none w-24 h-24 border-l border-t border-dashed border-neutral-400" />
                        </button>

                        {/* Theme 2: Cyber Punk */}
                        <button
                          onClick={() => {
                            setAppTheme("cyber-punk");
                            triggerToast("Thème 'Cyber Punk' activé !");
                          }}
                          className={`text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-40 group relative overflow-hidden ${
                            !isVS
                              ? "bg-slate-900 border-cyan-500 shadow-[0_4px_20px_rgba(6,182,212,0.15)]"
                              : "bg-[#1e1e1e] border-neutral-850 hover:border-neutral-750 hover:bg-[#252525]"
                          }`}
                        >
                          <div className="space-y-1 z-10">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold uppercase tracking-wider ${!isVS ? "text-cyan-400" : "text-neutral-400"}`}>
                                Cyber Punk
                              </span>
                              {!isVS && <span className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-0.5 text-[8px] font-bold rounded">ACTIF</span>}
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed max-w-[210px] mt-2">
                              Univers cosmique rétro-futuriste s'appuyant sur des dégradés de violet et cyan profonds, coins très arrondis et ombrages diffuses intenses.
                            </p>
                          </div>

                          {/* Mimic cyber shades */}
                          <div className="flex gap-2 mt-auto z-10">
                            <div className="w-6 h-6 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-[7px] font-mono font-bold text-slate-500">CY</div>
                            <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-[7px] font-mono font-bold text-slate-500">DK</div>
                            <div className="w-6 h-6 rounded bg-gradient-to-tr from-cyan-400 to-indigo-500 flex items-center justify-center text-[7px] font-mono font-bold text-slate-950">GR</div>
                          </div>

                          {/* Cyber glow background glow */}
                          <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
                        </button>

                      </div>

                    </div>

                    {/* Additional simulated control settings for Appearance */}
                    <div className="space-y-4 pt-4 border-t border-neutral-800/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold block">Arrondis des Angles</span>
                          <span className="text-[10px] text-neutral-450">Modifier l'élasticité graphique des éléments d'interface.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-neutral-500">{isVS ? "Arêtes Vives (4px)" : "Nuance Douce (16px)"}</span>
                          <div className="w-10 h-6 bg-neutral-800 rounded-full p-1 cursor-pointer flex items-center justify-start">
                            <div className={`w-4 h-4 rounded-full transition-transform ${isVS ? "bg-neutral-600 translate-x-0" : "bg-cyan-400 translate-x-4"}`} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold block">Qualité d'Exportation par défaut</span>
                          <span className="text-[10px] text-neutral-450">Taux de résolution vectorielle final des tracés.</span>
                        </div>
                        <div className="w-48">
                          <ThemedSelect
                            value={exportSize}
                            onChange={(val) => setExportSize(Number(val))}
                            options={[
                              { value: 1024, label: "HD (1024x1024px)" },
                              { value: 2048, label: "Ultra HD 4K (2048x2048px)" },
                            ]}
                            isVS={isVS}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {settingsActiveSubTab === "performance" && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-350">Profil de performance vectorielle :</h4>
                      <p className="text-[10px] text-neutral-400 leading-relaxed">
                        Ajuste la fidélité de restitution graphique et l'overhead CPU en temps réel lors de l'édition vectorielle intensive.
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {[
                          { id: "eco", label: "Éco", desc: "Optimisation maximale, idéal pour les appareils de faible puissance." },
                          { id: "standard", label: "Standard", desc: "Rendu fluide équilibré avec ombrages d'alignement actifs." },
                          { id: "high", label: "Studio Pro", desc: "Performance de l'artboard avec tracé vectoriel haute précision." }
                        ].map((profile) => (
                          <button
                            key={profile.id}
                            onClick={() => {
                              setPerformanceQuality(profile.id as any);
                              localStorage.setItem("performance_quality", profile.id);
                              triggerToast(`Profil de performance '${profile.label}' activé !`);
                            }}
                            className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all duration-150 h-28 cursor-pointer ${
                              performanceQuality === profile.id
                                ? isVS
                                  ? "bg-[#2d2d2d] border-[#f05a28] shadow-[0_4px_12px_rgba(240,90,40,0.15)] text-neutral-100"
                                  : "bg-cyan-950/40 border-cyan-500 shadow-[0_4px_20px_rgba(6,182,212,0.15)] text-cyan-300"
                                : "bg-[#181818]/60 border-neutral-800 hover:bg-[#252525]/80 hover:border-neutral-700 text-neutral-400"
                            }`}
                          >
                            <div>
                              <span className={`text-xs font-bold uppercase ${performanceQuality === profile.id ? isVS ? "text-[#f05a28]" : "text-cyan-400" : "text-neutral-300"}`}>
                                {profile.label}
                              </span>
                              <p className="text-[9px] text-neutral-450 leading-tight mt-1">
                                {profile.desc}
                              </p>
                            </div>
                            <span className="text-[8px] font-mono font-bold uppercase tracking-wider self-end mt-auto text-neutral-500">
                              {performanceQuality === profile.id ? "● SÉLECTIONNÉ" : "ACTIVER"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-neutral-800/10">
                      {/* Max History limit option */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold block">Limite d'étapes d'Annulation (Undo)</span>
                          <span className="text-[10px] text-neutral-455">Taille maximale de la pile d'historique conservée en mémoire RAM.</span>
                        </div>
                        <div className="w-56">
                          <ThemedSelect
                            value={maxHistorySteps}
                            onChange={(val) => {
                              const num = Number(val);
                              setMaxHistorySteps(num);
                              localStorage.setItem("max_history_steps", num.toString());
                              triggerToast(`Limite d'annulation fixée à : ${num} étapes`);
                            }}
                            options={[
                              { value: 15, label: "Compact (15 étapes - Éco)" },
                              { value: 30, label: "Normal (30 étapes - Équilibré)" },
                              { value: 50, label: "Créatif (50 étapes - Studio)" },
                              { value: 100, label: "Illimité (100 étapes - RAM Max)" },
                            ]}
                            isVS={isVS}
                            size="sm"
                          />
                        </div>
                      </div>

                      {/* Web Canvas grid optimization option */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold block">Optimisation du rendu de grille vectorielle</span>
                          <span className="text-[10px] text-neutral-455">Améliore les performances de zoom & de déplacement fluide sur le canevas.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-neutral-500">{enableCanvasGridPerf ? "Activé / Activé" : "Désactivé"}</span>
                          <button
                            onClick={() => {
                              const next = !enableCanvasGridPerf;
                              setEnableCanvasGridPerf(next);
                              localStorage.setItem("enable_canvas_grid_perf", String(next));
                              triggerToast(next ? "Optimisation de grille activée." : "Optimisation désactivée.");
                            }}
                            className="w-10 h-6 bg-neutral-800 rounded-full p-1 cursor-pointer flex items-center"
                          >
                            <div className={`w-4 h-4 rounded-full transition-transform ${enableCanvasGridPerf ? "bg-emerald-500 translate-x-4" : "bg-neutral-600 translate-x-0"}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {settingsActiveSubTab === "gemini" && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="p-3 bg-[#f05a28]/10 border border-[#f05a28]/20 rounded-lg text-neutral-200 text-xs flex gap-2 leading-relaxed">
                      <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <span className="font-bold text-neutral-100">Pourquoi renseigner votre clé d'API personnelle ?</span>
                        <p className="text-[10px] text-neutral-350 mt-1">
                          Visual Vector Studio intègre des modèles de logo intelligents et la Gomme magique IA.
                          Par défaut, vos prompts sont traités sur nos serveurs. Pour un volume de requêtes illimités sans restriction, 
                          vous pouvez configurer votre propre clé d'API Google Gemini. Elle reste strictement stockée en local dans votre navigateur.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-300 block">Votre clé d'API Google Gemini :</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type={showApiKey ? "text" : "password"}
                              value={geminiApiKey}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGeminiApiKey(val);
                                localStorage.setItem("gemini_api_key", val);
                              }}
                              placeholder="Clé d'API (commence par AIzaSy...)"
                              className="w-full bg-[#181818] border border-neutral-800 focus:border-[#f05a28] text-neutral-150 rounded px-3 py-2 text-xs outline-none transition font-mono pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-2 top-2 text-neutral-500 hover:text-white cursor-pointer"
                            >
                              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          
                          <button
                            onClick={() => {
                              localStorage.setItem("gemini_api_key", geminiApiKey);
                              triggerToast("Clé d'API enregistrée localement ! ✅");
                            }}
                            className={`px-4 py-2 font-black text-xs rounded transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                              isVS ? "bg-[#f05a28] hover:bg-[#ff723f] text-white" : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Enregistrer</span>
                          </button>
                        </div>
                        <p className="text-[9px] text-neutral-500 font-mono">
                          Laissez ce champ vide pour utiliser le jeton d'infrastructure par défaut du système.
                        </p>
                      </div>

                      {/* API testing component status */}
                      <div className="p-3 bg-neutral-900/60 border border-neutral-850 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-neutral-300 block">Statut de la clé d'API</span>
                            <span className="text-[10px] text-neutral-450 leading-relaxed">
                              Vérifiez instantanément la validité et l'accessibilité de votre clé auprès de l'API de Google.
                            </span>
                          </div>
                          <button
                            onClick={() => handleTestApiKey(geminiApiKey)}
                            disabled={isTestingKey}
                            className="bg-neutral-800 hover:bg-neutral-750 disabled:bg-neutral-850 disabled:text-neutral-500 border border-neutral-750 text-neutral-200 font-bold px-3 py-1.5 rounded text-[10px] transition cursor-pointer flex items-center gap-1"
                          >
                            {isTestingKey ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                            <span>{isTestingKey ? "Test en cours..." : "Tester la clé"}</span>
                          </button>
                        </div>

                        {keyTestResult && (
                          <div className={`p-2.5 rounded text-[10px] flex items-start gap-1.5 font-mono leading-relaxed ${keyTestResult.success ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" : "bg-red-500/10 text-red-400 border border-red-500/15"}`}>
                            <span className="font-bold">{keyTestResult.success ? "✓ REUSSITE :" : "✗ ERREUR :"}</span>
                            <span>{keyTestResult.message}</span>
                          </div>
                        )}
                      </div>

                      {/* Connection details of linked card operations */}
                      <div className="text-[10px] text-neutral-450 border-t border-neutral-800/15 pt-3 space-y-1">
                        <span className="font-bold text-neutral-300 uppercase tracking-wide block mb-1">Fonctionnalités associées :</span>
                        <ul className="list-disc pl-4 space-y-1">
                          <li><strong className="text-neutral-300">Modèles de Logos Vectoriels :</strong> Traduit vos prompts de logo en coordonnées géométriques complexes.</li>
                          <li><strong className="text-neutral-300">Gomme magique vectorielle :</strong> Efface les couches de fond ou de premier plan avec précision.</li>
                          <li><strong className="text-neutral-300">Adjoint de design QR Code :</strong> Suggère des dotStyle, eyeStyle et palettes chromatiques.</li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}

                {settingsActiveSubTab === "language" && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-350">Langue de l'interface / Interface Language :</h4>
                      <p className="text-[10px] text-neutral-400 leading-relaxed mb-4">
                        Choisissez la langue principale de l'application. / Choose the main application language.
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => {
                            setAppLanguage("fr");
                            triggerToast("Langue modifiée: Français");
                          }}
                          className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all duration-150 h-28 cursor-pointer ${
                            appLanguage === "fr"
                              ? isVS
                                ? "bg-[#2d2d2d] border-[#f05a28] shadow-[0_4px_12px_rgba(240,90,40,0.15)] text-neutral-100"
                                : "bg-cyan-950/40 border-cyan-500 shadow-[0_4px_20px_rgba(6,182,212,0.15)] text-cyan-300"
                              : "bg-[#181818]/60 border-neutral-800 hover:bg-[#252525]/80 hover:border-neutral-700 text-neutral-400"
                          }`}
                        >
                          <div>
                            <span className={`text-xs font-bold uppercase ${appLanguage === "fr" ? isVS ? "text-[#f05a28]" : "text-cyan-400" : "text-neutral-300"}`}>
                              🇫🇷 Français
                            </span>
                            <p className="text-[9px] text-neutral-450 leading-tight mt-1">
                              Interface complète en français.
                            </p>
                          </div>
                          <span className="text-[8px] font-mono font-bold uppercase tracking-wider self-end mt-auto text-neutral-500">
                            {appLanguage === "fr" ? "● ACTIF" : "ACTIVER"}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setAppLanguage("en");
                            triggerToast("Language changed: English");
                          }}
                          className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all duration-150 h-28 cursor-pointer ${
                            appLanguage === "en"
                              ? isVS
                                ? "bg-[#2d2d2d] border-[#f05a28] shadow-[0_4px_12px_rgba(240,90,40,0.15)] text-neutral-100"
                                : "bg-cyan-950/40 border-cyan-500 shadow-[0_4px_20px_rgba(6,182,212,0.15)] text-cyan-300"
                              : "bg-[#181818]/60 border-neutral-800 hover:bg-[#252525]/80 hover:border-neutral-700 text-neutral-400"
                          }`}
                        >
                          <div>
                            <span className={`text-xs font-bold uppercase ${appLanguage === "en" ? isVS ? "text-[#f05a28]" : "text-cyan-400" : "text-neutral-300"}`}>
                              🇬🇧 English
                            </span>
                            <p className="text-[9px] text-neutral-450 leading-tight mt-1">
                              Full UI translated to English.
                            </p>
                          </div>
                          <span className="text-[8px] font-mono font-bold uppercase tracking-wider self-end mt-auto text-neutral-500">
                            {appLanguage === "en" ? "● ACTIVE" : "ACTIVATE"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

              </div>

            </div>
          </motion.div>
        </main>
      )}

      {/* Bottom Navigation Glued to screen bottom */}
      {!(globalTab === "pro" && isProFullscreen) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 w-full pointer-events-none">
          <div className={`pointer-events-auto flex items-center justify-between gap-2 px-6 py-2.5 border-t backdrop-blur-lg shadow-2xl transition-all duration-300 ${
            isVS 
              ? "bg-[#252525]/95 border-[#3d3d3d] shadow-black/80" 
              : "bg-slate-900/95 border-slate-800 shadow-indigo-950/20"
          }`}>
            {[
              { id: "logo", label: "Vector Studio", shortLabel: "Vector Studio", desc: "Tracés vectoriels pro", icon: Palette },
              { id: "pro", label: "Professional Tool Studio", shortLabel: "Pro Tools", desc: "Tableau Blanc & Éducatif", icon: Presentation },
              { id: "corporate", label: "Corporate Studio", shortLabel: "Corporate", desc: "QR & Cartes de Visite", icon: Briefcase },
              { id: "pdf", label: "PDF Studio", shortLabel: "PDF", desc: "Éditer & Formulaires", icon: FileText }
            ].map((item) => {
              const isActive = globalTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setGlobalTab(item.id as any);
                    triggerToast(`Section active : ${item.label}`);
                  }}
                  className={`flex-1 flex items-center gap-3 p-2.5 text-left rounded-xl transition-all duration-200 cursor-pointer group relative overflow-hidden border ${
                    isActive
                      ? isVS
                        ? "bg-[#2d2d2d] border-[#f05a28]/80 shadow-[0_2px_8px_rgba(240,90,40,0.15)] text-neutral-100"
                        : "bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 border-cyan-505 text-cyan-300 shadow-lg shadow-cyan-500/5 font-semibold"
                      : isVS
                        ? "bg-[#1e1e1e]/60 border-transparent text-neutral-400 hover:text-white hover:bg-[#282828] hover:border-neutral-700"
                        : "bg-slate-950/60 border-transparent hover:border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {/* Visual active border-indicator bar */}
                  {isActive && (
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      isVS ? "bg-[#f05a28]" : "bg-gradient-to-b from-cyan-400 to-indigo-500"
                    }`} />
                  )}
                  
                  <div className={`p-2 rounded-lg shrink-0 transition duration-200 ${
                    isActive
                      ? isVS ? "bg-[#f05a28]/10 text-[#f05a28]" : "bg-cyan-500/10 text-cyan-400"
                      : isVS ? "bg-[#181818]/65 text-neutral-500 group-hover:text-neutral-300" : "bg-slate-950/40 text-slate-500 group-hover:text-slate-300"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  
                  <div className="hidden md:block overflow-hidden">
                    <div className={`text-xs font-bold leading-none ${isActive ? isVS ? "text-neutral-100" : "text-white" : isVS ? "text-neutral-400 font-medium" : "text-slate-400"}`}>
                      {item.label}
                    </div>
                    <div className={`text-[9px] truncate mt-0.5 leading-none ${isActive ? "opacity-75" : "text-neutral-500 group-hover:text-neutral-450"}`}>
                      {item.desc}
                    </div>
                  </div>

                  <div className="md:hidden mx-auto text-[10px] font-bold">
                    {item.shortLabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Studio Workspace Floating Submenu Anchored Under Top Right Avatar */}
      <AnimatePresence>
        {showVSMenu && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className="fixed top-14 right-6 z-50 w-80 bg-[#1c1c1c] border border-[#333333] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-md p-4 text-neutral-200 overflow-hidden"
          >
            {/* Ribbon Background Effect */}
            <div className="absolute right-0 top-0 opacity-5 pointer-events-none w-32 h-32 border-l border-b border-dashed border-[#f05a28]" />
            
            <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <VisualVectorStudioLogo className="w-6 h-6" variant="primary" />
                <div>
                  <span className="text-xs font-black tracking-wide text-white block">Visual Vector Studio Workspace</span>
                  <span className="text-[9px] text-[#00f2fe] uppercase font-mono font-bold tracking-widest leading-none">Environnement Pro</span>
                </div>
              </div>
              <button 
                onClick={() => setShowVSMenu(false)}
                className="text-neutral-500 hover:text-white p-1 rounded-md hover:bg-[#2d2d2d] transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              
              {/* Account Setting Block */}
              <div className="bg-[#242424] border border-[#2e2e2e] rounded-lg p-3 space-y-2 max-h-[300px] overflow-y-auto hidden-scrollbar">
                <AccountSettingsView isVS={isVS} triggerToast={triggerToast} />
              </div>

              {/* Conditional Admin Option */}
              {isAdmin ? (
                <button
                  onClick={() => {
                    setIsAdminMenuOpen(true);
                    setShowVSMenu(false);
                    triggerToast("Console Administrateur ouverte.");
                    loadFirebaseLogs();
                  }}
                  className="w-full bg-[#f05a28] hover:bg-[#ff6c3a] text-white font-bold rounded-lg p-2.5 text-xs flex items-center justify-center gap-2 transition hover:shadow-lg hover:shadow-[#f05a28]/10 cursor-pointer duration-200"
                >
                  <Terminal className="w-3.5 h-3.5 shrink-0" />
                  <span>Ouvrir Outils Administrateur</span>
                </button>
              ) : (
                <div className="bg-[#181818]/60 border border-dashed border-[#2d2d2d] rounded-lg p-3 text-center">
                  <p className="text-[10px] text-neutral-500 leading-normal">
                    Outils administrateur verrouillés.<br />Connectez-vous avec l'adresse mail Admin.
                  </p>
                </div>
              )}

              {/* Status Panel */}
              <div className="flex items-center justify-between text-[9px] text-[#777] font-mono leading-none pt-2 border-t border-[#2a2a2a]">
                <span className="flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5 text-emerald-500" /> base sync
                </span>
                <span>Projet: Visual Vector Studio</span>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Studio Admin Center sliding drawer */}
      <AnimatePresence>
        {isAdminMenuOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-[460px] max-w-full z-50 bg-[#1e1e1e] border-l border-[#333333] shadow-[0_0_50px_rgba(0,0,0,0.85)] flex flex-col text-neutral-200"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#333333] bg-[#222222] flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#f05a28]" />
                <div>
                  <span className="text-xs font-black tracking-wide text-white block">CONSOLE DE CONTRÔLE ADMIN</span>
                  <p className="text-[9px] font-mono font-bold uppercase text-sky-400 leading-none">Projet : Visual Vector Studio (Firebase Sync)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAdminMenuOpen(false);
                  triggerToast("Console Administrateur masquée.");
                }}
                className="hover:bg-[#2d2d2d] text-neutral-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main scrollable body */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto no-scrollbar">

              {/* Server health statistics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#242424] border border-[#2e2e2e] rounded-lg p-3">
                  <span className="text-[9px] text-neutral-500 font-mono block">STATUT DE CONVERSION</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${isFirebaseConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                    <span className="text-xs font-bold text-white uppercase font-mono">{isFirebaseConnected ? "Firebase Connecté" : "Hors-ligne"}</span>
                  </div>
                </div>
                
                <div className="bg-[#242424] border border-[#2e2e2e] rounded-lg p-3">
                  <span className="text-[9px] text-neutral-500 font-mono block">EMAIL EN SESSION</span>
                  <span className="text-[#ff6d39] text-xs font-bold font-mono mt-1 block truncate">{userEmail}</span>
                </div>
              </div>

              {/* Action items */}
              <div className="bg-[#242424] border border-[#2e2e2e] rounded-lg p-3 space-y-2">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Diagnostics et Actions Directes</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={triggerSimulatedError}
                    className="bg-[#c23e00]/10 hover:bg-[#c23e00]/25 border border-[#c23e00]/30 hover:border-[#c23e00]/60 text-xs text-[#ff7f4c] font-semibold py-2 px-3 rounded transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Déclencher Erreur</span>
                  </button>

                  <button
                    onClick={async () => {
                      await loadFirebaseLogs();
                      triggerToast("Données logs recalibrées de Firebase !");
                    }}
                    className="bg-[#2a4d6c]/10 hover:bg-[#2a4d6c]/25 border border-[#2a4d6c]/30 hover:border-[#2a4d6c]/60 text-xs text-sky-400 font-semibold py-2 px-3 rounded transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Recalibrer Logs</span>
                  </button>
                </div>
              </div>

              {/* Clipboard log copy tools */}
              <div className="bg-[#242424] border border-[#2e2e2e] rounded-lg p-3 space-y-3">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Copy className="w-3 h-3 text-[#f05a28]" /> Copier/Coller de Logs
                </span>
                
                <div className="space-y-2">
                  <button
                    onClick={handleCopyAll}
                    className="w-full text-left p-2.5 bg-[#2a2a2a] hover:bg-[#323232] rounded flex items-center justify-between text-xs transition border border-transparent hover:border-[#444] cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="text-white font-bold text-[11px]">Tout Copier (Totalité)</span>
                      <span className="text-[9px] text-neutral-500 font-mono">Quantité globale : {logs.length} entrées</span>
                    </div>
                    <Copy className="w-4 h-4 text-neutral-400" />
                  </button>

                  <button
                    onClick={handleCopyLastHour}
                    className="w-full text-left p-2.5 bg-[#2a2a2a] hover:bg-[#323232] rounded flex items-center justify-between text-xs transition border border-transparent hover:border-[#444] cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="text-white font-bold text-[11px]">Copier de la dernière heure</span>
                      <span className="text-[9px] text-[#ff6d39] font-mono">Dernière heure : {logsLastHour.length} entrées</span>
                    </div>
                    <Copy className="w-4 h-4 text-neutral-400" />
                  </button>

                  <div className="p-2.5 bg-[#2a2a2a] rounded border border-transparent space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-[11px]">Copier d'une date particulière</span>
                        <span className="text-[9px] text-[#10a1e5] font-mono">Date cible : {selectedLogsDate} ({logsForSelectedDate.length} entrées)</span>
                      </div>
                      <button
                        onClick={handleCopySelectedDate}
                        className="bg-[#f05a28] hover:bg-[#ff6c3a] text-white p-1.5 rounded transition cursor-pointer"
                        title="Copier pour cette date"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                      <input
                        type="date"
                        value={selectedLogsDate}
                        onChange={(e) => {
                          setSelectedLogsDate(e.target.value);
                          // Shift mode to date automatically to see changes
                          setConsoleFilterMode("date");
                        }}
                        className="bg-[#181818] border border-[#3c3c3c] rounded px-2 py-1 text-xs text-white outline-none w-full font-mono text-center cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Console log box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Console d'Erreurs en Direct
                  </span>
                  
                  {/* Console visual indicators */}
                  <div className="flex items-center gap-1 bg-[#181818] p-0.5 rounded border border-[#2d2d2d]">
                    <button
                      onClick={() => setConsoleFilterMode("all")}
                      className={`text-[9px] px-2 py-1 rounded transition font-mono ${
                        consoleFilterMode === "all" ? "bg-[#f05a28]/15 text-[#ff6d39] font-bold" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Tous ({logs.length})
                    </button>
                    <button
                      onClick={() => setConsoleFilterMode("hour")}
                      className={`text-[9px] px-2 py-1 rounded transition font-mono ${
                        consoleFilterMode === "hour" ? "bg-[#f05a28]/15 text-[#ff6d39] font-bold" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Dernière Heure ({logsLastHour.length})
                    </button>
                    <button
                      onClick={() => setConsoleFilterMode("date")}
                      className={`text-[9px] px-2 py-1 rounded transition font-mono ${
                        consoleFilterMode === "date" ? "bg-[#f05a28]/15 text-[#ff6d39] font-bold" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Date ({logsForSelectedDate.length})
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={searchLogQuery}
                    onChange={(e) => setSearchLogQuery(e.target.value)}
                    placeholder="Filtrer les messages d'erreurs..."
                    className="w-full bg-[#181818] border border-[#2d2d2d] rounded-lg px-3 py-1.5 pr-8 text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-neutral-500 transition font-mono"
                  />
                  <Terminal className="absolute right-2.5 top-2 w-3.5 h-3.5 text-neutral-600" />
                </div>

                {/* Shell simulated content */}
                <div className="bg-[#121212] border border-[#2d2d2d] rounded-lg p-3 h-72 overflow-y-auto no-scrollbar font-mono text-[10.5px]">
                  {activeFilteredLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-600">
                      <CheckCircle className="w-6 h-6 text-emerald-500/40 mb-2" />
                      <span>Aucune erreur signalée dans cette vue.</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {activeFilteredLogs.map((log, index) => {
                        const isExpanded = expandedLogId === index;
                        const logDate = new Date(log.timestamp);
                        const displayTime = logDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                        const displayFullDate = logDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
                        
                        return (
                          <div
                            key={index}
                            className="border-b border-[#222222] pb-2 last:border-0 last:pb-0 font-mono text-neutral-300"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="text-red-500 font-bold">[ERR]</span>
                                <span className="text-[#a5a5a5] text-[9.5px]">({displayFullDate} {displayTime})</span>
                                <span className="text-sky-400 text-[9.5px] bg-sky-500/5 px-1 rounded border border-sky-400/10 font-bold">{log.component}</span>
                                <span className="text-neutral-500 text-[9px]">User: {log.email}</span>
                              </div>
                              
                              <button
                                onClick={() => {
                                  const text = `[${log.timestamp}] [${log.component}] [User: ${log.email}]\nMessage: ${log.message}\n${log.stack ? `Stack: ${log.stack}` : ""}`;
                                  navigator.clipboard.writeText(text);
                                  triggerToast("Log copié avec succès !");
                                }}
                                className="text-neutral-500 hover:text-white transition cursor-pointer p-0.5 hover:bg-[#222] rounded"
                                title="Copier ce log uniquement"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            
                            <p 
                              className="text-neutral-200 mt-1 cursor-pointer hover:text-sky-300 transition break-all font-mono"
                              onClick={() => setExpandedLogId(isExpanded ? null : index)}
                              title="Déplier l'historique de la pile d'exécution"
                            >
                              {log.message}
                            </p>
                            
                            {/* Trace / Stack Details */}
                            {isExpanded && log.stack && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="mt-1.5 p-2 bg-black/60 border border-[#2d2d2d] rounded text-[9px] text-[#888] overflow-x-auto whitespace-pre leading-relaxed select-all no-scrollbar max-h-40"
                              >
                                {log.stack}
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer informational */}
            <div className="p-3 bg-[#181818] border-t border-[#333333] text-center text-[10px] text-neutral-500 font-mono">
              Visual Vector Studio Admin Environment
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InstallPrompt />
      {/* Footer */}
      {globalTab !== "pro" && (
        <footer className={isVS ? "border-t border-[#303030] bg-[#1a1a1a] py-8 px-6 text-center text-xs text-neutral-500 mt-auto transition-colors" : "border-t border-slate-900 bg-slate-950 py-8 px-6 text-center text-xs text-slate-500 mt-auto transition-colors"}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© 2026 Visual Vector Studio. Conçu avec soin pour la lisibilité et la pureté esthétique.</p>
            <div className="flex items-center gap-4 animate-fadeIn">
              <span>Propulsé par Google Gemini 2.5 Flash</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-[11px] text-slate-400">Certifié Scannable</span>
            </div>
          </div>
        </footer>
      )}

    </div>
  );
}

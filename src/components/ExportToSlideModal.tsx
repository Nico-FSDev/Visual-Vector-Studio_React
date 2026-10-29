import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Presentation,
  Folder,
  FolderPlus,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FilePlus2,
  Layers,
  Copy,
  Check,
  FileText,
  Sliders,
  ChevronDown,
  Loader2,
  Download,
  Info
} from "lucide-react";
import {
  authenticateGoogleForSlides,
  listDriveFolders,
  listGoogleSlidePresentations,
  createNewPresentationWithSlide,
  appendSlideToExistingPresentation,
  exportToPptxFile,
  DecryptedSlideContent,
  DriveFolder,
  DrivePresentation
} from "../utils/googleSlides";
import { getCachedAccessToken } from "../utils/googleDrive";

export interface ExportToSlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasDataUrl: string | null;
  boardMode: "whiteboard" | "blackboard" | "paperboard";
  geminiApiKey?: string;
  onToast?: (message: string) => void;
}

export function ExportToSlideModal({
  isOpen,
  onClose,
  canvasDataUrl,
  boardMode,
  geminiApiKey,
  onToast,
}: ExportToSlideModalProps) {
  // Mode: "create" (new presentation) or "append" (existing presentation)
  const [destinationMode, setDestinationMode] = useState<"create" | "append">("create");

  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  const [slideData, setSlideData] = useState<DecryptedSlideContent>({
    title: "Synthèse de Séance & Vision Stratégique",
    subtitle: "Décryptage visuel automatique par IA Gemini",
    category: "Synthèse de réunion",
    summary: "Revue détaillée des éléments esquissés et des schémas structurants du tableau.",
    bulletPoints: [
      "Cartographie des composants et des flux relationnels",
      "Points de décision clés et priorités opérationnelles",
      "Alignement stratégique et responsabilités associées",
    ],
    diagramAnalysis: "Organigramme et flux directionnels schématisés au tableau.",
    actionItems: [
      "Validation des orientations d'architecture avec l'équipe",
      "Planification des jalons de livraison",
    ],
    speakerNotes: "Cette diapositive reprend fidèlement la synthèse de la session de travail réalisée sur le tableau.",
    suggestedColorTheme: "ocean-blue",
  });

  // Google Authentication & Drive state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("root");
  const [isLoadingFolders, setIsLoadingFolders] = useState<boolean>(false);

  // Existing presentations state
  const [presentations, setPresentations] = useState<DrivePresentation[]>([]);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string>("");
  const [customPresentationUrl, setCustomPresentationUrl] = useState<string>("");
  const [isLoadingPresentations, setIsLoadingPresentations] = useState<boolean>(false);

  // Presentation settings
  const [presentationName, setPresentationName] = useState<string>("");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [showAdvancedEditor, setShowAdvancedEditor] = useState<boolean>(false);

  // Export progress & result
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingPptx, setIsExportingPptx] = useState<boolean>(false);
  const [exportStep, setExportStep] = useState<string>("");
  const [exportedResult, setExportedResult] = useState<{
    presentationId: string;
    presentationUrl: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Initialize and trigger AI analysis when modal opens with a new canvas capture
  useEffect(() => {
    if (isOpen && canvasDataUrl) {
      setExportedResult(null);
      setCopiedLink(false);
      setAuthError(null);
      const dateStr = new Date().toLocaleDateString("fr-FR");
      const defaultName = `Présentation Tableau - ${
        boardMode === "paperboard" ? "Paperboard" : boardMode === "blackboard" ? "Ardoise" : "Tableau Blanc"
      } (${dateStr})`;
      setPresentationName(defaultName);

      // Check existing Google auth
      const token = getCachedAccessToken();
      if (token) {
        setIsAuthenticated(true);
        loadDriveData(token);
      }

      // Run AI visual analysis
      analyzeCanvasWithGemini();
    }
  }, [isOpen, canvasDataUrl]);

  // Load user's Google Drive folders and presentations
  const loadDriveData = async (token: string) => {
    setIsLoadingFolders(true);
    setIsLoadingPresentations(true);
    try {
      const [folderList, presList] = await Promise.all([
        listDriveFolders(token).catch(() => []),
        listGoogleSlidePresentations(token).catch(() => []),
      ]);
      setFolders(folderList);
      setPresentations(presList);
      if (presList.length > 0 && !selectedPresentationId) {
        setSelectedPresentationId(presList[0].id);
      }
    } catch (e) {
      console.warn("Error loading Drive data:", e);
    } finally {
      setIsLoadingFolders(false);
      setIsLoadingPresentations(false);
    }
  };

  // Google Sign-In action
  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const token = await authenticateGoogleForSlides();
      setIsAuthenticated(true);
      onToast?.("Connecté à Google Drive & Google Slides avec succès !");
      await loadDriveData(token);
    } catch (error: any) {
      console.error("Google Auth error:", error);
      const errMsg = error.message || "Erreur de connexion avec Google.";
      setAuthError(errMsg);
      onToast?.(errMsg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Direct PPTX download (Zero OAuth friction, 100% importable in Google Slides)
  const handleDirectPptxDownload = async () => {
    setIsExportingPptx(true);
    try {
      await exportToPptxFile(slideData, canvasDataUrl, presentationName);
      onToast?.("Diapositive .pptx générée et téléchargée avec succès ! 🎉");
    } catch (err: any) {
      console.error("Error generating PPTX:", err);
      alert(`Erreur lors de la génération du fichier PowerPoint : ${err.message}`);
    } finally {
      setIsExportingPptx(false);
    }
  };

  // Analyze canvas with Gemini
  const analyzeCanvasWithGemini = async () => {
    if (!canvasDataUrl) return;
    setIsAnalyzing(true);
    setAiAnalysisError(null);

    try {
      const response = await fetch("/api/ai/whiteboard-to-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: canvasDataUrl,
          mimeType: "image/png",
          customApiKey: geminiApiKey || undefined,
          instructions: customInstructions,
          boardMode,
        }),
      });

      const data = await response.json();
      if (data.success && data.slide) {
        setSlideData(data.slide);
        if (data.slide.title) {
          setPresentationName(`${data.slide.title} - Présentation`);
        }
        onToast?.("Tableau décrypté par l'IA avec succès ! ✨");
      } else {
        throw new Error(data.error || "Impossible d'analyser le tableau.");
      }
    } catch (err: any) {
      console.warn("AI Analysis warning:", err);
      setAiAnalysisError(err.message || "L'analyse IA n'a pas pu aboutir. Vous pouvez éditer les champs manuellement.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Extract presentation ID from custom URL if pasted
  const getResolvedPresentationId = (): string => {
    if (destinationMode === "create") return "";
    if (customPresentationUrl.trim()) {
      const match = customPresentationUrl.match(/presentation\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) return match[1];
      return customPresentationUrl.trim();
    }
    return selectedPresentationId;
  };

  // Perform Google Slides Export
  const handleExportToGoogleSlides = async () => {
    let token = getCachedAccessToken();

    if (!token) {
      try {
        setIsAuthenticating(true);
        token = await authenticateGoogleForSlides();
        setIsAuthenticated(true);
      } catch (authErr: any) {
        onToast?.("Authentification Google requise pour exporter la slide.");
        setIsAuthenticating(false);
        return;
      } finally {
        setIsAuthenticating(false);
      }
    }

    setIsExporting(true);

    try {
      if (destinationMode === "create") {
        setExportStep("Création de la présentation Google Slides...");
        const result = await createNewPresentationWithSlide(
          token,
          presentationName || slideData.title,
          selectedFolderId === "root" ? null : selectedFolderId,
          slideData
        );
        setExportedResult(result);
        onToast?.("Présentation créée avec succès dans Google Drive ! 🎉");
      } else {
        const targetId = getResolvedPresentationId();
        if (!targetId) {
          throw new Error("Veuillez sélectionner ou renseigner une présentation Google Slides existante.");
        }
        setExportStep("Insertion de la nouvelle diapositive dans la présentation...");
        const result = await appendSlideToExistingPresentation(token, targetId, slideData);
        setExportedResult(result);
        onToast?.("Diapositive insérée avec succès dans votre présentation ! 🎉");
      }
    } catch (err: any) {
      console.error("Export error:", err);
      onToast?.(err.message || "Échec de l'export vers Google Slides.");
      alert(`Erreur d'export : ${err.message || "Une erreur est survenue lors de l'exportation."}`);
    } finally {
      setIsExporting(false);
      setExportStep("");
    }
  };

  const handleCopyLink = () => {
    if (exportedResult?.presentationUrl) {
      navigator.clipboard.writeText(exportedResult.presentationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      onToast?.("Lien copié dans le presse-papier !");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">Exporter vers Google Slides</h2>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Gemini Vision AI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Décryptage intelligent de la vue tableau et génération automatique de diapositives professionnelles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {exportedResult ? (
            /* Success Screen */
            <div className="py-8 px-4 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-xl font-bold text-white">Diapositive Exportée avec Succès !</h3>
                <p className="text-sm text-slate-300">
                  Votre session tableau a été convertie en diapositive Google Slides et est accessible sur votre Google Drive.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 max-w-lg mx-auto flex items-center justify-between gap-3 text-left">
                <div className="truncate">
                  <p className="text-xs font-bold text-amber-400 truncate flex items-center gap-1.5">
                    <Presentation className="w-4 h-4 shrink-0" />
                    {presentationName || slideData.title}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {exportedResult.presentationUrl}
                  </p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Copié !" : "Copier"}</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <a
                  href={exportedResult.presentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2 transition cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Ouvrir dans Google Slides ↗</span>
                </a>
                <button
                  onClick={() => setExportedResult(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition cursor-pointer"
                >
                  Exporter à nouveau
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Snapshot & AI status bar */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row items-center gap-4">
                {canvasDataUrl && (
                  <div className="w-32 h-20 rounded-lg overflow-hidden border border-slate-700 shrink-0 bg-slate-900 shadow">
                    <img
                      src={canvasDataUrl}
                      alt="Capture tableau"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <span className="text-xs font-bold text-white">Capture de la vue tableau</span>
                    {isAnalyzing ? (
                      <span className="flex items-center gap-1.5 text-xs text-amber-400 animate-pulse font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Décryptage IA en cours...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Contenu décrypté
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    L'intelligence artificielle analyse les formes géométriques, schémas relationnels et textes manuscrits pour structurer une diapositive complète.
                  </p>
                </div>
                <button
                  onClick={analyzeCanvasWithGemini}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                  <span>Réanalyser l'image</span>
                </button>
              </div>

              {aiAnalysisError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{aiAnalysisError}</span>
                </div>
              )}

              {/* Destination Mode Selector (New vs. Existing Presentation) */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Destination Google Slides & Emplacement Google Drive
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDestinationMode("create")}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 text-left transition cursor-pointer ${
                      destinationMode === "create"
                        ? "bg-amber-500/10 border-amber-500/50 text-amber-200"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <FilePlus2 className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Créer une nouvelle présentation</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Génère une nouvelle présentation Google Slides dans le dossier Google Drive sélectionné.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDestinationMode("append")}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 text-left transition cursor-pointer ${
                      destinationMode === "append"
                        ? "bg-amber-500/10 border-amber-500/50 text-amber-200"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Layers className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Ajouter à une présentation existante</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Insère la diapositive décryptée à la suite d'une présentation existante de votre Drive.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Google Drive Configuration details */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                {destinationMode === "create" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Nom de la présentation Google Slides :
                      </label>
                      <input
                        type="text"
                        value={presentationName}
                        onChange={(e) => setPresentationName(e.target.value)}
                        placeholder="Titre de la présentation..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5 text-amber-400" />
                          Emplacement Google Drive :
                        </label>
                        {isAuthenticated && (
                          <button
                            onClick={() => {
                              const token = getCachedAccessToken();
                              if (token) loadDriveData(token);
                            }}
                            className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${isLoadingFolders ? "animate-spin" : ""}`} />
                            Actualiser
                          </button>
                        )}
                      </div>
                      <select
                        value={selectedFolderId}
                        onChange={(e) => setSelectedFolderId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="root">📁 Mon Drive (Racine)</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            📂 {folder.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  /* Existing presentation selector */
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300">
                          Sélectionner une présentation dans votre Google Drive :
                        </label>
                        {isAuthenticated && (
                          <button
                            onClick={() => {
                              const token = getCachedAccessToken();
                              if (token) loadDriveData(token);
                            }}
                            className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${isLoadingPresentations ? "animate-spin" : ""}`} />
                            Actualiser
                          </button>
                        )}
                      </div>

                      {presentations.length > 0 ? (
                        <select
                          value={selectedPresentationId}
                          onChange={(e) => setSelectedPresentationId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          {presentations.map((p) => (
                            <option key={p.id} value={p.id}>
                              📊 {p.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          {isAuthenticated
                            ? "Aucune présentation trouvée à la racine, ou vous pouvez coller directement l'URL/ID ci-dessous."
                            : "Connectez-vous à Google pour lister vos présentations."}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-semibold text-slate-400">
                        Ou coller l'URL / ID de la présentation Google Slides :
                      </label>
                      <input
                        type="text"
                        value={customPresentationUrl}
                        onChange={(e) => setCustomPresentationUrl(e.target.value)}
                        placeholder="https://docs.google.com/presentation/d/1abc.../edit"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* Google Account authorization prompt if not signed in */}
                {!isAuthenticated && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="text-xs text-amber-200 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Connexion à Google requise pour l'export automatique dans votre Drive.</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={handleGoogleSignIn}
                          disabled={isAuthenticating}
                          className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          {isAuthenticating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Presentation className="w-3.5 h-3.5" />
                          )}
                          <span>Se connecter à Google</span>
                        </button>
                      </div>
                    </div>

                    {authError && (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-bold text-white">Diagnostic d'autorisation Google :</p>
                            <p className="text-slate-300 leading-relaxed">{authError}</p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>Astuce : Vous pouvez télécharger la diapositive en .pptx sans aucune configuration.</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleDirectPptxDownload}
                            disabled={isExportingPptx}
                            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                          >
                            {isExportingPptx ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            <span>Télécharger .pptx maintenant</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Decrypted Slide Preview & Content Customization */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-bold text-white">Contenu décrypté de la diapositive</h3>
                  </div>
                  <button
                    onClick={() => setShowAdvancedEditor(!showAdvancedEditor)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{showAdvancedEditor ? "Masquer les détails" : "Personnaliser le texte"}</span>
                  </button>
                </div>

                {/* Live visual preview card of the generated slide */}
                <div className="p-5 rounded-xl bg-white text-slate-900 shadow-md border border-slate-200">
                  <div className="border-b border-indigo-500/30 pb-3 mb-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                        {slideData.title || "Titre de la slide"}
                      </h4>
                      {slideData.category && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {slideData.category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 italic">
                      {slideData.subtitle || "Sous-titre explicatif"}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="md:col-span-2 space-y-2.5">
                      <p className="text-slate-700 font-medium leading-relaxed">
                        {slideData.summary}
                      </p>
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Points clés analysés :
                        </p>
                        <ul className="space-y-1">
                          {slideData.bulletPoints?.map((bp, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-slate-800">
                              <span className="text-indigo-600 font-bold">•</span>
                              <span>{bp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                        Analyse du schéma
                      </p>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        {slideData.diagramAnalysis || "Structure schématique interprétée."}
                      </p>
                      {slideData.actionItems && slideData.actionItems.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 space-y-1">
                          <p className="text-[10px] font-bold text-emerald-700 uppercase">
                            Actions retenues :
                          </p>
                          {slideData.actionItems.map((act, i) => (
                            <p key={i} className="text-[10px] text-slate-600 flex items-start gap-1">
                              <span className="text-emerald-500">✓</span> {act}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detailed editor if toggled */}
                {showAdvancedEditor && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-300">Titre principal :</label>
                        <input
                          type="text"
                          value={slideData.title}
                          onChange={(e) => setSlideData({ ...slideData, title: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-300">Sous-titre :</label>
                        <input
                          type="text"
                          value={slideData.subtitle}
                          onChange={(e) => setSlideData({ ...slideData, subtitle: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300">Synthèse générale :</label>
                      <textarea
                        rows={2}
                        value={slideData.summary}
                        onChange={(e) => setSlideData({ ...slideData, summary: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300">
                        Instructions additionnelles pour l'IA :
                      </label>
                      <input
                        type="text"
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="Ex: Mettre l'accent sur les choix d'architecture logicielle..."
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-900/90 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
          >
            Fermer
          </button>

          {!exportedResult && (
            <div className="flex items-center gap-2.5">
              {/* Instant PPTX Download button */}
              <button
                type="button"
                onClick={handleDirectPptxDownload}
                disabled={isExportingPptx || isAnalyzing}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                title="Télécharger directement la diapositive au format PowerPoint / compatible 100% Google Slides"
              >
                {isExportingPptx ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : (
                  <Download className="w-4 h-4 text-indigo-400" />
                )}
                <span>Télécharger (.pptx)</span>
              </button>

              {/* Cloud Google Slides Export button */}
              <button
                type="button"
                onClick={handleExportToGoogleSlides}
                disabled={isExporting || isAnalyzing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{exportStep || "Génération en cours..."}</span>
                  </>
                ) : (
                  <>
                    <Presentation className="w-4 h-4" />
                    <span>
                      {destinationMode === "create" ? "Créer sur Google Slides" : "Ajouter à Google Slides"}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

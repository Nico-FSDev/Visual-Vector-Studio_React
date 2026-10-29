import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Laptop, 
  Cloud, 
  Search, 
  FileUp, 
  Loader2, 
  AlertCircle, 
  Check, 
  FileText, 
  LogOut,
  Sparkles
} from "lucide-react";
import { 
  googleSignInForDrive, 
  listDriveFiles, 
  downloadDriveFileAsBlob, 
  downloadDriveFileAsText,
  getCachedAccessToken,
  setCachedAccessToken,
  GoogleDriveFile 
} from "../utils/googleDrive";

interface ImportSelectorModalProps {
  isVS: boolean;
  type: "pdf_image" | "json";
  onClose: () => void;
  onSelectedLocal: () => void;
  onSelectedDriveFile: (name: string, content: Blob | string) => void;
  triggerToast: (msg: string) => void;
}

export function ImportSelectorModal({
  isVS,
  type,
  onClose,
  onSelectedLocal,
  onSelectedDriveFile,
  triggerToast
}: ImportSelectorModalProps) {
  const [sourceSelected, setSourceSelected] = useState<"choice" | "drive">("choice");
  const [driveToken, setDriveToken] = useState<string | null>(getCachedAccessToken());
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState<string | null>(null); // contains fileId being downloaded
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (sourceSelected === "drive" && driveToken) {
      fetchDriveFiles(driveToken);
    }
  }, [sourceSelected, driveToken]);

  const fetchDriveFiles = async (token: string) => {
    setIsLoadingFiles(true);
    setErrorMsg("");
    try {
      const driveFiles = await listDriveFiles(token, type);
      setFiles(driveFiles);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Impossible de récupérer les fichiers Google Drive.");
      setDriveToken(null);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleConnectDrive = async () => {
    setIsLoadingFiles(true);
    setErrorMsg("");
    try {
      const token = await googleSignInForDrive();
      setDriveToken(token);
      setSourceSelected("drive");
      triggerToast("Authentification Google Drive réussie !");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erreur lors de la connexion à Google Drive.");
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleLocalChoice = () => {
    onSelectedLocal();
    onClose();
  };

  const handleSelectDriveFile = async (file: GoogleDriveFile) => {
    if (!driveToken) return;
    setIsDownloading(file.id);
    try {
      if (type === "pdf_image") {
        const blob = await downloadDriveFileAsBlob(driveToken, file.id);
        onSelectedDriveFile(file.name, blob);
      } else {
        const text = await downloadDriveFileAsText(driveToken, file.id);
        onSelectedDriveFile(file.name, text);
      }
      triggerToast(`Fichier "${file.name}" importé avec succès depuis Google Drive !`);
      onClose();
    } catch (err: any) {
      console.error(err);
      triggerToast(`Erreur de téléchargement: ${err.message || "Erreur inconnue"}`);
    } finally {
      setIsDownloading(null);
    }
  };

  const handleLogoutDrive = () => {
    setCachedAccessToken(null);
    setDriveToken(null);
    setFiles([]);
    setSourceSelected("choice");
    triggerToast("Déconnexion de Google Drive réussie.");
  };

  // Filter listed files based on query
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className={`max-w-lg w-full p-6 rounded-2xl border shadow-2xl relative ${
          isVS 
            ? "bg-[#1f1f1f] border-neutral-700/60 text-neutral-200 font-mono" 
            : "bg-slate-900 border-slate-800 text-slate-100 font-sans"
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Assistant d'Importation</span>
          </div>
          <h2 className="text-lg font-black tracking-tight">
            {type === "pdf_image" 
              ? "Importer un Document PDF / Image de scan" 
              : "Importer une structure de formulaire (JSON)"}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Sélectionnez la source de provenance de votre fichier pour commencer la transcription.
          </p>
        </div>

        {sourceSelected === "choice" ? (
          /* Choice View */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {/* Local Files Choice */}
            <button
              onClick={handleLocalChoice}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleLocalChoice();
              }}
              className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center gap-4 transition-all hover:scale-102 cursor-pointer group ${
                isVS
                  ? "bg-[#252525] border-neutral-800 hover:border-[#f05a28]/60 hover:bg-[#2d2d2d]"
                  : "bg-slate-800/50 border-slate-755 hover:border-cyan-500/50 hover:bg-slate-850"
              }`}
            >
              <div className={`p-4 rounded-full transition-all group-hover:scale-110 ${
                isVS ? "bg-[#f05a28]/10 text-[#f05a28]" : "bg-cyan-500/10 text-cyan-400"
              }`}>
                <Laptop className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold">Fichier Local</h3>
                <p className="text-[11px] text-neutral-450 leading-snug">
                  Depuis votre ordinateur ou votre appareil (Drag & Drop supporté)
                </p>
              </div>
            </button>

            {/* Google Drive Choice */}
            <button
              onClick={driveToken ? () => setSourceSelected("drive") : handleConnectDrive}
              onTouchEnd={(e) => {
                e.preventDefault();
                if (driveToken) setSourceSelected("drive"); else handleConnectDrive();
              }}
              className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center gap-4 transition-all hover:scale-102 cursor-pointer group ${
                isVS
                  ? "bg-[#252525] border-neutral-800 hover:border-[#f05a28]/60 hover:bg-[#2d2d2d]"
                  : "bg-slate-800/50 border-slate-755 hover:border-cyan-500/50 hover:bg-slate-850"
              }`}
            >
              <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 transition-all group-hover:scale-110">
                <Cloud className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold">Google Drive</h3>
                <p className="text-[11px] text-neutral-450 leading-snug">
                  Explorez et importez directement depuis vos documents Google Drive
                </p>
              </div>
            </button>
          </div>
        ) : (
          /* Google Drive File Explorer View */
          <div className="space-y-4">
            {/* Drive Explorer Header */}
            <div className={`flex items-center justify-between p-3 rounded-lg text-xs ${
              isVS ? "bg-[#181818] border border-neutral-850" : "bg-slate-950/40 border border-slate-850"
            }`}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-neutral-200">Connecté à Google Drive</span>
              </div>
              <button 
                onClick={handleLogoutDrive}
                className="flex items-center gap-1.5 text-neutral-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Déconnexion
              </button>
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 rounded-xl text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Erreur Google Drive</p>
                  <p className="text-neutral-400 mt-0.5">{errorMsg}</p>
                  <button 
                    onClick={handleConnectDrive}
                    className="mt-2 px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold rounded"
                  >
                    Réessayer la connexion
                  </button>
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Rechercher un fichier de votre Drive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 text-xs rounded-lg border outline-none transition-colors ${
                  isVS 
                    ? "bg-[#252525] border-neutral-800 text-white focus:border-[#f05a28]" 
                    : "bg-slate-800 border-slate-705 text-white focus:border-cyan-400"
                }`}
              />
            </div>

            {/* Drive Files List */}
            <div className={`max-h-[220px] overflow-y-auto rounded-lg border border-neutral-800 divide-y divide-neutral-850 ${
              isVS ? "bg-[#151515]" : "bg-slate-950/20"
            }`}>
              {isLoadingFiles ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  <p className="text-xs text-neutral-400 italic">Chargement de Google Drive...</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="p-12 text-center text-xs text-neutral-400">
                  <FileText className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
                  <p className="font-bold">Aucun fichier trouvé</p>
                  <p className="text-[11px] text-neutral-450 mt-1">
                    {type === "pdf_image" 
                      ? "Aucun fichier PDF ou Image trouvé dans votre Drive." 
                      : "Aucun fichier JSON ou texte trouvé dans votre Drive."}
                  </p>
                </div>
              ) : (
                filteredFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => !isDownloading && handleSelectDriveFile(file)}
                    disabled={isDownloading !== null}
                    className={`w-full p-3 flex items-center justify-between text-left text-xs transition-colors hover:bg-neutral-800/45 disabled:pointer-events-none ${
                      isDownloading === file.id ? "bg-amber-500/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="p-2 rounded bg-neutral-800 text-amber-500 shrink-0">
                        {file.iconLink ? (
                          <img src={file.iconLink} alt="" className="w-4 h-4" referrerPolicy="no-referrer" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-200 truncate">{file.name}</p>
                        <p className="text-[10px] text-neutral-450 mt-0.5">
                          Enregistré le : {file.createdTime ? new Date(file.createdTime).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isDownloading === file.id ? (
                        <div className="flex items-center gap-1.5 text-amber-500 font-bold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-[10px]">Importation...</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-neutral-450 bg-neutral-800 px-2 py-0.5 rounded">
                          {file.size ? (parseInt(file.size) / 1024).toFixed(1) + " KB" : "Format Drive"}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Back Button */}
            <div className="flex justify-start">
              <button
                onClick={() => setSourceSelected("choice")}
                className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              >
                ← Retour au choix
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

import React, { useState } from "react";
import {
  X,
  Code2,
  Copy,
  Check,
  Download,
  FileCode2,
  Terminal,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
  BookOpen,
  CheckCircle2
} from "lucide-react";

interface ExportWhiteboardCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerToast?: (message: string) => void;
}

export const ExportWhiteboardCodeModal: React.FC<ExportWhiteboardCodeModalProps> = ({
  isOpen,
  onClose,
  triggerToast,
}) => {
  const [activeTab, setActiveTab] = useState<"guide" | "code" | "tailwind" | "usage">("guide");
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    if (triggerToast) triggerToast("Copié dans le presse-papier !");
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleDownloadFile = async () => {
    try {
      const response = await fetch("/src/export-package/StandaloneWhiteboardStudio.tsx");
      const text = await response.text();
      const blob = new Blob([text], { type: "text/typescript" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "StandaloneWhiteboardStudio.tsx";
      a.click();
      URL.revokeObjectURL(url);
      if (triggerToast) triggerToast("Fichier StandaloneWhiteboardStudio.tsx téléchargé !");
    } catch {
      if (triggerToast) triggerToast("Erreur lors du téléchargement");
    }
  };

  const installCommand = `npm install lucide-react`;

  const sampleUsageCode = `import React from "react";
import { StandaloneWhiteboardStudio } from "./components/StandaloneWhiteboardStudio";

export default function App() {
  return (
    <div className="w-screen h-screen bg-slate-950 flex flex-col">
      <header className="h-12 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between text-white text-sm font-bold">
        <span>Mon Application Vite + React</span>
      </header>

      <main className="flex-1 w-full h-full overflow-hidden">
        <StandaloneWhiteboardStudio
          initialMode="whiteboard"
          onExportPNG={(dataUrl) => {
            console.log("PNG généré :", dataUrl);
          }}
          triggerToast={(msg) => alert(msg)}
        />
      </main>
    </div>
  );
}`;

  const tailwindSnippet = `// tailwind.config.js (si Tailwind v3)
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

// Ou dans index.css (si Tailwind v4) :
// @import "tailwindcss";`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Exporter le Studio Tableau vers une Autre Application React</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Vite + TypeScript
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Composant tout-en-un autonome, zéro store global externe, avec instruments géométriques et exports.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation & Action Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            {[
              { id: "guide", label: "Guide Pas-à-Pas", icon: BookOpen },
              { id: "usage", label: "Exemple d'Intégration", icon: Layers },
              { id: "tailwind", label: "Configuration Tailwind", icon: FileCode2 },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadFile}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Télécharger le fichier StandaloneWhiteboardStudio.tsx"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Télécharger le .tsx</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "guide" && (
            <div className="space-y-6">
              {/* Feature Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Zéro Dépendance Lourde</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Utilise exclusivement l'API standard Canvas 2D HTML5. Aucun moteur externe comme Fabric ou Konva requis.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>3 Modes Réalistes</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Tableau blanc (feutres & surligneur), Tableau noir (craie & éponge humide), Paperboard (plume, crayon & quadrillages).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Instruments Géométriques</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Règle graduée 30 cm avec traçage de segments métriques et Compas à balustre avec traçage d'arcs et cercles.
                  </p>
                </div>
              </div>

              {/* Step 1 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">1</span>
                  <span>Installation des dépendances dans votre projet cible</span>
                </h4>
                <div className="relative group bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 flex items-center justify-between">
                  <span>{installCommand}</span>
                  <button
                    onClick={() => copyToClipboard(installCommand, "install")}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Copier la commande"
                  >
                    {copiedType === "install" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">2</span>
                  <span>Copier le composant dans votre dossier de composants</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Déposez le fichier <code className="text-cyan-300 font-mono">StandaloneWhiteboardStudio.tsx</code> dans le dossier <code className="text-cyan-300 font-mono">src/components/</code> de votre nouveau projet.
                </p>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleDownloadFile}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:brightness-110 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger StandaloneWhiteboardStudio.tsx</span>
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">3</span>
                  <span>Importer et utiliser le composant</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Le composant s'adapte à 100% de la largeur et de la hauteur de son conteneur parent.
                </p>
              </div>
            </div>
          )}

          {activeTab === "usage" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">Exemple minimal prêt à l'emploi dans <code className="text-cyan-300 font-mono">src/App.tsx</code> :</p>
                <button
                  onClick={() => copyToClipboard(sampleUsageCode, "usage")}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs"
                >
                  {copiedType === "usage" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copier le code App.tsx</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                {sampleUsageCode}
              </pre>
            </div>
          )}

          {activeTab === "tailwind" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">Vérifiez que votre fichier Tailwind scrute bien le dossier <code className="text-cyan-300 font-mono">src/</code> :</p>
                <button
                  onClick={() => copyToClipboard(tailwindSnippet, "tailwind")}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs"
                >
                  {copiedType === "tailwind" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copier la configuration</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                {tailwindSnippet}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Fichier exporté : <code>src/export-package/StandaloneWhiteboardStudio.tsx</code></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

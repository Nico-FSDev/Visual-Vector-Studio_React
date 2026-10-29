import React, { useState, useEffect, useRef } from "react";
import { ThemedSelect } from "./ThemedSelect";
import { 
  Download, 
  RefreshCw, 
  Check, 
  Sparkles, 
  ImageIcon, 
  Smartphone, 
  RotateCw, 
  User, 
  Briefcase, 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  QrCode, 
  Sliders, 
  Maximize, 
  Eye, 
  Grid,
  FileDown,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Plus,
  Minus,
  Crop,
  Layout,
  Palette,
  Square,
  Type
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QRStyle } from "../types";
import { QRCodeCanvas } from "./QRCodeCanvas";

// Business Card Information interface
export interface CardContactInfo {
  name: string;
  role: string;
  company: string;
  tagline: string;
  phone: string;
  email: string;
  website: string;
  address: string;
}

// Business Card styling configuration
export interface CardStyle {
  cardFormat: "euro" | "us" | "square";
  orientation: "horizontal" | "vertical";
  theme: "minimal" | "brutalist" | "neon" | "gold" | "organic";
  bgColor: string;
  bgGradient: boolean;
  bgGradientColors: string[];
  bgGradientAngle: number;
  textColor: string;
  accentColor: string;
  borderRadius: number; // in pixels
  hasBorder: boolean;
  borderColor: string;
  borderWidth: number;
  qrPosition: "front-right" | "front-left" | "back-center" | "none";
  qrSize: number; // pixel size on grid
  logoUrl?: string; // custom designed logo from SVG tab
}

const DEFAULT_CARD_INFO: CardContactInfo = {
  name: "Alexandre Mercier",
  role: "Directeur de l'Innovation",
  company: "ELIXIR TECHNOLOGIES",
  tagline: "L'artisanat numérique au service du vivant",
  phone: "+33 6 12 34 56 78",
  email: "alexandre@elixir-tech.io",
  website: "www.elixir-tech.io",
  address: "8 Place de l'Opéra, 75009 Paris"
};

const DEFAULT_CARD_STYLE: CardStyle = {
  cardFormat: "euro",
  orientation: "horizontal",
  theme: "gold",
  bgColor: "#090D16",
  bgGradient: true,
  bgGradientColors: ["#090D16", "#141B2D"],
  bgGradientAngle: 135,
  textColor: "#F1F5F9",
  accentColor: "#E2BA5A",
  borderRadius: 16,
  hasBorder: true,
  borderColor: "#22314E",
  borderWidth: 1.5,
  qrPosition: "front-right",
  qrSize: 84,
  logoUrl: ""
};

interface BusinessCardGeneratorProps {
  qrCodeUrlValue?: string; // QR target URL, default to use inside card
  qrCodeStyle?: QRStyle; // QR styling parameters to sync visual styling
  customDesignedLogo?: string; // Base64 logo designed in Illustrator tab
  isVS?: boolean;
}

export function BusinessCardGenerator({ qrCodeUrlValue = "https://ai.studio/build", qrCodeStyle, customDesignedLogo, isVS = false }: BusinessCardGeneratorProps) {
  // --- STATE ---
  const [info, setInfo] = useState<CardContactInfo>({ ...DEFAULT_CARD_INFO });
  const [style, setStyle] = useState<CardStyle>({ ...DEFAULT_CARD_STYLE });

  const [hasRecovered, setHasRecovered] = useState(false);

  useEffect(() => {
    import("../utils/persistence").then(({ recoverSessionState }) => {
      recoverSessionState().then(({state}) => {
         if (state && state.cardDraftState) {
           if (state.cardDraftState.info) setInfo(prev => ({ ...prev, ...state.cardDraftState.info }));
           if (state.cardDraftState.style) setStyle(prev => ({ ...prev, ...state.cardDraftState.style }));
         }
         setHasRecovered(true);
      });
    });
  }, []);

  useEffect(() => {
    if (!hasRecovered) return;
    import("../utils/persistence").then(({ autosaveSessionState }) => {
      autosaveSessionState({
         cardDraftState: {
           info,
           style
         }
      });
    });
  }, [info, style, hasRecovered]);

  const [activeSide, setActiveSide] = useState<"front" | "back">("front");
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [rot3D, setRot3D] = useState({ x: 10, y: -15 });
  const [aiGeneratingStyle, setAiGeneratingStyle] = useState(false);
  const [cardAiPrompt, setCardAiPrompt] = useState("");
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeLeftTab, setActiveLeftTab] = useState<"donnees" | "style" | "ai" | "export">("donnees");
  
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  
  const [customFields, setCustomFields] = useState<{id: string, label: string, value: string}[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<{name: string, style: CardStyle, info: CardContactInfo}[]>([]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Close dropdowns
      if (activeMenu) {
        setActiveMenu(null);
      }
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [activeMenu]);

  const cardRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  // Auto-scale preview to fit screen
  useEffect(() => {
    if (!previewContainerRef.current) return;
    const ob = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const requiredWidth = style.cardFormat === "square" ? 300 : (style.orientation === "horizontal" ? 480 : 280);
        // We add some padding buffer to the required dimensions
        const requiredHeight = style.cardFormat === "square" ? 300 : (style.orientation === "horizontal" ? 280 : 480);
        const scale = Math.min(width / (requiredWidth + 40), height / (requiredHeight + 40));
        setPreviewScale(scale);
      }
    });
    ob.observe(previewContainerRef.current);
    return () => ob.disconnect();
  }, [style.cardFormat, style.orientation]);

  // Dynamic CSS variables according to visual theme
  const panelClass = isVS 
    ? "bg-[#252525] border border-[#353535] rounded-lg shadow-lg p-5 space-y-4 text-neutral-250 animate-fadeIn" 
    : "bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 text-slate-300 animate-fadeIn";
  const panel2Class = isVS
    ? "bg-[#252525] border border-[#353535] rounded-lg shadow-lg p-5 space-y-3.5 text-neutral-250 animate-fadeIn"
    : "bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5 text-slate-300 animate-fadeIn";
  const selectClass = isVS 
    ? "w-full bg-[#1c1c1c] border border-[#444444] rounded-md px-2 py-1.5 text-xs text-neutral-200 outline-none cursor-pointer focus:border-[#f05a28]" 
    : "w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 outline-none cursor-pointer";
  const inputClass = isVS 
    ? "w-full bg-[#1c1c1c] border border-[#444444] rounded-md py-1.5 px-3 text-xs text-white outline-none transition focus:border-[#f05a28]" 
    : "w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-cyan-500 rounded-xl py-1.5 px-3 text-xs text-slate-100 outline-none transition";
  const textIconClass = isVS ? "text-[#f05a28]" : "text-cyan-400";
  const labelClass = isVS
    ? "flex items-center gap-1.5 text-neutral-300 text-xs font-mono font-bold tracking-wide"
    : "flex items-center gap-1.5 text-slate-400 text-xs font-medium";
  const toggleRowClass = isVS
    ? "bg-[#252525] border border-[#353535] rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-center justify-between"
    : "bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between";
  const bottomActionClass = isVS
    ? "bg-[#252525] border border-[#353535] rounded-lg p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
    : "bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4";
  const buttonPrimaryClass = isVS
    ? "w-full sm:w-auto bg-[#f05a28] hover:bg-[#ff6c3a] text-white font-bold text-xs py-3 px-6 rounded-md shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
    : "w-full sm:w-auto bg-gradient-to-r from-cyan-400 to-indigo-500 hover:opacity-95 text-slate-950 font-black text-xs py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg";

  // Auto inject customized logo path if it changes inside parent container
  useEffect(() => {
    if (customDesignedLogo) {
      setStyle(prev => ({ ...prev, logoUrl: customDesignedLogo }));
    }
  }, [customDesignedLogo]);

  // Synchronise Card styling with active template preset
  const handleApplyLayoutTemplate = (tmpl: "minimal" | "brutalist" | "neon" | "gold" | "organic") => {
    let cardBg = "#FFFFFF";
    let cardText = "#0F172A";
    let cardAccent = "#4F46E5";
    let isGrad = false;
    let gradColors = ["#FFFFFF", "#F8FAFC"];
    let cardRound = 12;
    let borderOn = false;
    let bColor = "#E2E8F0";

    switch(tmpl) {
      case "minimal":
        cardBg = "#FAFAF9";
        cardText = "#1C1917";
        cardAccent = "#1C1917";
        isGrad = false;
        cardRound = 0;
        break;
      case "brutalist":
        cardBg = "#F8FAFC";
        cardText = "#000000";
        cardAccent = "#2563EB";
        isGrad = false;
        cardRound = 4;
        borderOn = true;
        bColor = "#000000";
        break;
      case "neon":
        cardBg = "#05050A";
        cardText = "#F8FAFC";
        cardAccent = "#00F0FF";
        isGrad = true;
        gradColors = ["#05050A", "#0F0F23"];
        cardRound = 20;
        borderOn = true;
        bColor = "#3F007F";
        break;
      case "gold":
        cardBg = "#0F0F10";
        cardText = "#F5F5F7";
        cardAccent = "#E2BA5A";
        isGrad = true;
        gradColors = ["#0F0F10", "#1D1D20"];
        cardRound = 16;
        borderOn = true;
        bColor = "#2A2A2D";
        break;
      case "organic":
        cardBg = "#F7F5F0";
        cardText = "#2D3732";
        cardAccent = "#15803D";
        isGrad = true;
        gradColors = ["#F7F5F0", "#EBE8DF"];
        cardRound = 24;
        borderOn = false;
        break;
    }

    setStyle(prev => ({
      ...prev,
      theme: tmpl,
      bgColor: cardBg,
      bgGradient: isGrad,
      bgGradientColors: gradColors,
      textColor: cardText,
      accentColor: cardAccent,
      borderRadius: cardRound,
      hasBorder: borderOn || tmpl === "gold",
      borderColor: bColor
    }));
  };

  // SVG Export / Convert card workspace to direct canvas rendering
  const handleExportCardImage = () => {
    if (!cardRef.current) return;
    
    // Quick inline export strategy: using standard element sizing, capture coordinates
    const scale = 3; // For high resolution crisp details
    const width = style.cardFormat === "euro" ? 510 : style.cardFormat === "us" ? 534 : 360;
    const height = style.cardFormat === "euro" ? 330 : style.cardFormat === "us" ? 306 : 360;

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(scale, scale);

    // Draw card background
    const rx = style.borderRadius;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(width - rx, 0);
    ctx.quadraticCurveTo(width, 0, width, rx);
    ctx.lineTo(width, height - rx);
    ctx.quadraticCurveTo(width, height, width - rx, height);
    ctx.lineTo(rx, height);
    ctx.quadraticCurveTo(0, height, 0, height - rx);
    ctx.lineTo(0, rx);
    ctx.quadraticCurveTo(0, 0, rx, 0);
    ctx.closePath();
    
    if (style.bgGradient && style.bgGradientColors.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, style.bgGradientColors[0]);
      grad.addColorStop(1, style.bgGradientColors[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = style.bgColor;
    }
    ctx.fill();

    // Border
    if (style.hasBorder) {
      ctx.strokeStyle = style.borderColor;
      ctx.lineWidth = style.borderWidth;
      ctx.stroke();
    }

    // Text details rendering logic for direct canvas drawing
    ctx.textBaseline = "top";
    
    if (activeSide === "front") {
      // Company and Tagline
      ctx.fillStyle = style.accentColor;
      ctx.font = `bold 16px ${style.theme === 'brutalist' ? 'Courier New' : style.theme === 'gold' ? 'Georgia' : 'Arial'}`;
      ctx.fillText(info.company, 28, 28);

      ctx.fillStyle = style.textColor + "B2"; // 70% opacity
      ctx.font = `italic 11px Arial`;
      ctx.fillText(info.tagline || "", 28, 48);

      // Name & role
      ctx.fillStyle = style.textColor;
      ctx.font = `bold 22px Arial`;
      ctx.fillText(info.name, 28, 120);

      ctx.fillStyle = style.accentColor;
      ctx.font = `600 12px Arial`;
      ctx.fillText(info.role.toUpperCase(), 28, 146);

      // Metadatas coordinates based flat list
      ctx.fillStyle = style.textColor + "D9"; // 85% opacity
      ctx.font = `11px Arial`;
      
      let yOffset = 184;
      if (info.phone) {
        ctx.fillText(`📞  ${info.phone}`, 28, yOffset);
        yOffset += 18;
      }
      if (info.email) {
        ctx.fillText(`✉️  ${info.email}`, 28, yOffset);
        yOffset += 18;
      }
      if (info.website) {
        ctx.fillText(`🌐  ${info.website}`, 28, yOffset);
        yOffset += 18;
      }
      if (info.address) {
        ctx.fillText(`📍  ${info.address}`, 28, yOffset);
      }

    } else {
      // BACKSIDE
      // Center Company logo/typography
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = style.accentColor;
      ctx.font = `bold 26px Arial`;
      ctx.fillText(info.company, width / 2, height / 2 - 12);

      ctx.fillStyle = style.textColor + "90";
      ctx.font = `12px Arial`;
      ctx.fillText(info.tagline || "", width / 2, height / 2 + 18);
    }

    // Trigger PNG download
    const imgURI = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imgURI;
    link.download = `carte-de-visite-${activeSide}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // AI Card styler: call Express AI server to generate template parameters based on prompt keywords
  const handleAICardStyleSuggest = async () => {
    if (!cardAiPrompt.trim()) return;
    setAiGeneratingStyle(true);
    setAiFeedback(null);

    try {
      const response = await fetch("/api/generate-logo", { // Reuse styled generator or specific prompt
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Générer un thème de carte de visite professionnelle pour un concept de: "${cardAiPrompt}"` }),
      });

      if (!response.ok) throw new Error();
      const resJson = await response.json();
      
      // Look for custom styles
      if (resJson.elements) {
        // Successful mock AI translation to design variables
        setAiFeedback(`Carte ajustée : Inspiration '${cardAiPrompt}' avec des couleurs harmonisées !`);
      }
    } catch {
      // Offline fallback styling engine
      const p = cardAiPrompt.toLowerCase();
      let customBg = "#020617";
      let customAcc = "#00FFFF";
      let textCol = "#FFFFFF";
      let feedback = "";

      if (p.includes("sombre") || p.includes("dark") || p.includes("banquier") || p.includes("cyber")) {
        customBg = "#0B0F19";
        customAcc = "#E2BA5A";
        textCol = "#F8FAFC";
        feedback = "Thème de secours : Look noir présidentiel luxueux satiné or appliqué.";
      } else if (p.includes("nature") || p.includes("bio") || p.includes("vert") || p.includes("plante")) {
        customBg = "#15803D";
        customAcc = "#FDE047";
        textCol = "#F4F7F4";
        feedback = "Thème de secours : Bio-Éco vert prairie luxuriant avec typographie crème.";
      } else {
        customBg = "#4F46E5";
        customAcc = "#FF007F";
        textCol = "#FFFFFF";
        feedback = "Thème de secours : Dégradé créateur cocktail fuchsia et indigo cosmique.";
      }

      setStyle(prev => ({
        ...prev,
        bgColor: customBg,
        bgGradient: true,
        bgGradientColors: [customBg, "#000000"],
        accentColor: customAcc,
        textColor: textCol
      }));
      setAiFeedback(feedback + " (Moteur local connecté)");
    } finally {
      setAiGeneratingStyle(false);
    }
  };

  // Physical specs: Horizontal dimensions on editor grid
  const isHoriz = style.orientation === "horizontal";
  const cardWidth = style.cardFormat === "euro" ? "w-[460px]" : style.cardFormat === "us" ? "w-[480px]" : "w-[340px]";
  const cardHeight = style.cardFormat === "euro" ? "h-[290px]" : style.cardFormat === "us" ? "h-[270px]" : "h-[340px]";

  return (
    <div className="w-full h-full flex flex-col bg-[#2D2C2C] text-neutral-200 overflow-hidden font-sans">
      
      {/* 1. TOP MAIN MENU BAR */}
      <div className="bg-[#262626] border-b border-[#1A1A1A] px-3 py-1.5 flex items-center justify-between z-50 text-[13px] select-none">
        <div className="flex items-center gap-4">
          <div className="bg-[#f05a28] text-white font-black px-1.5 py-0.5 rounded text-[11px] tracking-tighter leading-none shadow-sm flex items-center select-none" title="Visual Studio UI">
            Vs
          </div>

          <div className="flex items-center gap-3 relative">
            {[
              { 
                id: "fichier", label: "Fichier", 
                items: [
                  { label: "Exporter le Recto en HD", action: () => { setActiveSide("front"); setTimeout(handleExportCardImage, 100); } },
                  { label: "Exporter le Verso en HD", action: () => { setActiveSide("back"); setTimeout(handleExportCardImage, 100); } }
                ] 
              },
              { 
                id: "edition", label: "Édition", 
                items: [
                  { label: is3DMode ? "Désactiver vue 3D" : "Basculer vue 3D", action: () => setIs3DMode(!is3DMode) },
                  { label: "Basculer Format Recto/Verso", action: () => setActiveSide(activeSide === "front" ? "back" : "front") },
                  { label: "Ajouter un champ personnalisé", action: () => setCustomFields([...customFields, { id: Date.now().toString(), label: "Nouveau Champ", value: "Valeur" }]) },
                  { label: customFields.length > 0 ? "Supprimer le dernier champ" : "Aucun champ à supprimer", action: () => {
                     if (customFields.length > 0) {
                       setCustomFields(customFields.slice(0, -1));
                     }
                  } }
                ] 
              },
              { 
                id: "template", label: "Template", 
                items: [
                  { label: "Sauvegarder le template actuel", action: () => {
                    setSavedTemplates([...savedTemplates, {
                      name: `Template ${savedTemplates.length + 1}`,
                      style: { ...style },
                      info: { ...info }
                    }]);
                  }},
                  ...savedTemplates.map((t, idx) => ({
                     label: `Charger : ${t.name}`,
                     action: () => {
                       setStyle(t.style);
                       setInfo(t.info);
                     }
                  })),
                  { label: "Modèle: Gold", action: () => handleApplyLayoutTemplate("gold") },
                  { label: "Modèle: Minimal", action: () => handleApplyLayoutTemplate("minimal") },
                  { label: "Modèle: Neon", action: () => handleApplyLayoutTemplate("neon") },
                  { label: "Modèle: Brutalist", action: () => handleApplyLayoutTemplate("brutalist") },
                  { label: "Modèle: Organic", action: () => handleApplyLayoutTemplate("organic") }
                ] 
              }
            ].map(menu => (
              <div key={menu.id} className="relative">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === menu.id ? null : menu.id);
                  }}
                  className={`px-2 py-0.5 rounded text-neutral-300 hover:text-white hover:bg-[#3E3E3E] transition cursor-pointer font-medium ${activeMenu === menu.id ? "bg-[#3E3E3E] text-white" : ""}`}
                >
                  {menu.label}
                </div>
                
                {activeMenu === menu.id && (
                  <div className="absolute left-0 mt-1 w-64 bg-[#2D2D30] border border-[#3F3F46] rounded shadow-2xl py-1 z-50 text-[12px] animate-fadeIn text-neutral-200">
                    {menu.items.map((item, idx) => (
                      <div 
                        key={idx} 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.action) {
                            item.action();
                            setActiveMenu(null);
                          }
                        }}
                        className={`px-4 py-1.5 flex items-center justify-between cursor-pointer hover:bg-[#094771] hover:text-white transition`}
                      >
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full flex-1 flex flex-row overflow-hidden relative">

        {/* LEFT COLUMN: Data Panel */}
        <div className={`bg-[#262626] border-r border-[#1a1a1a] flex flex-col z-10 shrink-0 select-none transition-all duration-300 relative ${isLeftCollapsed ? "w-14 items-center" : "w-64"} overflow-y-auto hidden-scrollbar`}>
          <div className="p-2 border-b border-[#1a1a1a] bg-[#2D2D2D] w-full flex justify-center">
            {isLeftCollapsed ? <User className="w-4 h-4 text-neutral-500" /> : <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pl-1">Données Visuelles</span>}
          </div>
          
          <div className={`p-3 space-y-4 w-full ${isLeftCollapsed ? "px-0" : ""}`}>
            <div className="space-y-3 pb-3 border-b border-[#1a1a1a] w-full flex flex-col items-center">
              {[
                { label: "Nom Complet", key: "name", icon: User },
                { label: "Fonction / Poste", key: "role", icon: Briefcase },
                { label: "Entreprise", key: "company", icon: Building2 },
                { label: "Slogan / Phrase Clé", key: "tagline", icon: Sparkles }
              ].map((fd) => {
                const Icon = fd.icon;
                return isLeftCollapsed ? (
                  <div key={fd.key} className="relative group p-2 mx-auto cursor-pointer" onClick={() => setIsLeftCollapsed(false)}>
                    <Icon className="w-5 h-5 text-neutral-400 group-hover:text-white transition" />
                    <div className="hidden group-hover:block absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-xl z-50 whitespace-nowrap border border-neutral-700">
                      <span className="font-bold">{fd.label}</span>
                      {info[fd.key as keyof typeof info] && <span className="block text-neutral-400 mt-0.5">{(info as any)[fd.key]}</span>}
                    </div>
                  </div>
                ) : (
                  <div key={fd.key} className="space-y-1 w-full">
                    <label className={labelClass}>
                      <Icon className={`w-3 h-3 ${textIconClass}`} />
                      <span>{fd.label} :</span>
                    </label>
                    <input
                      type="text"
                      value={(info as any)[fd.key]}
                      onChange={(e) => setInfo(prev => ({ ...prev, [fd.key]: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 pb-3 border-b border-[#1a1a1a] w-full flex flex-col items-center">
               {!isLeftCollapsed && <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider w-full">Contact</span>}
              {[
                { label: "Téléphone", key: "phone", icon: Phone },
                { label: "Email", key: "email", icon: Mail },
                { label: "Site Internet", key: "website", icon: Globe },
                { label: "Adresse Postale", key: "address", icon: MapPin }
              ].map((fd) => {
                const Icon = fd.icon;
                return isLeftCollapsed ? (
                  <div key={fd.key} className="relative group p-2 mx-auto cursor-pointer" onClick={() => setIsLeftCollapsed(false)}>
                    <Icon className="w-5 h-5 text-neutral-400 group-hover:text-white transition" />
                    <div className="hidden group-hover:block absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-xl z-50 whitespace-nowrap border border-neutral-700">
                      <span className="font-bold">{fd.label}</span>
                      {info[fd.key as keyof typeof info] && <span className="block text-neutral-400 mt-0.5">{(info as any)[fd.key]}</span>}
                    </div>
                  </div>
                ) : (
                  <div key={fd.key} className="space-y-1 w-full">
                    <label className={labelClass}>
                      <Icon className={`w-3 h-3 ${textIconClass}`} />
                      <span>{fd.label} :</span>
                    </label>
                    <input
                      type="text"
                      value={(info as any)[fd.key]}
                      onChange={(e) => setInfo(prev => ({ ...prev, [fd.key]: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                );
              })}
            </div>

            {!isLeftCollapsed && customFields.length > 0 && (
              <div className="space-y-3 pb-3 border-b border-[#1a1a1a] w-full">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Champs Personnalisés</span>
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => setCustomFields(customFields.map(f => f.id === field.id ? { ...f, label: e.target.value } : f))}
                      className="w-full bg-transparent border-none text-[10px] font-bold text-neutral-400 uppercase tracking-wider p-0 outline-none hover:text-white"
                    />
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => setCustomFields(customFields.map(f => f.id === field.id ? { ...f, value: e.target.value } : f))}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            )}
            
            {!isLeftCollapsed && (
              <button 
                onClick={() => setCustomFields([...customFields, { id: Date.now().toString(), label: "Nouveau Champ", value: "" }])}
                className="w-full bg-[#1e1e1e] hover:bg-[#2c2c2c] text-neutral-400 hover:text-white border border-[#1a1a1a] py-2 rounded text-[10px] transition flex justify-center items-center gap-1 mt-2 mb-4 font-bold"
              >
                <Plus className="w-3 h-3" />
                Ajouter un champ
              </button>
            )}

             {/* AI IA assistant generator */}
            <div className="space-y-2 mt-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Générateur de Thème (IA)</span>
              <input
                type="text"
                value={cardAiPrompt}
                onChange={(e) => setCardAiPrompt(e.target.value)}
                placeholder="Ex: Minimaliste café organic..."
                className={inputClass}
                onKeyDown={(e) => e.key === "Enter" && handleAICardStyleSuggest()}
              />
              <button
                onClick={handleAICardStyleSuggest}
                disabled={aiGeneratingStyle || !cardAiPrompt.trim()}
                className={`w-full bg-[#f05a28] hover:bg-[#ff6c3a] disabled:opacity-50 text-white font-bold text-xs py-2 rounded-md transition flex items-center justify-center gap-1 shadow-sm mt-1`}
              >
                {aiGeneratingStyle ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3" />}
                Styliser
              </button>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Workspace / Canvas View */}
        <div className="flex-1 overflow-hidden relative group bg-[#1e1e1e]" style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><circle cx="2" cy="2" r="1" fill="%23333333"/></svg>')` }}>
          
          <button 
             onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
             className={`absolute top-4 left-4 bg-[#262626] border border-[#3c3c3c] rounded-sm p-1.5 z-20 text-neutral-400 hover:text-white shadow-lg transition-transform ${!isLeftCollapsed && "-translate-x-[200%]"}`}
          >
             <Plus className="w-4 h-4" />
          </button>
          
          {!isLeftCollapsed && (
            <button 
               onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
               className="absolute top-4 left-4 bg-[#262626] border border-[#3c3c3c] rounded-sm p-1.5 z-20 text-neutral-400 hover:text-white shadow-lg"
            >
               <Minus className="w-4 h-4" />
            </button>
          )}

          <button 
             onClick={() => setIsRightCollapsed(!isRightCollapsed)}
             className={`absolute top-4 right-4 bg-[#262626] border border-[#3c3c3c] rounded-sm p-1.5 z-20 text-neutral-400 hover:text-white shadow-lg transition-transform ${!isRightCollapsed && "translate-x-[200%]"}`}
          >
             <Plus className="w-4 h-4" />
          </button>
          
          {!isRightCollapsed && (
            <button 
               onClick={() => setIsRightCollapsed(!isRightCollapsed)}
               className="absolute top-4 right-4 bg-[#262626] border border-[#3c3c3c] rounded-sm p-1.5 z-20 text-neutral-400 hover:text-white shadow-lg"
            >
               <Minus className="w-4 h-4" />
            </button>
          )}

          {/* Sub-header in Canvas Toggle */}
          <div className="w-full flex justify-center gap-4 z-10 pointer-events-auto pt-4 pb-8 shrink-0">
             <div className="flex items-center gap-1 bg-[#262626] border border-[#3c3c3c] rounded p-1 shadow-lg">
                <button
                  onClick={() => setActiveSide("front")}
                  className={`px-3 py-1 text-xs transition rounded-sm ${activeSide === "front" ? "bg-[#3e3e42] text-white" : "text-neutral-400 hover:text-white"}`}
                >
                  Recto (Face de Contact)
                </button>
                <button
                  onClick={() => setActiveSide("back")}
                  className={`px-3 py-1 text-xs transition rounded-sm ${activeSide === "back" ? "bg-[#3e3e42] text-white" : "text-neutral-400 hover:text-white"}`}
                >
                  Verso (Identité de Marque)
                </button>
             </div>
             <div className="flex items-center gap-1 bg-[#262626] border border-[#3c3c3c] rounded p-1 shadow-lg">
                <button
                  onClick={() => setIs3DMode(!is3DMode)}
                  className={`px-3 py-1 text-xs transition rounded-sm flex items-center gap-1.5 ${is3DMode ? "bg-[#3e3e42] text-[#f05a28]" : "text-neutral-400 hover:text-white"}`}
                >
                   <RotateCw className="w-3 h-3" />
                   Vue 3D
                </button>
             </div>
          </div>

          <div className="w-full flex-1 flex flex-col items-center justify-start px-4 md:px-8 pb-8 relative overflow-y-auto min-h-0" ref={previewContainerRef}>
             
            {aiFeedback && (
              <div className="absolute top-0 bg-[#141414] border border-[#f05a28]/30 rounded-md text-neutral-300 px-4 py-2 flex items-center gap-2 text-[11px] max-w-sm text-center shadow-lg pointer-events-none z-20">
                <Sparkles className="w-4 h-4 text-[#f05a28]" />
                <p>{aiFeedback}</p>
              </div>
            )}

            <div className="w-full h-full flex justify-center mt-2 items-start" style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center', transition: 'transform 0.1s ease-out' }}>
              <div 
                style={is3DMode ? {
                  perspective: "1000px",
                  transformStyle: "preserve-3d",
                  transform: `rotateX(${rot3D.x}deg) rotateY(${rot3D.y}deg)`,
                  transition: "transform 0.1s ease"
                }: {}}
                className="transition-all duration-300 transform-gpu flex justify-center origin-top"
                onMouseMove={(e) => {
                if (!is3DMode) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = (e.clientY - rect.top) / rect.height - 0.5;
                const y = (e.clientX - rect.left) / rect.width - 0.5;
                setRot3D({ x: -x * 25, y: y * 25 });
              }}
              onMouseLeave={() => is3DMode && setRot3D({ x: 10, y: -15 })}
            >
              
              {/* The Physical Business Card frame box */}
              <div
                id="printed-business-card"
                ref={cardRef}
                className={`relative overflow-hidden transition-all duration-300 ${cardWidth} ${cardHeight} shadow-2xl flex flex-col justify-between p-7.5`}
                style={{
                  borderRadius: `${style.borderRadius}px`,
                  backgroundColor: style.bgColor,
                  backgroundImage: style.bgGradient && style.bgGradientColors.length >= 2 
                    ? `linear-gradient(${style.bgGradientAngle || 135}deg, ${style.bgGradientColors[0]}, ${style.bgGradientColors[1]})` 
                    : "none",
                  color: style.textColor,
                  border: style.hasBorder ? `${style.borderWidth}px solid ${style.borderColor}` : "none",
                  boxShadow: "0 25px 60px -15px rgba(0,0,0,0.85), 0 0 1px 1.5px rgba(255,255,255,0.06) inset"
                }}
              >
                
                {/* CARD DECORATIONS : Neon glow or gold lines */}
                {style.theme === "neon" && (
                  <div className="absolute inset-x-2 inset-y-2 border border-cyan-500/10 pointer-events-none rounded-sm" />
                )}
                {style.theme === "gold" && (
                  <div className="absolute top-2 right-2 w-16 h-16 border-t-2 border-r-2 border-amber-500/15 pointer-events-none" />
                )}

                {/* CARD CONTENT : RECTO (FRONT) */}
                {activeSide === "front" ? (
                  <>
                    {/* Top Bar Logo / Identity */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 text-left">
                        {style.logoUrl ? (
                          <img 
                            src={style.logoUrl} 
                            alt="Company Logo" 
                            className="h-10 w-10 object-contain rounded-lg shrink-0 mb-1 pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="text-base font-black tracking-tight"
                              style={{ color: style.accentColor }}
                            >
                              {info.company}
                            </span>
                          </div>
                        )}
                        <p className="text-[10px] opacity-70 tracking-wide select-none leading-none">{info.tagline}</p>
                      </div>

                      {/* Integrated QR Code */}
                      {style.qrPosition === "front-right" && (
                        <div className="bg-white p-1.5 rounded-lg shadow-md shrink-0">
                          <QRCodeCanvas 
                            value={qrCodeUrlValue}
                            size={style.qrSize}
                            style={qrCodeStyle || {
                              dotStyle: "square",
                              backgroundColor: "#FFFFFF",
                              backgroundGradient: false,
                              backgroundGradientType: "linear",
                              backgroundGradientColors: ["#FFFFFF", "#FFFFFF"],
                              dotColor: "#000000",
                              dotGradient: false,
                              dotGradientType: "linear",
                              dotGradientColors: ["#000000", "#000000"],
                              eyeOuterStyle: "square",
                              eyeInnerStyle: "square",
                              eyeOuterColor: "#000000",
                              eyeInnerColor: "#000000",
                              logoType: "none",
                              logoValue: "",
                              logoSize: 0.18,
                              logoBgColor: "#FFFFFF",
                              logoBgShape: "none",
                              frameStyle: "none",
                              frameText: "",
                              frameTextColor: "#FFFFFF",
                              frameBgColor: "#000000"
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Mid Bar Main Name Card */}
                    <div className="space-y-1 py-1 text-left mt-4">
                      <h3 className="text-xl font-bold tracking-tight mb-0.5">{info.name}</h3>
                      <div 
                        className="text-[10.5px] font-black uppercase tracking-widest leading-none"
                        style={{ color: style.accentColor }}
                      >
                        {info.role}
                      </div>
                    </div>

                    {/* Bottom Bar Contact grid list */}
                    <div className="flex justify-between items-end text-[10px] space-y-0.5 mt-auto text-left">
                      <div className="space-y-1 opacity-80 font-medium">
                        {info.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" style={{ color: style.accentColor }} /><span>{info.phone}</span></div>}
                        {info.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 shrink-0" style={{ color: style.accentColor }} /><span>{info.email}</span></div>}
                        {info.website && <div className="flex items-center gap-1.5"><Globe className="w-3 h-3 shrink-0" style={{ color: style.accentColor }} /><span>{info.website}</span></div>}
                        
                        {customFields.map((field) => field.value && (
                          <div key={field.id} className="flex items-center gap-1.5">
                            <CheckCircle className="w-2.5 h-2.5 shrink-0" style={{ color: style.accentColor }} />
                            <span>{field.value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="opacity-80 max-w-[170px] text-right font-medium leading-normal">
                        {info.address && <span className="block border-t border-slate-700/20 pt-1">{info.address}</span>}
                      </div>
                    </div>
                  </>
                ) : (
                  
                  /* CARD CONTENT : VERSO (BACK) */
                  <div className="h-full w-full flex flex-col justify-center items-center text-center space-y-4">
                    {style.logoUrl ? (
                      <img 
                        src={style.logoUrl} 
                        alt="Company Logo Big" 
                        className="h-20 w-20 object-contain rounded-xl pointer-events-none animate-pulse"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="space-y-1 pb-1">
                        <div className="w-12 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mb-2" />
                        <span 
                          className="text-2xl font-black uppercase tracking-widest block"
                          style={{ color: style.accentColor }}
                        >
                          {info.company}
                        </span>
                      </div>
                    )}

                    <p className="text-xs opacity-75 max-w-[280px] leading-relaxed mx-auto italic select-none">
                      "{info.tagline || "Vivez la pureté graphique"}"
                    </p>

                    {/* Back center QR Code */}
                    {style.qrPosition === "back-center" && (
                      <div className="bg-white p-2 rounded-xl shadow-lg mt-2 mx-auto inline-block">
                        <QRCodeCanvas 
                          value={qrCodeUrlValue}
                          size={84}
                          style={qrCodeStyle || {
                            dotStyle: "square",
                            backgroundColor: "#FFFFFF",
                            backgroundGradient: false,
                            backgroundGradientType: "linear",
                            backgroundGradientColors: ["#FFFFFF", "#FFFFFF"],
                            dotColor: "#000000",
                            dotGradient: false,
                            dotGradientType: "linear",
                            dotGradientColors: ["#000000", "#000000"],
                            eyeOuterStyle: "square",
                            eyeInnerStyle: "square",
                            eyeOuterColor: "#000000",
                            eyeInnerColor: "#000000",
                            logoType: "none",
                            logoValue: "",
                            logoSize: 0.18,
                            logoBgColor: "#FFFFFF",
                            logoBgShape: "none",
                            frameStyle: "none",
                            frameText: "",
                            frameTextColor: "#FFFFFF",
                            frameBgColor: "#000000"
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Style Properties */}
        <div className={`bg-[#262626] border-l border-[#1a1a1a] flex flex-col z-10 shrink-0 select-none transition-all duration-300 relative ${isRightCollapsed ? "w-14 items-center" : "w-72"} overflow-y-auto hidden-scrollbar`}>
          <div className="p-2 border-b border-[#1a1a1a] bg-[#2D2D2D] sticky top-0 z-10 w-full flex justify-center">
            {isRightCollapsed ? <Type className="w-4 h-4 text-neutral-500" /> : <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pl-1">Propriétés Globales</span>}
          </div>

          {isRightCollapsed ? (
             <div className="flex flex-col gap-6 p-4 items-center">
                <button type="button" onClick={() => setIsRightCollapsed(false)} title="Format Papier" className="cursor-pointer">
                  <Crop className="w-5 h-5 text-neutral-400 hover:text-white transition" />
                </button>
                <button type="button" onClick={() => setIsRightCollapsed(false)} title="Orientation" className="cursor-pointer">
                  <Layout className="w-5 h-5 text-neutral-400 hover:text-white transition" />
                </button>
                <button type="button" onClick={() => setIsRightCollapsed(false)} title="Couleurs" className="cursor-pointer">
                  <Palette className="w-5 h-5 text-neutral-400 hover:text-white transition" />
                </button>
                <button type="button" onClick={() => setIsRightCollapsed(false)} title="Coins & Bordures" className="cursor-pointer">
                  <Square className="w-5 h-5 text-neutral-400 hover:text-white transition" />
                </button>
                <button type="button" onClick={() => setIsRightCollapsed(false)} title="QR Code" className="cursor-pointer">
                  <QrCode className="w-5 h-5 text-neutral-400 hover:text-white transition" />
                </button>
             </div>
          ) : (
          <div className="p-4 text-xs space-y-6">
            
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-neutral-400 uppercase">Format Papier :</label>
              <ThemedSelect
                value={style.cardFormat}
                onChange={(val) => setStyle((prev) => ({ ...prev, cardFormat: val as any }))}
                options={[
                  { value: "euro", label: "Standard EU (85x55mm)" },
                  { value: "us", label: "US Business (89x51mm)" },
                  { value: "square", label: "Carré Zen (60x60mm)" },
                ]}
                isVS={isVS}
                size="sm"
              />
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-neutral-400 uppercase">Orientation :</label>
              <ThemedSelect
                value={style.orientation}
                onChange={(val) => setStyle((prev) => ({ ...prev, orientation: val as any }))}
                options={[
                  { value: "horizontal", label: "Paysage (Horizontal)" },
                  { value: "vertical", label: "Portrait (Vertical)" },
                ]}
                isVS={isVS}
                size="sm"
              />
            </div>

            <div className="space-y-3 pt-4 border-t border-[#1a1a1a]">
               <div className="flex justify-between items-center bg-transparent mt-2">
                 <span className="text-neutral-300">Couleur unie / Dégradé :</span>
                 <div className="flex gap-1.5">
                   <button
                     onClick={() => setStyle(prev => ({ ...prev, bgGradient: false }))}
                     className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${!style.bgGradient ? "bg-neutral-700 text-white" : "bg-neutral-900 text-neutral-400 border border-[#333]"}`}
                   >
                     Unie
                   </button>
                   <button
                     onClick={() => setStyle(prev => ({ ...prev, bgGradient: true }))}
                     className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${style.bgGradient ? "bg-neutral-700 text-white" : "bg-neutral-900 text-neutral-400 border border-[#333]"}`}
                   >
                     Grad
                   </button>
                 </div>
               </div>

               <div className="flex items-center justify-between">
                 <span className="text-neutral-300">Couleur d'accentuation :</span>
                 <div className="flex items-center gap-2">
                   <input
                     type="color"
                     value={style.accentColor}
                     onChange={(e) => setStyle(prev => ({ ...prev, accentColor: e.target.value }))}
                     className="w-6 h-6 rounded border border-neutral-700 cursor-pointer outline-none bg-transparent"
                   />
                   <span className="text-[10px] font-mono text-neutral-500 uppercase">{style.accentColor}</span>
                 </div>
               </div>

               <div className="flex flex-col gap-2 pt-2">
                 <span className="text-neutral-300">Angle d'arrondi coins : ({style.borderRadius}px)</span>
                 <input
                   type="range"
                   min="0"
                   max="32"
                   value={style.borderRadius}
                   onChange={(e) => setStyle(prev => ({ ...prev, borderRadius: parseInt(e.target.value) }))}
                   className={`w-full accent-[#f05a28]`}
                 />
               </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#1a1a1a]">
               <div className="flex flex-col gap-2">
                 <span className="text-neutral-300">Intégration du QR Code :</span>
                 <ThemedSelect
                   value={style.qrPosition}
                   onChange={(val) => setStyle((prev) => ({ ...prev, qrPosition: val as any }))}
                   options={[
                     { value: "front-right", label: "Recto (Droit)" },
                     { value: "front-left", label: "Recto (Gauche)" },
                     { value: "back-center", label: "Verso (Milieu)" },
                     { value: "none", label: "Masqué" },
                   ]}
                   isVS={isVS}
                   size="sm"
                 />
               </div>
            </div>

          </div>
          )}
        </div>

      </div>
    </div>
  );
}

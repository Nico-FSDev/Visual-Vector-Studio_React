import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Download,
  Copy,
  Check,
  Image as ImageIcon,
  FileCode2,
  FileText,
  Sliders,
  Sparkles,
  Lock,
  Unlock,
  Layers,
  FileDown,
  Info
} from "lucide-react";
import {
  renderArtworkToCanvas,
  exportArtworkToPdf,
  triggerFileDownload
} from "../utils/canvasExporter";

export type ExportFormat = "png" | "svg" | "jpeg" | "webp" | "pdf" | "vvs";

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: any[];
  canvasWidth: number;
  canvasHeight: number;
  canvasBgColor?: string;
  initialFormat?: ExportFormat;
  initialTransparentBg?: boolean;
  getSVGCode: (options?: {
    minify?: boolean;
    transparentBg?: boolean;
    includeXmlHeader?: boolean;
  }) => string;
  projectHistory?: any[];
  historyPointer?: number;
  onExportAsLogoUrl?: (url: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  elements,
  canvasWidth,
  canvasHeight,
  canvasBgColor = "transparent",
  initialFormat = "png",
  initialTransparentBg = true,
  getSVGCode,
  projectHistory = [],
  historyPointer = 0,
  onExportAsLogoUrl
}) => {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [scaleMultiplier, setScaleMultiplier] = useState<number>(2); // Default to 2x for crisp HD
  const [customWidth, setCustomWidth] = useState<number>(Math.round(canvasWidth * 2));
  const [customHeight, setCustomHeight] = useState<number>(Math.round(canvasHeight * 2));
  const [isAspectLocked, setIsAspectLocked] = useState<boolean>(true);
  const [quality, setQuality] = useState<number>(0.95);
  const [transparentBg, setTransparentBg] = useState<boolean>(initialTransparentBg);
  const [customBgColor, setCustomBgColor] = useState<string>(
    canvasBgColor !== "transparent" ? canvasBgColor : "#ffffff"
  );
  
  // SVG specific options
  const [minifySvg, setMinifySvg] = useState<boolean>(false);
  const [includeXmlHeader, setIncludeXmlHeader] = useState<boolean>(true);
  
  // PDF specific options
  const [pdfPageFormat, setPdfPageFormat] = useState<"artboard" | "a4" | "a3" | "letter">("artboard");
  const [pdfOrientation, setPdfOrientation] = useState<"auto" | "portrait" | "landscape">("auto");
  const [pdfMargin, setPdfMargin] = useState<number>(10);

  // Status & Telemetry
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [customFilename, setCustomFilename] = useState<string>(
    `motif-vectoriel-${new Date().toISOString().slice(0, 10)}`
  );

  const aspectRatio = useMemo(() => {
    return canvasWidth > 0 && canvasHeight > 0 ? canvasWidth / canvasHeight : 1;
  }, [canvasWidth, canvasHeight]);

  // Sync format whenever initialFormat changes
  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat);
      setCustomWidth(Math.round(canvasWidth * scaleMultiplier));
      setCustomHeight(Math.round(canvasHeight * scaleMultiplier));
    }
  }, [isOpen, initialFormat, canvasWidth, canvasHeight]);

  // Handle scale chip click
  const handleScalePreset = (mult: number) => {
    setScaleMultiplier(mult);
    const newW = Math.round(canvasWidth * mult);
    const newH = Math.round(canvasHeight * mult);
    setCustomWidth(newW);
    setCustomHeight(newH);
  };

  // Handle custom width change
  const handleWidthChange = (val: number) => {
    const w = Math.max(16, Math.min(val || 16, 8192));
    setCustomWidth(w);
    if (isAspectLocked) {
      setCustomHeight(Math.round(w / aspectRatio));
    }
    setScaleMultiplier(w / canvasWidth);
  };

  // Handle custom height change
  const handleHeightChange = (val: number) => {
    const h = Math.max(16, Math.min(val || 16, 8192));
    setCustomHeight(h);
    if (isAspectLocked) {
      setCustomWidth(Math.round(h * aspectRatio));
    }
    setScaleMultiplier(h / canvasHeight);
  };

  // Generate live preview
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const generatePreview = async () => {
      try {
        setPreviewError(null);
        if (format === "svg") {
          const svgString = getSVGCode({
            transparentBg,
            minify: minifySvg,
            includeXmlHeader
          });
          const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          if (isMounted) setPreviewDataUrl(url);
        } else if (format === "vvs") {
          // Render a quick miniature raster preview
          const res = await renderArtworkToCanvas({
            elements,
            canvasWidth,
            canvasHeight,
            canvasBgColor: transparentBg ? "transparent" : customBgColor,
            exportWithTransparentBg: transparentBg,
            targetMaxDim: 400,
            format: "png",
            quality: 0.9
          });
          if (isMounted) setPreviewDataUrl(res.dataUrl);
        } else {
          // Raster formats (PNG, JPEG, WEBP, PDF)
          const res = await renderArtworkToCanvas({
            elements,
            canvasWidth,
            canvasHeight,
            canvasBgColor: transparentBg && (format === "png" || format === "webp") ? "transparent" : customBgColor,
            exportWithTransparentBg: transparentBg && (format === "png" || format === "webp"),
            targetWidth: Math.min(customWidth, 800),
            targetHeight: Math.min(customHeight, Math.round(800 / aspectRatio)),
            format: format === "pdf" ? "png" : (format as "png" | "jpeg" | "webp"),
            quality: quality
          });
          if (isMounted) setPreviewDataUrl(res.dataUrl);
        }
      } catch (err: any) {
        console.warn("Preview generation error:", err);
        if (isMounted) setPreviewError("Aperçu non disponible pour ces paramètres");
      }
    };

    const timer = setTimeout(generatePreview, 120);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    format,
    customWidth,
    customHeight,
    quality,
    transparentBg,
    customBgColor,
    minifySvg,
    includeXmlHeader,
    elements,
    canvasWidth,
    canvasHeight,
    aspectRatio
  ]);

  // Handle Export Action
  const handlePerformExport = async () => {
    setIsExporting(true);
    try {
      const cleanName = (customFilename.trim() || "export-motif").replace(/[^a-zA-Z0-9-_]/g, "_");

      if (format === "svg") {
        let code = getSVGCode({
          transparentBg,
          minify: minifySvg,
          includeXmlHeader
        });

        if (minifySvg) {
          code = code.replace(/>\s+</g, "><").trim();
        }

        const blob = new Blob([code], { type: "image/svg+xml;charset=utf-8" });
        triggerFileDownload(blob, `${cleanName}.svg`, "image/svg+xml");

        if (onExportAsLogoUrl) {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") onExportAsLogoUrl(reader.result);
          };
          reader.readAsDataURL(blob);
        }
      } else if (format === "pdf") {
        await exportArtworkToPdf({
          elements,
          canvasWidth,
          canvasHeight,
          canvasBgColor: transparentBg ? "transparent" : customBgColor,
          exportWithTransparentBg: transparentBg,
          orientation: pdfOrientation,
          pageFormat: pdfPageFormat,
          marginMm: pdfMargin,
          filename: `${cleanName}.pdf`
        });
      } else if (format === "vvs") {
        const projectData = {
          version: "1.0",
          name: cleanName,
          elements: elements,
          canvasWidth,
          canvasHeight,
          canvasBgColor,
          history: projectHistory,
          historyPointer: historyPointer,
          timestamp: Date.now()
        };
        const jsonStr = JSON.stringify(projectData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
        triggerFileDownload(blob, `${cleanName}.vvs`, "application/json");
      } else {
        // PNG, JPEG, WEBP
        const result = await renderArtworkToCanvas({
          elements,
          canvasWidth,
          canvasHeight,
          canvasBgColor: transparentBg && (format === "png" || format === "webp") ? "transparent" : customBgColor,
          exportWithTransparentBg: transparentBg && (format === "png" || format === "webp"),
          targetWidth: customWidth,
          targetHeight: customHeight,
          format: format as "png" | "jpeg" | "webp",
          quality: quality
        });

        triggerFileDownload(result.blob, `${cleanName}.${format}`, `image/${format}`);

        if (onExportAsLogoUrl && (format === "png" || format === "webp")) {
          onExportAsLogoUrl(result.dataUrl);
        }
      }

      onClose();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Une erreur est survenue lors de l'exportation.");
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Copy to Clipboard
  const handleCopyToClipboard = async () => {
    try {
      if (format === "svg") {
        const code = getSVGCode({ transparentBg, minify: minifySvg, includeXmlHeader });
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else if (previewDataUrl) {
        // Copy image blob or URL
        const res = await fetch(previewDataUrl);
        const blob = await res.blob();
        if (blob.type === "image/png" && navigator.clipboard && (window as any).ClipboardItem) {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ "image/png": blob })
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          await navigator.clipboard.writeText(previewDataUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    } catch (err) {
      console.warn("Clipboard copy fallback:", err);
    }
  };

  // Estimated file size calculation
  const estimatedSize = useMemo(() => {
    const totalPixels = customWidth * customHeight;
    if (format === "svg") {
      const elCount = elements.length;
      return `~${Math.round(Math.max(2, elCount * 0.8))} Ko`;
    }
    if (format === "png") {
      const kBytes = Math.round((totalPixels * 4) / 1024 / 4); // Compression estimation
      return kBytes > 1024 ? `~${(kBytes / 1024).toFixed(1)} Mo` : `~${kBytes} Ko`;
    }
    if (format === "jpeg") {
      const kBytes = Math.round((totalPixels * 3 * quality) / 1024 / 8);
      return kBytes > 1024 ? `~${(kBytes / 1024).toFixed(1)} Mo` : `~${kBytes} Ko`;
    }
    if (format === "webp") {
      const kBytes = Math.round((totalPixels * 3 * quality) / 1024 / 12);
      return `~${kBytes} Ko`;
    }
    if (format === "pdf") {
      return `~${Math.round((totalPixels * 2) / 1024 / 6)} Ko`;
    }
    return `~${Math.round(JSON.stringify(elements).length / 1024)} Ko`;
  }, [format, customWidth, customHeight, quality, elements]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#222224] border border-[#3A3A3D] rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden text-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#1A1A1C] px-6 py-4 border-b border-[#2D2D30] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ff9a00]/15 border border-[#ff9a00]/30 flex items-center justify-center text-[#ff9a00]">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Exporter le Motif
                <span className="text-[11px] bg-[#333] text-neutral-300 font-mono px-2 py-0.5 rounded-full font-normal">
                  Haute Définition
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Configurez les dimensions, la qualité et le format de rendu exacts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#2A2A2D] hover:bg-[#38383C] text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-0 divide-y md:divide-y-0 md:divide-x divide-[#2D2D30]">
          {/* Left Column: Live Preview & Summary (5 cols) */}
          <div className="md:col-span-5 p-5 flex flex-col bg-[#1C1C1E]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#ff9a00]" />
                Aperçu du rendu
              </span>
              <span className="text-[11px] font-mono text-neutral-400 bg-[#28282B] px-2 py-0.5 rounded">
                {customWidth} × {customHeight} px
              </span>
            </div>

            {/* Preview Box */}
            <div className="flex-1 min-h-[220px] max-h-[280px] bg-[#121214] border border-[#2B2B2E] rounded-xl flex items-center justify-center p-4 relative overflow-hidden group">
              {/* Checkerboard transparency background */}
              {transparentBg && (format === "png" || format === "webp" || format === "svg") && (
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)`,
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px"
                  }}
                />
              )}

              {previewDataUrl && !previewError ? (
                <img
                  src={previewDataUrl}
                  alt="Aperçu Export"
                  className="max-w-full max-h-full object-contain rounded drop-shadow-md z-10 transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="text-center text-xs text-neutral-500 z-10">
                  {previewError || "Génération de l'aperçu..."}
                </div>
              )}

              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-neutral-300 border border-white/10 z-20">
                {format.toUpperCase()} • {estimatedSize}
              </div>
            </div>

            {/* Filename Input */}
            <div className="mt-4">
              <label className="block text-[11px] font-medium text-neutral-400 mb-1.5">
                Nom du fichier
              </label>
              <div className="flex items-center bg-[#252528] border border-[#353539] focus-within:border-[#ff9a00] rounded-lg px-3 py-1.5 transition">
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  className="bg-transparent text-xs text-white outline-none w-full font-mono"
                  placeholder="nom-du-fichier"
                />
                <span className="text-[11px] font-mono text-[#ff9a00] shrink-0 font-bold ml-1">
                  .{format}
                </span>
              </div>
            </div>

            {/* Specs Badges */}
            <div className="mt-4 p-3 bg-[#242427] border border-[#323236] rounded-xl space-y-1.5 text-[11px] text-neutral-300">
              <div className="flex justify-between">
                <span className="text-neutral-400">Éléments vectoriels :</span>
                <span className="font-mono text-white font-semibold">{elements.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Poids estimé :</span>
                <span className="font-mono text-[#ff9a00] font-semibold">{estimatedSize}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Densité calculée :</span>
                <span className="font-mono text-white">
                  {scaleMultiplier >= 4
                    ? "Ultra HD (300 DPI - Impression)"
                    : scaleMultiplier >= 2
                    ? "Retina HD (144 DPI - Écran)"
                    : "Standard (72 DPI - Web)"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Settings, Formats & Options (7 cols) */}
          <div className="md:col-span-7 p-6 space-y-5 bg-[#222224] overflow-y-auto">
            {/* 1. Format Selector Grid */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-2">
                1. Format de sortie
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { id: "png", label: "PNG", icon: ImageIcon, desc: "Raster HD transparent", color: "#ff9a00" },
                  { id: "svg", label: "SVG", icon: FileCode2, desc: "Vectoriel pur infini", color: "#38bdf8" },
                  { id: "jpeg", label: "JPEG", icon: ImageIcon, desc: "Raster compressé", color: "#4ade80" },
                  { id: "webp", label: "WEBP", icon: ImageIcon, desc: "Web nouvelle gén.", color: "#c084fc" },
                  { id: "pdf", label: "PDF", icon: FileText, desc: "Document vectoriel", color: "#f43f5e" },
                  { id: "vvs", label: "Projet", icon: Layers, desc: "Sauvegarde (.VVS)", color: "#fbbf24" }
                ].map((fmt) => {
                  const Icon = fmt.icon;
                  const isSelected = format === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => setFormat(fmt.id as ExportFormat)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center relative ${
                        isSelected
                          ? "bg-[#ff9a00]/15 border-[#ff9a00] text-white shadow-sm ring-1 ring-[#ff9a00]"
                          : "bg-[#1C1C1F] border-[#303034] text-neutral-400 hover:text-white hover:bg-[#28282D] hover:border-[#404046]"
                      }`}
                    >
                      <Icon
                        className="w-5 h-5"
                        style={{ color: isSelected ? "#ff9a00" : undefined }}
                      />
                      <span className="text-xs font-bold leading-none">{fmt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Sizing & Multiplier Controls (for raster / PDF) */}
            {format !== "vvs" && (
              <div className="pt-2 border-t border-[#2D2D30]">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-neutral-300">
                    2. Échelle & Dimensions ({format.toUpperCase()})
                  </label>
                  <div className="flex items-center gap-1">
                    {[
                      { label: "1x", val: 1 },
                      { label: "2x HD", val: 2 },
                      { label: "3x", val: 3 },
                      { label: "4x UHD", val: 4 }
                    ].map((chip) => (
                      <button
                        key={chip.val}
                        onClick={() => handleScalePreset(chip.val)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer font-bold ${
                          Math.abs(scaleMultiplier - chip.val) < 0.05
                            ? "bg-[#ff9a00] text-black"
                            : "bg-[#1C1C1F] text-neutral-400 hover:text-white hover:bg-[#2C2C30]"
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center bg-[#1C1C1F] p-3 rounded-xl border border-[#2F2F34]">
                  {/* Width Input */}
                  <div>
                    <span className="text-[10px] text-neutral-400 block mb-1">Largeur (px)</span>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#141416] border border-[#35353A] rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:border-[#ff9a00] outline-none"
                    />
                  </div>

                  {/* Height Input */}
                  <div className="relative">
                    <span className="text-[10px] text-neutral-400 block mb-1">Hauteur (px)</span>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#141416] border border-[#35353A] rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:border-[#ff9a00] outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 px-1">
                  <button
                    onClick={() => setIsAspectLocked(!isAspectLocked)}
                    className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-white transition cursor-pointer"
                  >
                    {isAspectLocked ? (
                      <Lock className="w-3.5 h-3.5 text-[#ff9a00]" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-neutral-500" />
                    )}
                    <span>{isAspectLocked ? "Proportions verrouillées" : "Proportions libres"}</span>
                  </button>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    Artboard original : {canvasWidth} × {canvasHeight}
                  </span>
                </div>
              </div>
            )}

            {/* 3. Format Specific Parameters */}
            <div className="pt-2 border-t border-[#2D2D30] space-y-3">
              <label className="text-xs font-bold text-neutral-300 block">
                3. Options de Compression & Rendu
              </label>

              {/* Transparency Toggle (PNG, WEBP, SVG) */}
              {(format === "png" || format === "webp" || format === "svg") && (
                <div className="flex items-center justify-between p-3 bg-[#1C1C1F] rounded-xl border border-[#2F2F34]">
                  <div>
                    <span className="text-xs font-medium text-white block">
                      Fond Transparent (Alpha)
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      Génère un canal alpha sans couleur d'arrière-plan
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={transparentBg}
                    onChange={(e) => setTransparentBg(e.target.checked)}
                    className="w-4 h-4 accent-[#ff9a00] cursor-pointer rounded"
                  />
                </div>
              )}

              {/* Background Color fallback */}
              {!transparentBg && format !== "vvs" && (
                <div className="flex items-center justify-between p-3 bg-[#1C1C1F] rounded-xl border border-[#2F2F34]">
                  <div>
                    <span className="text-xs font-medium text-white block">
                      Couleur du Fond
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      Couleur de remplissage pour l'arrière-plan
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customBgColor}
                      onChange={(e) => setCustomBgColor(e.target.value)}
                      className="w-7 h-7 rounded border border-[#444] cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={customBgColor}
                      onChange={(e) => setCustomBgColor(e.target.value)}
                      className="w-20 bg-[#141416] border border-[#35353A] rounded px-2 py-1 text-xs font-mono text-white text-center"
                    />
                  </div>
                </div>
              )}

              {/* Quality Slider (JPEG, WEBP, PNG) */}
              {(format === "jpeg" || format === "webp") && (
                <div className="p-3 bg-[#1C1C1F] rounded-xl border border-[#2F2F34] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-white">Qualité de Compression</span>
                    <span className="text-xs font-mono text-[#ff9a00] font-bold">
                      {Math.round(quality * 100)} %
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-full accent-[#ff9a00] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                    <span>Fichier léger (10%)</span>
                    <span>Équilibré (80%)</span>
                    <span>Qualité Max (100%)</span>
                  </div>
                </div>
              )}

              {/* SVG Specific Toggles */}
              {format === "svg" && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2.5 bg-[#1C1C1F] rounded-xl border border-[#2F2F34] cursor-pointer text-xs text-neutral-300">
                    <input
                      type="checkbox"
                      checked={minifySvg}
                      onChange={(e) => setMinifySvg(e.target.checked)}
                      className="accent-[#ff9a00] rounded"
                    />
                    <span>Minifier le code SVG (supprime les espaces et retours à la ligne)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-[#1C1C1F] rounded-xl border border-[#2F2F34] cursor-pointer text-xs text-neutral-300">
                    <input
                      type="checkbox"
                      checked={includeXmlHeader}
                      onChange={(e) => setIncludeXmlHeader(e.target.checked)}
                      className="accent-[#ff9a00] rounded"
                    />
                    <span>Inclure l'en-tête XML standard &lt;?xml version="1.0"?&gt;</span>
                  </label>
                </div>
              )}

              {/* PDF Specific Options */}
              {format === "pdf" && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#1C1C1F] rounded-xl border border-[#2F2F34]">
                  <div>
                    <span className="text-[10px] text-neutral-400 block mb-1">Format de Page</span>
                    <select
                      value={pdfPageFormat}
                      onChange={(e) => setPdfPageFormat(e.target.value as any)}
                      className="w-full bg-[#141416] border border-[#35353A] rounded-lg px-2 py-1.5 text-xs text-white focus:border-[#ff9a00] outline-none"
                    >
                      <option value="artboard">Artboard (Sur mesure)</option>
                      <option value="a4">Format A4</option>
                      <option value="a3">Format A3</option>
                      <option value="letter">Format US Letter</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-400 block mb-1">Orientation</span>
                    <select
                      value={pdfOrientation}
                      onChange={(e) => setPdfOrientation(e.target.value as any)}
                      className="w-full bg-[#141416] border border-[#35353A] rounded-lg px-2 py-1.5 text-xs text-white focus:border-[#ff9a00] outline-none"
                    >
                      <option value="auto">Automatique (selon ratio)</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Paysage</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer: Action Buttons */}
        <div className="bg-[#1A1A1C] px-6 py-4 border-t border-[#2D2D30] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Info className="w-4 h-4 text-[#ff9a00]" />
            <span>
              {format === "svg"
                ? "Fichier vectoriel vectoriel universellement compatible (Illustrator, Inkscape, Figma)"
                : format === "pdf"
                ? "Document vectoriel haute résolution prêt pour l'impression"
                : `${format.toUpperCase()} rendu à ${customWidth} × ${customHeight} px`}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Copy button */}
            <button
              onClick={handleCopyToClipboard}
              className="px-3 py-2 bg-[#252528] hover:bg-[#323236] border border-[#3A3A3F] text-neutral-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
              title="Copier dans le presse-papiers"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{format === "svg" ? "Copier code SVG" : "Copier"}</span>
                </>
              )}
            </button>

            {/* Cancel */}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-transparent hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Annuler
            </button>

            {/* Primary Download Button */}
            <button
              onClick={handlePerformExport}
              disabled={isExporting}
              className="flex-1 sm:flex-initial px-5 py-2 bg-[#ff9a00] hover:bg-[#e08800] active:scale-[0.98] text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#ff9a00]/20 transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {isExporting ? "Génération en cours..." : `Télécharger (${format.toUpperCase()})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ExportModal;

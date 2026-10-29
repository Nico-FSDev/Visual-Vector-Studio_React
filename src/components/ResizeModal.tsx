import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Maximize2,
  Lock,
  Unlock,
  Layers,
  Layout,
  Sparkles,
  Check,
  RotateCcw,
  ArrowRight,
  Sliders,
  Ratio,
} from "lucide-react";
import {
  ResizeTargetMode,
  ResizeUnit,
  ResizeAnchor,
  getElementsBoundingBox,
  resizeCanvasOnly,
  resizeElementsOnly,
  resizeImageAndCanvas,
} from "../utils/resizeOperations";
import { VectorElement } from "./IllustratorCanvas";

export interface ResizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: ResizeTargetMode;
  elements: VectorElement[];
  selectedElementIds: string[];
  canvasWidth: number;
  canvasHeight: number;
  onApplyResize: (result: {
    canvasWidth?: number;
    canvasHeight?: number;
    elements?: VectorElement[];
    message: string;
  }) => void;
}

export const ResizeModal: React.FC<ResizeModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  elements,
  selectedElementIds,
  canvasWidth,
  canvasHeight,
  onApplyResize,
}) => {
  const [mode, setMode] = useState<ResizeTargetMode>(initialMode);
  const [unit, setUnit] = useState<ResizeUnit>("px");
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [anchor, setAnchor] = useState<ResizeAnchor>("center");
  const [scaleStrokes, setScaleStrokes] = useState<boolean>(true);

  // Compute baseline reference dimensions depending on mode and selection
  const selectedElements = elements.filter(
    (el) => selectedElementIds.includes(el.id) && !el.isLocked
  );
  const activeTargets =
    selectedElements.length > 0
      ? selectedElements
      : elements.filter((el) => !el.isLocked);

  const elementsBounds = getElementsBoundingBox(activeTargets);

  // Initial reference dimensions
  const baseWidth =
    mode === "canvas" || mode === "both"
      ? canvasWidth
      : Math.round(elementsBounds.width || canvasWidth);

  const baseHeight =
    mode === "canvas" || mode === "both"
      ? canvasHeight
      : Math.round(elementsBounds.height || canvasHeight);

  const baseAspect = baseWidth / Math.max(1, baseHeight);

  // Controlled dimensions in pixels
  const [widthPx, setWidthPx] = useState<number>(baseWidth);
  const [heightPx, setHeightPx] = useState<number>(baseHeight);

  // Controlled percentages
  const [percentX, setPercentX] = useState<number>(100);
  const [percentY, setPercentY] = useState<number>(100);

  // Reset/sync when mode changes or modal opens
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, isOpen]);

  useEffect(() => {
    const curBaseW =
      mode === "canvas" || mode === "both"
        ? canvasWidth
        : Math.round(elementsBounds.width || canvasWidth);
    const curBaseH =
      mode === "canvas" || mode === "both"
        ? canvasHeight
        : Math.round(elementsBounds.height || canvasHeight);

    setWidthPx(curBaseW);
    setHeightPx(curBaseH);
    setPercentX(100);
    setPercentY(100);
  }, [mode, canvasWidth, canvasHeight, elements.length]);

  if (!isOpen) return null;

  // Handle Width change in pixels
  const handleWidthPxChange = (val: number) => {
    const nextW = Math.max(1, Math.round(val));
    setWidthPx(nextW);
    const calculatedPercentX = Math.round((nextW / baseWidth) * 100);
    setPercentX(calculatedPercentX);

    if (lockAspectRatio) {
      const nextH = Math.max(1, Math.round(nextW / baseAspect));
      setHeightPx(nextH);
      setPercentY(Math.round((nextH / baseHeight) * 100));
    }
  };

  // Handle Height change in pixels
  const handleHeightPxChange = (val: number) => {
    const nextH = Math.max(1, Math.round(val));
    setHeightPx(nextH);
    const calculatedPercentY = Math.round((nextH / baseHeight) * 100);
    setPercentY(calculatedPercentY);

    if (lockAspectRatio) {
      const nextW = Math.max(1, Math.round(nextH * baseAspect));
      setWidthPx(nextW);
      setPercentX(Math.round((nextW / baseWidth) * 100));
    }
  };

  // Handle Percent X change
  const handlePercentXChange = (val: number) => {
    const nextPctX = Math.max(1, Math.round(val));
    setPercentX(nextPctX);
    const nextW = Math.max(1, Math.round(baseWidth * (nextPctX / 100)));
    setWidthPx(nextW);

    if (lockAspectRatio) {
      setPercentY(nextPctX);
      const nextH = Math.max(1, Math.round(baseHeight * (nextPctX / 100)));
      setHeightPx(nextH);
    }
  };

  // Handle Percent Y change
  const handlePercentYChange = (val: number) => {
    const nextPctY = Math.max(1, Math.round(val));
    setPercentY(nextPctY);
    const nextH = Math.max(1, Math.round(baseHeight * (nextPctY / 100)));
    setHeightPx(nextH);

    if (lockAspectRatio) {
      setPercentX(nextPctY);
      const nextW = Math.max(1, Math.round(baseWidth * (nextPctY / 100)));
      setWidthPx(nextW);
    }
  };

  // Quick preset scale buttons
  const applyPresetPercent = (pct: number) => {
    setPercentX(pct);
    setPercentY(pct);
    setWidthPx(Math.max(1, Math.round(baseWidth * (pct / 100))));
    setHeightPx(Math.max(1, Math.round(baseHeight * (pct / 100))));
  };

  const handleApply = () => {
    const targetW = widthPx;
    const targetH = heightPx;

    if (mode === "canvas") {
      const result = resizeCanvasOnly(
        elements,
        canvasWidth,
        canvasHeight,
        targetW,
        targetH,
        anchor
      );
      onApplyResize({
        canvasWidth: result.newWidth,
        canvasHeight: result.newHeight,
        elements: result.elements,
        message: `Plan de travail redimensionné : ${result.newWidth} × ${result.newHeight} px (${anchor})`,
      });
    } else if (mode === "image") {
      const targetIds =
        selectedElementIds.length > 0 ? selectedElementIds : undefined;
      const updatedElements = resizeElementsOnly(
        elements,
        targetIds,
        targetW,
        targetH,
        anchor,
        scaleStrokes
      );
      onApplyResize({
        elements: updatedElements,
        message: `Image / sélection redimensionnée à ${targetW} × ${targetH} px (${percentX}% × ${percentY}%)`,
      });
    } else {
      // mode === "both"
      const result = resizeImageAndCanvas(
        elements,
        canvasWidth,
        canvasHeight,
        targetW,
        targetH,
        scaleStrokes
      );
      onApplyResize({
        canvasWidth: result.newWidth,
        canvasHeight: result.newHeight,
        elements: result.elements,
        message: `Image & Plan de travail redimensionnés à ${result.newWidth} × ${result.newHeight} px`,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="bg-[#262626] border border-[#3E3E42] rounded-xl shadow-2xl w-full max-w-lg text-neutral-200 overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#1F1F1F] border-b border-[#333333] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#f05a28]/20 text-[#f05a28] rounded-lg">
              <Maximize2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Redimensionner
              </h3>
              <p className="text-[11px] text-neutral-400">
                Ajustez le plan de travail, les images ou les deux simultanément
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white hover:bg-[#333333] rounded-lg transition"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-4 border-b border-[#333333] bg-[#222222]">
          <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
            Cible du redimensionnement
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#181818] rounded-lg border border-[#333333]">
            <button
              type="button"
              onClick={() => setMode("canvas")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-medium transition cursor-pointer ${
                mode === "canvas"
                  ? "bg-[#f05a28] text-white shadow"
                  : "text-neutral-400 hover:text-white hover:bg-[#2A2A2A]"
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span className="truncate">Plan de travail</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("image")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-medium transition cursor-pointer ${
                mode === "image"
                  ? "bg-[#f05a28] text-white shadow"
                  : "text-neutral-400 hover:text-white hover:bg-[#2A2A2A]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="truncate">Image / Calque</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("both")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-medium transition cursor-pointer ${
                mode === "both"
                  ? "bg-[#f05a28] text-white shadow"
                  : "text-neutral-400 hover:text-white hover:bg-[#2A2A2A]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="truncate">Image & Plan</span>
            </button>
          </div>
        </div>

        {/* Main Form Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Unit Toggle & Aspect Ratio Lock Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Unité :</span>
              <div className="flex bg-[#181818] p-0.5 rounded-md border border-[#333333]">
                <button
                  type="button"
                  onClick={() => setUnit("px")}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                    unit === "px"
                      ? "bg-[#3A3A3A] text-white"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Pixels (px)
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("percent")}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                    unit === "percent"
                      ? "bg-[#3A3A3A] text-white"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Pourcentage (%)
                </button>
              </div>
            </div>

            {/* Lock Aspect Ratio Toggle */}
            <button
              type="button"
              onClick={() => setLockAspectRatio(!lockAspectRatio)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition cursor-pointer ${
                lockAspectRatio
                  ? "bg-[#f05a28]/15 border-[#f05a28]/40 text-[#f05a28]"
                  : "bg-[#181818] border-[#333333] text-neutral-400 hover:text-white"
              }`}
              title={
                lockAspectRatio
                  ? "Conserver les proportions (cliquer pour déverrouiller)"
                  : "Proportions libres (cliquer pour conserver le ratio)"
              }
            >
              {lockAspectRatio ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Proportions liées</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Proportions libres</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Presets for Percentages */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
              Préréglages rapides
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[50, 75, 100, 125, 150, 200, 300].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPresetPercent(preset)}
                  className={`px-2.5 py-1 text-[11px] rounded font-medium transition cursor-pointer border ${
                    percentX === preset && percentY === preset
                      ? "bg-[#f05a28] border-[#f05a28] text-white"
                      : "bg-[#1E1E1E] border-[#333333] text-neutral-300 hover:bg-[#2E2E2E] hover:text-white"
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>

          {/* Width and Height Controls */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Width */}
            <div className="bg-[#1C1C1C] p-3 rounded-lg border border-[#333333] space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                <span>Largeur</span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  Base: {baseWidth}px
                </span>
              </label>

              {unit === "px" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    step="1"
                    value={widthPx}
                    onChange={(e) => handleWidthPxChange(Number(e.target.value))}
                    className="w-full bg-[#121212] border border-[#3E3E42] rounded px-2.5 py-1.5 text-sm text-white font-mono focus:border-[#f05a28] focus:outline-none"
                  />
                  <span className="text-xs text-neutral-400 font-mono">px</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="5"
                    value={percentX}
                    onChange={(e) => handlePercentXChange(Number(e.target.value))}
                    className="w-full bg-[#121212] border border-[#3E3E42] rounded px-2.5 py-1.5 text-sm text-white font-mono focus:border-[#f05a28] focus:outline-none"
                  />
                  <span className="text-xs text-neutral-400 font-mono">%</span>
                </div>
              )}

              <div className="text-[10px] text-neutral-400 flex justify-between font-mono pt-0.5">
                <span>{unit === "px" ? `${percentX}%` : `${widthPx} px`}</span>
              </div>
            </div>

            {/* Height */}
            <div className="bg-[#1C1C1C] p-3 rounded-lg border border-[#333333] space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                <span>Hauteur</span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  Base: {baseHeight}px
                </span>
              </label>

              {unit === "px" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    step="1"
                    value={heightPx}
                    onChange={(e) => handleHeightPxChange(Number(e.target.value))}
                    className="w-full bg-[#121212] border border-[#3E3E42] rounded px-2.5 py-1.5 text-sm text-white font-mono focus:border-[#f05a28] focus:outline-none"
                  />
                  <span className="text-xs text-neutral-400 font-mono">px</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="5"
                    value={percentY}
                    onChange={(e) => handlePercentYChange(Number(e.target.value))}
                    className="w-full bg-[#121212] border border-[#3E3E42] rounded px-2.5 py-1.5 text-sm text-white font-mono focus:border-[#f05a28] focus:outline-none"
                  />
                  <span className="text-xs text-neutral-400 font-mono">%</span>
                </div>
              )}

              <div className="text-[10px] text-neutral-400 flex justify-between font-mono pt-0.5">
                <span>{unit === "px" ? `${percentY}%` : `${heightPx} px`}</span>
              </div>
            </div>
          </div>

          {/* Anchor Selector (For Canvas and Image positioning) */}
          <div className="flex items-center justify-between bg-[#1A1A1A] p-3 rounded-lg border border-[#333333]">
            <div>
              <span className="text-xs font-semibold text-neutral-200 block">
                Point d'ancrage (Origine)
              </span>
              <span className="text-[11px] text-neutral-400">
                {anchor === "center"
                  ? "Centré (équilibre les marges)"
                  : anchor === "top-left"
                  ? "Haut-Gauche (maintient l'origine)"
                  : anchor}
              </span>
            </div>

            {/* 3x3 Anchor Grid */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#121212] rounded border border-[#333333]">
              {[
                { id: "top-left", title: "Haut Gauche" },
                { id: "top-center", title: "Haut Centre", disabled: true },
                { id: "top-right", title: "Haut Droite" },
                { id: "mid-left", title: "Milieu Gauche", disabled: true },
                { id: "center", title: "Centre" },
                { id: "mid-right", title: "Milieu Droite", disabled: true },
                { id: "bottom-left", title: "Bas Gauche" },
                { id: "bottom-center", title: "Bas Centre", disabled: true },
                { id: "bottom-right", title: "Bas Droite" },
              ].map((item, idx) => {
                const isSelected = anchor === item.id;
                if (item.disabled) {
                  return (
                    <div
                      key={idx}
                      className="w-5 h-5 rounded bg-[#181818] opacity-30 flex items-center justify-center text-[9px]"
                    >
                      •
                    </div>
                  );
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAnchor(item.id as ResizeAnchor)}
                    title={item.title}
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] transition cursor-pointer ${
                      isSelected
                        ? "bg-[#f05a28] text-white font-bold"
                        : "bg-[#2A2A2A] text-neutral-400 hover:bg-[#3A3A3A] hover:text-white"
                    }`}
                  >
                    •
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stroke Width Scaling Option */}
          {(mode === "image" || mode === "both") && (
            <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scaleStrokes}
                onChange={(e) => setScaleStrokes(e.target.checked)}
                className="rounded border-[#3E3E42] text-[#f05a28] focus:ring-0 bg-[#121212] w-4 h-4 cursor-pointer"
              />
              <span>Mettre à l'échelle les contours et épaisseurs de traits</span>
            </label>
          )}

          {/* Real-time Summary Card */}
          <div className="bg-[#181818] p-3 rounded-lg border border-[#2D2D2D] text-xs space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-[11px]">
              <span>Cible active :</span>
              <span className="text-neutral-200 font-medium">
                {mode === "canvas"
                  ? "Plan de travail"
                  : mode === "image"
                  ? selectedElements.length > 0
                    ? `${selectedElements.length} élément(s) sélectionné(s)`
                    : `Tous les éléments (${elements.length})`
                  : "Plan de travail + Ensemble des éléments"}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-300 font-mono text-[12px] pt-1 border-t border-[#262626]">
              <span>
                {baseWidth} × {baseHeight} px
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#f05a28]" />
              <span className="text-[#f05a28] font-bold">
                {widthPx} × {heightPx} px
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-[#1F1F1F] border-t border-[#333333] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setWidthPx(baseWidth);
              setHeightPx(baseHeight);
              setPercentX(100);
              setPercentY(100);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 hover:text-white hover:bg-[#333333] rounded-lg transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-[#333333] rounded-lg transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-[#f05a28] hover:bg-[#e04f20] text-white rounded-lg shadow-md transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Appliquer</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

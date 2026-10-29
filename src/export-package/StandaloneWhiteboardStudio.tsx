import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  PenTool,
  PenLine,
  Pen,
  Pencil,
  Cylinder,
  Feather,
  Brush,
  Paintbrush,
  RectangleHorizontal,
  RectangleVertical,
  Droplet,
  Compass,
  Ruler,
  Eraser,
  Type,
  Square,
  Circle,
  ArrowRight,
  Download,
  Printer,
  Camera,
  Trash2,
  Undo2,
  Redo2,
  Grid,
  Sun,
  Moon,
  Sparkles,
  Maximize2,
  Minimize2,
  Check,
  Plus,
  X,
  Move,
  RotateCw,
  Highlighter,
  Shapes,
  Palette,
  Eye,
  ChevronDown,
  Sliders,
  FileText,
  RotateCcw,
  CircleDot,
  Upload,
  Copy
} from "lucide-react";

// ==========================================
// 1. Types & Data Structures
// ==========================================

export type BoardMode = "whiteboard" | "blackboard" | "paperboard";

export type ToolType =
  | "marker"
  | "thin_marker"
  | "bullet_marker"
  | "chalk"
  | "wet_sponge"
  | "pencil"
  | "fountain_pen"
  | "brush"
  | "highlighter"
  | "eraser"
  | "line"
  | "arrow"
  | "rect"
  | "circle"
  | "triangle"
  | "text";

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
  speed?: number;
}

export interface DrawingStroke {
  id: string;
  tool: ToolType;
  points: StrokePoint[];
  color: string;
  size: number;
  mode: BoardMode;
  text?: string;
  fontSize?: number;
}

export interface WhiteboardSnapshot {
  id: string;
  timestamp: string;
  dataUrl: string;
  mode: BoardMode;
}

export interface StandaloneWhiteboardStudioProps {
  initialMode?: BoardMode;
  className?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: (fullscreen: boolean) => void;
  triggerToast?: (message: string) => void;
  onExportPNG?: (dataUrl: string) => void;
  onExportJSON?: (jsonString: string) => void;
}

// Preset color palettes
const WHITEBOARD_COLORS = [
  { name: "Noir Intégral", value: "#1e293b" },
  { name: "Bleu Marine", value: "#1d4ed8" },
  { name: "Rouge Intense", value: "#dc2626" },
  { name: "Vert Émeraude", value: "#047857" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Orange", value: "#ea580c" },
];

const BLACKBOARD_CHALK_COLORS = [
  { name: "Craie Blanche", value: "#f8fafc" },
  { name: "Craie Jaune", value: "#fef08a" },
  { name: "Craie Cyan", value: "#a5f3fc" },
  { name: "Craie Rose", value: "#fbcfe8" },
  { name: "Craie Menthe", value: "#bbf7d0" },
  { name: "Craie Pêche", value: "#fed7aa" },
];

const PAPERBOARD_COLORS = [
  { name: "Graphite HB", value: "#262626" },
  { name: "Encre Bleue", value: "#1d4ed8" },
  { name: "Rouge Feutre", value: "#dc2626" },
  { name: "Vert Forêt", value: "#15803d" },
  { name: "Sépia Brun", value: "#78350f" },
  { name: "Orange Sanguine", value: "#ea580c" },
  { name: "Violet Encre", value: "#7e22ce" },
  { name: "Lavis Ciel", value: "#0ea5e9" },
  { name: "Rose Pivoine", value: "#db2777" },
];

// Technical scale constants
const RULER_PIXELS_PER_CM = 20;
const RULER_TOTAL_CM = 30;
const RULER_MARGIN_X = 5;

// ==========================================
// 2. Geometry Instrument Sub-components
// ==========================================

interface StandaloneRulerProps {
  pos: { x: number; y: number };
  angle: number;
  onPosChange: (pos: { x: number; y: number }) => void;
  onAngleChange: (angle: number) => void;
  onClose: () => void;
  onOpenLineModal: () => void;
  boardMode: BoardMode;
}

const StandaloneRuler: React.FC<StandaloneRulerProps> = ({
  pos,
  angle,
  onPosChange,
  onAngleChange,
  onClose,
  onOpenLineModal,
  boardMode,
}) => {
  const PIXELS_PER_CM = RULER_PIXELS_PER_CM;
  const TOTAL_CM = RULER_TOTAL_CM;
  const MARGIN_X = RULER_MARGIN_X;
  const RULER_WIDTH = TOTAL_CM * PIXELS_PER_CM + MARGIN_X * 2;
  const RULER_HEIGHT = 58;

  const [isDraggingBody, setIsDraggingBody] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isRotating, setIsRotating] = useState(false);
  const rotateStartRef = useRef<{
    startTime: number;
    startX: number;
    startY: number;
    initialAngle: number;
    hasMoved: boolean;
  } | null>(null);

  const getRulerCenter = () => {
    const rad = (angle * Math.PI) / 180;
    const cxLocal = RULER_WIDTH / 2;
    const cyLocal = RULER_HEIGHT / 2;
    const cxRotated = cxLocal * Math.cos(rad) - cyLocal * Math.sin(rad);
    const cyRotated = cxLocal * Math.sin(rad) + cyLocal * Math.cos(rad);
    return { x: pos.x + cxRotated, y: pos.y + cyRotated };
  };

  const handleBodyPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingBody(true);
    dragStartRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  const handleBodyPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingBody) return;
    onPosChange({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleBodyPointerUp = (e: React.PointerEvent) => {
    if (isDraggingBody) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDraggingBody(false);
    }
  };

  const handleRotatePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    rotateStartRef.current = {
      startTime: Date.now(),
      startX: e.clientX,
      startY: e.clientY,
      initialAngle: angle,
      hasMoved: false,
    };
    setIsRotating(true);
  };

  const handleRotatePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isRotating || !rotateStartRef.current) return;
    const start = rotateStartRef.current;
    const dist = Math.hypot(e.clientX - start.startX, e.clientY - start.startY);

    if (dist > 3 || Date.now() - start.startTime > 180) {
      start.hasMoved = true;
      const center = getRulerCenter();
      const currentPointerAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x) * (180 / Math.PI);
      const startPointerAngle = Math.atan2(start.startY - center.y, start.startX - center.x) * (180 / Math.PI);
      let newAngle = (start.initialAngle + (currentPointerAngle - startPointerAngle)) % 360;
      if (newAngle < 0) newAngle += 360;

      const snapTargets = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
      for (const target of snapTargets) {
        if (Math.abs(newAngle - target) <= 2.5) {
          newAngle = target % 360;
          break;
        }
      }
      onAngleChange(Math.round(newAngle * 10) / 10);
    }
  };

  const handleRotatePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (rotateStartRef.current) {
      const { startTime, hasMoved } = rotateStartRef.current;
      const duration = Date.now() - startTime;
      if (!hasMoved && duration < 240) {
        onAngleChange((Math.round(angle / 15) * 15 + 15) % 360);
      }
    }
    setIsRotating(false);
    rotateStartRef.current = null;
  };

  const isDark = boardMode === "blackboard";
  const isPaper = boardMode === "paperboard";
  const rulerBgClass = isDark
    ? "bg-amber-950/80 border-amber-500/70 text-amber-200 backdrop-blur-md"
    : isPaper
    ? "bg-amber-100/95 border-amber-700/80 text-amber-950 shadow-xl"
    : "bg-amber-50/90 border-amber-600/70 text-amber-950 backdrop-blur-sm shadow-xl";

  const tickColor = isDark ? "#fef08a" : "#78350f";
  const subTickColor = isDark ? "rgba(254, 240, 138, 0.45)" : "rgba(120, 53, 15, 0.4)";

  return (
    <div
      className={`absolute z-20 pointer-events-auto border-2 rounded-md shadow-2xl flex flex-col justify-between select-none cursor-move transition-shadow ${rulerBgClass}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: RULER_WIDTH,
        height: RULER_HEIGHT,
        transform: `rotate(${angle}deg)`,
        transformOrigin: "top left",
        boxShadow: isRotating
          ? "0 20px 35px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(245, 158, 11, 0.4)"
          : "0 10px 25px -5px rgba(0, 0, 0, 0.35)",
      }}
      onPointerDown={handleBodyPointerDown}
      onPointerMove={handleBodyPointerMove}
      onPointerUp={handleBodyPointerUp}
      onPointerCancel={handleBodyPointerUp}
    >
      <div className="relative w-full h-8 overflow-hidden border-b border-amber-500/30">
        <svg
          className="absolute inset-0 w-full h-full"
          width={RULER_WIDTH}
          height={32}
          viewBox={`0 0 ${RULER_WIDTH} 32`}
        >
          {Array.from({ length: TOTAL_CM * 10 + 1 }).map((_, mmIdx) => {
            const x = MARGIN_X + (mmIdx * PIXELS_PER_CM) / 10;
            const isCm = mmIdx % 10 === 0;
            const isHalfCm = mmIdx % 5 === 0 && !isCm;
            const tickH = isCm ? 16 : isHalfCm ? 10 : 5;
            return (
              <line
                key={mmIdx}
                x1={x}
                y1={0}
                x2={x}
                y2={tickH}
                stroke={isCm ? tickColor : subTickColor}
                strokeWidth={isCm ? 1.5 : 1}
              />
            );
          })}
          {Array.from({ length: TOTAL_CM + 1 }).map((_, cm) => {
            const x = MARGIN_X + cm * PIXELS_PER_CM;
            return (
              <text
                key={`label-${cm}`}
                x={x}
                y={26}
                fontSize={cm >= 20 ? 8 : 9}
                fontFamily="ui-monospace, monospace"
                fontWeight="700"
                textAnchor="middle"
                fill={tickColor}
              >
                {cm}
              </text>
            );
          })}
        </svg>
        <span
          className="absolute right-1 top-0.5 text-[7px] font-mono font-bold tracking-tight opacity-60"
          style={{ color: tickColor }}
        >
          cm
        </span>
      </div>

      <div className="flex items-center justify-between px-2.5 py-1 bg-amber-950/10 border-t border-amber-500/20 text-[10px]">
        <div className="flex items-center gap-1.5 font-bold tracking-wide">
          <Move className="w-3 h-3 opacity-60" />
          <span>Règle (30 cm)</span>
          <span className="ml-1 px-1.5 py-0.2 bg-amber-500/20 rounded font-mono text-[9px] border border-amber-500/30">
            {angle.toFixed(0)}°
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenLineModal();
            }}
            className="px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition text-[9px] bg-amber-400/30 hover:bg-amber-400/50 text-amber-900 dark:text-amber-200 border border-amber-500/40 cursor-pointer shadow-sm active:scale-95"
            title="Tracer un segment de droite précis"
          >
            <PenLine className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Tracer Ligne</span>
          </button>

          <button
            onPointerDown={handleRotatePointerDown}
            onPointerMove={handleRotatePointerMove}
            onPointerUp={handleRotatePointerUp}
            onPointerCancel={handleRotatePointerUp}
            className={`px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition text-[9px] cursor-grab active:cursor-grabbing ${
              isRotating
                ? "bg-amber-500 text-amber-950 shadow-md scale-105"
                : "bg-amber-400/30 hover:bg-amber-400/50 text-amber-900 dark:text-amber-200 border border-amber-500/40"
            }`}
            title="Clic: +15° | Glisser: Rotation libre continue"
          >
            <RotateCw className={`w-3 h-3 ${isRotating ? "animate-spin" : ""}`} />
            <span>{isRotating ? `${angle.toFixed(1)}°` : "Pivoter"}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-rose-500/20 hover:text-rose-500 transition text-slate-500 dark:text-slate-400"
            title="Masquer la règle"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface StandaloneRulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTraceLine: (startCm: number, endCm: number) => void;
}

const StandaloneRulerModal: React.FC<StandaloneRulerModalProps> = ({
  isOpen,
  onClose,
  onTraceLine,
}) => {
  const [startCm, setStartCm] = useState(0);
  const [endCm, setEndCm] = useState(30);

  if (!isOpen) return null;

  const minCm = Math.min(startCm, endCm);
  const maxCm = Math.max(startCm, endCm);
  const lengthCm = Math.round((maxCm - minCm) * 10) / 10;
  const lengthPx = Math.round(lengthCm * 20);

  const handleCommit = () => {
    onTraceLine(minCm, maxCm);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Tracer une Ligne à la Règle</h3>
              <p className="text-[11px] text-slate-400">Règle métrique de 30 cm</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Départ (cm)</label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                value={startCm}
                onChange={(e) => setStartCm(Math.max(0, Math.min(30, parseFloat(e.target.value) || 0)))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Fin (cm)</label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                value={endCm}
                onChange={(e) => setEndCm(Math.max(0, Math.min(30, parseFloat(e.target.value) || 0)))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Longueur du segment :</span>
            <span className="font-mono font-bold text-amber-400">{lengthCm} cm ({lengthPx} px)</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleCommit}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Tracer le segment</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StandaloneCompassProps {
  center: { x: number; y: number };
  radius: number;
  angle: number;
  color: string;
  boardMode: BoardMode;
  onCenterChange: (center: { x: number; y: number }) => void;
  onRadiusChange: (radius: number) => void;
  onAngleChange: (angle: number) => void;
  onOpenArcModal: () => void;
  onDirectDrawCircle: () => void;
  onClose: () => void;
}

const StandaloneCompass: React.FC<StandaloneCompassProps> = ({
  center,
  radius,
  angle,
  color,
  boardMode,
  onCenterChange,
  onRadiusChange,
  onAngleChange,
  onOpenArcModal,
  onDirectDrawCircle,
  onClose,
}) => {
  const [isDraggingCenter, setIsDraggingCenter] = useState(false);
  const [isDraggingRadius, setIsDraggingRadius] = useState(false);
  const [isRotatingCompass, setIsRotatingCompass] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleNeedlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingCenter(true);
    dragStartRef.current = { x: e.clientX - center.x, y: e.clientY - center.y };
  };

  const handleNeedlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingCenter) return;
    onCenterChange({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleNeedlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingCenter) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDraggingCenter(false);
    }
  };

  const handlePencilPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingRadius(true);
  };

  const handlePencilPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRadius) return;
    const dx = e.clientX - center.x;
    const dy = e.clientY - center.y;
    const dist = Math.hypot(dx, dy);
    const clampedRadius = Math.max(25, Math.min(450, Math.round(dist)));
    onRadiusChange(clampedRadius);
    const newAngle = Math.atan2(dy, dx);
    onAngleChange(newAngle);
  };

  const handlePencilPointerUp = (e: React.PointerEvent) => {
    if (isDraggingRadius) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDraggingRadius(false);
    }
  };

  const handleApexPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsRotatingCompass(true);
  };

  const handleApexPointerMove = (e: React.PointerEvent) => {
    if (!isRotatingCompass) return;
    const dx = e.clientX - center.x;
    const dy = e.clientY - center.y;
    const newAngle = Math.atan2(dy, dx) - Math.PI / 2;
    onAngleChange(newAngle);
  };

  const handleApexPointerUp = (e: React.PointerEvent) => {
    if (isRotatingCompass) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsRotatingCompass(false);
    }
  };

  const pencilX = center.x + radius * Math.cos(angle);
  const pencilY = center.y + radius * Math.sin(angle);
  const midX = (center.x + pencilX) / 2;
  const midY = (center.y + pencilY) / 2;
  const legLength = 175;
  const halfDist = radius / 2;
  const legHeight = Math.max(70, Math.sqrt(Math.max(1600, legLength * legLength - halfDist * halfDist)));

  const perpAngle = angle - Math.PI / 2;
  const apexX = midX + legHeight * Math.cos(perpAngle);
  const apexY = midY + legHeight * Math.sin(perpAngle);

  const spindleAnchorX = center.x + (apexX - center.x) * 0.45;
  const spindleAnchorY = center.y + (apexY - center.y) * 0.45;
  const spindlePencilX = pencilX + (apexX - pencilX) * 0.45;
  const spindlePencilY = pencilY + (apexY - pencilY) * 0.45;
  const spindleMidX = (spindleAnchorX + spindlePencilX) / 2;
  const spindleMidY = (spindleAnchorY + spindlePencilY) / 2;

  const knobApexX = apexX + 32 * Math.cos(perpAngle);
  const knobApexY = apexY + 32 * Math.sin(perpAngle);
  const displayDeg = Math.round(((angle * 180) / Math.PI + 360) % 360);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-visible select-none">
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <circle
          cx={center.x}
          cy={center.y}
          r={radius}
          fill="none"
          stroke={boardMode === "blackboard" ? "rgba(148, 163, 184, 0.25)" : "rgba(99, 102, 241, 0.3)"}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <line x1={center.x - 12} y1={center.y} x2={center.x + 12} y2={center.y} stroke="#6366f1" strokeWidth="1" opacity="0.8" />
        <line x1={center.x} y1={center.y - 12} x2={center.x} y2={center.y + 12} stroke="#6366f1" strokeWidth="1" opacity="0.8" />
      </svg>

      <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
        <defs>
          <linearGradient id="standaloneSteel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="standaloneBrass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
        </defs>

        <g>
          <line x1={spindleAnchorX} y1={spindleAnchorY} x2={spindlePencilX} y2={spindlePencilY} stroke="#475569" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx={spindleMidX} cy={spindleMidY} r="8" fill="url(#standaloneBrass)" stroke="#78350f" strokeWidth="1.2" />
          <line x1={apexX} y1={apexY} x2={center.x} y2={center.y} stroke="url(#standaloneSteel)" strokeWidth="7" strokeLinecap="round" />
          <line x1={apexX} y1={apexY} x2={pencilX} y2={pencilY} stroke="url(#standaloneSteel)" strokeWidth="7" strokeLinecap="round" />
          <circle cx={apexX} cy={apexY} r="9" fill="url(#standaloneBrass)" stroke="#78350f" strokeWidth="1.5" />
          <line x1={apexX} y1={apexY} x2={knobApexX} y2={knobApexY} stroke="url(#standaloneSteel)" strokeWidth="5" strokeLinecap="round" />
          <circle cx={knobApexX} cy={knobApexY} r="7" fill="url(#standaloneBrass)" stroke="#78350f" strokeWidth="1.2" />
          <circle cx={pencilX} cy={pencilY} r="5" fill={color} stroke="#ffffff" strokeWidth="1.5" />
        </g>
      </svg>

      <div
        className="absolute pointer-events-auto cursor-move -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-dashed border-indigo-400 bg-indigo-500/20 hover:bg-indigo-500/40 flex items-center justify-center transition"
        style={{ left: center.x, top: center.y }}
        onPointerDown={handleNeedlePointerDown}
        onPointerMove={handleNeedlePointerMove}
        onPointerUp={handleNeedlePointerUp}
        title="Glisser pour déplacer la pointe sèche"
      >
        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />
      </div>

      <div
        className="absolute pointer-events-auto cursor-ew-resize -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/40 flex items-center justify-center transition"
        style={{ left: pencilX, top: pencilY }}
        onPointerDown={handlePencilPointerDown}
        onPointerMove={handlePencilPointerMove}
        onPointerUp={handlePencilPointerUp}
        title="Glisser pour modifier le rayon et l'orbite"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
      </div>

      <div
        className="absolute pointer-events-auto cursor-grab active:cursor-grabbing -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full border-2 border-amber-400 bg-amber-500/30 hover:bg-amber-500/50 flex items-center justify-center transition"
        style={{ left: knobApexX, top: knobApexY }}
        onPointerDown={handleApexPointerDown}
        onPointerMove={handleApexPointerMove}
        onPointerUp={handleApexPointerUp}
        title="Faire pivoter la molette du compas"
      >
        <RotateCw className="w-4 h-4 text-amber-300" />
      </div>

      <div
        className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-700 shadow-xl backdrop-blur-md text-slate-200"
        style={{ left: spindleMidX, top: spindleMidY - 36 }}
      >
        <span className="text-[10px] font-mono font-bold text-amber-400 px-1.5">
          R: {Math.round(radius / 20 * 10) / 10} cm ({radius}px) · {displayDeg}°
        </span>
        <button
          onClick={onDirectDrawCircle}
          className="px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[10px] flex items-center gap-1 transition"
          title="Tracer le cercle complet"
        >
          <CircleDot className="w-3 h-3" />
          <span>Cercle</span>
        </button>
        <button
          onClick={onOpenArcModal}
          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[10px] flex items-center gap-1 transition border border-slate-700"
          title="Tracer un arc de cercle paramétrique"
        >
          <span>Arc</span>
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition"
          title="Fermer le compas"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface StandaloneCompassModalProps {
  isOpen: boolean;
  onClose: () => void;
  radius: number;
  onTraceArc: (params: {
    startAngleRad: number;
    endAngleRad: number;
    clockwise: boolean;
  }) => void;
}

const StandaloneCompassModal: React.FC<StandaloneCompassModalProps> = ({
  isOpen,
  onClose,
  radius,
  onTraceArc,
}) => {
  const [startDeg, setStartDeg] = useState(0);
  const [endDeg, setEndDeg] = useState(120);
  const [clockwise, setClockwise] = useState(true);

  if (!isOpen) return null;

  const handleCommit = () => {
    const startAngleRad = (startDeg * Math.PI) / 180;
    const endAngleRad = (endDeg * Math.PI) / 180;
    onTraceArc({ startAngleRad, endAngleRad, clockwise });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Tracer un Arc de Cercle</h3>
              <p className="text-[11px] text-slate-400">Rayon actuel : {Math.round(radius / 20 * 10) / 10} cm</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Angle Départ (°)</label>
              <input
                type="number"
                min="0"
                max="360"
                value={startDeg}
                onChange={(e) => setStartDeg(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Angle Fin (°)</label>
              <input
                type="number"
                min="0"
                max="360"
                value={endDeg}
                onChange={(e) => setEndDeg(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <span className="text-slate-400">Sens de rotation :</span>
            <button
              onClick={() => setClockwise(!clockwise)}
              className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold"
            >
              {clockwise ? "Horaire (Sens des aiguilles)" : "Trigonométrique (Anti-horaire)"}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition">
              Annuler
            </button>
            <button
              onClick={handleCommit}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Tracer l'arc</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. Main Standalone Whiteboard Studio
// ==========================================

export function StandaloneWhiteboardStudio({
  initialMode = "whiteboard",
  className = "",
  isFullscreen: externalIsFullscreen,
  onToggleFullscreen,
  triggerToast,
  onExportPNG,
  onExportJSON,
}: StandaloneWhiteboardStudioProps) {
  // Board configuration state
  const [boardMode, setBoardMode] = useState<BoardMode>(initialMode);
  const [activeTool, setActiveTool] = useState<ToolType>("marker");
  const [currentColor, setCurrentColor] = useState<string>(WHITEBOARD_COLORS[0].value);
  const [strokeSize, setStrokeSize] = useState<number>(4);
  const [gridOverlay, setGridOverlay] = useState<"none" | "grid" | "lines" | "dots">("none");

  // History & Stored Strokes
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [history, setHistory] = useState<DrawingStroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Text insertion state
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState("");

  // Geometry Instruments
  const [isRulerActive, setIsRulerActive] = useState(false);
  const [rulerPos, setRulerPos] = useState({ x: 120, y: 160 });
  const [rulerAngle, setRulerAngle] = useState(0);
  const [isRulerModalOpen, setIsRulerModalOpen] = useState(false);

  const [isCompassActive, setIsCompassActive] = useState(false);
  const [compassCenter, setCompassCenter] = useState({ x: 340, y: 300 });
  const [compassRadius, setCompassRadius] = useState(120);
  const [compassAngle, setCompassAngle] = useState(0);
  const [isCompassModalOpen, setIsCompassModalOpen] = useState(false);

  // Snapshot Gallery
  const [snapshots, setSnapshots] = useState<WhiteboardSnapshot[]>([]);
  const [isSnapshotGalleryOpen, setIsSnapshotGalleryOpen] = useState(false);

  // Export menu
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isFullscreen = externalIsFullscreen !== undefined ? externalIsFullscreen : internalFullscreen;

  // DOM Canvas References
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);
  const isDrawingRef = useRef(false);

  // Local notification toast
  const [localToast, setLocalToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    if (triggerToast) {
      triggerToast(msg);
    } else {
      setLocalToast(msg);
      setTimeout(() => setLocalToast(null), 3000);
    }
  }, [triggerToast]);

  // Sync default color on board mode change
  useEffect(() => {
    if (boardMode === "whiteboard") {
      setCurrentColor(WHITEBOARD_COLORS[0].value);
      setActiveTool("marker");
      setStrokeSize(4);
    } else if (boardMode === "blackboard") {
      setCurrentColor(BLACKBOARD_CHALK_COLORS[0].value);
      setActiveTool("chalk");
      setStrokeSize(6);
    } else {
      setCurrentColor(PAPERBOARD_COLORS[0].value);
      setActiveTool("fountain_pen");
      setStrokeSize(3);
    }
  }, [boardMode]);

  // Synchronize history states
  const pushToHistory = useCallback((newStrokes: DrawingStroke[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newStrokes);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex]);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setStrokes([]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex]);
    }
  }, [history, historyIndex]);

  const clearBoard = useCallback(() => {
    if (strokes.length === 0) return;
    pushToHistory([]);
    setStrokes([]);
    showToast("Tableau effacé.");
  }, [strokes, pushToHistory, showToast]);

  // Render stroke routine on HTML5 Canvas
  const renderStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    const { tool, points, color, size, text, fontSize } = stroke;
    if (points.length === 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "chalk") {
      // Textured blackboard chalk
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.globalAlpha = 0.85;

      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Realistic chalk dust jitter particles
        const steps = Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 4);
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const px = p1.x + (p2.x - p1.x) * t;
          const py = p1.y + (p2.y - p1.y) * t;
          const jitterX = (Math.random() - 0.5) * (size * 0.9);
          const jitterY = (Math.random() - 0.5) * (size * 0.9);
          ctx.fillStyle = color;
          ctx.globalAlpha = Math.random() * 0.35 + 0.1;
          ctx.fillRect(px + jitterX, py + jitterY, 1.5, 1.5);
        }
      }
    } else if (tool === "wet_sponge") {
      // Water wash sponge eraser for blackboard
      ctx.strokeStyle = "rgba(20, 26, 31, 0.45)";
      ctx.lineWidth = size * 2.5;
      for (let i = 1; i < points.length; i++) {
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
        ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }
    } else if (tool === "highlighter") {
      // Translucent rectangular chisel marker
      ctx.strokeStyle = color;
      ctx.lineWidth = size * 2.5;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    } else if (tool === "eraser") {
      // Board eraser
      ctx.strokeStyle = boardMode === "blackboard" ? "#141a1f" : boardMode === "paperboard" ? "#faf8f2" : "#fdfefe";
      ctx.lineWidth = size * 2;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    } else if (tool === "fountain_pen") {
      // Dynamic calligraphy pen
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        const speed = p2.speed || 1;
        const dynamicWidth = Math.max(1, size * (1.3 / (speed * 0.4 + 1)));
        ctx.lineWidth = dynamicWidth;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    } else if (tool === "line" && points.length >= 2) {
      const p1 = points[0];
      const p2 = points[points.length - 1];
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (tool === "arrow" && points.length >= 2) {
      const p1 = points[0];
      const p2 = points[points.length - 1];
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Arrow head
      const headlen = Math.max(10, size * 2.5);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headlen * Math.cos(angle - Math.PI / 6), p2.y - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(p2.x - headlen * Math.cos(angle + Math.PI / 6), p2.y - headlen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (tool === "rect" && points.length >= 2) {
      const p1 = points[0];
      const p2 = points[points.length - 1];
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    } else if (tool === "circle" && points.length >= 2) {
      const p1 = points[0];
      const p2 = points[points.length - 1];
      const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool === "triangle" && points.length >= 2) {
      const p1 = points[0];
      const p2 = points[points.length - 1];
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(p1.x + (p2.x - p1.x) / 2, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p1.x, p2.y);
      ctx.closePath();
      ctx.stroke();
    } else if (tool === "text" && text) {
      ctx.fillStyle = color;
      ctx.font = `${fontSize || 20}px 'Inter', sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(text, points[0].x, points[0].y);
    } else {
      // Standard marker / pencil
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }, [boardMode]);

  // Main canvas redraw loop
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background texture
    if (boardMode === "blackboard") {
      ctx.fillStyle = "#141a1f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (boardMode === "paperboard") {
      ctx.fillStyle = "#faf8f2";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#fdfefe";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw grid overlays
    if (gridOverlay === "grid") {
      ctx.strokeStyle = boardMode === "blackboard" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 1;
      const step = 25;
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    } else if (gridOverlay === "lines") {
      ctx.strokeStyle = boardMode === "blackboard" ? "rgba(255, 255, 255, 0.1)" : "rgba(30, 64, 175, 0.12)";
      ctx.lineWidth = 1;
      for (let y = 40; y < canvas.height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    } else if (gridOverlay === "dots") {
      ctx.fillStyle = boardMode === "blackboard" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)";
      const step = 24;
      for (let x = step / 2; x < canvas.width; x += step) {
        for (let y = step / 2; y < canvas.height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Render strokes
    for (const stroke of strokes) {
      renderStroke(ctx, stroke);
    }

    // Render active drawing stroke
    if (currentStrokeRef.current) {
      renderStroke(ctx, currentStrokeRef.current);
    }
  }, [boardMode, gridOverlay, strokes, renderStroke]);

  // Resize canvas to match element container
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      redrawCanvas();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Pointer event handlers for drawing
  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, time: Date.now() };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      time: Date.now(),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === "text") {
      const pos = getPointerPos(e);
      setTextInputPos(pos);
      setTextInputValue("");
      return;
    }

    const pos = getPointerPos(e);
    isDrawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const newStroke: DrawingStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tool: activeTool,
      points: [pos],
      color: currentColor,
      size: strokeSize,
      mode: boardMode,
    };
    currentStrokeRef.current = newStroke;
    redrawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const pos = getPointerPos(e);
    const stroke = currentStrokeRef.current;
    const lastPoint = stroke.points[stroke.points.length - 1];

    if (lastPoint) {
      const dist = Math.hypot(pos.x - lastPoint.x, pos.y - lastPoint.y);
      const timeDiff = Math.max(1, (pos.time || Date.now()) - (lastPoint.time || Date.now()));
      pos.speed = dist / timeDiff;
    }

    stroke.points.push(pos);
    redrawCanvas();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const completedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (completedStroke.points.length > 0) {
      const updated = [...strokes, completedStroke];
      setStrokes(updated);
      pushToHistory(updated);
    }
    redrawCanvas();
  };

  // Add geometric ruler line
  const handleTraceRulerLine = (startCm: number, endCm: number) => {
    const PIXELS_PER_CM = RULER_PIXELS_PER_CM;
    const MARGIN_X = RULER_MARGIN_X;
    const rad = (rulerAngle * Math.PI) / 180;

    const startXLocal = MARGIN_X + startCm * PIXELS_PER_CM;
    const endXLocal = MARGIN_X + endCm * PIXELS_PER_CM;

    const p1 = {
      x: rulerPos.x + startXLocal * Math.cos(rad),
      y: rulerPos.y + startXLocal * Math.sin(rad),
    };
    const p2 = {
      x: rulerPos.x + endXLocal * Math.cos(rad),
      y: rulerPos.y + endXLocal * Math.sin(rad),
    };

    const newStroke: DrawingStroke = {
      id: `stroke-ruler-${Date.now()}`,
      tool: "line",
      points: [p1, p2],
      color: currentColor,
      size: strokeSize,
      mode: boardMode,
    };

    const updated = [...strokes, newStroke];
    setStrokes(updated);
    pushToHistory(updated);
    showToast(`Segment tracé (${Math.round((endCm - startCm) * 10) / 10} cm)`);
  };

  // Trace circle with compass
  const handleTraceCompassCircle = () => {
    const points: StrokePoint[] = [];
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      points.push({
        x: compassCenter.x + compassRadius * Math.cos(theta),
        y: compassCenter.y + compassRadius * Math.sin(theta),
      });
    }

    const newStroke: DrawingStroke = {
      id: `stroke-compass-circle-${Date.now()}`,
      tool: activeTool === "chalk" ? "chalk" : "line",
      points,
      color: currentColor,
      size: strokeSize,
      mode: boardMode,
    };

    const updated = [...strokes, newStroke];
    setStrokes(updated);
    pushToHistory(updated);
    showToast(`Cercle tracé (R = ${Math.round(compassRadius / 20 * 10) / 10} cm)`);
  };

  // Trace arc with compass
  const handleTraceCompassArc = ({
    startAngleRad,
    endAngleRad,
    clockwise,
  }: {
    startAngleRad: number;
    endAngleRad: number;
    clockwise: boolean;
  }) => {
    const points: StrokePoint[] = [];
    const steps = 48;
    let diff = endAngleRad - startAngleRad;
    if (clockwise && diff < 0) diff += Math.PI * 2;
    if (!clockwise && diff > 0) diff -= Math.PI * 2;

    for (let i = 0; i <= steps; i++) {
      const theta = startAngleRad + (diff * i) / steps;
      points.push({
        x: compassCenter.x + compassRadius * Math.cos(theta),
        y: compassCenter.y + compassRadius * Math.sin(theta),
      });
    }

    const newStroke: DrawingStroke = {
      id: `stroke-compass-arc-${Date.now()}`,
      tool: activeTool === "chalk" ? "chalk" : "line",
      points,
      color: currentColor,
      size: strokeSize,
      mode: boardMode,
    };

    const updated = [...strokes, newStroke];
    setStrokes(updated);
    pushToHistory(updated);
    showToast("Arc de cercle tracé");
  };

  // Text insertion commit
  const handleCommitText = () => {
    if (!textInputPos || !textInputValue.trim()) {
      setTextInputPos(null);
      setTextInputValue("");
      return;
    }

    const newStroke: DrawingStroke = {
      id: `stroke-text-${Date.now()}`,
      tool: "text",
      points: [textInputPos],
      color: currentColor,
      size: strokeSize,
      mode: boardMode,
      text: textInputValue,
      fontSize: Math.max(16, strokeSize * 5),
    };

    const updated = [...strokes, newStroke];
    setStrokes(updated);
    pushToHistory(updated);
    setTextInputPos(null);
    setTextInputValue("");
  };

  // Snapshots
  const takeSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const newSnapshot: WhiteboardSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      dataUrl,
      mode: boardMode,
    };
    setSnapshots([newSnapshot, ...snapshots]);
    showToast("Instantané enregistré dans la galerie !");
  };

  // Export functions
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    if (onExportPNG) {
      onExportPNG(dataUrl);
    } else {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `tableau-${boardMode}-${Date.now()}.png`;
      a.click();
    }
    showToast("Image PNG téléchargée avec succès !");
  };

  const handleExportJSON = () => {
    const json = JSON.stringify({ boardMode, strokes, timestamp: Date.now() }, null, 2);
    if (onExportJSON) {
      onExportJSON(json);
    } else {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tableau-session-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    showToast("Session vectorielle exportée en JSON !");
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen(!isFullscreen);
    } else {
      setInternalFullscreen(!internalFullscreen);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[500px] flex flex-col overflow-hidden select-none bg-slate-950 font-sans ${className} ${
        isFullscreen ? "fixed inset-0 z-50 !h-screen !w-screen" : ""
      }`}
    >
      {/* 1. Header Toolbar */}
      <div className="shrink-0 h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-3 z-30">
        {/* Left: Board Style Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setBoardMode("whiteboard")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              boardMode === "whiteboard"
                ? "bg-white text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Tableau Blanc</span>
          </button>

          <button
            onClick={() => setBoardMode("blackboard")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              boardMode === "blackboard"
                ? "bg-emerald-950 text-emerald-200 border border-emerald-500/40 shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Tableau Noir</span>
          </button>

          <button
            onClick={() => setBoardMode("paperboard")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              boardMode === "paperboard"
                ? "bg-amber-100 text-amber-950 shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Paperboard</span>
          </button>
        </div>

        {/* Center: Quick History & Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={historyIndex < 0}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            title="Rétablir (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Grid overlay selector */}
          <button
            onClick={() => {
              const modes: ("none" | "grid" | "lines" | "dots")[] = ["none", "grid", "lines", "dots"];
              const next = modes[(modes.indexOf(gridOverlay) + 1) % modes.length];
              setGridOverlay(next);
            }}
            className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
              gridOverlay !== "none"
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                : "bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
            title="Changer le quadrillage d'arrière-plan"
          >
            <Grid className="w-4 h-4" />
            <span className="text-[10px] uppercase font-bold hidden md:inline">{gridOverlay}</span>
          </button>

          {/* Ruler toggle */}
          <button
            onClick={() => setIsRulerActive(!isRulerActive)}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isRulerActive
                ? "bg-amber-500/20 border-amber-400 text-amber-300"
                : "bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
            title="Activer la Règle métrique de 30 cm"
          >
            <Ruler className="w-4 h-4" />
          </button>

          {/* Compass toggle */}
          <button
            onClick={() => setIsCompassActive(!isCompassActive)}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isCompassActive
                ? "bg-indigo-500/20 border-indigo-400 text-indigo-300"
                : "bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
            title="Activer le Compas de précision"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Export Menu & Canvas Controls */}
        <div className="flex items-center gap-2">
          {/* Snapshots camera */}
          <button
            onClick={takeSnapshot}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer relative"
            title="Capturer un instantané"
          >
            <Camera className="w-4 h-4" />
            {snapshots.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-500 text-white rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold">
                {snapshots.length}
              </span>
            )}
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 hover:brightness-110 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exporter</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-xl">
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportPNG();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition text-left cursor-pointer"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <div>
                    <p className="text-xs font-semibold">Télécharger PNG</p>
                    <p className="text-[10px] text-slate-400">Image HD avec fond de tableau</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportJSON();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition text-left cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <div>
                    <p className="text-xs font-semibold">Sauvegarder JSON</p>
                    <p className="text-[10px] text-slate-400">Tracés vectoriels complets</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handlePrint();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition text-left cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-xs font-semibold">Imprimer / PDF</p>
                    <p className="text-[10px] text-slate-400">Format d'impression vectoriel</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Clear board */}
          <button
            onClick={clearBoard}
            className="p-2 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 hover:bg-rose-900/60 transition cursor-pointer"
            title="Effacer le tableau"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Primary Canvas Workspace */}
      <div className="relative flex-1 w-full h-full overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute inset-0 w-full h-full touch-none"
        />

        {/* Text insertion popup input */}
        {textInputPos && (
          <div
            className="absolute z-40 bg-slate-900 border border-indigo-500 rounded-xl p-2 shadow-2xl flex items-center gap-2"
            style={{ left: textInputPos.x, top: textInputPos.y }}
          >
            <input
              type="text"
              autoFocus
              placeholder="Écrire sur le tableau..."
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCommitText();
                if (e.key === "Escape") setTextInputPos(null);
              }}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-56"
            />
            <button
              onClick={handleCommitText}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs"
            >
              OK
            </button>
            <button
              onClick={() => setTextInputPos(null)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Geometry Instrument Overlays */}
        {isRulerActive && (
          <StandaloneRuler
            pos={rulerPos}
            angle={rulerAngle}
            onPosChange={setRulerPos}
            onAngleChange={setRulerAngle}
            onClose={() => setIsRulerActive(false)}
            onOpenLineModal={() => setIsRulerModalOpen(true)}
            boardMode={boardMode}
          />
        )}

        {isCompassActive && (
          <StandaloneCompass
            center={compassCenter}
            radius={compassRadius}
            angle={compassAngle}
            color={currentColor}
            boardMode={boardMode}
            onCenterChange={setCompassCenter}
            onRadiusChange={setCompassRadius}
            onAngleChange={setCompassAngle}
            onOpenArcModal={() => setIsCompassModalOpen(true)}
            onDirectDrawCircle={handleTraceCompassCircle}
            onClose={() => setIsCompassActive(false)}
          />
        )}
      </div>

      {/* 3. Floating Bottom Tools Palette */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-slate-900/95 border border-slate-800 p-2 rounded-2xl shadow-2xl backdrop-blur-md">
        {/* Pens & Drawing Tools */}
        <div className="flex items-center gap-1 border-r border-slate-800 pr-2">
          {boardMode === "blackboard" ? (
            <>
              <button
                onClick={() => setActiveTool("chalk")}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  activeTool === "chalk" ? "bg-amber-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
                title="Craie blanche ou colorée"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool("wet_sponge")}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  activeTool === "wet_sponge" ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
                title="Éponge humide (nettoyage craie)"
              >
                <Droplet className="w-4 h-4" />
              </button>
            </>
          ) : boardMode === "paperboard" ? (
            <>
              <button
                onClick={() => setActiveTool("fountain_pen")}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  activeTool === "fountain_pen" ? "bg-amber-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
                title="Plume calligraphique"
              >
                <Feather className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool("pencil")}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  activeTool === "pencil" ? "bg-amber-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
                title="Crayon de papier HB"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTool("marker")}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  activeTool === "marker" ? "bg-cyan-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
                title="Feutre effaçable à sec"
              >
                <PenTool className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool("highlighter")}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  activeTool === "highlighter" ? "bg-yellow-300 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
                title="Surligneur biseauté"
              >
                <Highlighter className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTool("eraser")}
            className={`p-2 rounded-xl transition cursor-pointer ${
              activeTool === "eraser" ? "bg-rose-500 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
            title="Gomme"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Shapes & Text */}
        <div className="flex items-center gap-1 border-r border-slate-800 pr-2">
          <button
            onClick={() => setActiveTool("line")}
            className={`p-2 rounded-xl transition cursor-pointer ${
              activeTool === "line" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Ligne droite"
          >
            <PenLine className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool("arrow")}
            className={`p-2 rounded-xl transition cursor-pointer ${
              activeTool === "arrow" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Flèche"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool("rect")}
            className={`p-2 rounded-xl transition cursor-pointer ${
              activeTool === "rect" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Rectangle"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool("circle")}
            className={`p-2 rounded-xl transition cursor-pointer ${
              activeTool === "circle" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Cercle"
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool("text")}
            className={`p-2 rounded-xl transition cursor-pointer ${
              activeTool === "text" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Texte"
          >
            <Type className="w-4 h-4" />
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-1.5 border-r border-slate-800 pr-2">
          {(boardMode === "blackboard"
            ? BLACKBOARD_CHALK_COLORS
            : boardMode === "paperboard"
            ? PAPERBOARD_COLORS
            : WHITEBOARD_COLORS
          ).slice(0, 6).map((col) => (
            <button
              key={col.value}
              onClick={() => setCurrentColor(col.value)}
              className={`w-6 h-6 rounded-full transition-transform cursor-pointer border ${
                currentColor === col.value ? "scale-125 border-white ring-2 ring-indigo-500" : "border-slate-700"
              }`}
              style={{ backgroundColor: col.value }}
              title={col.name}
            />
          ))}
        </div>

        {/* Stroke Size Slider */}
        <div className="flex items-center gap-2 pl-1">
          <input
            type="range"
            min="2"
            max="28"
            value={strokeSize}
            onChange={(e) => setStrokeSize(parseInt(e.target.value, 10))}
            className="w-20 accent-indigo-500 cursor-pointer"
            title={`Épaisseur du trait: ${strokeSize}px`}
          />
          <span className="text-[10px] font-mono text-slate-400 w-5">{strokeSize}p</span>
        </div>
      </div>

      {/* 4. Modals */}
      <StandaloneRulerModal
        isOpen={isRulerModalOpen}
        onClose={() => setIsRulerModalOpen(false)}
        onTraceLine={handleTraceRulerLine}
      />

      <StandaloneCompassModal
        isOpen={isCompassModalOpen}
        onClose={() => setIsCompassModalOpen(false)}
        radius={compassRadius}
        onTraceArc={handleTraceCompassArc}
      />

      {/* Snapshot Gallery Drawer */}
      {isSnapshotGalleryOpen && (
        <div className="absolute inset-y-0 right-0 w-80 bg-slate-900/98 border-l border-slate-800 shadow-2xl z-50 p-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-400" />
              <span>Galerie d'instantanés ({snapshots.length})</span>
            </h3>
            <button
              onClick={() => setIsSnapshotGalleryOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {snapshots.map((snap) => (
              <div key={snap.id} className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <img src={snap.dataUrl} alt="Snapshot" className="w-full rounded-lg border border-slate-700/50" />
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{snap.timestamp}</span>
                  <a
                    href={snap.dataUrl}
                    download={`snapshot-${snap.id}.png`}
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Télécharger</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local Toast Alert */}
      {localToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-cyan-500/50 text-cyan-200 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{localToast}</span>
        </div>
      )}
    </div>
  );
}

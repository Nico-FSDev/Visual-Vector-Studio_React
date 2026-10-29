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
  Presentation,
  Share2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Sliders,
  FileText,
  Code2
} from "lucide-react";
import { ExportToSlideModal } from "./ExportToSlideModal";
import { ExportWhiteboardCodeModal } from "./ExportWhiteboardCodeModal";
import { RulerTool, RULER_MARGIN_X, RULER_PIXELS_PER_CM } from "./geometry/RulerTool";
import { RulerLineModal } from "./geometry/RulerLineModal";
import { DraftingCompass } from "./geometry/DraftingCompass";
import { CompassArcModal } from "./geometry/CompassArcModal";

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

const WHITEBOARD_COLORS = [
  { name: "Noir", value: "#1e293b" },
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

export interface WhiteboardStudioProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: (isFullscreen: boolean) => void;
  geminiApiKey?: string;
  triggerToast?: (msg: string) => void;
  maxHistorySteps?: number;
  enableCanvasGridPerf?: boolean;
  performanceQuality?: string;
  onExportAsLogoUrl?: (url: string) => void;
  isAdmin?: boolean;
}

export function WhiteboardStudio({
  isFullscreen: externalIsFullscreen,
  onToggleFullscreen,
  geminiApiKey,
  triggerToast: externalTriggerToast,
  isAdmin = false,
}: WhiteboardStudioProps = {}) {
  // Board configuration state
  const [boardMode, setBoardMode] = useState<BoardMode>("whiteboard");
  const [activeTool, setActiveTool] = useState<ToolType>("thin_marker");
  const [color, setColor] = useState<string>(WHITEBOARD_COLORS[0].value);
  const [strokeSize, setStrokeSize] = useState<number>(5);
  const [bgPattern, setBgPattern] = useState<"blank" | "grid" | "lines" | "dots">("grid");
  const [internalIsFullscreen, setInternalIsFullscreen] = useState(false);
  const isFullscreen = externalIsFullscreen !== undefined ? externalIsFullscreen : internalIsFullscreen;

  // Dropdown Export Menu & Google Slides Modal state
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [slideCanvasDataUrl, setSlideCanvasDataUrl] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isExportMenuOpen]);

  const handleOpenSlideExport = () => {
    setIsExportMenuOpen(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setSlideCanvasDataUrl(dataUrl);
    setIsSlideModalOpen(true);
  };

  const toggleFullscreen = (targetState?: boolean) => {
    const nextVal = targetState !== undefined ? targetState : !isFullscreen;
    setInternalIsFullscreen(nextVal);
    onToggleFullscreen?.(nextVal);
    showToast(nextVal ? "Mode plein écran activé (bandeau supérieur masqué)" : "Mode normal restauré");
  };

  // Undo / Redo history
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [history, setHistory] = useState<DrawingStroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Active drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);

  // Text insertion state
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);

  // Interactive Educational Overlay Tools
  const [showRuler, setShowRuler] = useState(false);
  const [rulerPos, setRulerPos] = useState({ x: 150, y: 250 });
  const [rulerAngle, setRulerAngle] = useState(0);
  const [rulerLength, setRulerLength] = useState(400);
  const [isDraggingRuler, setIsDraggingRuler] = useState(false);
  const [rulerDragStart, setRulerDragStart] = useState({ x: 0, y: 0 });
  const [showRulerLineModal, setShowRulerLineModal] = useState(false);

  const [showCompass, setShowCompass] = useState(false);
  const [compassCenter, setCompassCenter] = useState({ x: 450, y: 300 });
  const [compassRadius, setCompassRadius] = useState(120);
  const [compassAngle, setCompassAngle] = useState(0);
  const [isDraggingCompass, setIsDraggingCompass] = useState(false);
  const [isSettingRadius, setIsSettingRadius] = useState(false);
  const [showCompassArcModal, setShowCompassArcModal] = useState(false);

  const [showProtractor, setShowProtractor] = useState(false);
  const [protractorPos, setProtractorPos] = useState({ x: 300, y: 200 });
  const [protractorAngle, setProtractorAngle] = useState(0);

  // Progressive Disclosure Floating Tooltip (Stage 1: Tool Name, Stage 2: Long press Description)
  interface FloatingTooltipState {
    x: number;
    y: number;
    name: string;
    description: string;
    isLongPressed: boolean;
  }
  const [floatingTooltip, setFloatingTooltip] = useState<FloatingTooltipState | null>(null);
  const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleToolPointerEnter = (e: React.PointerEvent<HTMLElement>, name: string, description: string) => {
    if (e.pointerType === "touch") return; // Touch interactions handled via onPointerDown
    const rect = e.currentTarget.getBoundingClientRect();
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    setFloatingTooltip({
      x: rect.right + 12,
      y: rect.top + rect.height / 2,
      name,
      description,
      isLongPressed: false,
    });

    longPressTimerRef.current = setTimeout(() => {
      setFloatingTooltip((prev) => (prev ? { ...prev, isLongPressed: true } : null));
    }, 550);
  };

  const handleToolPointerDown = (e: React.PointerEvent<HTMLElement>, name: string, description: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    // Initial short hold triggers Stage 1 (Name)
    tooltipTimerRef.current = setTimeout(() => {
      setFloatingTooltip({
        x: rect.right + 12,
        y: rect.top + rect.height / 2,
        name,
        description,
        isLongPressed: false,
      });
    }, 150);

    // Sustained long press triggers Stage 2 (Description)
    longPressTimerRef.current = setTimeout(() => {
      setFloatingTooltip((prev) => (prev ? { ...prev, isLongPressed: true } : null));
    }, 600);
  };

  const handleToolPointerLeaveOrUp = () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    setFloatingTooltip(null);
  };

  // Snapshots / Export gallery
  const [snapshots, setSnapshots] = useState<WhiteboardSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<WhiteboardSnapshot | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Collapsible Toolboxes
  const [isLeftPaletteCollapsed, setIsLeftPaletteCollapsed] = useState(false);
  const [isBottomBarCollapsed, setIsBottomBarCollapsed] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-adapt tool & color when changing Board Mode (Whiteboard <-> Blackboard <-> Paperboard)
  useEffect(() => {
    if (boardMode === "blackboard") {
      if (!["chalk", "wet_sponge", "highlighter", "eraser", "line", "arrow", "rect", "circle", "triangle", "text"].includes(activeTool)) {
        setActiveTool("chalk");
      }
      setColor(BLACKBOARD_CHALK_COLORS[0].value);
    } else if (boardMode === "paperboard") {
      if (!["pencil", "fountain_pen", "brush", "marker", "highlighter", "eraser", "line", "arrow", "rect", "circle", "triangle", "text"].includes(activeTool)) {
        setActiveTool("pencil");
      }
      setColor(PAPERBOARD_COLORS[0].value);
    } else {
      // Whiteboard mode
      if (!["thin_marker", "bullet_marker", "highlighter", "eraser", "line", "arrow", "rect", "circle", "triangle", "text"].includes(activeTool)) {
        setActiveTool("thin_marker");
      }
      setColor(WHITEBOARD_COLORS[0].value);
    }
  }, [boardMode]);

  // Escape key handler for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        toggleFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    externalTriggerToast?.(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Push to history helper
  const pushState = (newStrokes: DrawingStroke[]) => {
    const newHist = history.slice(0, historyIndex + 1);
    newHist.push(newStrokes);
    setHistory(newHist);
    setHistoryIndex(newHist.length - 1);
    setStrokes(newStrokes);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setStrokes(history[prevIndex]);
      showToast("Action annulée");
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setStrokes([]);
      showToast("Tableau réinitialisé");
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setStrokes(history[nextIndex]);
      showToast("Action rétablie");
    }
  };

  const clearBoard = () => {
    if (strokes.length === 0) return;
    if (window.confirm("Voulez-vous vraiment effacer tout le tableau ?")) {
      pushState([]);
      showToast("Tableau effacé");
    }
  };

  /**
   * Traces a smooth, continuous path through sampled points using midpoint quadratic Bézier splines.
   * Completely eliminates polyline angular stepping and input jitter.
   */
  const traceSmoothedPath = (ctx: CanvasRenderingContext2D, points: StrokePoint[]) => {
    if (points.length === 0) return;
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, Math.max(1, ctx.lineWidth / 2), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  };

  // Render Canvas Content
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    if (width <= 0 || height <= 0) return;

    // Prepare Offscreen Canvas for Stroke Layer
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
    }
    const offscreen = offscreenCanvasRef.current;
    if (offscreen.width !== width || offscreen.height !== height) {
      offscreen.width = width;
      offscreen.height = height;
    }
    const ctxOff = offscreen.getContext("2d");
    if (!ctxOff) return;

    // Clear main canvas and offscreen layer
    ctx.clearRect(0, 0, width, height);
    ctxOff.clearRect(0, 0, width, height);

    // 1. Draw Background on Main Canvas (ctx)
    if (boardMode === "whiteboard") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Background Pattern for Whiteboard
      if (bgPattern === "grid") {
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        const gridSize = 30;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (bgPattern === "lines") {
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1;
        const lineSpacing = 32;
        for (let y = lineSpacing; y < height; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (bgPattern === "dots") {
        ctx.fillStyle = "#cbd5e1";
        const dotSpacing = 30;
        for (let x = 15; x < width; x += dotSpacing) {
          for (let y = 15; y < height; y += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else if (boardMode === "blackboard") {
      // Blackboard / Slate Mode
      ctx.fillStyle = "#1b232a";
      ctx.fillRect(0, 0, width, height);

      // Blackboard Texture/Grain
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      if (bgPattern === "grid") {
        const gridSize = 30;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (bgPattern === "lines") {
        const lineSpacing = 32;
        for (let y = lineSpacing; y < height; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (bgPattern === "dots") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        const dotSpacing = 30;
        for (let x = 15; x < width; x += dotSpacing) {
          for (let y = 15; y < height; y += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else {
      // Paperboard / Chevalet de conférence
      ctx.fillStyle = "#faf7ee";
      ctx.fillRect(0, 0, width, height);

      // Paper fiber texture (soft warm tooth)
      ctx.fillStyle = "rgba(180, 160, 130, 0.035)";
      for (let gx = 0; gx < width; gx += 45) {
        for (let gy = 32; gy < height; gy += 45) {
          ctx.fillRect(gx + (gx % 9), gy + (gy % 13), 1.5, 1.5);
        }
      }

      // Top flipchart clamp binding strip
      ctx.fillStyle = "#ebe4d5";
      ctx.fillRect(0, 0, width, 26);
      ctx.strokeStyle = "#d6cbba";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 26);
      ctx.lineTo(width, 26);
      ctx.stroke();

      // Perforation tear line
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(160, 140, 120, 0.4)";
      ctx.moveTo(0, 34);
      ctx.lineTo(width, 34);
      ctx.stroke();
      ctx.restore();

      // 2 flipchart hole punches with metal grommets
      const punchHoles = [width * 0.28, width * 0.72];
      punchHoles.forEach((hx) => {
        // Shadow
        ctx.beginPath();
        ctx.arc(hx, 14, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
        ctx.fill();
        // Cutout hole
        ctx.beginPath();
        ctx.arc(hx, 13, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#1e293b";
        ctx.fill();
        // Grommet ring
        ctx.beginPath();
        ctx.arc(hx, 13, 7, 0, Math.PI * 2);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Paperboard Guidelines Pattern
      if (bgPattern === "grid") {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.32)";
        ctx.lineWidth = 1;
        const gridSize = 28;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 34);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 34; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else if (bgPattern === "lines") {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
        ctx.lineWidth = 1;
        const lineSpacing = 32;
        for (let y = 34 + lineSpacing; y < height; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        // French margin line
        ctx.beginPath();
        ctx.strokeStyle = "rgba(244, 63, 94, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(70, 34);
        ctx.lineTo(70, height);
        ctx.stroke();
      } else if (bgPattern === "dots") {
        ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
        const dotSpacing = 28;
        for (let x = 14; x < width; x += dotSpacing) {
          for (let y = 48; y < height; y += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 2. Render all completed strokes & active stroke on Offscreen Layer (ctxOff)
    const allStrokesToRender = [...strokes];
    if (isDrawing && currentPoints.length > 0) {
      allStrokesToRender.push({
        id: "active",
        tool: activeTool,
        points: currentPoints,
        color: color,
        size: strokeSize,
        mode: boardMode,
      });
    }

    allStrokesToRender.forEach((stroke) => {
      if (stroke.points.length === 0) return;

      ctxOff.save();

      if (stroke.tool === "eraser") {
        if (stroke.mode === "blackboard" || boardMode === "blackboard") {
          // Blackboard Buffer: High-strength contact clearing (~96% per pass) with wide footprint
          ctxOff.save();
          ctxOff.globalCompositeOperation = "destination-out";
          ctxOff.globalAlpha = 0.96;
          ctxOff.lineWidth = stroke.size * 6.2;
          ctxOff.lineCap = "square";
          ctxOff.lineJoin = "miter";
          traceSmoothedPath(ctxOff, stroke.points);
          ctxOff.restore();

          // Subtle chalk dust streak / residue along the buffer wipe path
          ctxOff.save();
          ctxOff.globalCompositeOperation = "source-over";
          ctxOff.strokeStyle = "rgba(240, 244, 252, 0.028)";
          ctxOff.lineWidth = stroke.size * 4.2;
          ctxOff.lineCap = "square";
          ctxOff.lineJoin = "bevel";
          traceSmoothedPath(ctxOff, stroke.points);

          // Subtle internal felt sweep streaks
          ctxOff.strokeStyle = "rgba(240, 244, 252, 0.012)";
          ctxOff.lineWidth = stroke.size * 2.0;
          traceSmoothedPath(ctxOff, stroke.points);
          ctxOff.restore();
        } else if (stroke.mode === "paperboard" || boardMode === "paperboard") {
          // Paperboard Gomme douce mie de pain (kneaded rubber eraser)
          ctxOff.globalCompositeOperation = "destination-out";
          ctxOff.globalAlpha = 0.78;
          ctxOff.lineWidth = stroke.size * 3.0;
          ctxOff.lineCap = "round";
          ctxOff.lineJoin = "round";
          traceSmoothedPath(ctxOff, stroke.points);
        } else {
          // Whiteboard magnetic felt eraser (crisp, complete wipe)
          ctxOff.globalCompositeOperation = "destination-out";
          ctxOff.globalAlpha = 1.0;
          ctxOff.lineWidth = stroke.size * 3.4;
          ctxOff.lineCap = "round";
          ctxOff.lineJoin = "round";
          traceSmoothedPath(ctxOff, stroke.points);
        }
      } else if (stroke.tool === "thin_marker") {
        // Whiteboard Thin Marker: Crisp dry-erase solvent ink, continuous capillary feed, smooth Bézier curves
        ctxOff.strokeStyle = stroke.color;
        ctxOff.lineWidth = Math.max(1.5, stroke.size * 0.58);
        ctxOff.lineCap = "round";
        ctxOff.lineJoin = "round";
        ctxOff.globalAlpha = 0.96;
        traceSmoothedPath(ctxOff, stroke.points);

        // Micro solvent pooling at stroke start & stop points
        if (stroke.points.length > 0) {
          ctxOff.fillStyle = stroke.color;
          ctxOff.globalAlpha = 0.98;
          const pStart = stroke.points[0];
          const pEnd = stroke.points[stroke.points.length - 1];
          const beadR = Math.max(1.2, stroke.size * 0.38);
          ctxOff.beginPath();
          ctxOff.arc(pStart.x, pStart.y, beadR, 0, Math.PI * 2);
          ctxOff.arc(pEnd.x, pEnd.y, beadR, 0, Math.PI * 2);
          ctxOff.fill();
        }
      } else if (stroke.tool === "bullet_marker") {
        // Whiteboard Bullet-Tip Marker: Rounded polymer ogive tip with velocity modulation & specular highlight
        ctxOff.save();
        ctxOff.lineCap = "round";
        ctxOff.lineJoin = "round";

        // Base saturated rounded stroke
        ctxOff.strokeStyle = stroke.color;
        ctxOff.lineWidth = stroke.size * 1.42;
        ctxOff.globalAlpha = 0.98;
        traceSmoothedPath(ctxOff, stroke.points);

        // Distinct glossy specular highlight line along the center (whiteboard enamel reflection)
        ctxOff.strokeStyle = "rgba(255, 255, 255, 0.32)";
        ctxOff.lineWidth = Math.max(1, stroke.size * 0.32);
        traceSmoothedPath(ctxOff, stroke.points);

        // Organic start/end ink pooling
        if (stroke.points.length > 0) {
          ctxOff.fillStyle = stroke.color;
          ctxOff.globalAlpha = 0.98;
          const pStart = stroke.points[0];
          const pEnd = stroke.points[stroke.points.length - 1];
          const beadR = stroke.size * 0.76;
          ctxOff.beginPath();
          ctxOff.arc(pStart.x, pStart.y, beadR, 0, Math.PI * 2);
          ctxOff.arc(pEnd.x, pEnd.y, beadR, 0, Math.PI * 2);
          ctxOff.fill();
        }
        ctxOff.restore();
      } else if (stroke.tool === "chalk") {
        // Blackboard Chalk: Porous calcium carbonate stick on slate with velocity chatter & dust spatter
        ctxOff.save();
        ctxOff.strokeStyle = stroke.color;
        ctxOff.fillStyle = stroke.color;
        ctxOff.lineCap = "round";
        ctxOff.lineJoin = "round";

        if (stroke.points.length === 1) {
          ctxOff.globalAlpha = 0.92;
          ctxOff.beginPath();
          ctxOff.arc(stroke.points[0].x, stroke.points[0].y, stroke.size * 0.5, 0, Math.PI * 2);
          ctxOff.fill();
        } else {
          for (let i = 0; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i];
            const p2 = stroke.points[i + 1];
            const segSpeed = p2.speed ?? 0.3;

            // Velocity-sensitive coverage: slow = dense opaque chalk, fast = skipping chalk
            const density = Math.max(0.35, Math.min(1.0, 1.08 - segSpeed * 0.52));
            const chalkWidth = stroke.size * (0.82 + 0.32 * density);

            ctxOff.lineWidth = chalkWidth;
            ctxOff.globalAlpha = 0.92 * density;

            ctxOff.beginPath();
            ctxOff.moveTo(p1.x, p1.y);
            if (i < stroke.points.length - 2) {
              const p3 = stroke.points[i + 2];
              const midX = (p2.x + p3.x) / 2;
              const midY = (p2.y + p3.y) / 2;
              ctxOff.quadraticCurveTo(p2.x, p2.y, midX, midY);
            } else {
              ctxOff.lineTo(p2.x, p2.y);
            }
            ctxOff.stroke();

            // Porous calcium carbonate grain and microscopic chalk dust spatter along slate pits
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const steps = Math.floor((dist / 2.8) * density);
            for (let s = 0; s < steps; s++) {
              const t = s / Math.max(1, steps);
              const rx = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * chalkWidth * 1.35;
              const ry = p1.y + (p2.y - p1.y) * t + (Math.random() - 0.5) * chalkWidth * 1.35;
              ctxOff.globalAlpha = (0.16 + Math.random() * 0.38) * density;
              const grainSize = Math.random() * 1.8 + 0.8;
              ctxOff.fillRect(rx, ry, grainSize, grainSize);
            }
          }
        }
        ctxOff.restore();
      } else if (stroke.tool === "wet_sponge") {
        // Blackboard Wet Sponge: Deep chalk clearance with damp slate darkening trail
        ctxOff.save();

        // 1. Total erasure of chalk
        ctxOff.globalCompositeOperation = "destination-out";
        ctxOff.lineWidth = stroke.size * 6.2;
        ctxOff.lineCap = "round";
        ctxOff.lineJoin = "round";
        ctxOff.globalAlpha = 1.0;
        traceSmoothedPath(ctxOff, stroke.points);

        // 2. Damp slate sheen trail
        ctxOff.globalCompositeOperation = "source-over";
        ctxOff.strokeStyle = "rgba(10, 16, 24, 0.16)";
        ctxOff.lineWidth = stroke.size * 6.4;
        ctxOff.lineCap = "round";
        ctxOff.lineJoin = "round";
        traceSmoothedPath(ctxOff, stroke.points);

        ctxOff.restore();
      } else if (stroke.tool === "pencil") {
        // Paperboard Graphite HB Pencil: Graphite friction & organic micro-tooth texture on paper
        ctxOff.save();
        ctxOff.strokeStyle = stroke.color;
        ctxOff.fillStyle = stroke.color;
        ctxOff.lineCap = "round";
        ctxOff.lineJoin = "round";

        for (let i = 0; i < stroke.points.length - 1; i++) {
          const p1 = stroke.points[i];
          const p2 = stroke.points[i + 1];
          const segSpeed = p2.speed ?? 0.3;
          const speedScale = Math.max(0.68, Math.min(1.15, 1.18 - segSpeed * 0.38));
          const pencilWidth = Math.max(1, stroke.size * 0.45 * speedScale);

          ctxOff.lineWidth = pencilWidth;
          ctxOff.globalAlpha = 0.88 * speedScale;

          // Core smooth graphite stroke
          ctxOff.beginPath();
          ctxOff.moveTo(p1.x, p1.y);
          if (i < stroke.points.length - 2) {
            const p3 = stroke.points[i + 2];
            ctxOff.quadraticCurveTo(p2.x, p2.y, (p2.x + p3.x) / 2, (p2.y + p3.y) / 2);
          } else {
            ctxOff.lineTo(p2.x, p2.y);
          }
          ctxOff.stroke();

          // Organic graphite micro-grain on cellulose paper tooth
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const steps = Math.floor(dist / 2.2);
          for (let s = 0; s < steps; s++) {
            const t = s / Math.max(1, steps);
            const rx = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * pencilWidth * 1.3;
            const ry = p1.y + (p2.y - p1.y) * t + (Math.random() - 0.5) * pencilWidth * 1.3;
            ctxOff.globalAlpha = 0.14 + Math.random() * 0.32;
            ctxOff.fillRect(rx, ry, 1, 1);
          }
        }
        ctxOff.restore();
      } else if (stroke.tool === "fountain_pen") {
        // Paperboard Fountain Pen: Split-tine nib calligraphy with dynamic angle width & capillary ink pooling
        ctxOff.save();
        ctxOff.strokeStyle = stroke.color;
        ctxOff.fillStyle = stroke.color;
        ctxOff.lineCap = "round";
        ctxOff.lineJoin = "round";

        for (let i = 0; i < stroke.points.length - 1; i++) {
          const p1 = stroke.points[i];
          const p2 = stroke.points[i + 1];
          const segSpeed = p2.speed ?? 0.3;

          // 45° nib angle calculation
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const calligFactor = Math.abs(Math.cos(angle - Math.PI / 4));
          const speedTaper = Math.max(0.55, 1.12 - segSpeed * 0.35);
          const nibWidth = Math.max(
            1.2,
            stroke.size * (0.32 + 0.95 * calligFactor) * speedTaper
          );

          ctxOff.lineWidth = nibWidth;
          ctxOff.globalAlpha = 0.95;

          ctxOff.beginPath();
          ctxOff.moveTo(p1.x, p1.y);
          if (i < stroke.points.length - 2) {
            const p3 = stroke.points[i + 2];
            ctxOff.quadraticCurveTo(p2.x, p2.y, (p2.x + p3.x) / 2, (p2.y + p3.y) / 2);
          } else {
            ctxOff.lineTo(p2.x, p2.y);
          }
          ctxOff.stroke();

          // Capillary ink pooling at turning points / pauses
          if (segSpeed < 0.22) {
            ctxOff.globalAlpha = 0.97;
            ctxOff.beginPath();
            ctxOff.arc(p2.x, p2.y, nibWidth * 0.85, 0, Math.PI * 2);
            ctxOff.fill();
          }
        }
        ctxOff.restore();
      } else if (stroke.tool === "highlighter") {
        if (stroke.mode === "blackboard" || boardMode === "blackboard") {
          // Beveled Blackboard Chalk
          ctxOff.save();
          ctxOff.strokeStyle = stroke.color;
          ctxOff.fillStyle = stroke.color;
          ctxOff.lineCap = "butt";
          ctxOff.lineJoin = "miter";
          ctxOff.globalAlpha = 0.88;
          for (let i = 0; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i];
            const p2 = stroke.points[i + 1];
            const dx = stroke.size * 1.25;
            const dy = -stroke.size * 1.25;
            ctxOff.beginPath();
            ctxOff.moveTo(p1.x - dx, p1.y - dy);
            ctxOff.lineTo(p1.x + dx, p1.y + dy);
            ctxOff.lineTo(p2.x + dx, p2.y + dy);
            ctxOff.lineTo(p2.x - dx, p2.y - dy);
            ctxOff.closePath();
            ctxOff.fill();
          }
          ctxOff.restore();
        } else {
          // Directional Chisel Highlighter (Whiteboard & Paperboard)
          ctxOff.save();
          ctxOff.globalAlpha = stroke.mode === "paperboard" || boardMode === "paperboard" ? 0.38 : 0.35;
          ctxOff.strokeStyle = stroke.color;
          ctxOff.lineCap = "square";
          ctxOff.lineJoin = "bevel";

          for (let i = 0; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i];
            const p2 = stroke.points[i + 1];
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            // Directional width: thin when moving parallel to 35° chisel edge, wide when perpendicular
            const chiselFactor = Math.abs(Math.sin(angle - Math.PI / 5));
            ctxOff.lineWidth = Math.max(stroke.size * 0.9, stroke.size * (0.9 + 2.3 * chiselFactor));

            ctxOff.beginPath();
            ctxOff.moveTo(p1.x, p1.y);
            ctxOff.lineTo(p2.x, p2.y);
            ctxOff.stroke();
          }
          ctxOff.restore();
        }
      } else if (stroke.tool === "brush") {
        if (stroke.mode === "paperboard" || boardMode === "paperboard") {
          // Authentic Watercolor Wash on Paperboard with multi-layer pigment & coffee-ring drying
          ctxOff.save();
          ctxOff.globalCompositeOperation = "multiply";
          ctxOff.lineCap = "round";
          ctxOff.lineJoin = "round";

          // Pass 1: Soft outer wet wash halo (water diffusion)
          ctxOff.globalAlpha = 0.16;
          ctxOff.strokeStyle = stroke.color;
          ctxOff.lineWidth = stroke.size * 2.6;
          traceSmoothedPath(ctxOff, stroke.points);

          // Pass 2: Main watercolor wash body
          ctxOff.globalAlpha = 0.30;
          ctxOff.lineWidth = stroke.size * 1.6;
          traceSmoothedPath(ctxOff, stroke.points);

          // Pass 3: Concentrated core pigment with organic paper bleeding
          ctxOff.globalAlpha = 0.44;
          ctxOff.lineWidth = stroke.size * 0.88;
          traceSmoothedPath(ctxOff, stroke.points);

          // Pass 4: "Coffee-ring" edge pigment concentration
          ctxOff.globalAlpha = 0.22;
          ctxOff.lineWidth = stroke.size * 1.75;
          traceSmoothedPath(ctxOff, stroke.points);

          ctxOff.restore();
        } else {
          ctxOff.globalAlpha = 0.9;
          ctxOff.strokeStyle = stroke.color;
          ctxOff.lineWidth = stroke.size * 1.5;
          ctxOff.lineCap = "round";
          ctxOff.lineJoin = "round";
          traceSmoothedPath(ctxOff, stroke.points);
        }
      } else if (stroke.tool === "marker") {
        // Paperboard Felt Pen / Marker: Saturated dye ink absorbed into paper fibers with multiply blending
        ctxOff.save();
        if (stroke.mode === "paperboard" || boardMode === "paperboard") {
          ctxOff.globalCompositeOperation = "multiply";
          ctxOff.globalAlpha = 0.82;
        } else {
          ctxOff.globalAlpha = 0.94;
        }
        ctxOff.strokeStyle = stroke.color;
        ctxOff.lineWidth = stroke.size * 1.35;
        ctxOff.lineCap = "round";
        ctxOff.lineJoin = "round";
        traceSmoothedPath(ctxOff, stroke.points);

        // Capillary bleed pooling at start/stop
        if (stroke.points.length > 0) {
          ctxOff.fillStyle = stroke.color;
          const pStart = stroke.points[0];
          const pEnd = stroke.points[stroke.points.length - 1];
          const bleedR = stroke.size * 0.72;
          ctxOff.beginPath();
          ctxOff.arc(pStart.x, pStart.y, bleedR, 0, Math.PI * 2);
          ctxOff.arc(pEnd.x, pEnd.y, bleedR, 0, Math.PI * 2);
          ctxOff.fill();
        }
        ctxOff.restore();
      } else if (
        stroke.tool === "line" ||
        stroke.tool === "arrow" ||
        stroke.tool === "rect" ||
        stroke.tool === "circle" ||
        stroke.tool === "triangle"
      ) {
        ctxOff.strokeStyle = stroke.color;
        ctxOff.lineWidth = stroke.size;
        ctxOff.lineCap = "round";
        ctxOff.lineJoin = "round";

        const pStart = stroke.points[0];
        const pEnd = stroke.points[stroke.points.length - 1];

        if (stroke.tool === "line") {
          ctxOff.beginPath();
          ctxOff.moveTo(pStart.x, pStart.y);
          ctxOff.lineTo(pEnd.x, pEnd.y);
          ctxOff.stroke();
        } else if (stroke.tool === "arrow") {
          ctxOff.beginPath();
          ctxOff.moveTo(pStart.x, pStart.y);
          ctxOff.lineTo(pEnd.x, pEnd.y);
          ctxOff.stroke();

          // Arrow head
          const angle = Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x);
          const headLen = 14 + stroke.size * 1.5;
          ctxOff.beginPath();
          ctxOff.moveTo(pEnd.x, pEnd.y);
          ctxOff.lineTo(
            pEnd.x - headLen * Math.cos(angle - Math.PI / 6),
            pEnd.y - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctxOff.lineTo(
            pEnd.x - headLen * Math.cos(angle + Math.PI / 6),
            pEnd.y - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctxOff.closePath();
          ctxOff.fillStyle = stroke.color;
          ctxOff.fill();
        } else if (stroke.tool === "rect") {
          const w = pEnd.x - pStart.x;
          const h = pEnd.y - pStart.y;
          ctxOff.beginPath();
          ctxOff.rect(pStart.x, pStart.y, w, h);
          ctxOff.stroke();
        } else if (stroke.tool === "circle") {
          const radius = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
          ctxOff.beginPath();
          ctxOff.arc(pStart.x, pStart.y, radius, 0, Math.PI * 2);
          ctxOff.stroke();
        } else if (stroke.tool === "triangle") {
          ctxOff.beginPath();
          ctxOff.moveTo(pStart.x + (pEnd.x - pStart.x) / 2, pStart.y);
          ctxOff.lineTo(pStart.x, pEnd.y);
          ctxOff.lineTo(pEnd.x, pEnd.y);
          ctxOff.closePath();
          ctxOff.stroke();
        }
      } else if (stroke.tool === "text" && stroke.text) {
        ctxOff.fillStyle = stroke.color;
        ctxOff.font = `500 ${stroke.fontSize || 24}px 'Comic Neue', 'Caveat', sans-serif, system-ui`;
        ctxOff.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
      }
      ctxOff.restore();
    });

    // 3. Composite Offscreen Stroke Layer onto Main Canvas
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(offscreen, 0, 0);
    ctx.restore();
  }, [boardMode, bgPattern, strokes, isDrawing, currentPoints, activeTool, color, strokeSize]);

  // Handle Resize and Initial Render with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId: any = null;
    const updateDimensions = () => {
      const currentContainer = containerRef.current;
      const canvas = canvasRef.current;
      if (!currentContainer || !canvas) return;

      const newWidth = currentContainer.clientWidth;
      const newHeight = currentContainer.clientHeight;
      if (newWidth <= 0 || newHeight <= 0) return;

      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        redrawCanvas();
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDimensions, 50);
    });

    resizeObserver.observe(container);

    window.addEventListener("resize", updateDimensions);
    window.addEventListener("orientationchange", updateDimensions);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateDimensions);
      window.removeEventListener("orientationchange", updateDimensions);
    };
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Pointer Event Handlers for Drawing with Velocity Dynamics
  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, time: Date.now(), speed: 0.2 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5,
      time: Date.now(),
      speed: 0.2,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === "text") {
      const pos = getCanvasPos(e);
      setTextPos(pos);
      return;
    }

    const pos = getCanvasPos(e);
    pos.speed = 0.15;
    setIsDrawing(true);
    setCurrentPoints([pos]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // High-frequency coalesced pointer events for maximum curve fidelity
    const nativeEvt = e.nativeEvent as PointerEvent;
    const rawEvents: (PointerEvent | React.PointerEvent<HTMLCanvasElement>)[] =
      typeof nativeEvt.getCoalescedEvents === "function" && nativeEvt.getCoalescedEvents().length > 0
        ? nativeEvt.getCoalescedEvents()
        : [e];

    const newPoints: StrokePoint[] = [];
    let lastPoint = currentPoints[currentPoints.length - 1];

    for (const evt of rawEvents) {
      const clientX = evt.clientX;
      const clientY = evt.clientY;
      const pressure = evt.pressure !== undefined && evt.pressure > 0 ? evt.pressure : 0.5;
      const now = Date.now();

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      let speed = 0.25;
      if (lastPoint && lastPoint.time) {
        const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
        // Suppress micro-jitter sub-pixel duplication
        if (dist < 0.6 && rawEvents.length > 1) continue;
        const dt = Math.max(1, now - lastPoint.time);
        speed = dist / dt;
      }
      const prevSpeed = lastPoint?.speed ?? 0.25;
      const smoothedSpeed = prevSpeed * 0.35 + speed * 0.65;

      const pt: StrokePoint = {
        x,
        y,
        pressure,
        time: now,
        speed: smoothedSpeed,
      };
      newPoints.push(pt);
      lastPoint = pt;
    }

    if (newPoints.length > 0) {
      setCurrentPoints((prev) => [...prev, ...newPoints]);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length > 0) {
      const newStroke: DrawingStroke = {
        id: `stroke-${Date.now()}`,
        tool: activeTool,
        points: currentPoints,
        color: color,
        size: strokeSize,
        mode: boardMode,
      };
      pushState([...strokes, newStroke]);
    }
    setCurrentPoints([]);
  };

  // Confirm Text Entry
  const handleAddText = () => {
    if (!textInput.trim() || !textPos) {
      setTextPos(null);
      setTextInput("");
      return;
    }

    const textStroke: DrawingStroke = {
      id: `text-${Date.now()}`,
      tool: "text",
      points: [textPos],
      color: color,
      size: strokeSize,
      mode: boardMode,
      text: textInput.trim(),
      fontSize: Math.max(18, strokeSize * 5),
    };

    pushState([...strokes, textStroke]);
    setTextInput("");
    setTextPos(null);
    showToast("Texte ajouté au tableau");
  };

  // Educational Geometry Tool: Draw Circle with Compass
  const handleDrawCompassCircle = () => {
    const steps = 60;
    const points: StrokePoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = compassCenter.x + compassRadius * Math.cos(angle);
      const y = compassCenter.y + compassRadius * Math.sin(angle);
      points.push({ x, y, speed: 0.25 });
    }

    const circleStroke: DrawingStroke = {
      id: `compass-circle-${Date.now()}`,
      tool: boardMode === "blackboard" ? "chalk" : boardMode === "paperboard" ? "pencil" : "marker",
      points,
      color,
      size: strokeSize,
      mode: boardMode,
    };

    pushState([...strokes, circleStroke]);
    showToast("Cercle complet (360°) tracé au compas");
  };

  // Educational Geometry Tool: Draw Parametric Arc with Compass
  const handleDrawCompassArc = (params: {
    startAngleRad: number;
    endAngleRad: number;
    clockwise: boolean;
    displayUnit: "deg" | "rad";
    startValue: number;
    endValue: number;
  }) => {
    const { startAngleRad, endAngleRad, clockwise } = params;
    let sweep = 0;
    if (clockwise) {
      sweep = endAngleRad >= startAngleRad ? endAngleRad - startAngleRad : Math.PI * 2 - (startAngleRad - endAngleRad);
    } else {
      sweep = startAngleRad >= endAngleRad ? startAngleRad - endAngleRad : Math.PI * 2 - (endAngleRad - startAngleRad);
    }
    if (sweep === 0) sweep = Math.PI * 2;

    const steps = Math.max(16, Math.round((sweep / (Math.PI * 2)) * 64));
    const points: StrokePoint[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const curAngle = clockwise ? startAngleRad + t * sweep : startAngleRad - t * sweep;
      const x = compassCenter.x + compassRadius * Math.cos(curAngle);
      const y = compassCenter.y + compassRadius * Math.sin(curAngle);
      points.push({ x, y, speed: 0.25 });
    }

    const arcStroke: DrawingStroke = {
      id: `compass-arc-${Date.now()}`,
      tool: boardMode === "blackboard" ? "chalk" : boardMode === "paperboard" ? "pencil" : "marker",
      points,
      color,
      size: strokeSize,
      mode: boardMode,
    };

    pushState([...strokes, arcStroke]);
    // Orient the compass pencil tip to the end of the arc
    setCompassAngle(endAngleRad);

    const label =
      params.displayUnit === "deg"
        ? `${Math.round(params.startValue)}° → ${Math.round(params.endValue)}°`
        : `${params.startValue.toFixed(2)} rad → ${params.endValue.toFixed(2)} rad`;
    showToast(`Arc tracé au compas (${label})`);
  };

  // Educational Geometry Tool: Draw Parametric Line Segment along Ruler
  const handleDrawRulerLine = (startCm: number, endCm: number) => {
    const minCm = Math.min(startCm, endCm);
    const maxCm = Math.max(startCm, endCm);

    // Calculate local coordinates along top graduated edge
    const x1_local = RULER_MARGIN_X + minCm * RULER_PIXELS_PER_CM;
    const y1_local = 0.5;
    const x2_local = RULER_MARGIN_X + maxCm * RULER_PIXELS_PER_CM;
    const y2_local = 0.5;

    // 2D Rotation transformation relative to top-left origin
    const rad = (rulerAngle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const worldX1 = rulerPos.x + (x1_local * cos - y1_local * sin);
    const worldY1 = rulerPos.y + (x1_local * sin + y1_local * cos);
    const worldX2 = rulerPos.x + (x2_local * cos - y2_local * sin);
    const worldY2 = rulerPos.y + (x2_local * sin + y2_local * cos);

    const dist = Math.hypot(worldX2 - worldX1, worldY2 - worldY1);
    const steps = Math.max(8, Math.round(dist / 3));
    const points: StrokePoint[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: worldX1 + (worldX2 - worldX1) * t,
        y: worldY1 + (worldY2 - worldY1) * t,
        speed: 0.25,
      });
    }

    const lineStroke: DrawingStroke = {
      id: `ruler-line-${Date.now()}`,
      tool: boardMode === "blackboard" ? "chalk" : boardMode === "paperboard" ? "pencil" : "marker",
      points,
      color,
      size: strokeSize,
      mode: boardMode,
    };

    pushState([...strokes, lineStroke]);
    showToast(`Segment tracé à la règle (${minCm} cm → ${maxCm} cm, ${(maxCm - minCm).toFixed(1)} cm)`);
  };

  // Snapshot / Export Capabilities
  const takeSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const newSnapshot: WhiteboardSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      dataUrl,
      mode: boardMode,
    };

    setSnapshots((prev) => [newSnapshot, ...prev]);
    setSelectedSnapshot(newSnapshot);
    showToast("Capture du tableau réalisée !");
  };

  const handleExportPNG = (dataUrl?: string) => {
    const targetUrl = dataUrl || canvasRef.current?.toDataURL("image/png");
    if (!targetUrl) return;

    const link = document.createElement("a");
    link.download = `tableau-${boardMode}-${Date.now()}.png`;
    link.href = targetUrl;
    link.click();
    showToast("Image téléchargée en PNG");
  };

  const handlePrint = (dataUrl?: string) => {
    const targetUrl = dataUrl || canvasRef.current?.toDataURL("image/png");
    if (!targetUrl) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres surgissantes (popups) pour imprimer.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impression Tableau - ${boardMode.toUpperCase()}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              font-family: system-ui, sans-serif;
              background-color: #f8fafc;
            }
            img {
              max-width: 100%;
              height: auto;
              border: 1px solid #cbd5e1;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              border-radius: 8px;
            }
            .header {
              margin-bottom: 16px;
              text-align: center;
            }
            @media print {
              body { padding: 0; background: none; }
              img { border: none; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Visual Vector Studio - Tableau ${
              boardMode === "whiteboard"
                ? "Blanc"
                : boardMode === "blackboard"
                ? "Noir (Ardoise)"
                : "Paperboard (Chevalet de conférence)"
            }</h2>
            <p>Exporté le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</p>
          </div>
          <img src="${targetUrl}" onload="window.print();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className={`flex-1 flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden select-none ${isFullscreen ? "fixed inset-0 z-50" : "relative"}`}>
      {/* Subheader Toolbar */}
      <div className={`shrink-0 bg-slate-900/95 border-b border-slate-800 px-3 sm:px-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 z-30 shadow-md transition-all ${
        isFullscreen ? "py-1.5" : "py-2 sm:py-2.5"
      }`}>
        {/* Title & Mode Badge - Collapsed in Fullscreen Mode */}
        {!isFullscreen && (
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-slate-950 shadow-inner font-black shrink-0">
              <Presentation className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2 flex-wrap">
                Professional Tool Studio
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  boardMode === "paperboard"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : boardMode === "blackboard"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                }`}>
                  {boardMode === "paperboard"
                    ? "Paperboard & Conférence"
                    : boardMode === "blackboard"
                    ? "Tableau Noir & Craie"
                    : "Tableau Blanc & Éducatif"}
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Outils pédagogiques interactifs pour enseignants, formateurs & créatifs
              </p>
            </div>
          </div>
        )}

        {/* Board Mode Switcher (Whiteboard <-> Blackboard <-> Paperboard) */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 shrink-0">
          <button
            onClick={() => {
              setBoardMode("whiteboard");
              showToast("Mode Tableau Blanc (Feutres & Marqueurs)");
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              boardMode === "whiteboard"
                ? "bg-slate-100 text-slate-900 shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Tableau Blanc</span>
          </button>

          <button
            onClick={() => {
              setBoardMode("blackboard");
              showToast("Mode Tableau Noir (Craies & Texture Ardoise)");
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              boardMode === "blackboard"
                ? "bg-emerald-950 border border-emerald-500/40 text-emerald-300 shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Tableau Noir</span>
          </button>

          <button
            onClick={() => {
              setBoardMode("paperboard");
              showToast("Mode Paperboard (Crayon graphite, Aquarelle & Feutres papier)");
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              boardMode === "paperboard"
                ? "bg-amber-100 border border-amber-300 text-amber-950 shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Paperboard</span>
          </button>
        </div>

        {/* Action Controls: Undo/Redo, Snapshot, Export, Print, Clear, Fullscreen */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={handleUndo}
            disabled={historyIndex < 0}
            title="Annuler (Ctrl+Z)"
            className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Rétablir (Ctrl+Y)"
            className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="hidden sm:block h-4 w-px bg-slate-800 mx-0.5" />

          {/* Unified Intelligent Dropdown Menu for Capture, Export, Print, and Export to Slide (AI) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                isExportMenuOpen
                  ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/60 shadow-lg shadow-cyan-500/10"
                  : "bg-slate-800/90 border-slate-700/80 text-slate-200 hover:bg-slate-700 hover:text-white"
              }`}
              title="Options d'exportation, capture et création de diapositives IA"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Exporter</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${
                  isExportMenuOpen ? "rotate-180 text-cyan-300" : "text-slate-400"
                }`}
              />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-xl animate-fadeIn">
                {/* 1. Export to Slide (AI Powered) */}
                <button
                  onClick={handleOpenSlideExport}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-indigo-500/15 border border-amber-500/30 text-amber-200 hover:border-amber-400 hover:bg-amber-500/25 transition cursor-pointer group text-left shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                      <Presentation className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Exporter vers Slide</span>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 uppercase tracking-wider">
                          IA
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Créer ou ajouter à Google Slides
                      </p>
                    </div>
                  </div>
                  <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                </button>

                <div className="h-px bg-slate-800 my-0.5" />

                {/* 2. Instant snapshot */}
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    takeSnapshot();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer text-left"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Capturer un instantané</p>
                    <p className="text-[10px] text-slate-400">
                      Enregistrer dans la galerie ({snapshots.length})
                    </p>
                  </div>
                </button>

                {/* 3. Export PNG */}
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportPNG();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer text-left"
                >
                  <div className="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Télécharger l'image (PNG)</p>
                    <p className="text-[10px] text-slate-400">Haute définition avec fond tableau</p>
                  </div>
                </button>

                {/* 4. Print */}
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handlePrint();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer text-left"
                >
                  <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Imprimer le tableau</p>
                    <p className="text-[10px] text-slate-400">Format document & export PDF</p>
                  </div>
                </button>

                {/* 5. Export Code for React (Admin Only) */}
                {isAdmin && (
                  <>
                    <div className="h-px bg-slate-800 my-0.5" />
                    <button
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        setIsCodeModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer text-left"
                    >
                      <div className="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
                        <Code2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-slate-200">Exporter le Code React</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                            Admin
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">Composant autonome & guide Vite</p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={clearBoard}
            title="Effacer le tableau"
            className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 hover:bg-rose-900/60 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Quick React Export Modal button (Admin Only) */}
          {isAdmin && (
            <>
              <div className="hidden sm:block h-4 w-px bg-slate-800 mx-0.5" />
              <button
                onClick={() => setIsCodeModalOpen(true)}
                title="Exporter le composant pour une autre application React (Vite + TS) - Réservé Administrateur"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-slate-300 hover:text-white hover:border-cyan-500/40 hover:bg-slate-700 transition cursor-pointer text-xs font-semibold"
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Code React</span>
              </button>
            </>
          )}

          <div className="hidden sm:block h-4 w-px bg-slate-800 mx-0.5" />

          {/* Fullscreen Toggle Button */}
          <button
            onClick={() => {
              toggleFullscreen();
            }}
            title={isFullscreen ? "Quitter le plein écran (Échap)" : "Plein écran (100% de la fenêtre)"}
            className={`p-2 rounded-lg border transition cursor-pointer ${
              isFullscreen
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-md"
                : "bg-slate-800/70 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700"
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-cyan-500/40 text-cyan-200 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Studio View Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Floating Trigger Button for Collapsed Left Palette */}
        {isLeftPaletteCollapsed && (
          <button
            onClick={() => setIsLeftPaletteCollapsed(false)}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 p-2.5 rounded-2xl bg-slate-900/95 border border-slate-800 text-cyan-300 hover:text-white hover:bg-slate-800 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-bold transition-all cursor-pointer animate-fade-in group"
            title="Afficher la boîte d'outils"
          >
            <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
            <PenTool className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Outils</span>
          </button>
        )}

        {/* Left Floating Tools Palette */}
        <div 
          onScroll={handleToolPointerLeaveOrUp}
          className={`absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex flex-col gap-2 sm:gap-3 max-h-[calc(100%-6.5rem)] overflow-y-auto no-scrollbar transition-all duration-300 ease-in-out ${
            isLeftPaletteCollapsed
              ? "-translate-x-32 opacity-0 pointer-events-none"
              : "translate-x-0 opacity-100"
          }`}
        >
          {/* Collapse Header Button */}
          <div className="flex justify-start">
            <button
              onClick={() => {
                handleToolPointerLeaveOrUp();
                setIsLeftPaletteCollapsed(true);
              }}
              className="p-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center justify-center cursor-pointer shadow-lg group"
              title="Masquer la boîte d'outils"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-[10px] font-bold text-slate-400 ml-1 pr-1">Masquer</span>
            </button>
          </div>

          {/* Main Drawing Tools */}
          <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl flex flex-col gap-1">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 text-center py-1">
              {boardMode === "whiteboard" ? "Marqueurs" : boardMode === "blackboard" ? "Craies & Ardoise" : "Papier & Encres"}
            </p>

            {boardMode === "whiteboard" && (
              <>
                {/* Thin Marker */}
                <button
                  onClick={() => setActiveTool("thin_marker")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Marqueur fin", "Tracé précis & feutre sec")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Marqueur fin", "Tracé précis & feutre sec")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "thin_marker"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <PenLine className="w-5 h-5" />
                </button>

                {/* Bullet Tip Marker */}
                <button
                  onClick={() => setActiveTool("bullet_marker")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Marqueur ogive", "Pointe ronde & éclat brillant")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Marqueur ogive", "Pointe ronde & éclat brillant")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "bullet_marker"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Pen className="w-5 h-5" />
                </button>

                {/* Beveled Whiteboard Marker */}
                <button
                  onClick={() => setActiveTool("highlighter")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Marqueur biseauté", "Tracé large & surlignage")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Marqueur biseauté", "Tracé large & surlignage")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "highlighter"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Highlighter className="w-5 h-5" />
                </button>

                {/* Whiteboard Magnetic Eraser Block */}
                <button
                  onClick={() => setActiveTool("eraser")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Tampon effaceur magnétique", "Feutre pour tableau blanc")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Tampon effaceur magnétique", "Feutre pour tableau blanc")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "eraser"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <RectangleVertical className="w-5 h-5" />
                </button>
              </>
            )}

            {boardMode === "blackboard" && (
              <>
                {/* Chalk Stick */}
                <button
                  onClick={() => setActiveTool("chalk")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Bâton de craie", "Dense au ralenti, estompé & poudreux en vitesse")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Bâton de craie", "Dense au ralenti, estompé & poudreux en vitesse")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "chalk"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Cylinder className="w-5 h-5" />
                </button>

                {/* Beveled Chalk */}
                <button
                  onClick={() => setActiveTool("highlighter")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Craie biseautée", "Ruban calligraphique sur ardoise")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Craie biseautée", "Ruban calligraphique sur ardoise")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "highlighter"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Highlighter className="w-5 h-5" />
                </button>

                {/* Felt Buffer (High-strength erasure with realistic chalk dust residue) */}
                <button
                  onClick={() => setActiveTool("eraser")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Tampon feutre", "Effacement puissant au premier passage & traînée de craie")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Tampon feutre", "Effacement puissant au premier passage & traînée de craie")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "eraser"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <RectangleHorizontal className="w-5 h-5" />
                </button>

                {/* Blackboard Wet Sponge - placed under the Felt Buffer at the bottom of Craies & Ardoise */}
                <button
                  onClick={() => setActiveTool("wet_sponge")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Éponge humide", "Nettoyage puissant à l'eau & trace sombre")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Éponge humide", "Nettoyage puissant à l'eau & trace sombre")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "wet_sponge"
                      ? "bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Droplet className="w-5 h-5" />
                </button>
              </>
            )}

            {boardMode === "paperboard" && (
              <>
                {/* Graphite Pencil */}
                <button
                  onClick={() => setActiveTool("pencil")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Crayon graphite HB", "Grain graphite naturel & friction papier")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Crayon graphite HB", "Grain graphite naturel & friction papier")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "pencil"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Pencil className="w-5 h-5" />
                </button>

                {/* Fountain Pen */}
                <button
                  onClick={() => setActiveTool("fountain_pen")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Stylo plume", "Plume biseautée 45°, calligraphie & gouttes d'encre")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Stylo plume", "Plume biseautée 45°, calligraphie & gouttes d'encre")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "fountain_pen"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Feather className="w-5 h-5" />
                </button>

                {/* Watercolor Paintbrush */}
                <button
                  onClick={() => setActiveTool("brush")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Pinceau Lavis Aquarelle", "Diffusion d'eau, glacis translucide & auréole")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Pinceau Lavis Aquarelle", "Diffusion d'eau, glacis translucide & auréole")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "brush"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Paintbrush className="w-5 h-5" />
                </button>

                {/* Paper Marker */}
                <button
                  onClick={() => setActiveTool("marker")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Feutre papier", "Absorption buvard & superposition d'encres")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Feutre papier", "Absorption buvard & superposition d'encres")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "marker"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <PenTool className="w-5 h-5" />
                </button>

                {/* Paper Eraser */}
                <button
                  onClick={() => setActiveTool("eraser")}
                  onPointerEnter={(e) => handleToolPointerEnter(e, "Gomme à papier", "Gomme douce mie de pain")}
                  onPointerDown={(e) => handleToolPointerDown(e, "Gomme à papier", "Gomme douce mie de pain")}
                  onPointerUp={handleToolPointerLeaveOrUp}
                  onPointerLeave={handleToolPointerLeaveOrUp}
                  onPointerCancel={handleToolPointerLeaveOrUp}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                    activeTool === "eraser"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-400/50 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Eraser className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="h-px bg-slate-800 my-1" />

            {/* Geometric Shapes */}
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 text-center py-0.5">
              Formes
            </p>

            <button
              onClick={() => setActiveTool("line")}
              onPointerEnter={(e) => handleToolPointerEnter(e, "Ligne droite", "Tracé rectiligne précis")}
              onPointerDown={(e) => handleToolPointerDown(e, "Ligne droite", "Tracé rectiligne précis")}
              onPointerUp={handleToolPointerLeaveOrUp}
              onPointerLeave={handleToolPointerLeaveOrUp}
              onPointerCancel={handleToolPointerLeaveOrUp}
              className={`p-2 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                activeTool === "line"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <div className="w-4 h-0.5 bg-current rotate-45" />
            </button>

            <button
              onClick={() => setActiveTool("arrow")}
              onPointerEnter={(e) => handleToolPointerEnter(e, "Flèche d'annotation", "Vecteur directionnel")}
              onPointerDown={(e) => handleToolPointerDown(e, "Flèche d'annotation", "Vecteur directionnel")}
              onPointerUp={handleToolPointerLeaveOrUp}
              onPointerLeave={handleToolPointerLeaveOrUp}
              onPointerCancel={handleToolPointerLeaveOrUp}
              className={`p-2 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                activeTool === "arrow"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTool("rect")}
              onPointerEnter={(e) => handleToolPointerEnter(e, "Rectangle", "Forme géométrique")}
              onPointerDown={(e) => handleToolPointerDown(e, "Rectangle", "Forme géométrique")}
              onPointerUp={handleToolPointerLeaveOrUp}
              onPointerLeave={handleToolPointerLeaveOrUp}
              onPointerCancel={handleToolPointerLeaveOrUp}
              className={`p-2 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                activeTool === "rect"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Square className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTool("circle")}
              onPointerEnter={(e) => handleToolPointerEnter(e, "Cercle / Ellipse", "Forme géométrique")}
              onPointerDown={(e) => handleToolPointerDown(e, "Cercle / Ellipse", "Forme géométrique")}
              onPointerUp={handleToolPointerLeaveOrUp}
              onPointerLeave={handleToolPointerLeaveOrUp}
              onPointerCancel={handleToolPointerLeaveOrUp}
              className={`p-2 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                activeTool === "circle"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Circle className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTool("text")}
              onPointerEnter={(e) => handleToolPointerEnter(e, "Texte / Note manuscrite", "Annotation textuelle")}
              onPointerDown={(e) => handleToolPointerDown(e, "Texte / Note manuscrite", "Annotation textuelle")}
              onPointerUp={handleToolPointerLeaveOrUp}
              onPointerLeave={handleToolPointerLeaveOrUp}
              onPointerCancel={handleToolPointerLeaveOrUp}
              className={`p-2 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                activeTool === "text"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Type className="w-4 h-4" />
            </button>
          </div>

          {/* Educational Geometry Instruments Widget Toggle */}
          <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl flex flex-col gap-1">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 text-center py-1">
              Instruments
            </p>

            <button
              onClick={() => {
                setShowRuler(!showRuler);
                showToast(showRuler ? "Règle masquée" : "Règle graduée affichée");
              }}
              onPointerEnter={(e) => handleToolPointerEnter(e, "Règle Graduée", "Mesure & guide d'angle virtuel")}
              onPointerDown={(e) => handleToolPointerDown(e, "Règle Graduée", "Mesure & guide d'angle virtuel")}
              onPointerUp={handleToolPointerLeaveOrUp}
              onPointerLeave={handleToolPointerLeaveOrUp}
              onPointerCancel={handleToolPointerLeaveOrUp}
              className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                showRuler
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/50 shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Ruler className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setShowCompass(!showCompass);
                showToast(showCompass ? "Compas masqué" : "Compas de géométrie affiché");
              }}
              onPointerEnter={(e) => handleToolPointerEnter(e, "Compas de Géométrie", "Tracé de cercles parfaits")}
              onPointerDown={(e) => handleToolPointerDown(e, "Compas de Géométrie", "Tracé de cercles parfaits")}
              onPointerUp={handleToolPointerLeaveOrUp}
              onPointerLeave={handleToolPointerLeaveOrUp}
              onPointerCancel={handleToolPointerLeaveOrUp}
              className={`p-2.5 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
                showCompass
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/50 shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Compass className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Floating Trigger Button for Collapsed Bottom Settings Bar */}
        {isBottomBarCollapsed && (
          <button
            onClick={() => setIsBottomBarCollapsed(false)}
            className={`absolute left-1/2 -translate-x-1/2 z-20 px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-slate-800 text-cyan-300 hover:text-white hover:bg-slate-800 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-bold transition-all cursor-pointer animate-fade-in group ${
              isFullscreen ? "bottom-4 sm:bottom-6" : "bottom-20 sm:bottom-22"
            }`}
            title="Afficher les couleurs et réglages"
          >
            <ChevronUp className="w-4 h-4 text-cyan-400 group-hover:-translate-y-0.5 transition-transform" />
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Couleurs & Réglages</span>
            <span
              className="w-3.5 h-3.5 rounded-full border border-slate-700 shadow-sm ml-0.5 shrink-0"
              style={{ backgroundColor: color }}
            />
          </button>
        )}

        {/* Bottom Floating Bar: Colors, Stroke Size, Background Pattern */}
        <div className={`absolute left-1/2 -translate-x-1/2 z-20 w-[calc(100%-1.5rem)] sm:w-auto max-w-3xl bg-slate-900/95 border border-slate-800 backdrop-blur-md px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl shadow-2xl flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 transition-all duration-300 ease-in-out ${
          isBottomBarCollapsed
            ? "translate-y-28 opacity-0 pointer-events-none"
            : `${isFullscreen ? "bottom-4 sm:bottom-6" : "bottom-20 sm:bottom-22"} translate-y-0 opacity-100`
        }`}>
          {/* Palette Colors */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 whitespace-nowrap">
              Couleur :
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(boardMode === "whiteboard"
                ? WHITEBOARD_COLORS
                : boardMode === "blackboard"
                ? BLACKBOARD_CHALK_COLORS
                : PAPERBOARD_COLORS
              ).map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                    color === c.value
                      ? "scale-125 border-cyan-400 shadow-md"
                      : "border-slate-700 hover:scale-110"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 rounded-full border-0 p-0 cursor-pointer overflow-hidden bg-transparent"
                title="Couleur personnalisée"
              />
            </div>
          </div>

          <div className="hidden md:block h-5 w-px bg-slate-800" />

          {/* Stroke Size Slider */}
          <div className="flex items-center gap-2 justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Épaisseur ({strokeSize}px) :
            </span>
            <input
              type="range"
              min="2"
              max="30"
              value={strokeSize}
              onChange={(e) => setStrokeSize(Number(e.target.value))}
              className="w-24 accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="hidden md:block h-5 w-px bg-slate-800" />

          {/* Background Grid Pattern */}
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 whitespace-nowrap">
              Fond :
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {(["blank", "grid", "lines", "dots"] as const).map((pat) => (
                <button
                  key={pat}
                  onClick={() => setBgPattern(pat)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition ${
                    bgPattern === pat
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  {pat === "blank"
                    ? "Vierge"
                    : pat === "grid"
                    ? "Carreaux"
                    : pat === "lines"
                    ? "Lignes"
                    : "Points"}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden md:block h-5 w-px bg-slate-800" />

          {/* Minimize Bottom Bar Button */}
          <button
            onClick={() => setIsBottomBarCollapsed(true)}
            className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer flex items-center gap-1 group shrink-0"
            title="Masquer la barre de réglages (Réduire vers le bas)"
          >
            <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
            <span className="text-[10px] font-bold hidden sm:inline">Réduire</span>
          </button>
        </div>

        {/* Main Interactive Board Canvas */}
        <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden bg-slate-950">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full touch-none cursor-crosshair block"
          />

          {/* Interactive Text Input Popup */}
          {textPos && (
            <div
              className="absolute z-30 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl flex items-center gap-2"
              style={{ left: textPos.x, top: textPos.y }}
            >
              <input
                type="text"
                autoFocus
                placeholder="Tapez votre texte ici..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddText();
                  if (e.key === "Escape") setTextPos(null);
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                onClick={handleAddText}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 text-slate-950 text-xs font-bold hover:bg-cyan-500 transition"
              >
                Valider
              </button>
              <button
                onClick={() => setTextPos(null)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Educational Instrument: Precision 30cm Metric Ruler */}
          {showRuler && (
            <RulerTool
              pos={rulerPos}
              angle={rulerAngle}
              onPosChange={setRulerPos}
              onAngleChange={setRulerAngle}
              onClose={() => setShowRuler(false)}
              onOpenLineModal={() => setShowRulerLineModal(true)}
              boardMode={boardMode}
            />
          )}

          {/* Parametric Line Configuration Modal (0 to 30 cm) */}
          <RulerLineModal
            isOpen={showRulerLineModal}
            onClose={() => setShowRulerLineModal(false)}
            currentColor={color}
            strokeSize={strokeSize}
            boardMode={boardMode}
            onTraceLine={handleDrawRulerLine}
          />

          {/* Educational Instrument: Authentic Drafting Compass */}
          {showCompass && (
            <DraftingCompass
              center={compassCenter}
              radius={compassRadius}
              angle={compassAngle}
              color={color}
              boardMode={boardMode}
              onCenterChange={setCompassCenter}
              onRadiusChange={setCompassRadius}
              onAngleChange={setCompassAngle}
              onOpenArcModal={() => setShowCompassArcModal(true)}
              onDirectDrawCircle={handleDrawCompassCircle}
              onClose={() => setShowCompass(false)}
            />
          )}

          {/* Parametric Arc Configuration Modal (Degrees / Radians) */}
          <CompassArcModal
            isOpen={showCompassArcModal}
            onClose={() => setShowCompassArcModal(false)}
            radius={compassRadius}
            currentColor={color}
            boardMode={boardMode}
            onTraceArc={handleDrawCompassArc}
          />
        </div>

        {/* Right Gallery Drawer for Snapshots */}
        {snapshots.length > 0 && (
          <div className="w-64 max-w-[75vw] bg-slate-900 border-l border-slate-800 p-3 flex flex-col gap-3 overflow-y-auto z-20 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-indigo-400" />
                Captures ({snapshots.length})
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="group relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden hover:border-cyan-500/50 transition shadow-md"
                >
                  <img src={snap.dataUrl} alt="Snapshot" className="w-full h-28 object-cover" />
                  <div className="p-2 flex items-center justify-between bg-slate-900/90 text-[10px] text-slate-400">
                    <span>{snap.timestamp}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleExportPNG(snap.dataUrl)}
                        className="p-1 hover:text-cyan-400"
                        title="Télécharger"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handlePrint(snap.dataUrl)}
                        className="p-1 hover:text-white"
                        title="Imprimer"
                      >
                        <Printer className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setSlideCanvasDataUrl(snap.dataUrl);
                          setIsSlideModalOpen(true);
                        }}
                        className="p-1 hover:text-amber-400"
                        title="Exporter vers Google Slides avec IA"
                      >
                        <Presentation className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Google Slides AI Export Modal */}
      <ExportToSlideModal
        isOpen={isSlideModalOpen}
        onClose={() => setIsSlideModalOpen(false)}
        canvasDataUrl={slideCanvasDataUrl}
        boardMode={boardMode}
        geminiApiKey={geminiApiKey}
        onToast={showToast}
      />

      {/* Standalone React Export & Integration Guide Modal (Admin Only) */}
      {isAdmin && (
        <ExportWhiteboardCodeModal
          isOpen={isCodeModalOpen}
          onClose={() => setIsCodeModalOpen(false)}
          triggerToast={showToast}
        />
      )}
    </div>
  );
}

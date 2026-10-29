import React, { useState, useRef } from "react";
import { RotateCw, X, Move, PenLine } from "lucide-react";
import { BoardMode } from "../WhiteboardStudio";

export const RULER_PIXELS_PER_CM = 20;
export const RULER_TOTAL_CM = 30;
export const RULER_MARGIN_X = 5; // Minimal 5px bevel padding so 0 to 30 cm spans 98.4% of ruler length

interface RulerToolProps {
  pos: { x: number; y: number };
  angle: number;
  onPosChange: (pos: { x: number; y: number }) => void;
  onAngleChange: (angle: number) => void;
  onClose: () => void;
  onOpenLineModal: () => void;
  boardMode: BoardMode;
}

/**
 * Precision 30 cm Metric Technical Ruler
 * - Exactly 30 cm length with strict 20px per 1 cm scale (600px active graduation span).
 * - Minimal 5px bevel margin so graduations occupy almost the entire length of the ruler body (610px total).
 * - Millimeter ticks (every 2px), half-centimeter ticks (5mm), and numbered centimeter graduations (0 to 30 cm).
 * - "Tracer Ligne" direct button opening parametric line dialog.
 * - Dual-mode rotation button:
 *   * Click (<200ms): Step rotation (+15° incremental advance).
 *   * Maintain & Drag (>200ms or >3px motion): Free angular rotation tracking gesture with magnetic snapping.
 */
export const RulerTool: React.FC<RulerToolProps> = ({
  pos,
  angle,
  onPosChange,
  onAngleChange,
  onClose,
  onOpenLineModal,
  boardMode,
}) => {
  // Scale definition: 20 pixels = 1 cm (1mm = 2px)
  const PIXELS_PER_CM = RULER_PIXELS_PER_CM;
  const TOTAL_CM = RULER_TOTAL_CM;
  const MARGIN_X = RULER_MARGIN_X;
  const RULER_WIDTH = TOTAL_CM * PIXELS_PER_CM + MARGIN_X * 2; // 610px total
  const RULER_HEIGHT = 58;

  // Ruler dragging state
  const [isDraggingBody, setIsDraggingBody] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Free rotation state
  const [isRotating, setIsRotating] = useState(false);
  const rotateStartRef = useRef<{
    startTime: number;
    startX: number;
    startY: number;
    initialAngle: number;
    hasMoved: boolean;
  } | null>(null);

  // Ruler center in canvas/viewport space for angular math
  const getRulerCenter = () => {
    // Top-left origin rotation
    const rad = (angle * Math.PI) / 180;
    const cxLocal = RULER_WIDTH / 2;
    const cyLocal = RULER_HEIGHT / 2;
    // Rotated offset from pos
    const cxRotated = cxLocal * Math.cos(rad) - cyLocal * Math.sin(rad);
    const cyRotated = cxLocal * Math.sin(rad) + cyLocal * Math.cos(rad);
    return {
      x: pos.x + cxRotated,
      y: pos.y + cyRotated,
    };
  };

  // 1. Ruler Body Dragging Handlers
  const handleBodyPointerDown = (e: React.PointerEvent) => {
    // Only drag if not clicking buttons
    if ((e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingBody(true);
    dragStartRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
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

  // 2. Dual-mode Rotate Button Handlers
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
      // Calculate current pointer angle relative to ruler center
      const currentPointerAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x) * (180 / Math.PI);
      const startPointerAngle = Math.atan2(start.startY - center.y, start.startX - center.x) * (180 / Math.PI);
      let newAngle = (start.initialAngle + (currentPointerAngle - startPointerAngle)) % 360;
      if (newAngle < 0) newAngle += 360;

      // Magnetic snapping within ±2.5° of cardinal / standard drawing angles
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
      // If short click without significant drag motion, advance by +15°
      if (!hasMoved && duration < 240) {
        onAngleChange((Math.round(angle / 15) * 15 + 15) % 360);
      }
    }

    setIsRotating(false);
    rotateStartRef.current = null;
  };

  // Aesthetic theming according to board mode
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
      {/* Top Beveled Edge Graduation Scale (0 to 30 cm) */}
      <div className="relative w-full h-8 overflow-hidden border-b border-amber-500/30">
        <svg
          className="absolute inset-0 w-full h-full"
          width={RULER_WIDTH}
          height={32}
          viewBox={`0 0 ${RULER_WIDTH} 32`}
        >
          {/* Centimeter & Millimeter Graduations */}
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

          {/* Centimeter Digits 0 to 30 */}
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

        {/* Units Indicator */}
        <span
          className="absolute right-1 top-0.5 text-[7px] font-mono font-bold tracking-tight opacity-60"
          style={{ color: tickColor }}
        >
          cm
        </span>
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-amber-950/10 border-t border-amber-500/20 text-[10px]">
        <div className="flex items-center gap-1.5 font-bold tracking-wide">
          <Move className="w-3 h-3 opacity-60" />
          <span>Règle métrique (30 cm)</span>
          <span className="ml-1 px-1.5 py-0.2 bg-amber-500/20 rounded font-mono text-[9px] border border-amber-500/30">
            {angle.toFixed(0)}°
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Tracer Ligne Action Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenLineModal();
            }}
            className="px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition text-[9px] bg-amber-400/30 hover:bg-amber-400/50 text-amber-900 dark:text-amber-200 border border-amber-500/40 cursor-pointer shadow-sm active:scale-95"
            title="Tracer un segment de droite précis le long de la règle graduée"
          >
            <PenLine className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Tracer Ligne</span>
          </button>

          {/* Dual-Mode Rotation Button */}
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
            title="Clic: +15° | Maintenir et glisser: Rotation libre continue"
          >
            <RotateCw className={`w-3 h-3 ${isRotating ? "animate-spin" : ""}`} />
            <span>{isRotating ? `${angle.toFixed(1)}°` : "Pivoter"}</span>
          </button>

          {/* Close Ruler Button */}
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

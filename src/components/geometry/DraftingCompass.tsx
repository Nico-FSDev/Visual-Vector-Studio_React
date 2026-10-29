import React, { useState, useRef } from "react";
import { X, CircleDot, RotateCw, Move } from "lucide-react";
import { BoardMode } from "../WhiteboardStudio";

interface DraftingCompassProps {
  center: { x: number; y: number };
  radius: number;
  angle: number; // in radians
  color: string;
  boardMode: BoardMode;
  onCenterChange: (center: { x: number; y: number }) => void;
  onRadiusChange: (radius: number) => void;
  onAngleChange: (angle: number) => void;
  onOpenArcModal: () => void;
  onDirectDrawCircle: () => void;
  onClose: () => void;
}

/**
 * Realistic Drafting Compass (Compas technique à balustre)
 * - Authentic technical drafting instrument anatomy:
 *   * Dual articulated metallic legs (brushed chrome & brass finish).
 *   * Hardened steel needle with center target crosshair.
 *   * Precision graphite/pencil lead holder with dynamic tip angle.
 *   * Central micrometer spindle with knurled adjustment thumbwheel.
 *   * Top knurled friction turn-knob for orbital rotation.
 * - Interactive direct-manipulation gestures:
 *   * Drag needle center to reposition on the canvas.
 *   * Drag pencil tip or thumbwheel to change radius.
 *   * Drag apex knob to rotate compass angle.
 */
export const DraftingCompass: React.FC<DraftingCompassProps> = ({
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
  const radiusStartRef = useRef<{ startX: number; startY: number; startRadius: number }>({
    startX: 0,
    startY: 0,
    startRadius: radius,
  });

  // 1. Anchor Needle Drag (Move compass across canvas)
  const handleNeedlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingCenter(true);
    dragStartRef.current = {
      x: e.clientX - center.x,
      y: e.clientY - center.y,
    };
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

  // 2. Pencil Tip Drag (Adjust radius and/or orbit)
  const handlePencilPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingRadius(true);
    radiusStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRadius: radius,
    };
  };

  const handlePencilPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRadius) return;
    // Calculate new radius and angle directly from pointer position relative to compass center
    const dx = e.clientX - center.x;
    const dy = e.clientY - center.y;
    const dist = Math.hypot(dx, dy);
    const clampedRadius = Math.max(30, Math.min(420, Math.round(dist)));
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

  // 3. Top Knob Drag (Rotate compass)
  const handleApexPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsRotatingCompass(true);
  };

  const handleApexPointerMove = (e: React.PointerEvent) => {
    if (!isRotatingCompass) return;
    const dx = e.clientX - center.x;
    const dy = e.clientY - center.y;
    const newAngle = Math.atan2(dy, dx) - Math.PI / 2; // offset from top apex
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

  // Calculated Positions
  const pencilX = center.x + radius * Math.cos(angle);
  const pencilY = center.y + radius * Math.sin(angle);

  // Compass Apex (Hinge Joint): elevated isosceles triangle above center and pencil
  const midX = (center.x + pencilX) / 2;
  const midY = (center.y + pencilY) / 2;
  // Perpendicular height based on leg length (fixed drafting leg length ~170px)
  const legLength = 175;
  const halfDist = radius / 2;
  const legHeight = Math.max(70, Math.sqrt(Math.max(1600, legLength * legLength - halfDist * halfDist)));

  // Direction perpendicular to the baseline (center -> pencil)
  const baseAngle = angle;
  const perpAngle = baseAngle - Math.PI / 2;
  const apexX = midX + legHeight * Math.cos(perpAngle);
  const apexY = midY + legHeight * Math.sin(perpAngle);

  // Spindle location (halfway up the legs)
  const spindleAnchorX = center.x + (apexX - center.x) * 0.45;
  const spindleAnchorY = center.y + (apexY - center.y) * 0.45;
  const spindlePencilX = pencilX + (apexX - pencilX) * 0.45;
  const spindlePencilY = pencilY + (apexY - pencilY) * 0.45;
  const spindleMidX = (spindleAnchorX + spindlePencilX) / 2;
  const spindleMidY = (spindleAnchorY + spindlePencilY) / 2;

  // Knob apex extension (for turning handle)
  const knobApexX = apexX + 32 * Math.cos(perpAngle);
  const knobApexY = apexY + 32 * Math.sin(perpAngle);

  // Angle in degrees for display
  const displayDeg = Math.round(((angle * 180) / Math.PI + 360) % 360);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-visible select-none">
      {/* 1. Translucent Circular Guide Track */}
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

        {/* Center Target Crosshairs */}
        <line
          x1={center.x - 12}
          y1={center.y}
          x2={center.x + 12}
          y2={center.y}
          stroke={boardMode === "blackboard" ? "#f8fafc" : "#6366f1"}
          strokeWidth="1"
          opacity="0.8"
        />
        <line
          x1={center.x}
          y1={center.y - 12}
          x2={center.x}
          y2={center.y + 12}
          stroke={boardMode === "blackboard" ? "#f8fafc" : "#6366f1"}
          strokeWidth="1"
          opacity="0.8"
        />
      </svg>

      {/* 2. Realistic Rendered SVG Compass Instrument Body */}
      <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
        <defs>
          {/* Metallic Steel Gradient for Legs */}
          <linearGradient id="metalSteel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="35%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>

          {/* Knurled Brass Accent Gradient */}
          <linearGradient id="metalBrass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="40%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>

          {/* Drop Shadow Filter */}
          <filter id="compassShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="4" floodOpacity="0.38" floodColor="#020617" />
          </filter>
        </defs>

        <g filter="url(#compassShadow)">
          {/* Spindle Threaded Rod between legs */}
          <line
            x1={spindleAnchorX}
            y1={spindleAnchorY}
            x2={spindlePencilX}
            y2={spindlePencilY}
            stroke="#475569"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Spindle Knurled Thumbwheel */}
          <circle
            cx={spindleMidX}
            cy={spindleMidY}
            r="8"
            fill="url(#metalBrass)"
            stroke="#78350f"
            strokeWidth="1.2"
          />

          {/* Anchor Leg (Steel needle leg) */}
          <line
            x1={apexX}
            y1={apexY}
            x2={center.x}
            y2={center.y}
            stroke="url(#metalSteel)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Steel Needle Point */}
          <polygon
            points={`
              ${center.x},${center.y}
              ${center.x - 2.5 * Math.sin(perpAngle)},${center.y + 2.5 * Math.cos(perpAngle)}
              ${center.x + 12 * Math.cos(perpAngle)},${center.y + 12 * Math.sin(perpAngle)}
              ${center.x + 2.5 * Math.sin(perpAngle)},${center.y - 2.5 * Math.cos(perpAngle)}
            `}
            fill="#334155"
          />

          {/* Pencil Leg (Pencil holder arm) */}
          <line
            x1={apexX}
            y1={apexY}
            x2={pencilX}
            y2={pencilY}
            stroke="url(#metalSteel)"
            strokeWidth="7"
            strokeLinecap="round"
          />

          {/* Pencil Clamp Joint */}
          <circle
            cx={pencilX + 16 * Math.cos(perpAngle)}
            cy={pencilY + 16 * Math.sin(perpAngle)}
            r="5"
            fill="url(#metalBrass)"
            stroke="#92400e"
            strokeWidth="1"
          />

          {/* Graphite Lead Tip pointing to canvas */}
          <polygon
            points={`
              ${pencilX},${pencilY}
              ${pencilX - 2.5 * Math.sin(perpAngle)},${pencilY + 2.5 * Math.cos(perpAngle)}
              ${pencilX + 12 * Math.cos(perpAngle)},${pencilY + 12 * Math.sin(perpAngle)}
              ${pencilX + 2.5 * Math.sin(perpAngle)},${pencilY - 2.5 * Math.cos(perpAngle)}
            `}
            fill={color || "#1e293b"}
          />

          {/* Hinge Joint Head */}
          <circle
            cx={apexX}
            cy={apexY}
            r="9"
            fill="url(#metalSteel)"
            stroke="#475569"
            strokeWidth="1.5"
          />
          <circle cx={apexX} cy={apexY} r="4" fill="#334155" />

          {/* Apex Handle Knurled Turning Rod */}
          <line
            x1={apexX}
            y1={apexY}
            x2={knobApexX}
            y2={knobApexY}
            stroke="url(#metalBrass)"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>
      </svg>

      {/* 3. Interactive Target Anchors & Grips */}

      {/* Center Needle Handle (Drag to position) */}
      <div
        className="absolute z-30 pointer-events-auto -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-move hover:scale-110 active:scale-95 transition-transform"
        style={{ left: center.x, top: center.y }}
        onPointerDown={handleNeedlePointerDown}
        onPointerMove={handleNeedlePointerMove}
        onPointerUp={handleNeedlePointerUp}
        onPointerCancel={handleNeedlePointerUp}
        title="Glisser pour déplacer le centre du compas"
      >
        <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow-lg flex items-center justify-center animate-pulse" />
      </div>

      {/* Pencil Lead Tip Handle (Drag to adjust radius & orbit) */}
      <div
        className="absolute z-30 pointer-events-auto -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center cursor-crosshair hover:scale-110 active:scale-95 transition-transform"
        style={{ left: pencilX, top: pencilY }}
        onPointerDown={handlePencilPointerDown}
        onPointerMove={handlePencilPointerMove}
        onPointerUp={handlePencilPointerUp}
        onPointerCancel={handlePencilPointerUp}
        title="Glisser pour ajuster le rayon ou orienter la mine"
      >
        <div
          className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
          style={{ backgroundColor: color || "#6366f1" }}
        />
      </div>

      {/* Top Apex Knob Handle (Drag to orbit/rotate compass) */}
      <div
        className="absolute z-30 pointer-events-auto -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
        style={{ left: knobApexX, top: knobApexY }}
        onPointerDown={handleApexPointerDown}
        onPointerMove={handleApexPointerMove}
        onPointerUp={handleApexPointerUp}
        onPointerCancel={handleApexPointerUp}
        title="Glisser pour faire pivoter le compas"
      >
        <div className="w-5 h-5 rounded-full bg-amber-400 border-2 border-amber-800 shadow-md flex items-center justify-center text-amber-950 font-bold text-[8px]">
          <RotateCw className="w-3 h-3" />
        </div>
      </div>

      {/* 4. Floating Compass HUD Toolbar */}
      <div
        className="absolute z-30 pointer-events-auto -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-indigo-500/40 shadow-2xl text-slate-200 text-xs"
        style={{
          left: center.x,
          top: center.y + 22,
        }}
      >
        <div className="flex items-center gap-1 font-mono font-bold text-indigo-300 pr-1 border-r border-slate-700">
          <span>R: {(radius / 20).toFixed(1)} cm</span>
          <span className="text-[10px] text-slate-400 font-normal">({radius}px)</span>
          <span className="text-[10px] text-indigo-400 font-semibold ml-1">∠{displayDeg}°</span>
        </div>

        {/* Action: Open Arc Modal */}
        <button
          onClick={onOpenArcModal}
          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg font-bold text-[11px] shadow-sm flex items-center gap-1 transition"
          title="Ouvrir la fenêtre de configuration pour tracer un arc paramétré (degrés/radians)"
        >
          <CircleDot className="w-3 h-3 text-indigo-200" />
          <span>Tracer Arc</span>
        </button>

        {/* Action: Quick Direct 360° Circle */}
        <button
          onClick={onDirectDrawCircle}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition"
          title="Tracer immédiatement un cercle complet (360°)"
        >
          Cercle
        </button>

        {/* Close Compass */}
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-rose-400 rounded-md transition"
          title="Fermer le compas"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

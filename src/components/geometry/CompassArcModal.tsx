import React, { useState, useEffect } from "react";
import { X, Check, RotateCcw, ArrowRight, CircleDot } from "lucide-react";
import { BoardMode } from "../WhiteboardStudio";

interface CompassArcModalProps {
  isOpen: boolean;
  onClose: () => void;
  radius: number;
  currentColor: string;
  boardMode: BoardMode;
  onTraceArc: (params: {
    startAngleRad: number;
    endAngleRad: number;
    clockwise: boolean;
    displayUnit: "deg" | "rad";
    startValue: number;
    endValue: number;
  }) => void;
}

type AngleUnit = "deg" | "rad";

export const CompassArcModal: React.FC<CompassArcModalProps> = ({
  isOpen,
  onClose,
  radius,
  currentColor,
  boardMode,
  onTraceArc,
}) => {
  const [unit, setUnit] = useState<AngleUnit>("deg");
  // Store internal normalized degrees (0 to 360)
  const [startAngleDeg, setStartAngleDeg] = useState(0);
  const [endAngleDeg, setEndAngleDeg] = useState(90);
  const [clockwise, setClockwise] = useState(true);

  // Synchronized inputs for the active unit
  const [startInput, setStartInput] = useState("0");
  const [endInput, setEndInput] = useState("90");

  useEffect(() => {
    if (unit === "deg") {
      setStartInput(Math.round(startAngleDeg).toString());
      setEndInput(Math.round(endAngleDeg).toString());
    } else {
      // Radians: (deg * Math.PI) / 180
      const startRad = (startAngleDeg * Math.PI) / 180;
      const endRad = (endAngleDeg * Math.PI) / 180;
      setStartInput((Math.round(startRad * 100) / 100).toFixed(2));
      setEndInput((Math.round(endRad * 100) / 100).toFixed(2));
    }
  }, [unit, startAngleDeg, endAngleDeg]);

  if (!isOpen) return null;

  // Handle unit toggle switch
  const handleUnitToggle = (newUnit: AngleUnit) => {
    if (newUnit === unit) return;
    setUnit(newUnit);
  };

  // Convert inputs to degrees
  const handleStartInputChange = (valStr: string) => {
    setStartInput(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num)) {
      if (unit === "deg") {
        setStartAngleDeg(((num % 360) + 360) % 360);
      } else {
        const deg = ((num * 180) / Math.PI) % 360;
        setStartAngleDeg((deg + 360) % 360);
      }
    }
  };

  const handleEndInputChange = (valStr: string) => {
    setEndInput(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num)) {
      if (unit === "deg") {
        setEndAngleDeg(((num % 360) + 360) % 360);
      } else {
        const deg = ((num * 180) / Math.PI) % 360;
        setEndAngleDeg((deg + 360) % 360);
      }
    }
  };

  // Sweep calculations
  let sweepDeg = 0;
  if (clockwise) {
    sweepDeg = endAngleDeg >= startAngleDeg ? endAngleDeg - startAngleDeg : 360 - (startAngleDeg - endAngleDeg);
  } else {
    sweepDeg = startAngleDeg >= endAngleDeg ? startAngleDeg - endAngleDeg : 360 - (endAngleDeg - startAngleDeg);
  }
  if (sweepDeg === 0 && startAngleDeg !== endAngleDeg) sweepDeg = 360;
  if (startAngleDeg === endAngleDeg) sweepDeg = 360; // default full circle if identical

  const sweepRad = (sweepDeg * Math.PI) / 180;

  // Radian friendly label helper (e.g. π/2, π, 2π)
  const formatRadLabel = (rad: number) => {
    const piMultiple = rad / Math.PI;
    if (Math.abs(piMultiple - 0.5) < 0.02) return "π/2";
    if (Math.abs(piMultiple - 1) < 0.02) return "π";
    if (Math.abs(piMultiple - 1.5) < 0.02) return "3π/2";
    if (Math.abs(piMultiple - 2) < 0.02) return "2π";
    if (Math.abs(piMultiple - 0.25) < 0.02) return "π/4";
    if (Math.abs(piMultiple - 0.333) < 0.02) return "π/3";
    if (Math.abs(piMultiple - 0.166) < 0.02) return "π/6";
    return `${rad.toFixed(2)} rad`;
  };

  // SVG Dial Preview Geometry
  const dialRadius = 55;
  const dialCenter = 70;
  const startAngleRad = (startAngleDeg * Math.PI) / 180;
  const endAngleRad = (endAngleDeg * Math.PI) / 180;

  const startX = dialCenter + dialRadius * Math.cos(startAngleRad);
  const startY = dialCenter + dialRadius * Math.sin(startAngleRad);
  const endX = dialCenter + dialRadius * Math.cos(endAngleRad);
  const endY = dialCenter + dialRadius * Math.sin(endAngleRad);

  const largeArcFlag = sweepDeg > 180 ? 1 : 0;
  const sweepFlag = clockwise ? 1 : 0;

  const arcPath =
    sweepDeg >= 360
      ? `M ${dialCenter + dialRadius} ${dialCenter} A ${dialRadius} ${dialRadius} 0 1 1 ${dialCenter - dialRadius} ${dialCenter} A ${dialRadius} ${dialRadius} 0 1 1 ${dialCenter + dialRadius} ${dialCenter}`
      : `M ${startX} ${startY} A ${dialRadius} ${dialRadius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;

  const handleCommit = () => {
    onTraceArc({
      startAngleRad,
      endAngleRad,
      clockwise,
      displayUnit: unit,
      startValue: unit === "deg" ? startAngleDeg : startAngleRad,
      endValue: unit === "deg" ? endAngleDeg : endAngleRad,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <CircleDot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Tracer un Arc au Compas</h3>
              <p className="text-[11px] text-slate-400">Rayon actif: {(radius / 20).toFixed(1)} cm ({radius} px)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Unit Toggle Switch: Degrés vs Radians */}
          <div className="flex items-center justify-between bg-slate-950/70 p-1.5 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-400 ml-2">Unité d'angle</span>
            <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700/60">
              <button
                type="button"
                onClick={() => handleUnitToggle("deg")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  unit === "deg"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Degrés (°)
              </button>
              <button
                type="button"
                onClick={() => handleUnitToggle("rad")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  unit === "rad"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Radians (rad)
              </button>
            </div>
          </div>

          {/* Interactive Dial Preview & Sweep Summary */}
          <div className="flex items-center gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
            <div className="relative w-[140px] h-[140px] flex-shrink-0 flex items-center justify-center bg-slate-900/90 rounded-full border border-slate-800 shadow-inner">
              <svg width="140" height="140" viewBox="0 0 140 140">
                {/* Background Compass Rose / Reference Ticks */}
                <circle cx="70" cy="70" r="55" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="70" y1="15" x2="70" y2="125" stroke="#334155" strokeWidth="0.75" />
                <line x1="15" y1="70" x2="125" y2="70" stroke="#334155" strokeWidth="0.75" />

                {/* Swept Arc highlight */}
                <path
                  d={arcPath}
                  fill="none"
                  stroke={currentColor || "#818cf8"}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Center needle anchor */}
                <circle cx="70" cy="70" r="3" fill="#cbd5e1" />

                {/* Start Point (Green dot) */}
                <circle cx={startX} cy={startY} r="4" fill="#10b981" stroke="#064e3b" strokeWidth="1" />

                {/* End Point (Indigo arrow / point) */}
                <circle cx={endX} cy={endY} r="4" fill="#6366f1" stroke="#312e81" strokeWidth="1" />
              </svg>
            </div>

            {/* Sweep summary statistics */}
            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-slate-400">Angle balayé:</span>
                <span className="font-mono font-bold text-indigo-300">
                  {unit === "deg" ? `${Math.round(sweepDeg)}°` : `${formatRadLabel(sweepRad)}`}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-slate-400">Longueur de l'arc:</span>
                <span className="font-mono font-bold text-slate-200">
                  {(((sweepRad * radius) / 20)).toFixed(1)} cm
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Sens de rotation:</span>
                <button
                  onClick={() => setClockwise(!clockwise)}
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-medium transition"
                >
                  {clockwise ? "Horaire (CW)" : "Trigonométrique (CCW)"}
                </button>
              </div>
            </div>
          </div>

          {/* Start Angle Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Angle de départ ({unit === "deg" ? "°" : "rad"})
              </label>
              <input
                type="number"
                step={unit === "deg" ? "1" : "0.05"}
                min="0"
                max={unit === "deg" ? "360" : "6.28"}
                value={startInput}
                onChange={(e) => handleStartInputChange(e.target.value)}
                className="w-20 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={startAngleDeg}
              onChange={(e) => setStartAngleDeg(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            {/* Quick Presets for Start Angle */}
            <div className="flex gap-1 overflow-x-auto py-1">
              {[0, 30, 45, 60, 90, 180].map((deg) => (
                <button
                  key={`start-${deg}`}
                  type="button"
                  onClick={() => setStartAngleDeg(deg)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
                    Math.round(startAngleDeg) === deg
                      ? "bg-emerald-600/30 border-emerald-500 text-emerald-300"
                      : "bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {unit === "deg" ? `${deg}°` : formatRadLabel((deg * Math.PI) / 180)}
                </button>
              ))}
            </div>
          </div>

          {/* End Angle Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-indigo-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Angle d'arrivée ({unit === "deg" ? "°" : "rad"})
              </label>
              <input
                type="number"
                step={unit === "deg" ? "1" : "0.05"}
                min="0"
                max={unit === "deg" ? "360" : "6.28"}
                value={endInput}
                onChange={(e) => handleEndInputChange(e.target.value)}
                className="w-20 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-right font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={endAngleDeg}
              onChange={(e) => setEndAngleDeg(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            {/* Quick Presets for End Angle */}
            <div className="flex gap-1 overflow-x-auto py-1">
              {[45, 90, 180, 270, 360].map((deg) => (
                <button
                  key={`end-${deg}`}
                  type="button"
                  onClick={() => setEndAngleDeg(deg % 360 === 0 && deg !== 0 ? 360 : deg % 360)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
                    Math.round(endAngleDeg) === deg
                      ? "bg-indigo-600/30 border-indigo-500 text-indigo-300"
                      : "bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {deg === 360
                    ? unit === "deg"
                      ? "360° (Plein)"
                      : "2π (Plein)"
                    : unit === "deg"
                    ? `${deg}°`
                    : formatRadLabel((deg * Math.PI) / 180)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleCommit}
            className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-lg flex items-center gap-1.5 transition"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Tracer l'Arc sur le Tableau</span>
          </button>
        </div>
      </div>
    </div>
  );
};

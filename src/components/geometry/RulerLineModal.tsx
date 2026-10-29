import React, { useState } from "react";
import { X, Check, Ruler, Sparkles } from "lucide-react";
import { BoardMode } from "../WhiteboardStudio";

interface RulerLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  strokeSize: number;
  boardMode: BoardMode;
  onTraceLine: (startCm: number, endCm: number) => void;
}

export const RulerLineModal: React.FC<RulerLineModalProps> = ({
  isOpen,
  onClose,
  currentColor,
  strokeSize,
  boardMode,
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

  const isDark = boardMode === "blackboard";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
        {/* Modal Header */}
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

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Segment Visual Ruler Preview */}
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Segment sélectionné:</span>
              <span className="font-mono font-bold text-amber-300">
                {minCm.toFixed(1)} cm → {maxCm.toFixed(1)} cm
              </span>
            </div>

            {/* Visual Ruler Graduation Bar Preview */}
            <div className="relative h-12 w-full bg-amber-950/40 rounded-lg border border-amber-500/30 overflow-hidden flex items-center px-1">
              {/* Background graduation simulation */}
              <div className="absolute inset-0 flex justify-between px-2 pt-1 opacity-40 select-none pointer-events-none">
                {[0, 5, 10, 15, 20, 25, 30].map((mark) => (
                  <div key={mark} className="flex flex-col items-center">
                    <div className="w-0.5 h-3 bg-amber-300" />
                    <span className="text-[8px] font-mono text-amber-200 mt-0.5">{mark}</span>
                  </div>
                ))}
              </div>

              {/* Active Drawn Segment Highlight */}
              <div
                className="absolute h-2.5 rounded-full shadow-lg transition-all"
                style={{
                  left: `${(minCm / 30) * 100}%`,
                  width: `${Math.max(1, ((maxCm - minCm) / 30) * 100)}%`,
                  backgroundColor: currentColor || "#f59e0b",
                  boxShadow: `0 0 10px ${currentColor || "#f59e0b"}88`,
                }}
              />
            </div>

            {/* Length and Pixel Summary */}
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-400">Longueur du tracé:</span>
              <span className="font-mono font-bold text-slate-200">
                {lengthCm} cm <span className="text-slate-400 font-normal">({lengthPx} px)</span>
              </span>
            </div>
          </div>

          {/* Start Point Input (cm) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Point de départ (cm)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  value={startCm}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setStartCm(Math.max(0, Math.min(30, val)));
                  }}
                  className="w-18 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-400 font-mono">cm</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="0.1"
              value={startCm}
              onChange={(e) => setStartCm(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* End Point Input (cm) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-indigo-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Point d'arrivée (cm)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  value={endCm}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setEndCm(Math.max(0, Math.min(30, val)));
                  }}
                  className="w-18 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-right font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-400 font-mono">cm</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="0.1"
              value={endCm}
              onChange={(e) => setEndCm(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400">Raccourcis de mesure:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "0 → 5 cm", s: 0, e: 5 },
                { label: "0 → 10 cm", s: 0, e: 10 },
                { label: "0 → 15 cm", s: 0, e: 15 },
                { label: "0 → 20 cm", s: 0, e: 20 },
                { label: "5 → 25 cm", s: 5, e: 25 },
                { label: "Plein (0 → 30 cm)", s: 0, e: 30 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setStartCm(p.s);
                    setEndCm(p.e);
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-mono border transition ${
                    startCm === p.s && endCm === p.e
                      ? "bg-amber-500/25 border-amber-500 text-amber-300 font-bold"
                      : "bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 bg-slate-900/95">
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
            className="px-4 py-1.5 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 rounded-lg shadow-lg flex items-center gap-1.5 transition"
          >
            <Check className="w-3.5 h-3.5 text-amber-950" />
            <span>Tracer le Trait sur le Tableau</span>
          </button>
        </div>
      </div>
    </div>
  );
};

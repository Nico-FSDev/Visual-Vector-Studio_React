import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface ThemedSelectOption<T extends string | number = string> {
  value: T;
  label: string;
  category?: string;
  icon?: React.ReactNode;
  description?: string;
}

interface ThemedSelectProps<T extends string | number = string> {
  value: T;
  onChange: (value: T) => void;
  options: ThemedSelectOption<T>[];
  label?: string;
  placeholder?: string;
  isVS?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function ThemedSelect<T extends string | number = string>({
  value,
  onChange,
  options,
  label,
  placeholder = "Sélectionner...",
  isVS = true,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  size = "md",
  disabled = false,
  icon,
}: ThemedSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const selectedOption = options.find((opt) => opt.value === value);

  // Position calculation for floating portal menu
  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const margin = 4;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    let maxHeight: number;

    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      // Place above button if space is tight below
      maxHeight = Math.min(280, spaceAbove - margin - 8);
      top = rect.top - maxHeight - margin;
      if (top < 8) {
        top = 8;
        maxHeight = Math.max(120, rect.top - margin - 16);
      }
    } else {
      // Place below button
      top = rect.bottom + margin;
      maxHeight = Math.min(280, Math.max(120, spaceBelow - margin - 8));
    }

    // Horizontal positioning and fit
    const minWidth = rect.width;
    let left = rect.left;
    if (left + minWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - minWidth - 12);
    }

    setMenuStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${minWidth}px`,
      maxHeight: `${maxHeight}px`,
      zIndex: 99999,
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      updateMenuPosition();
    }
  }, [isOpen, updateMenuPosition]);

  // Event listeners for resize and scroll to keep menu correctly positioned
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updateMenuPosition();
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen, updateMenuPosition]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Group options by category if category exists
  const hasCategories = options.some((opt) => !!opt.category);
  const groupedOptions = hasCategories
    ? options.reduce((acc, opt) => {
        const cat = opt.category || "Général";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(opt);
        return acc;
      }, {} as Record<string, ThemedSelectOption<T>[]>)
    : null;

  // Size variations
  const sizeClasses = {
    sm: "py-1 px-2.5 text-[11px]",
    md: "py-1.5 px-3 text-xs",
    lg: "py-2 px-3.5 text-sm",
  }[size];

  // Base theme classes
  const themeButtonClass = isVS
    ? "bg-[#1e1e1e] hover:bg-[#252526] text-neutral-200 border-[#3c3c3c] focus:border-[#f05a28] active:border-[#f05a28]"
    : "bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(34,211,238,0.25)]";

  const themeMenuClass = isVS
    ? "bg-[#181818] border-[#383838] shadow-[0_12px_32px_rgba(0,0,0,0.85)] text-neutral-200"
    : "bg-slate-950/95 backdrop-blur-md border-cyan-500/30 shadow-[0_12px_36px_rgba(0,0,0,0.9)] text-slate-200";

  return (
    <div className={`relative inline-block w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
          {label}
        </label>
      )}

      {/* Select Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg transition-all duration-150 cursor-pointer outline-none select-none font-medium ${sizeClasses} ${themeButtonClass} ${
          isOpen
            ? isVS
              ? "border-[#f05a28] ring-1 ring-[#f05a28]/30"
              : "border-cyan-400 ring-1 ring-cyan-400/40"
            : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate text-left flex-1 min-w-0">
          {icon || selectedOption?.icon}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          } ${isVS ? "text-neutral-400" : "text-cyan-400"}`}
        />
      </button>

      {/* Custom Floating Options Menu via React Portal to prevent clipping */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{ ...menuStyle, scrollbarWidth: "thin" }}
            className={`overflow-y-auto rounded-lg border py-1 transition-opacity animate-fadeIn ${themeMenuClass} ${menuClassName}`}
          >
            {groupedOptions ? (
              Object.entries(groupedOptions).map(([category, catOptions]) => (
                <div key={category} className="py-1">
                  <div
                    className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider ${
                      isVS ? "text-[#f05a28] bg-neutral-900/80" : "text-cyan-400 bg-cyan-950/60"
                    }`}
                  >
                    {category}
                  </div>
                  {catOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <div
                        key={String(opt.value)}
                        onClick={() => {
                          onChange(opt.value);
                          setIsOpen(false);
                        }}
                        className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer transition select-none ${
                          isSelected
                            ? isVS
                              ? "bg-[#2d2d2d] text-[#f05a28] font-bold"
                              : "bg-cyan-500/20 text-cyan-300 font-bold"
                            : isVS
                            ? "hover:bg-[#282828] text-neutral-300 hover:text-white"
                            : "hover:bg-slate-800/80 text-slate-300 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {opt.icon}
                          <div className="flex flex-col">
                            <span className="truncate">{opt.label}</span>
                            {opt.description && (
                              <span className="text-[10px] text-neutral-400 truncate font-normal">
                                {opt.description}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <Check
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isVS ? "text-[#f05a28]" : "text-cyan-400"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={String(opt.value)}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer transition select-none ${
                      isSelected
                        ? isVS
                          ? "bg-[#2d2d2d] text-[#f05a28] font-bold"
                          : "bg-cyan-500/20 text-cyan-300 font-bold"
                        : isVS
                        ? "hover:bg-[#282828] text-neutral-300 hover:text-white"
                        : "hover:bg-slate-800/80 text-slate-300 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon}
                      <div className="flex flex-col">
                        <span className="truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="text-[10px] text-neutral-400 truncate font-normal">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check
                        className={`w-3.5 h-3.5 shrink-0 ${isVS ? "text-[#f05a28]" : "text-cyan-400"}`}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}


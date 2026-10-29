import { VectorElement } from "../components/IllustratorCanvas";
import { renderArtworkToCanvas } from "./canvasExporter";

/**
 * Color utility helpers for parsing and converting colors
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  if (!hex || hex === "none" || hex === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Handle rgba(...) or rgb(...)
  if (hex.startsWith("rgb")) {
    const parts = hex.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      return {
        r: Math.min(255, Math.max(0, parseInt(parts[0], 10))),
        g: Math.min(255, Math.max(0, parseInt(parts[1], 10))),
        b: Math.min(255, Math.max(0, parseInt(parts[2], 10))),
        a: parts.length >= 4 ? parseFloat(parts[3]) : 1,
      };
    }
  }

  let cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((c) => c + c).join("");
  }
  if (cleanHex.length === 6) {
    const num = parseInt(cleanHex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
      a: 1,
    };
  }
  if (cleanHex.length === 8) {
    const num = parseInt(cleanHex, 16);
    return {
      r: (num >> 24) & 255,
      g: (num >> 16) & 255,
      b: (num >> 8) & 255,
      a: (num & 255) / 255,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = (h % 360) / 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return { r, g, b };
}

/**
 * Path coordinate translation helper
 */
export function translatePathString(path: string, dx: number, dy: number): string {
  if (!path) return path;
  let isX = true;
  return path.replace(
    /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g,
    (match, cmd, num) => {
      if (cmd) {
        if (cmd.toUpperCase() === "Z") {
          isX = true;
          return cmd;
        }
        if (cmd.toUpperCase() === "H") {
          isX = true;
          return cmd;
        }
        if (cmd.toUpperCase() === "V") {
          isX = false;
          return cmd;
        }
        isX = true;
        return cmd;
      }
      if (num !== undefined) {
        const val = parseFloat(num);
        let res = val;
        if (isX) res += dx;
        else res += dy;
        isX = !isX;
        return res.toString();
      }
      return match;
    }
  );
}

/**
 * Calculates the exact content bounding box across all visible elements on the canvas
 * using both high-resolution pixel scan and vector geometric bounds.
 */
export async function calculateSmartCropBounds(
  elements: VectorElement[],
  canvasWidth: number,
  canvasHeight: number
): Promise<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cropWidth: number;
  cropHeight: number;
  hasContent: boolean;
}> {
  const visibleElements = elements.filter((el) => !el.isHidden);
  if (visibleElements.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: canvasWidth,
      maxY: canvasHeight,
      cropWidth: canvasWidth,
      cropHeight: canvasHeight,
      hasContent: false,
    };
  }

  let pixelMinX = Infinity;
  let pixelMinY = Infinity;
  let pixelMaxX = -Infinity;
  let pixelMaxY = -Infinity;
  let foundPixels = false;

  try {
    // 1. Render all visible elements with transparent background to scan non-empty pixels
    const { canvas } = await renderArtworkToCanvas({
      elements: visibleElements,
      canvasWidth,
      canvasHeight,
      exportWithTransparentBg: true,
      scaleMultiplier: 1,
    });

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const w = canvas.width;
      const h = canvas.height;

      // Scan bounding box of non-transparent pixels (alpha > 4)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const alpha = data[(y * w + x) * 4 + 3];
          if (alpha > 4) {
            if (x < pixelMinX) pixelMinX = x;
            if (x > pixelMaxX) pixelMaxX = x;
            if (y < pixelMinY) pixelMinY = y;
            if (y > pixelMaxY) pixelMaxY = y;
            foundPixels = true;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Pixel scan fallback to geometric bounds:", err);
  }

  // 2. Compute vector geometric bounds as reference & safety check
  let geomMinX = Infinity;
  let geomMinY = Infinity;
  let geomMaxX = -Infinity;
  let geomMaxY = -Infinity;

  visibleElements.forEach((el) => {
    const strokePadding = (el.strokeWidth || 0) / 2 + (el.contourWidth || 0);
    const x1 = el.x - strokePadding;
    const y1 = el.y - strokePadding;
    const x2 = el.x + el.width + strokePadding;
    const y2 = el.y + el.height + strokePadding;

    if (!el.rotate || el.rotate === 0) {
      if (x1 < geomMinX) geomMinX = x1;
      if (y1 < geomMinY) geomMinY = y1;
      if (x2 > geomMaxX) geomMaxX = x2;
      if (y2 > geomMaxY) geomMaxY = y2;
    } else {
      // Rotate 4 bounding corners around element center
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const rad = (el.rotate * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const corners = [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ];

      corners.forEach((pt) => {
        const rx = cx + (pt.x - cx) * cos - (pt.y - cy) * sin;
        const ry = cy + (pt.x - cx) * sin + (pt.y - cy) * cos;
        if (rx < geomMinX) geomMinX = rx;
        if (ry < geomMinY) geomMinY = ry;
        if (rx > geomMaxX) geomMaxX = rx;
        if (ry > geomMaxY) geomMaxY = ry;
      });
    }
  });

  // Combine pixel scan with geometric bounds
  let finalMinX: number;
  let finalMinY: number;
  let finalMaxX: number;
  let finalMaxY: number;

  if (foundPixels && pixelMinX <= pixelMaxX && pixelMinY <= pixelMaxY) {
    // Pixel scan is exact; include slight rounding to guarantee crisp edges
    finalMinX = Math.floor(pixelMinX);
    finalMinY = Math.floor(pixelMinY);
    finalMaxX = Math.ceil(pixelMaxX);
    finalMaxY = Math.ceil(pixelMaxY);
  } else if (geomMinX !== Infinity && geomMinX <= geomMaxX) {
    finalMinX = Math.max(0, Math.floor(geomMinX));
    finalMinY = Math.max(0, Math.floor(geomMinY));
    finalMaxX = Math.min(canvasWidth, Math.ceil(geomMaxX));
    finalMaxY = Math.min(canvasHeight, Math.ceil(geomMaxY));
  } else {
    return {
      minX: 0,
      minY: 0,
      maxX: canvasWidth,
      maxY: canvasHeight,
      cropWidth: canvasWidth,
      cropHeight: canvasHeight,
      hasContent: false,
    };
  }

  const cropWidth = Math.max(10, finalMaxX - finalMinX + 1);
  const cropHeight = Math.max(10, finalMaxY - finalMinY + 1);

  return {
    minX: finalMinX,
    minY: finalMinY,
    maxX: finalMaxX,
    maxY: finalMaxY,
    cropWidth,
    cropHeight,
    hasContent: true,
  };
}

/**
 * Shifts all elements and their associated path data and eraser strokes
 * to accommodate the new smart-cropped canvas dimensions.
 */
export function applySmartCropOffset(
  elements: VectorElement[],
  offsetX: number,
  offsetY: number
): VectorElement[] {
  return elements.map((el) => {
    const newX = el.x - offsetX;
    const newY = el.y - offsetY;

    let newPathData = el.pathData;
    if (
      el.pathData &&
      (el.type === "path" ||
        el.type === "line" ||
        el.type === "clone-stamp" ||
        el.type === "dodge" ||
        el.type === "burn" ||
        el.type === "shape" ||
        el.type === "arc")
    ) {
      newPathData = translatePathString(el.pathData, -offsetX, -offsetY);
    }

    let newEraserStrokes = el.eraserStrokes;
    if (el.eraserStrokes && el.eraserStrokes.length > 0) {
      newEraserStrokes = el.eraserStrokes.map((stroke) => ({
        ...stroke,
        path: translatePathString(stroke.path, -offsetX, -offsetY),
      }));
    }

    return {
      ...el,
      x: newX,
      y: newY,
      pathData: newPathData,
      eraserStrokes: newEraserStrokes,
    };
  });
}

/**
 * --------------------------------------------------------------------------
 * FILTER TRANSFORMATIONS
 * --------------------------------------------------------------------------
 */

// Helper to determine target element IDs
function getTargetElements(elements: VectorElement[], targetIds?: string[]): VectorElement[] {
  if (targetIds && targetIds.length > 0) {
    const targets = elements.filter((el) => targetIds.includes(el.id) && !el.isLocked);
    if (targets.length > 0) return targets;
  }
  return elements.filter((el) => !el.isHidden && !el.isLocked);
}

/**
 * Metallic Chrome / Brushed Silver & Gold Filter
 */
export function applyMetallicFilter(
  elements: VectorElement[],
  targetIds?: string[],
  variant: "chrome" | "gold" = "chrome"
): VectorElement[] {
  const targets = getTargetElements(elements, targetIds);
  const targetIdSet = new Set(targets.map((t) => t.id));

  const chromeGradient = ["#E2E8F0", "#FFFFFF", "#94A3B8", "#F8FAFC", "#475569"];
  const goldGradient = ["#FDE047", "#FEF08A", "#CA8A04", "#FEF9C3", "#854D0E"];
  const gradientColors = variant === "gold" ? goldGradient : chromeGradient;

  return elements.map((el) => {
    if (!targetIdSet.has(el.id)) return el;

    return {
      ...el,
      fillGradient: true,
      fillGradientType: "linear" as const,
      fillGradientAngle: 135,
      fillGradientColors: [...gradientColors],
      stroke: variant === "gold" ? "#FEF08A" : "#FFFFFF",
      strokeWidth: Math.max(1.5, el.strokeWidth || 1.5),
      contourColor: variant === "gold" ? "#713F12" : "#1E293B",
      contourWidth: 1.5,
    };
  });
}

/**
 * Hand-Drawn Sketch / Pencil Filter
 */
export function applySketchFilter(
  elements: VectorElement[],
  targetIds?: string[]
): VectorElement[] {
  const targets = getTargetElements(elements, targetIds);
  const targetIdSet = new Set(targets.map((t) => t.id));

  return elements.map((el) => {
    if (!targetIdSet.has(el.id)) return el;

    return {
      ...el,
      fillGradient: false,
      fillGradientColors: [],
      fill: el.fill === "none" ? "none" : "#F8FAFC",
      stroke: "#1E293B",
      strokeWidth: Math.max(2, (el.strokeWidth || 1) + 1),
      strokeDash: "solid" as const,
      contourColor: "#64748B",
      contourWidth: 0.8,
      opacity: Math.min(1, Math.max(0.85, el.opacity || 1)),
    };
  });
}

/**
 * Cyberpunk Electric Neon Glow Filter
 */
export function applyNeonFilter(
  elements: VectorElement[],
  targetIds?: string[]
): VectorElement[] {
  const targets = getTargetElements(elements, targetIds);
  const targetIdSet = new Set(targets.map((t) => t.id));

  const neonPalettes = [
    { fill: ["#00F0FF", "#7000FF"], stroke: "#00F0FF", contour: "#FF007F" },
    { fill: ["#FF007F", "#FF8A00"], stroke: "#FF007F", contour: "#00F0FF" },
    { fill: ["#39FF14", "#00F0FF"], stroke: "#39FF14", contour: "#7000FF" },
    { fill: ["#B026FF", "#FF007F"], stroke: "#B026FF", contour: "#00F0FF" },
  ];

  let palIdx = 0;

  return elements.map((el) => {
    if (!targetIdSet.has(el.id)) return el;
    const pal = neonPalettes[palIdx % neonPalettes.length];
    palIdx++;

    return {
      ...el,
      fillGradient: true,
      fillGradientType: "linear" as const,
      fillGradientAngle: 45,
      fillGradientColors: [...pal.fill],
      stroke: pal.stroke,
      strokeWidth: Math.max(2, el.strokeWidth || 2),
      contourColor: pal.contour,
      contourWidth: 3,
      opacity: 1,
    };
  });
}

/**
 * Monochrome / Noir & Blanc (Grayscale) Filter
 */
export function applyMonochromeFilter(
  elements: VectorElement[],
  targetIds?: string[]
): VectorElement[] {
  const targets = getTargetElements(elements, targetIds);
  const targetIdSet = new Set(targets.map((t) => t.id));

  const toGrayHex = (colorStr?: string) => {
    if (!colorStr || colorStr === "none" || colorStr === "transparent") return colorStr || "none";
    const rgb = hexToRgb(colorStr);
    const lum = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
    return rgbToHex(lum, lum, lum);
  };

  return elements.map((el) => {
    if (!targetIdSet.has(el.id)) return el;

    const newFill = toGrayHex(el.fill);
    const newStroke = toGrayHex(el.stroke);
    const newContour = el.contourColor ? toGrayHex(el.contourColor) : undefined;
    const newGradientColors = (el.fillGradientColors || []).map((c) => toGrayHex(c));

    return {
      ...el,
      fill: newFill,
      stroke: newStroke,
      contourColor: newContour,
      fillGradientColors: newGradientColors,
    };
  });
}

/**
 * 70s Warm Vintage / Retro Filter
 */
export function applyVintageFilter(
  elements: VectorElement[],
  targetIds?: string[]
): VectorElement[] {
  const targets = getTargetElements(elements, targetIds);
  const targetIdSet = new Set(targets.map((t) => t.id));

  const vintageColors = ["#D97706", "#B45309", "#9A3412", "#047857", "#1E3A8A", "#78350F"];
  let colorIdx = 0;

  return elements.map((el) => {
    if (!targetIdSet.has(el.id)) return el;

    const vColor = vintageColors[colorIdx % vintageColors.length];
    colorIdx++;

    return {
      ...el,
      fillGradient: true,
      fillGradientType: "linear" as const,
      fillGradientAngle: 120,
      fillGradientColors: [vColor, "#FEF3C7"],
      stroke: "#451A03",
      strokeWidth: Math.max(1.5, el.strokeWidth || 1.5),
      contourColor: "#78350F",
      contourWidth: 1,
    };
  });
}

/**
 * Frosted Glass / Glassmorphism Filter
 */
export function applyGlassmorphismFilter(
  elements: VectorElement[],
  targetIds?: string[]
): VectorElement[] {
  const targets = getTargetElements(elements, targetIds);
  const targetIdSet = new Set(targets.map((t) => t.id));

  return elements.map((el) => {
    if (!targetIdSet.has(el.id)) return el;

    return {
      ...el,
      fillGradient: true,
      fillGradientType: "linear" as const,
      fillGradientAngle: 135,
      fillGradientColors: ["rgba(255, 255, 255, 0.45)", "rgba(255, 255, 255, 0.10)"],
      fill: "rgba(255, 255, 255, 0.25)",
      stroke: "#FFFFFF",
      strokeWidth: 1.5,
      contourColor: "rgba(0, 0, 0, 0.18)",
      contourWidth: 2,
      opacity: 0.88,
    };
  });
}

/**
 * Adjusts brightness, contrast, saturation, or color balance
 */
export function adjustElementColors(
  elements: VectorElement[],
  mode: "brightness" | "contrast" | "saturation" | "balance",
  delta: number,
  targetIds?: string[]
): VectorElement[] {
  const targets = getTargetElements(elements, targetIds);
  const targetIdSet = new Set(targets.map((t) => t.id));

  const transformColor = (colorStr?: string): string => {
    if (!colorStr || colorStr === "none" || colorStr === "transparent" || colorStr.startsWith("url")) {
      return colorStr || "none";
    }

    const { r, g, b, a } = hexToRgb(colorStr);

    if (mode === "brightness") {
      const nr = Math.min(255, Math.max(0, r + delta));
      const ng = Math.min(255, Math.max(0, g + delta));
      const nb = Math.min(255, Math.max(0, b + delta));
      return a < 1 ? `rgba(${nr}, ${ng}, ${nb}, ${a})` : rgbToHex(nr, ng, nb);
    }

    if (mode === "contrast") {
      const factor = (259 * (delta + 255)) / (255 * (259 - delta));
      const nr = Math.min(255, Math.max(0, Math.round(factor * (r - 128) + 128)));
      const ng = Math.min(255, Math.max(0, Math.round(factor * (g - 128) + 128)));
      const nb = Math.min(255, Math.max(0, Math.round(factor * (b - 128) + 128)));
      return a < 1 ? `rgba(${nr}, ${ng}, ${nb}, ${a})` : rgbToHex(nr, ng, nb);
    }

    if (mode === "saturation") {
      const hsl = rgbToHsl(r, g, b);
      const newS = Math.min(100, Math.max(0, hsl.s + delta));
      const { r: nr, g: ng, b: nb } = hslToRgb(hsl.h, newS, hsl.l);
      return a < 1 ? `rgba(${nr}, ${ng}, ${nb}, ${a})` : rgbToHex(nr, ng, nb);
    }

    if (mode === "balance") {
      // Warm / Cool balance adjustment (warm = +R, -B; cool = -R, +B)
      const nr = Math.min(255, Math.max(0, r + delta));
      const ng = Math.min(255, Math.max(0, g + Math.round(delta * 0.3)));
      const nb = Math.min(255, Math.max(0, b - delta));
      return a < 1 ? `rgba(${nr}, ${ng}, ${nb}, ${a})` : rgbToHex(nr, ng, nb);
    }

    return colorStr;
  };

  return elements.map((el) => {
    if (!targetIdSet.has(el.id)) return el;

    return {
      ...el,
      fill: transformColor(el.fill),
      stroke: transformColor(el.stroke),
      contourColor: el.contourColor ? transformColor(el.contourColor) : undefined,
      fillGradientColors: (el.fillGradientColors || []).map(transformColor),
    };
  });
}

/**
 * AI / Smart Designer Stylization Harmonic Enhancement
 */
export function applyAiHarmonization(
  elements: VectorElement[],
  targetIds?: string[]
): VectorElement[] {
  const targets = getTargetElements(elements, targetIds);
  const targetIdSet = new Set(targets.map((t) => t.id));

  // Harmonized luxury palette
  const palettes = [
    { fill: "#1E293B", stroke: "#F59E0B", grad: ["#0F172A", "#334155"] },
    { fill: "#047857", stroke: "#FDE68A", grad: ["#064E3B", "#10B981"] },
    { fill: "#4338CA", stroke: "#E0E7FF", grad: ["#312E81", "#6366F1"] },
    { fill: "#BE123C", stroke: "#FECDD3", grad: ["#881337", "#F43F5E"] },
  ];

  let pIdx = 0;

  return elements.map((el) => {
    if (!targetIdSet.has(el.id)) return el;
    const p = palettes[pIdx % palettes.length];
    pIdx++;

    return {
      ...el,
      fillGradient: true,
      fillGradientType: "linear" as const,
      fillGradientAngle: 45,
      fillGradientColors: [...p.grad],
      stroke: p.stroke,
      strokeWidth: Math.max(1.5, el.strokeWidth || 1.5),
      opacity: 1,
    };
  });
}

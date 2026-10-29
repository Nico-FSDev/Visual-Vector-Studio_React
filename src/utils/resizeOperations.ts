import { VectorElement } from "../components/IllustratorCanvas";
import { translatePathString } from "./filterEffects";

export type ResizeTargetMode = "canvas" | "image" | "both";
export type ResizeUnit = "px" | "percent";
export type ResizeAnchor = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface ResizeOptions {
  mode: ResizeTargetMode;
  unit: ResizeUnit;
  targetWidth: number;
  targetHeight: number;
  percentX: number;
  percentY: number;
  lockAspectRatio: boolean;
  anchor: ResizeAnchor;
  scaleStrokeWidth?: boolean;
}

/**
 * Scales an SVG path string from an origin point (ox, oy) by scale factors (sx, sy)
 */
export function scalePathString(
  path: string,
  sx: number,
  sy: number,
  originX: number = 0,
  originY: number = 0
): string {
  if (!path) return path;
  let isX = true;

  return path.replace(
    /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g,
    (match, cmd, num) => {
      if (cmd) {
        const upper = cmd.toUpperCase();
        if (upper === "Z") {
          isX = true;
          return cmd;
        }
        if (upper === "H") {
          isX = true;
          return cmd;
        }
        if (upper === "V") {
          isX = false;
          return cmd;
        }
        isX = true;
        return cmd;
      }
      if (num !== undefined) {
        const val = parseFloat(num);
        let res = val;
        if (isX) {
          res = originX + (val - originX) * sx;
        } else {
          res = originY + (val - originY) * sy;
        }
        isX = !isX;
        // Keep clean decimal precision
        return Number(res.toFixed(4)).toString();
      }
      return match;
    }
  );
}

/**
 * Calculates the total bounding box for a given list of vector elements
 */
export function getElementsBoundingBox(elements: VectorElement[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  const visible = elements.filter((el) => !el.isHidden);
  if (visible.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  visible.forEach((el) => {
    const strokePad = (el.strokeWidth || 0) / 2 + (el.contourWidth || 0);
    const x1 = el.x - strokePad;
    const y1 = el.y - strokePad;
    const x2 = el.x + el.width + strokePad;
    const y2 = el.y + el.height + strokePad;

    if (!el.rotate || el.rotate === 0) {
      if (x1 < minX) minX = x1;
      if (y1 < minY) minY = y1;
      if (x2 > maxX) maxX = x2;
      if (y2 > maxY) maxY = y2;
    } else {
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
        if (rx < minX) minX = rx;
        if (ry < minY) minY = ry;
        if (rx > maxX) maxX = rx;
        if (ry > maxY) maxY = ry;
      });
    }
  });

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/**
 * 1. RESIZE CANVAS ONLY
 * Changes canvas dimensions. Shifts elements based on selected anchor point.
 */
export function resizeCanvasOnly(
  elements: VectorElement[],
  currentWidth: number,
  currentHeight: number,
  newWidth: number,
  newHeight: number,
  anchor: ResizeAnchor = "center"
): {
  newWidth: number;
  newHeight: number;
  elements: VectorElement[];
} {
  newWidth = Math.max(10, Math.round(newWidth));
  newHeight = Math.max(10, Math.round(newHeight));

  let shiftX = 0;
  let shiftY = 0;

  if (anchor === "center") {
    shiftX = (newWidth - currentWidth) / 2;
    shiftY = (newHeight - currentHeight) / 2;
  } else if (anchor === "top-right") {
    shiftX = newWidth - currentWidth;
    shiftY = 0;
  } else if (anchor === "bottom-left") {
    shiftX = 0;
    shiftY = newHeight - currentHeight;
  } else if (anchor === "bottom-right") {
    shiftX = newWidth - currentWidth;
    shiftY = newHeight - currentHeight;
  } else {
    // "top-left": no coordinate shifting
    shiftX = 0;
    shiftY = 0;
  }

  if (shiftX === 0 && shiftY === 0) {
    return {
      newWidth,
      newHeight,
      elements: [...elements],
    };
  }

  const updatedElements = elements.map((el) => {
    let newPathData = el.pathData;
    if (el.pathData) {
      newPathData = translatePathString(el.pathData, shiftX, shiftY);
    }

    let newEraserStrokes = el.eraserStrokes;
    if (el.eraserStrokes && el.eraserStrokes.length > 0) {
      newEraserStrokes = el.eraserStrokes.map((s) => ({
        ...s,
        path: translatePathString(s.path, shiftX, shiftY),
      }));
    }

    return {
      ...el,
      x: el.x + shiftX,
      y: el.y + shiftY,
      pathData: newPathData,
      eraserStrokes: newEraserStrokes,
    };
  });

  return {
    newWidth,
    newHeight,
    elements: updatedElements,
  };
}

/**
 * 2. RESIZE IMAGE / ELEMENTS ONLY
 * Scales selected elements (or all elements if none selected) to target size / percentage
 */
export function resizeElementsOnly(
  elements: VectorElement[],
  targetIds: string[] | undefined,
  targetWidth: number,
  targetHeight: number,
  anchor: ResizeAnchor = "center",
  scaleStrokes: boolean = false
): VectorElement[] {
  let targets = elements.filter((el) => !el.isLocked);
  if (targetIds && targetIds.length > 0) {
    const specified = elements.filter((el) => targetIds.includes(el.id) && !el.isLocked);
    if (specified.length > 0) {
      targets = specified;
    }
  }

  if (targets.length === 0) return elements;

  const targetIdSet = new Set(targets.map((t) => t.id));
  const bounds = getElementsBoundingBox(targets);

  if (bounds.width <= 0 || bounds.height <= 0) return elements;

  const sx = targetWidth / bounds.width;
  const sy = targetHeight / bounds.height;

  let originX = bounds.minX;
  let originY = bounds.minY;

  if (anchor === "center") {
    originX = bounds.centerX;
    originY = bounds.centerY;
  } else if (anchor === "top-right") {
    originX = bounds.maxX;
    originY = bounds.minY;
  } else if (anchor === "bottom-left") {
    originX = bounds.minX;
    originY = bounds.maxY;
  } else if (anchor === "bottom-right") {
    originX = bounds.maxX;
    originY = bounds.maxY;
  }

  return elements.map((el) => {
    if (!targetIdSet.has(el.id)) return el;

    // Scale element bounds relative to origin
    const newX = originX + (el.x - originX) * sx;
    const newY = originY + (el.y - originY) * sy;
    const newW = Math.max(1, el.width * sx);
    const newH = Math.max(1, el.height * sy);

    let newPathData = el.pathData;
    if (el.pathData) {
      newPathData = scalePathString(el.pathData, sx, sy, originX, originY);
    }

    let newEraserStrokes = el.eraserStrokes;
    if (el.eraserStrokes && el.eraserStrokes.length > 0) {
      newEraserStrokes = el.eraserStrokes.map((s) => ({
        ...s,
        path: scalePathString(s.path, sx, sy, originX, originY),
      }));
    }

    const newStrokeWidth = scaleStrokes && el.strokeWidth
      ? Math.max(0.5, el.strokeWidth * ((sx + sy) / 2))
      : el.strokeWidth;

    return {
      ...el,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      strokeWidth: newStrokeWidth,
      pathData: newPathData,
      eraserStrokes: newEraserStrokes,
    };
  });
}

/**
 * 3. RESIZE IMAGE AND CANVAS (BOTH SYNCHRONOUSLY)
 * Scales both canvas viewport and all elements proportionally or to target dimensions.
 */
export function resizeImageAndCanvas(
  elements: VectorElement[],
  currentCanvasWidth: number,
  currentCanvasHeight: number,
  targetCanvasWidth: number,
  targetCanvasHeight: number,
  scaleStrokes: boolean = true
): {
  newWidth: number;
  newHeight: number;
  elements: VectorElement[];
} {
  targetCanvasWidth = Math.max(10, Math.round(targetCanvasWidth));
  targetCanvasHeight = Math.max(10, Math.round(targetCanvasHeight));

  const sx = targetCanvasWidth / currentCanvasWidth;
  const sy = targetCanvasHeight / currentCanvasHeight;

  const updatedElements = elements.map((el) => {
    const newX = el.x * sx;
    const newY = el.y * sy;
    const newW = Math.max(1, el.width * sx);
    const newH = Math.max(1, el.height * sy);

    let newPathData = el.pathData;
    if (el.pathData) {
      newPathData = scalePathString(el.pathData, sx, sy, 0, 0);
    }

    let newEraserStrokes = el.eraserStrokes;
    if (el.eraserStrokes && el.eraserStrokes.length > 0) {
      newEraserStrokes = el.eraserStrokes.map((s) => ({
        ...s,
        path: scalePathString(s.path, sx, sy, 0, 0),
      }));
    }

    const newStrokeWidth = scaleStrokes && el.strokeWidth
      ? Math.max(0.5, el.strokeWidth * ((sx + sy) / 2))
      : el.strokeWidth;

    return {
      ...el,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      strokeWidth: newStrokeWidth,
      pathData: newPathData,
      eraserStrokes: newEraserStrokes,
    };
  });

  return {
    newWidth: targetCanvasWidth,
    newHeight: targetCanvasHeight,
    elements: updatedElements,
  };
}

/**
 * Canvas Exporter Utility
 * High-definition rendering of vector elements to raster images (PNG, JPEG, WebP, PDF) and file downloading
 */
import jsPDF from "jspdf";

export interface RenderCanvasOptions {
  elements: any[];
  canvasWidth: number;
  canvasHeight: number;
  canvasBgColor?: string;
  exportWithTransparentBg?: boolean;
  targetWidth?: number;
  targetHeight?: number;
  scaleMultiplier?: number;
  targetMaxDim?: number;
  format?: "png" | "jpeg" | "webp";
  quality?: number;
}

export interface RenderResult {
  dataUrl: string;
  blob: Blob;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface ExportPdfOptions {
  elements: any[];
  canvasWidth: number;
  canvasHeight: number;
  canvasBgColor?: string;
  exportWithTransparentBg?: boolean;
  orientation?: "portrait" | "landscape" | "auto";
  pageFormat?: "a4" | "a3" | "letter" | "artboard";
  marginMm?: number;
  filename?: string;
}

export function triggerFileDownload(
  data: Blob | string,
  filename: string,
  _mimeType?: string
): { url: string } {
  let url = "";
  if (typeof data === "string") {
    url = data;
  } else if (data instanceof Blob) {
    url = URL.createObjectURL(data);
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return { url };
}

// Generate star path for canvas
function generateStarPath(cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): Path2D {
  const p = new Path2D();
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  p.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    p.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    p.lineTo(x, y);
    rot += step;
  }
  p.closePath();
  return p;
}

// Generate shape path for standard shapes
function getShapePath2D(el: any): Path2D {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const w = el.width / 2;
  const h = el.height / 2;
  const type = el.shapeType;

  if (el.type === "star") {
    return generateStarPath(cx, cy, el.points || 5, el.width / 2, el.width / 4);
  }

  const p = new Path2D();

  if (type === "triangle") {
    p.moveTo(cx, el.y);
    p.lineTo(el.x + el.width, el.y + el.height);
    p.lineTo(el.x, el.y + el.height);
    p.closePath();
    return p;
  }
  if (type === "diamond") {
    p.moveTo(cx, el.y);
    p.lineTo(el.x + el.width, cy);
    p.lineTo(cx, el.y + el.height);
    p.lineTo(el.x, cy);
    p.closePath();
    return p;
  }
  if (type === "parallelogram") {
    p.moveTo(el.x + w * 0.5, el.y);
    p.lineTo(el.x + el.width, el.y);
    p.lineTo(el.x + w * 1.5, el.y + el.height);
    p.lineTo(el.x, el.y + el.height);
    p.closePath();
    return p;
  }
  if (type === "trapezoid") {
    p.moveTo(el.x + w * 0.5, el.y);
    p.lineTo(el.x + w * 1.5, el.y);
    p.lineTo(el.x + el.width, el.y + el.height);
    p.lineTo(el.x, el.y + el.height);
    p.closePath();
    return p;
  }
  if (type === "cross") {
    p.moveTo(cx - w / 3, el.y);
    p.lineTo(cx + w / 3, el.y);
    p.lineTo(cx + w / 3, cy - h / 3);
    p.lineTo(el.x + el.width, cy - h / 3);
    p.lineTo(el.x + el.width, cy + h / 3);
    p.lineTo(cx + w / 3, cy + h / 3);
    p.lineTo(cx + w / 3, el.y + el.height);
    p.lineTo(cx - w / 3, el.y + el.height);
    p.lineTo(cx - w / 3, cy + h / 3);
    p.lineTo(el.x, cy + h / 3);
    p.lineTo(el.x, cy - h / 3);
    p.lineTo(cx - w / 3, cy - h / 3);
    p.closePath();
    return p;
  }
  if (type === "hexagon" || type === "octagon" || type === "pentagon") {
    const polyPoints = type === "hexagon" ? 6 : type === "octagon" ? 8 : 5;
    for (let i = 0; i < polyPoints; i++) {
      const a = (i * 2 * Math.PI) / polyPoints - Math.PI / 2;
      const px = cx + w * Math.cos(a);
      const py = cy + h * Math.sin(a);
      if (i === 0) p.moveTo(px, py);
      else p.lineTo(px, py);
    }
    p.closePath();
    return p;
  }

  // Fallback if pathData exists
  if (el.pathData) {
    try {
      return new Path2D(el.pathData);
    } catch {
      // ignore
    }
  }

  // Default box
  p.rect(el.x, el.y, el.width, el.height);
  return p;
}

export async function renderArtworkToCanvas(options: RenderCanvasOptions): Promise<RenderResult> {
  const {
    elements = [],
    canvasWidth = 500,
    canvasHeight = 500,
    canvasBgColor = "transparent",
    exportWithTransparentBg = false,
    targetWidth,
    targetHeight,
    scaleMultiplier,
    targetMaxDim,
    format = "png",
    quality = 0.95
  } = options;

  let exportW = canvasWidth;
  let exportH = canvasHeight;

  if (targetWidth && targetHeight) {
    exportW = Math.round(targetWidth);
    exportH = Math.round(targetHeight);
  } else if (scaleMultiplier && scaleMultiplier > 0) {
    exportW = Math.round(canvasWidth * scaleMultiplier);
    exportH = Math.round(canvasHeight * scaleMultiplier);
  } else if (targetMaxDim && targetMaxDim > 0) {
    const maxOriginal = Math.max(canvasWidth, canvasHeight);
    const s = targetMaxDim / maxOriginal;
    exportW = Math.round(canvasWidth * s);
    exportH = Math.round(canvasHeight * s);
  }

  const scaleX = exportW / canvasWidth;
  const scaleY = exportH / canvasHeight;

  const canvas = document.createElement("canvas");
  canvas.width = exportW;
  canvas.height = exportH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    throw new Error("Unable to create 2D canvas context");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Scale context to match original artboard coordinates
  ctx.scale(scaleX, scaleY);

  // Background
  const effectiveBg =
    exportWithTransparentBg || format === "png" || format === "webp"
      ? exportWithTransparentBg
        ? "transparent"
        : canvasBgColor || "transparent"
      : canvasBgColor && canvasBgColor !== "transparent"
      ? canvasBgColor
      : "#ffffff";

  if (effectiveBg !== "transparent") {
    ctx.fillStyle = effectiveBg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Helper to load image
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  };

  // Render elements in document order
  for (const el of elements) {
    if (el.isHidden) continue;

    ctx.save();
    ctx.globalAlpha = typeof el.opacity === "number" ? Math.max(0, Math.min(1, el.opacity)) : 1;

    // Apply rotation & flip around center
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;

    if (el.rotate || el.flipX || el.flipY) {
      ctx.translate(cx, cy);
      if (el.rotate) {
        ctx.rotate((el.rotate * Math.PI) / 180);
      }
      if (el.flipX || el.flipY) {
        ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
      }
      ctx.translate(-cx, -cy);
    }

    // Determine fill style (solid or gradient)
    let fillStyle: string | CanvasGradient = el.fill || "#E2BA5A";
    if (el.fillGradient && el.fillGradientColors && el.fillGradientColors.length >= 2) {
      if (el.fillGradientType === "radial") {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(el.width, el.height) / 2);
        grad.addColorStop(0, el.fillGradientColors[0]);
        grad.addColorStop(1, el.fillGradientColors[1]);
        fillStyle = grad;
      } else {
        const angle = ((el.fillGradientAngle || 0) * Math.PI) / 180;
        const x1 = el.x;
        const y1 = el.y;
        const x2 = el.x + el.width * Math.cos(angle);
        const y2 = el.y + el.height * Math.sin(angle);
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, el.fillGradientColors[0]);
        grad.addColorStop(1, el.fillGradientColors[1]);
        fillStyle = grad;
      }
    }

    // Set dash if needed
    if (el.strokeDash === "dashed") {
      ctx.setLineDash([6, 6]);
    } else if (el.strokeDash === "dotted") {
      ctx.setLineDash([2, 4]);
    } else {
      ctx.setLineDash([]);
    }

    if (el.type === "image" && el.imageUrl) {
      try {
        const img = await loadImage(el.imageUrl);
        ctx.drawImage(img, el.x, el.y, el.width, el.height);
      } catch (err) {
        console.warn("Failed to load image element for export:", err);
      }
    } else if (el.type === "rect") {
      if (fillStyle !== "none") {
        ctx.fillStyle = fillStyle;
        if (el.rx && el.rx > 0 && typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(el.x, el.y, el.width, el.height, el.rx);
          ctx.fill();
        } else {
          ctx.fillRect(el.x, el.y, el.width, el.height);
        }
      }
      if (el.stroke && el.stroke !== "none" && el.strokeWidth) {
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.strokeWidth;
        if (el.rx && el.rx > 0 && typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(el.x, el.y, el.width, el.height, el.rx);
          ctx.stroke();
        } else {
          ctx.strokeRect(el.x, el.y, el.width, el.height);
        }
      }
    } else if (el.type === "circle" || el.type === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        Math.max(1, el.width / 2),
        Math.max(1, el.height / 2),
        0,
        0,
        2 * Math.PI
      );
      if (fillStyle !== "none") {
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }
      if (el.stroke && el.stroke !== "none" && el.strokeWidth) {
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.strokeWidth;
        ctx.stroke();
      }
    } else if (el.type === "line") {
      ctx.beginPath();
      if (el.pathData) {
        try {
          const p = new Path2D(el.pathData);
          ctx.strokeStyle = el.stroke || "#ffffff";
          ctx.lineWidth = el.strokeWidth || 2;
          ctx.stroke(p);
        } catch {
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.x + el.width, el.y + el.height);
          ctx.strokeStyle = el.stroke || "#ffffff";
          ctx.lineWidth = el.strokeWidth || 2;
          ctx.stroke();
        }
      } else {
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + el.width, el.y + el.height);
        ctx.strokeStyle = el.stroke || "#ffffff";
        ctx.lineWidth = el.strokeWidth || 2;
        ctx.stroke();
      }
    } else if (el.type === "text") {
      const fontSize = Math.max(10, el.height || 24);
      ctx.font = `${el.fontWeight || "normal"} ${fontSize}px ${el.fontFamily || "sans-serif"}`;
      ctx.textBaseline = "alphabetic";
      if (fillStyle !== "none") {
        ctx.fillStyle = fillStyle;
        ctx.fillText(el.textValue || el.name || "", el.x, el.y + fontSize * 0.85);
      }
      if (el.stroke && el.stroke !== "none" && el.strokeWidth) {
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.strokeWidth;
        ctx.strokeText(el.textValue || el.name || "", el.x, el.y + fontSize * 0.85);
      }
    } else if (el.type === "path") {
      if (el.pathData) {
        try {
          const p2d = new Path2D(el.pathData);
          if (fillStyle !== "none") {
            ctx.fillStyle = fillStyle;
            ctx.fill(p2d);
          }
          if (el.stroke && el.stroke !== "none" && el.strokeWidth) {
            ctx.strokeStyle = el.stroke;
            ctx.lineWidth = el.strokeWidth;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke(p2d);
          }
        } catch (err) {
          console.warn("Error rendering path2d:", err);
        }
      }
    } else if (el.type === "star" || el.type === "shape" || el.type === "arc") {
      try {
        const shapePath = getShapePath2D(el);
        if (el.type !== "arc" && fillStyle !== "none") {
          ctx.fillStyle = fillStyle;
          ctx.fill(shapePath);
        }
        if (el.stroke && el.stroke !== "none" && el.strokeWidth) {
          ctx.strokeStyle = el.stroke;
          ctx.lineWidth = el.strokeWidth;
          ctx.stroke(shapePath);
        }
      } catch (err) {
        console.warn("Error rendering shape:", err);
      }
    }

    ctx.restore();
  }

  const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  const dataUrl = canvas.toDataURL(mime, quality);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas blob conversion failed"));
      },
      mime,
      quality
    );
  });

  return {
    dataUrl,
    blob,
    canvas,
    width: exportW,
    height: exportH
  };
}

/**
 * High-definition PDF Export using jsPDF
 */
export async function exportArtworkToPdf(options: ExportPdfOptions): Promise<{ url: string; blob: Blob }> {
  const {
    elements,
    canvasWidth,
    canvasHeight,
    canvasBgColor = "#ffffff",
    exportWithTransparentBg = false,
    orientation = "auto",
    pageFormat = "a4",
    marginMm = 10,
    filename = `export-${Date.now()}.pdf`
  } = options;

  // Render high-res raster bitmap for PDF embedding (2x resolution for crisp 300 DPI print)
  const raster = await renderArtworkToCanvas({
    elements,
    canvasWidth,
    canvasHeight,
    canvasBgColor: exportWithTransparentBg ? "transparent" : canvasBgColor,
    exportWithTransparentBg,
    scaleMultiplier: 2.5,
    format: "png",
    quality: 1.0
  });

  let effectiveOrientation: "portrait" | "landscape" = "portrait";
  if (orientation === "auto") {
    effectiveOrientation = canvasWidth > canvasHeight ? "landscape" : "portrait";
  } else {
    effectiveOrientation = orientation;
  }

  let pdf: jsPDF;
  if (pageFormat === "artboard") {
    // Custom page size matching artboard aspect in mm
    const mmW = (canvasWidth / 96) * 25.4;
    const mmH = (canvasHeight / 96) * 25.4;
    pdf = new jsPDF({
      orientation: effectiveOrientation,
      unit: "mm",
      format: [mmW, mmH]
    });
    pdf.addImage(raster.dataUrl, "PNG", 0, 0, mmW, mmH);
  } else {
    pdf = new jsPDF({
      orientation: effectiveOrientation,
      unit: "mm",
      format: pageFormat
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const printableW = pageWidth - marginMm * 2;
    const printableH = pageHeight - marginMm * 2;

    const artboardRatio = canvasWidth / canvasHeight;
    let targetW = printableW;
    let targetH = targetW / artboardRatio;

    if (targetH > printableH) {
      targetH = printableH;
      targetW = targetH * artboardRatio;
    }

    const posX = marginMm + (printableW - targetW) / 2;
    const posY = marginMm + (printableH - targetH) / 2;

    pdf.addImage(raster.dataUrl, "PNG", posX, posY, targetW, targetH);
  }

  const pdfBlob = pdf.output("blob");
  const { url } = triggerFileDownload(pdfBlob, filename, "application/pdf");

  return { url, blob: pdfBlob };
}


import React, { useRef, useEffect } from "react";
import QRCode from "qrcode";
import { QRStyle } from "../types";

interface QRCodeCanvasProps {
  value: string;
  style: QRStyle;
  size?: number; // QR code render size (excluding frame paddings)
  customLogoFile?: string | null; // Data URL of a custom uploaded logo
  onDownloadReady?: (dataUrl: string) => void;
}

export const QRCodeCanvas: React.FC<QRCodeCanvasProps> = ({
  value,
  style,
  size = 400,
  customLogoFile,
  onDownloadReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Generate Raw QR Data Matrix with High Error Correction
    let qr: any;
    try {
      qr = QRCode.create(value || "https://ai.studio", {
        errorCorrectionLevel: "H", // High to tolerate large logos
      });
    } catch (err) {
      console.error("QR Code Generation Error:", err);
      return;
    }

    const {
      dotStyle,
      backgroundColor,
      backgroundGradient,
      backgroundGradientType,
      backgroundGradientColors,
      dotColor,
      dotGradient,
      dotGradientType,
      dotGradientColors,
      eyeOuterStyle,
      eyeInnerStyle,
      eyeOuterColor,
      eyeInnerColor,
      logoType,
      logoValue,
      logoSize,
      logoBgColor,
      logoBgShape,
      frameStyle,
      frameText,
      frameTextColor,
      frameBgColor,
    } = style;

    const matrixSize = qr.modules.size;
    const padding = 30; // internal white/color margin inside the frame
    
    // Frame sizing
    let topFramePadding = padding;
    let bottomFramePadding = padding;
    let leftFramePadding = padding;
    let rightFramePadding = padding;

    const hasFrame = frameStyle !== "none";
    if (hasFrame) {
      topFramePadding = 40;
      bottomFramePadding = 90; // space for frame text at bottom
      leftFramePadding = 35;
      rightFramePadding = 35;
    }

    const qrWidth = size;
    const qrHeight = size;
    
    const canvasWidth = qrWidth + leftFramePadding + rightFramePadding;
    const canvasHeight = qrHeight + topFramePadding + bottomFramePadding;

    canvas.width = canvasWidth * 2; // high-dpi scale
    canvas.height = canvasHeight * 2;
    // Set max width but allow proportional scaling
    canvas.style.width = "100%";
    canvas.style.maxWidth = `${canvasWidth}px`;
    canvas.style.height = "auto";
    canvas.style.aspectRatio = `${canvasWidth} / ${canvasHeight}`;
    
    ctx.scale(2, 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const cellSize = qrWidth / matrixSize;

    // Helper to check if row/col is within any eye pattern
    const isEye = (r: number, c: number) => {
      if (r >= 0 && r < 7 && c >= 0 && c < 7) return "top-left";
      if (r >= 0 && r < 7 && c >= matrixSize - 7 && c < matrixSize) return "top-right";
      if (r >= matrixSize - 7 && r < matrixSize && c >= 0 && c < 7) return "bottom-left";
      return null;
    };

    // Helper to check if row/col is in the central logo lockout zone
    const logoCellSpan = logoType !== "none" ? Math.ceil(matrixSize * logoSize) : 0;
    // ensure cell span is odd to center properly
    const adjustedLogoCellSpan = logoCellSpan % 2 === 0 ? logoCellSpan + 1 : logoCellSpan;
    const logoMinIndex = Math.floor((matrixSize - adjustedLogoCellSpan) / 2);
    const logoMaxIndex = logoMinIndex + adjustedLogoCellSpan;

    const isInsideLogo = (r: number, c: number) => {
      if (logoType !== "none" && adjustedLogoCellSpan > 0) {
        return r >= logoMinIndex && r < logoMaxIndex && c >= logoMinIndex && c < logoMaxIndex;
      }
      return false;
    };

    // Helper to verify if bit is dark (safely handles different library signatures)
    const isDark = (r: number, c: number) => {
      if (typeof qr.modules.isDark === "function") {
        return qr.modules.isDark(r, c);
      }
      return !!qr.modules.data[r * matrixSize + c];
    };

    // 2. Draw Frame Background / Overall Background
    ctx.save();
    if (hasFrame) {
      // Outer frame base border/shadow
      ctx.fillStyle = frameBgColor || "#0F172A";
      
      if (frameStyle === "bubble") {
        // Speech bubble shaped outer card
        ctx.beginPath();
        const rValue = 24;
        ctx.roundRect(0, 0, canvasWidth, canvasHeight, rValue);
        ctx.fill();

        // Little bubble tail at bottom
        ctx.beginPath();
        ctx.moveTo(canvasWidth / 2 - 12, canvasHeight);
        ctx.lineTo(canvasWidth / 2, canvasHeight + 10);
        ctx.lineTo(canvasWidth / 2 + 12, canvasHeight);
        ctx.closePath();
        ctx.fillStyle = frameBgColor || "#0F172A";
        ctx.fill();
      } else if (frameStyle === "minimalist") {
        // Slate sleek thin bordered card
        ctx.fillStyle = "#FAF8F5";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.strokeStyle = frameBgColor || "#2C2A29";
        ctx.lineWidth = 4;
        ctx.strokeRect(6, 6, canvasWidth - 12, canvasHeight - 12);
      } else if (frameStyle === "badge") {
        // Fancy certificate style
        ctx.fillStyle = "#1E1E2F";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.strokeStyle = frameBgColor || "#D4AF37"; // Golden border
        ctx.lineWidth = 5;
        ctx.strokeRect(8, 8, canvasWidth - 16, canvasHeight - 16);
        ctx.strokeRect(13, 13, canvasWidth - 26, canvasHeight - 26);
      } else {
        // Classic rectangular card style
        ctx.beginPath();
        ctx.roundRect(0, 0, canvasWidth, canvasHeight, 16);
        ctx.fill();
      }
    }
    ctx.restore();

    // 3. Draw QR Inner Canvas Background
    ctx.save();
    const qrInnerX = leftFramePadding;
    const qrInnerY = topFramePadding;

    // Draw the main background of QR code inside padding
    let qrBgStyle: string | CanvasGradient;
    if (backgroundGradient && backgroundGradientColors.length > 1) {
      if (backgroundGradientType === "linear") {
        const grad = ctx.createLinearGradient(qrInnerX, qrInnerY, qrInnerX + qrWidth, qrInnerY + qrHeight);
        backgroundGradientColors.forEach((color, i) => {
          grad.addColorStop(i / (backgroundGradientColors.length - 1), color);
        });
        qrBgStyle = grad;
      } else {
        const grad = ctx.createRadialGradient(
          qrInnerX + qrWidth / 2, qrInnerY + qrHeight / 2, 5,
          qrInnerX + qrWidth / 2, qrInnerY + qrHeight / 2, qrWidth * 0.70
        );
        backgroundGradientColors.forEach((color, i) => {
          grad.addColorStop(i / (backgroundGradientColors.length - 1), color);
        });
        qrBgStyle = grad;
      }
    } else {
      qrBgStyle = backgroundColor || "#FFFFFF";
    }

    ctx.fillStyle = qrBgStyle;
    if (hasFrame) {
      ctx.beginPath();
      // Draw nicely curved inner white rectangle holder
      ctx.roundRect(qrInnerX - 10, qrInnerY - 10, qrWidth + 20, qrHeight + 20, 12);
      ctx.fill();
    } else {
      // Pure non-frame background fills canvas
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    ctx.restore();

    // 4. Create Dot Fill Gradients / Colors for main matrix cells
    let qrDotFill: string | CanvasGradient;
    if (dotGradient && dotGradientColors.length > 1) {
      if (dotGradientType === "linear") {
        const grad = ctx.createLinearGradient(qrInnerX, qrInnerY, qrInnerX + qrWidth, qrInnerY + qrHeight);
        dotGradientColors.forEach((color, i) => {
          grad.addColorStop(i / (dotGradientColors.length - 1), color);
        });
        qrDotFill = grad;
      } else {
        const grad = ctx.createRadialGradient(
          qrInnerX + qrWidth / 2, qrInnerY + qrHeight / 2, 10,
          qrInnerX + qrWidth / 2, qrInnerY + qrHeight / 2, qrWidth * 0.75
        );
        dotGradientColors.forEach((color, i) => {
          grad.addColorStop(i / (dotGradientColors.length - 1), color);
        });
        qrDotFill = grad;
      }
    } else {
      qrDotFill = dotColor || "#1F2937";
    }

    // 5. Draw QR Code Foreground Dots (excluding eye patterns & central logo cutout)
    ctx.save();
    ctx.fillStyle = qrDotFill;

    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (!isDark(r, c)) continue;
        if (isEye(r, c)) continue;
        if (isInsideLogo(r, c)) continue;

        // Position of the cell in pixel coordinates on the canvas
        const cellX = qrInnerX + c * cellSize;
        const cellY = qrInnerY + r * cellSize;

        ctx.beginPath();
        if (dotStyle === "circle") {
          // Rounded circle modules (neat dots)
          const radius = cellSize * 0.42;
          ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (dotStyle === "dots") {
          // Smaller polar dots
          const radius = cellSize * 0.28;
          ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (dotStyle === "diamond") {
          // Shiny diamond shapes
          ctx.moveTo(cellX + cellSize / 2, cellY);
          ctx.lineTo(cellX + cellSize, cellY + cellSize / 2);
          ctx.lineTo(cellX + cellSize / 2, cellY + cellSize);
          ctx.lineTo(cellX, cellY + cellSize / 2);
          ctx.closePath();
          ctx.fill();
        } else if (dotStyle === "star") {
          // Luxurious sparkling four-point stars
          const cx = cellX + cellSize / 2;
          const cy = cellY + cellSize / 2;
          const rMax = cellSize * 0.5;
          const rMin = cellSize * 0.15;
          ctx.moveTo(cx, cy - rMax);
          ctx.quadraticCurveTo(cx, cy, cx + rMax, cy);
          ctx.quadraticCurveTo(cx, cy, cx, cy + rMax);
          ctx.quadraticCurveTo(cx, cy, cx - rMax, cy);
          ctx.quadraticCurveTo(cx, cy, cx, cy - rMax);
          ctx.closePath();
          ctx.fill();
        } else if (dotStyle === "rounded-connect") {
          // Liquid bubble modules (rounded corners for each coordinate)
          const radius = cellSize * 0.35;
          ctx.roundRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1, radius);
          ctx.fill();
        } else {
          // Standard traditional sharp squares
          ctx.fillRect(cellX + 0.3, cellY + 0.3, cellSize - 0.6, cellSize - 0.6);
        }
      }
    }
    ctx.restore();

    // 6. Draw custom eye patterns
    // We render 3 giant corners with detailed border and center nodes
    const eyes = [
      { r: 0, c: 0, label: "top-left" },
      { r: 0, c: matrixSize - 7, label: "top-right" },
      { r: matrixSize - 7, c: 0, label: "bottom-left" },
    ];

    eyes.forEach((eye) => {
      const eyeX = qrInnerX + eye.c * cellSize;
      const eyeY = qrInnerY + eye.r * cellSize;
      const eyeFullSize = 7 * cellSize;

      ctx.save();

      // Set eye colors
      const outerColor = eyeOuterColor || dotColor || "#1F2937";
      const innerColor = eyeInnerColor || dotColor || "#1F2937";

      // A) Outer Eye Frame
      ctx.strokeStyle = outerColor;
      ctx.lineWidth = cellSize;

      ctx.beginPath();
      // Calculate rectangle dimensions centered on the line width stroke
      const inset = cellSize / 2;
      const rectX = eyeX + inset;
      const rectY = eyeY + inset;
      const rectSize = eyeFullSize - cellSize;

      if (eyeOuterStyle === "circle") {
        ctx.arc(eyeX + eyeFullSize / 2, eyeY + eyeFullSize / 2, eyeFullSize / 2 - cellSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (eyeOuterStyle === "rounded") {
        ctx.roundRect(rectX, rectY, rectSize, rectSize, cellSize * 1.5);
        ctx.stroke();
      } else if (eyeOuterStyle === "extra-rounded") {
        ctx.roundRect(rectX, rectY, rectSize, rectSize, cellSize * 2.5);
        ctx.stroke();
      } else {
        // Classic Square
        ctx.strokeRect(rectX, rectY, rectSize, rectSize);
      }

      // B) Inner Eye Core
      ctx.fillStyle = innerColor;
      ctx.beginPath();

      const coreSize = 3 * cellSize;
      const coreX = eyeX + 2 * cellSize;
      const coreY = eyeY + 2 * cellSize;

      if (eyeInnerStyle === "circle") {
        ctx.arc(eyeX + eyeFullSize / 2, eyeY + eyeFullSize / 2, coreSize / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (eyeInnerStyle === "rounded") {
        ctx.roundRect(coreX + 0.3, coreY + 0.3, coreSize - 0.6, coreSize - 0.6, cellSize * 0.9);
        ctx.fill();
      } else if (eyeInnerStyle === "diamond") {
        const cx = coreX + coreSize / 2;
        const cy = coreY + coreSize / 2;
        ctx.moveTo(cx, coreY);
        ctx.lineTo(coreX + coreSize, cy);
        ctx.lineTo(cx, coreY + coreSize);
        ctx.lineTo(coreX, cy);
        ctx.closePath();
        ctx.fill();
      } else {
        // Classic core Square
        ctx.fillRect(coreX, coreY, coreSize, coreSize);
      }

      ctx.restore();
    });

    // 7. Draw central logo badge
    if (logoType !== "none") {
      ctx.save();
      const logoCenterX = qrInnerX + qrWidth / 2;
      const logoCenterY = qrInnerY + qrHeight / 2;
      const logoPixelSize = adjustedLogoCellSpan * cellSize;

      // Draw background cutout backplate to separate logo from dots
      if (logoBgShape !== "none") {
        ctx.fillStyle = logoBgColor || backgroundColor || "#FFFFFF";
        ctx.beginPath();
        if (logoBgShape === "circle") {
          ctx.arc(logoCenterX, logoCenterY, (logoPixelSize * 1.05) / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.roundRect(
            logoCenterX - logoPixelSize / 2,
            logoCenterY - logoPixelSize / 2,
            logoPixelSize,
            logoPixelSize,
            cellSize * 1.2
          );
          ctx.fill();
        }
      }

      // Draw active logo value
      if (logoType === "emoji" && logoValue) {
        ctx.font = `bold ${logoPixelSize * 0.65}px Helvetica, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(logoValue, logoCenterX, logoCenterY + 1); // small offset for visual centering
      } else if (logoType === "custom" && customLogoFile) {
        // Render custom image logo asynchronously
        const img = new Image();
        img.src = customLogoFile;
        img.onload = () => {
          ctx.save();
          // Clip circular logo if badge shape is circular
          if (logoBgShape === "circle") {
            ctx.beginPath();
            ctx.arc(logoCenterX, logoCenterY, (logoPixelSize * 0.85) / 2, 0, Math.PI * 2);
            ctx.clip();
          }
          const drawLogoW = logoPixelSize * 0.82;
          const drawLogoH = logoPixelSize * 0.82;
          ctx.drawImage(
            img,
            logoCenterX - drawLogoW / 2,
            logoCenterY - drawLogoH / 2,
            drawLogoW,
            drawLogoH
          );
          ctx.restore();
          
          // Trigger download callback after canvas async resources complete
          if (onDownloadReady) {
            onDownloadReady(canvas.toDataURL("image/png"));
          }
        };
      } else if (logoType === "preset") {
        // Draw elegant vector drawings for predefined presets manually for pixel crisp exports!
        ctx.strokeStyle = dotColor || "#1F2937";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const drawPresetVector = (vName: string) => {
          const lDim = logoPixelSize * 0.52;
          const left = logoCenterX - lDim / 2;
          const top = logoCenterY - lDim / 2;

          ctx.beginPath();
          if (vName === "heart") {
            ctx.fillStyle = "#FF3366";
            ctx.strokeStyle = "#FF3366";
            ctx.moveTo(logoCenterX, logoCenterY + lDim * 0.35);
            // Left curve
            ctx.bezierCurveTo(
              left, logoCenterY - lDim * 0.1,
              left - lDim * 0.1, top - lDim * 0.1,
              logoCenterX - lDim * 0.25, top
            );
            ctx.bezierCurveTo(
              logoCenterX, top - lDim * 0.2,
              logoCenterX, logoCenterY,
              logoCenterX, logoCenterY + lDim * 0.35
            );
            // Right curve
            ctx.moveTo(logoCenterX, logoCenterY + lDim * 0.35);
            ctx.bezierCurveTo(
              logoCenterX + lDim * 0.5, logoCenterY - lDim * 0.1,
              logoCenterX + lDim * 0.6, top - lDim * 0.1,
              logoCenterX + lDim * 0.25, top
            );
            ctx.bezierCurveTo(
              logoCenterX, top - lDim * 0.2,
              logoCenterX, logoCenterY,
              logoCenterX, logoCenterY + lDim * 0.35
            );
            ctx.fill();
          } else if (vName === "star") {
            ctx.fillStyle = "#FFD700";
            ctx.strokeStyle = "#DAA520";
            // Classic standard 5 point star coordinates
            for (let i = 0; i < 5; i++) {
              const alpha = (Math.PI / 2) + (i * Math.PI * 2 / 5);
              const x1 = logoCenterX + (lDim / 2) * Math.cos(alpha);
              const y1 = logoCenterY - (lDim / 2) * Math.sin(alpha);
              ctx.lineTo(x1, y1);

              const beta = alpha + (Math.PI / 5);
              const x2 = logoCenterX + (lDim / 4) * Math.cos(beta);
              const y2 = logoCenterY - (lDim / 4) * Math.sin(beta);
              ctx.lineTo(x2, y2);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (vName === "globe") {
            // Earth preset
            ctx.arc(logoCenterX, logoCenterY, lDim / 2, 0, Math.PI * 2);
            ctx.stroke();
            // equator lines
            ctx.beginPath();
            ctx.ellipse(logoCenterX, logoCenterY, lDim / 2, lDim / 5, 0, 0, Math.PI * 2);
            ctx.stroke();
            // meridian line
            ctx.beginPath();
            ctx.moveTo(logoCenterX, logoCenterY - lDim / 2);
            ctx.lineTo(logoCenterX, logoCenterY + lDim / 2);
            ctx.stroke();
          } else if (vName === "phone") {
            // Draw a cute phone receiver vector
            ctx.fillStyle = dotColor || "#1F2937";
            ctx.beginPath();
            ctx.roundRect(logoCenterX - lDim * 0.25, logoCenterY - lDim * 0.45, lDim * 0.5, lDim * 0.9, 5);
            ctx.fill();
            // Home button and screen lines
            ctx.beginPath();
            ctx.fillStyle = logoBgColor || backgroundColor || "#FFFFFF";
            ctx.fillRect(logoCenterX - lDim * 0.2, logoCenterY - lDim * 0.35, lDim * 0.4, lDim * 0.65);
            ctx.beginPath();
            ctx.arc(logoCenterX, logoCenterY + lDim * 0.38, 2, 0, Math.PI * 2);
            ctx.fillStyle = "#A2A2A2";
            ctx.fill();
          } else if (vName === "mail") {
            // Draw standard cute envelope
            ctx.rect(left, logoCenterY - lDim * 0.35, lDim, lDim * 0.7);
            ctx.stroke();
            // envelope flaps lines
            ctx.beginPath();
            ctx.moveTo(left, logoCenterY - lDim * 0.35);
            ctx.lineTo(logoCenterX, logoCenterY + lDim * 0.1);
            ctx.lineTo(left + lDim, logoCenterY - lDim * 0.35);
            ctx.stroke();
          } else if (vName === "wifi") {
            // Draw wifi status arcs
            ctx.arc(logoCenterX, logoCenterY + lDim * 0.3, 3, 0, Math.PI * 2);
            ctx.fillStyle = dotColor || "#1F2937";
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(logoCenterX, logoCenterY + lDim * 0.3, lDim * 0.35, -Math.PI * 0.8, -Math.PI * 0.2);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(logoCenterX, logoCenterY + lDim * 0.3, lDim * 0.65, -Math.PI * 0.8, -Math.PI * 0.2);
            ctx.stroke();
          } else {
            // fallback simple symbol
            ctx.font = `bold ${logoPixelSize * 0.48}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = dotColor || "#1F2937";
            ctx.fillText("★", logoCenterX, logoCenterY);
          }
        };

        drawPresetVector(logoValue);
      }
      ctx.restore();
    }

    // 8. Draw Frame Text overlay
    if (hasFrame && frameText) {
      ctx.save();
      ctx.fillStyle = frameTextColor || "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (frameStyle === "minimalist") {
        // Modern and sleek uppercase small display text in bottom margin
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.letterSpacing = "2px";
        ctx.fillStyle = frameBgColor || "#111111";
        ctx.fillText(frameText.toUpperCase(), canvasWidth / 2, canvasHeight - bottomFramePadding / 2 + 10);
      } else if (frameStyle === "badge") {
        // Noble serif display text
        ctx.font = "italic bold 15px Georgia, serif";
        ctx.letterSpacing = "1.5px";
        ctx.fillStyle = frameBgColor || "#D4AF37";
        ctx.fillText(frameText.toUpperCase(), canvasWidth / 2, canvasHeight - bottomFramePadding / 2 + 10);
      } else if (frameStyle === "bubble") {
        // Extra chunky happy typography
        ctx.font = "black 900 17px system-ui, sans-serif";
        ctx.letterSpacing = "0.5px";
        ctx.shadowColor = "rgba(0,0,0,0.15)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.fillText(frameText.toUpperCase(), canvasWidth / 2, canvasHeight - bottomFramePadding / 2 + 5);
      } else {
        // Classic Standard QR Banner
        ctx.font = "bold 15px system-ui, sans-serif";
        ctx.letterSpacing = "1px";
        ctx.fillText(frameText.toUpperCase(), canvasWidth / 2, canvasHeight - bottomFramePadding / 2 + 8);
      }

      ctx.restore();
    }

    // 9. Fire callback to parent component with ready clean DataURL
    if (onDownloadReady && logoType !== "custom") {
      onDownloadReady(canvas.toDataURL("image/png"));
    }
  }, [value, style, size, customLogoFile]);

  return (
    <div className="relative inline-flex items-center justify-center p-3 rounded-2xl bg-slate-900/5 dark:bg-slate-500/5 border border-slate-500/10 max-w-full overflow-hidden">
      <canvas ref={canvasRef} className="rounded-xl shadow-xl max-w-full h-auto" style={{ objectFit: 'contain' }} />
    </div>
  );
};

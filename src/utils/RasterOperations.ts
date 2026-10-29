import { contours } from "d3-contour";
import { geoPath } from "d3-geo";

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

export async function processMagicWandOnImage(
    imageUrl: string,
    imgX: number, imgY: number, imgW: number, imgH: number,
    clickX: number, clickY: number,
    tolerance: number,
    action: "wand" | "eraser" | "color-select",
    canvasBgColor: string = "#FFFFFF"
): Promise<{ newPathData?: string; colorHex?: string; newImageUrl?: string, width?: number, height?: number }> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const w = img.width;
            const height = img.height;
            canvas.width = w;
            canvas.height = height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) return resolve({});

            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, w, height);
            const data = imgData.data;

            // Map click coords from SVG space to natural image space
            const relativeX = (clickX - imgX) * (w / imgW);
            const relativeY = (clickY - imgY) * (height / imgH);
            const startX = Math.max(0, Math.min(w - 1, Math.round(relativeX)));
            const startY = Math.max(0, Math.min(height - 1, Math.round(relativeY)));

            const startIdx = (startY * w + startX) * 4;
            const startR = data[startIdx];
            const startG = data[startIdx + 1];
            const startB = data[startIdx + 2];
            const startA = data[startIdx + 3];

            // Perceptual color matching (weighted RGB distance)
            // Weighting: Red: 2, Green: 4, Blue: 3
            // Max distance squared: 2*(255^2) + 4*(255^2) + 3*(255^2) = 585225
            const toleranceFraction = tolerance / 100;
            const maxDistSq = toleranceFraction * toleranceFraction * 585225;

            const mask = new Float32Array(w * height);
            const visited = new Uint8Array(w * height);

            if (action === "color-select") {
                for (let cy = 0; cy < height; cy++) {
                    for (let cx = 0; cx < w; cx++) {
                        const idx = (cy * w + cx) * 4;
                        const r = data[idx];
                        const g = data[idx + 1];
                        const b = data[idx + 2];
                        const a = data[idx + 3];

                        let match = false;
                        if (startA === 0) {
                            if (a === 0) match = true;
                        } else {
                            if (a > 0) {
                                const dr = r - startR;
                                const dg = g - startG;
                                const db = b - startB;
                                const distSq = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
                                if (distSq <= maxDistSq) {
                                    match = true;
                                }
                            }
                        }

                        if (match) {
                            mask[cy * w + cx] = 1;
                        }
                    }
                }
            } else {
                // Optimized 1D array stack to avoid object allocation in the hot loop
                const stack = new Int32Array(w * height * 2);
                let stackPtr = 0;
                stack[stackPtr++] = startX;
                stack[stackPtr++] = startY;
                
                visited[startY * w + startX] = 1;

                while (stackPtr > 0) {
                    const cy = stack[--stackPtr];
                    const cx = stack[--stackPtr];
                    const idx = (cy * w + cx) * 4;

                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    const a = data[idx + 3];

                    // If transparent pixel clicked, only collect transparent ones
                    let match = false;
                    if (startA === 0) {
                        if (a === 0) match = true;
                    } else {
                        if (a > 0) {
                            const dr = r - startR;
                            const dg = g - startG;
                            const db = b - startB;
                            const distSq = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
                            if (distSq <= maxDistSq) {
                                match = true;
                            }
                        }
                    }

                    if (match) {
                        mask[cy * w + cx] = 1; // 1 means part of the selection
                        if (action === "eraser") {
                            data[idx + 3] = 0; // Erase pixel
                        }

                        // neighbors
                        if (cx > 0 && !visited[cy * w + (cx - 1)]) {
                            visited[cy * w + (cx - 1)] = 1;
                            stack[stackPtr++] = cx - 1;
                            stack[stackPtr++] = cy;
                        }
                        if (cx < w - 1 && !visited[cy * w + (cx + 1)]) {
                            visited[cy * w + (cx + 1)] = 1;
                            stack[stackPtr++] = cx + 1;
                            stack[stackPtr++] = cy;
                        }
                        if (cy > 0 && !visited[(cy - 1) * w + cx]) {
                            visited[(cy - 1) * w + cx] = 1;
                            stack[stackPtr++] = cx;
                            stack[stackPtr++] = cy - 1;
                        }
                        if (cy < height - 1 && !visited[(cy + 1) * w + cx]) {
                            visited[(cy + 1) * w + cx] = 1;
                            stack[stackPtr++] = cx;
                            stack[stackPtr++] = cy + 1;
                        }
                    }
                }
            }

            if (action === "eraser") {
                ctx.putImageData(imgData, 0, 0);
                resolve({ newImageUrl: canvas.toDataURL("image/png") });
                return;
            }

            // Convert mask to GeoJSON MultiPolygon contours
            // Pad the mask with 0s by 1 pixel on all sides so contours touching the edges are properly closed
            // instead of hugging the bounding box.
            const padW = w + 2;
            const padH = height + 2;
            const paddedMask = new Float32Array(padW * padH);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < w; x++) {
                    paddedMask[(y + 1) * padW + (x + 1)] = mask[y * w + x];
                }
            }

            const contourGen = contours().size([padW, padH]).thresholds([0.5]);
            const results = contourGen(paddedMask);
            
            if (results.length > 0 && results[0].coordinates.length > 0) {
                 const scaleX = imgW / w;
                 const scaleY = imgH / height;
                 const poly = results[0];
                 poly.coordinates = poly.coordinates.map(polygon => {
                     return polygon.map(ring => {
                         // Apply scaling and offset
                         let scaledRing = ring.map(pt => [
                             (pt[0] - 1) * scaleX + imgX,
                             (pt[1] - 1) * scaleY + imgY
                         ]);
                         
                         // Apply Chaikin smoothing
                         // 2 iterations typically removes jagged pixel staircases perfectly
                         for (let i = 0; i < 2; i++) {
                             if (scaledRing.length < 3) break;
                             const nextRing = [];
                             for (let j = 0; j < scaledRing.length - 1; j++) {
                                 const p0 = scaledRing[j];
                                 const p1 = scaledRing[j + 1];
                                 nextRing.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
                                 nextRing.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
                             }
                             nextRing.push([...nextRing[0]]); // close ring
                             scaledRing = nextRing;
                         }
                         return scaledRing;
                     });
                 });

                 const d3Path = geoPath()(poly);
                 if (d3Path) {
                     const colorHex = `#${startR.toString(16).padStart(2,'0')}${startG.toString(16).padStart(2,'0')}${startB.toString(16).padStart(2,'0')}`;
                     resolve({ newPathData: d3Path, colorHex, width: imgW, height: imgH });
                     return;
                 }
            }

            resolve({});
        };
        img.src = imageUrl;
    });
}

export async function processEraserStrokeOnImage(
    imageUrl: string,
    imgX: number, imgY: number, imgW: number, imgH: number,
    strokePoints: {x: number, y: number}[],
    eraseRadius: number,
    clipPathData?: string
): Promise<{ newImageUrl?: string }> {
    return new Promise((resolve) => {
        if (strokePoints.length === 0) return resolve({});

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const w = img.width;
            const height = img.height;
            canvas.width = w;
            canvas.height = height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) return resolve({});

            ctx.drawImage(img, 0, 0);
            
            // Setup transform from global canvas coordinates to local image pixel coordinates
            const scaleX = w / imgW;
            const scaleY = height / imgH;
            
            ctx.save();
            ctx.scale(scaleX, scaleY);
            ctx.translate(-imgX, -imgY);

            if (clipPathData) {
                const pathObj = new Path2D(clipPathData);
                ctx.clip(pathObj);
            }
            
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = eraseRadius * 2; // Radius doesn't need manual scaling because context is scaled
            
            ctx.beginPath();
            const firstPt = strokePoints[0];
            ctx.moveTo(firstPt.x, firstPt.y);
            
            for (let i = 1; i < strokePoints.length; i++) {
                const pt = strokePoints[i];
                ctx.lineTo(pt.x, pt.y);
            }
            
            // If it's a single point click, draw a small line to ensure a circle is drawn (because lineCap=round)
            if (strokePoints.length === 1) {
                ctx.lineTo(firstPt.x + 0.1, firstPt.y + 0.1);
            }
            
            ctx.stroke();
            ctx.restore();

            resolve({ newImageUrl: canvas.toDataURL("image/png") });
        };
        img.src = imageUrl;
    });
}

export interface RasterFilterOptions {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  exposure: number; // -100 to 100
  grayscale: boolean;
  invert: boolean;
  sepia: number; // 0 to 100
  hueRotate: number; // 0 to 360
  thresholdEnabled: boolean;
  thresholdValue: number; // 0 to 255
  kernelEnabled: boolean;
  kernel: number[]; // 9 weights for 3x3
  kernelDivisor: number;
  kernelOffset: number;
  pixelate: number; // block size (1 = disabled)
  ditherType: "none" | "floyd-steinberg" | "ordered" | string;
  ditherColors: number; // number of color bins/levels (2 to 256)
  posterize: number; // number of color levels (0 = disabled)
  equalize: boolean;
}

export async function applyAdvancedRasterFilter(
  imageUrl: string,
  options: RasterFilterOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = img.width;
      const h = img.height;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve(imageUrl);
        return;
      }

      ctx.drawImage(img, 0, 0);
      let imgData = ctx.getImageData(0, 0, w, h);
      let data = imgData.data;

      // 1. Pixelation (Apply first so sub-pixels are block-aligned)
      if (options.pixelate > 1) {
        const size = Math.floor(options.pixelate);
        for (let y = 0; y < h; y += size) {
          for (let x = 0; x < w; x += size) {
            // Get center or average color of the block
            const cx = Math.min(w - 1, x + Math.floor(size / 2));
            const cy = Math.min(h - 1, y + Math.floor(size / 2));
            const centerIdx = (cy * w + cx) * 4;
            const r = data[centerIdx];
            const g = data[centerIdx + 1];
            const b = data[centerIdx + 2];
            const a = data[centerIdx + 3];

            // Fill block
            for (let dy = 0; dy < size; dy++) {
              for (let dx = 0; dx < size; dx++) {
                const px = x + dx;
                const py = y + dy;
                if (px < w && py < h) {
                  const idx = (py * w + px) * 4;
                  data[idx] = r;
                  data[idx + 1] = g;
                  data[idx + 2] = b;
                  data[idx + 3] = a;
                }
              }
            }
          }
        }
      }

      // 2. Convolution (3x3 Kernel Matrix)
      if (options.kernelEnabled && options.kernel && options.kernel.length === 9) {
        const tempDst = new Uint8ClampedArray(data.length);
        const divisor = options.kernelDivisor || 1;
        const offset = options.kernelOffset || 0;
        const k = options.kernel;

        // Keep alpha channel
        for (let i = 0; i < data.length; i += 4) {
          tempDst[i + 3] = data[i + 3];
        }

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let rSum = 0;
            let gSum = 0;
            let bSum = 0;

            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const px = Math.min(w - 1, Math.max(0, x + kx));
                const py = Math.min(h - 1, Math.max(0, y + ky));
                const pIdx = (py * w + px) * 4;
                const weight = k[(ky + 1) * 3 + (kx + 1)];

                rSum += data[pIdx] * weight;
                gSum += data[pIdx + 1] * weight;
                bSum += data[pIdx + 2] * weight;
              }
            }

            const idx = (y * w + x) * 4;
            tempDst[idx] = Math.min(255, Math.max(0, (rSum / divisor) + offset));
            tempDst[idx + 1] = Math.min(255, Math.max(0, (gSum / divisor) + offset));
            tempDst[idx + 2] = Math.min(255, Math.max(0, (bSum / divisor) + offset));
          }
        }
        // Update pixel buffer with convolved data
        for (let i = 0; i < data.length; i++) {
          data[i] = tempDst[i];
        }
      }

      // 3. Histogram Equalization (Contrast Maximization)
      if (options.equalize) {
        const histR = new Int32Array(256);
        const histG = new Int32Array(256);
        const histB = new Int32Array(256);

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) {
            histR[data[i]]++;
            histG[data[i + 1]]++;
            histB[data[i + 2]]++;
          }
        }

        const cdfR = new Int32Array(256);
        const cdfG = new Int32Array(256);
        const cdfB = new Int32Array(256);

        cdfR[0] = histR[0];
        cdfG[0] = histG[0];
        cdfB[0] = histB[0];

        for (let i = 1; i < 256; i++) {
          cdfR[i] = cdfR[i - 1] + histR[i];
          cdfG[i] = cdfG[i - 1] + histG[i];
          cdfB[i] = cdfB[i - 1] + histB[i];
        }

        const totalPixels = w * h;
        const minR = cdfR.find(val => val > 0) || 1;
        const minG = cdfG.find(val => val > 0) || 1;
        const minB = cdfB.find(val => val > 0) || 1;

        const mapR = new Uint8Array(256);
        const mapG = new Uint8Array(256);
        const mapB = new Uint8Array(256);

        for (let i = 0; i < 256; i++) {
          mapR[i] = Math.min(255, Math.max(0, Math.round(((cdfR[i] - minR) / (totalPixels - minR)) * 255)));
          mapG[i] = Math.min(255, Math.max(0, Math.round(((cdfG[i] - minG) / (totalPixels - minG)) * 255)));
          mapB[i] = Math.min(255, Math.max(0, Math.round(((cdfB[i] - minB) / (totalPixels - minB)) * 255)));
        }

        for (let i = 0; i < data.length; i += 4) {
          data[i] = mapR[data[i]];
          data[i + 1] = mapG[data[i + 1]];
          data[i + 2] = mapB[data[i + 2]];
        }
      }

      // 4. Color Adjustments: Brightness, Contrast, Saturation, Exposure, Sepia, Hue Rotate, Invert, Grayscale, Threshold
      const bright = options.brightness;
      const contrastFactor = (options.contrast + 100) / 100; // -100 to 100 => 0 to 2
      const satMultiplier = (options.saturation + 100) / 100; // -100 to 100 => 0 to 2
      const expMultiplier = Math.pow(2, options.exposure / 50); // -100 to 100 exposure multiplier
      const sepiaVal = options.sepia / 100; // 0 to 1

      // Precompute Hue rotation values if needed
      const angle = (options.hueRotate * Math.PI) / 180;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; // Skip transparency

        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Exposure Adjustment
        if (options.exposure !== 0) {
          r *= expMultiplier;
          g *= expMultiplier;
          b *= expMultiplier;
        }

        // Brightness Adjustment
        if (bright !== 0) {
          r += bright * 2.55;
          g += bright * 2.55;
          b += bright * 2.55;
        }

        // Contrast Adjustment
        if (options.contrast !== 0) {
          r = (r - 128) * contrastFactor + 128;
          g = (g - 128) * contrastFactor + 128;
          b = (b - 128) * contrastFactor + 128;
        }

        // Grayscale & Saturation
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        if (options.grayscale) {
          r = gray;
          g = gray;
          b = gray;
        } else if (options.saturation !== 0) {
          r = gray + (r - gray) * satMultiplier;
          g = gray + (g - gray) * satMultiplier;
          b = gray + (b - gray) * satMultiplier;
        }

        // Sepia
        if (options.sepia > 0) {
          const sr = 0.393 * r + 0.769 * g + 0.189 * b;
          const sg = 0.349 * r + 0.686 * g + 0.168 * b;
          const sb = 0.272 * r + 0.534 * g + 0.131 * b;

          r = r + (sr - r) * sepiaVal;
          g = g + (sg - g) * sepiaVal;
          b = b + (sb - b) * sepiaVal;
        }

        // Hue Rotate
        if (options.hueRotate !== 0) {
          const rX = r, gX = g, bX = b;
          r = (0.213 + 0.787 * cosA - 0.213 * sinA) * rX + (0.715 - 0.715 * cosA - 0.715 * sinA) * gX + (0.072 - 0.072 * cosA + 0.928 * sinA) * bX;
          g = (0.213 - 0.213 * cosA + 0.143 * sinA) * rX + (0.715 + 0.285 * cosA + 0.140 * sinA) * gX + (0.072 - 0.072 * cosA - 0.283 * sinA) * bX;
          b = (0.213 - 0.213 * cosA - 0.787 * sinA) * rX + (0.715 - 0.715 * cosA + 0.715 * sinA) * gX + (0.072 + 0.928 * cosA + 0.072 * sinA) * bX;
        }

        // Invert
        if (options.invert) {
          r = 255 - r;
          g = 255 - g;
          b = 255 - b;
        }

        // Threshold (Binarize)
        if (options.thresholdEnabled) {
          const val = (r + g + b) / 3 >= options.thresholdValue ? 255 : 0;
          r = val;
          g = val;
          b = val;
        }

        // Clamp & write back
        data[i] = Math.min(255, Math.max(0, r));
        data[i + 1] = Math.min(255, Math.max(0, g));
        data[i + 2] = Math.min(255, Math.max(0, b));
      }

      // 5. Retro Posterize (Color Quantization)
      if (options.posterize > 1 && !options.thresholdEnabled) {
        const levels = Math.floor(options.posterize);
        const step = 255 / (levels - 1);
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          data[i] = Math.round(data[i] / step) * step;
          data[i + 1] = Math.round(data[i + 1] / step) * step;
          data[i + 2] = Math.round(data[i + 2] / step) * step;
        }
      }

      // 6. Advanced Dithering (Floyd-Steinberg Error Diffusion or Ordered Bayer Matrix)
      if (options.ditherType !== "none" && !options.thresholdEnabled) {
        const dLevels = Math.max(2, options.ditherColors);
        const step = 255 / (dLevels - 1);

        if (options.ditherType === "floyd-steinberg") {
          // Floyd-Steinberg error diffusion requires a floating point or buffer to keep exact error precision
          const errR = new Float32Array(w * h);
          const errG = new Float32Array(w * h);
          const errB = new Float32Array(w * h);

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              if (data[idx + 3] === 0) continue;

              // Add previous errors
              const rWithErr = data[idx] + errR[y * w + x];
              const gWithErr = data[idx + 1] + errG[y * w + x];
              const bWithErr = data[idx + 2] + errB[y * w + x];

              // Quantize to nearest palette step
              const finalR = Math.min(255, Math.max(0, Math.round(rWithErr / step) * step));
              const finalG = Math.min(255, Math.max(0, Math.round(gWithErr / step) * step));
              const finalB = Math.min(255, Math.max(0, Math.round(bWithErr / step) * step));

              data[idx] = finalR;
              data[idx + 1] = finalG;
              data[idx + 2] = finalB;

              // Calculate errors
              const eR = rWithErr - finalR;
              const eG = gWithErr - finalG;
              const eB = bWithErr - finalB;

              // Distribute error: 7/16 right, 3/16 bottom-left, 5/16 bottom, 1/16 bottom-right
              if (x + 1 < w) {
                const rightIdx = y * w + (x + 1);
                errR[rightIdx] += eR * (7 / 16);
                errG[rightIdx] += eG * (7 / 16);
                errB[rightIdx] += eB * (7 / 16);
              }
              if (y + 1 < h) {
                if (x > 0) {
                  const blIdx = (y + 1) * w + (x - 1);
                  errR[blIdx] += eR * (3 / 16);
                  errG[blIdx] += eG * (3 / 16);
                  errB[blIdx] += eB * (3 / 16);
                }
                const bIdx = (y + 1) * w + x;
                errR[bIdx] += eR * (5 / 16);
                errG[bIdx] += eG * (5 / 16);
                errB[bIdx] += eB * (5 / 16);
                if (x + 1 < w) {
                  const brIdx = (y + 1) * w + (x + 1);
                  errR[brIdx] += eR * (1 / 16);
                  errG[brIdx] += eG * (1 / 16);
                  errB[brIdx] += eB * (1 / 16);
                }
              }
            }
          }
        } else if (options.ditherType === "ordered") {
          const bayer = [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5]
          ];
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              if (data[idx + 3] === 0) continue;

              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              // Bayer threshold addition (map 0-15 to -16 to 16 approximately)
              const threshold = (bayer[y % 4][x % 4] - 7.5) * (255 / 16 / dLevels);

              const finalR = Math.min(255, Math.max(0, Math.round((r + threshold) / step) * step));
              const finalG = Math.min(255, Math.max(0, Math.round((g + threshold) / step) * step));
              const finalB = Math.min(255, Math.max(0, Math.round((b + threshold) / step) * step));

              data[idx] = finalR;
              data[idx + 1] = finalG;
              data[idx + 2] = finalB;
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => {
      reject(e);
    };
    img.src = imageUrl;
  });
}

export async function adjustAlphaMask(
  originalUrl: string,
  cutoutUrl: string,
  dilateRadius: number // positive = expand mask (less aggressive), negative = shrink mask (more aggressive)
): Promise<string> {
  return new Promise((resolve, reject) => {
    const origImg = new Image();
    const cutImg = new Image();
    origImg.crossOrigin = "Anonymous";
    cutImg.crossOrigin = "Anonymous";

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded === 2) {
        process();
      }
    };
    origImg.onload = onLoad;
    cutImg.onload = onLoad;
    origImg.onerror = reject;
    cutImg.onerror = reject;
    origImg.src = originalUrl;
    cutImg.src = cutoutUrl;

    function process() {
      const w = origImg.width;
      const h = origImg.height;
      if (w === 0 || h === 0) return resolve(originalUrl);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(originalUrl);

      // Draw cutout to get mask
      ctx.drawImage(cutImg, 0, 0, w, h);
      const cutData = ctx.getImageData(0, 0, w, h);
      const mask = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        mask[i] = cutData.data[i * 4 + 3]; // alpha channel
      }

      // Dilate/Erode mask
      const newMask = new Uint8Array(w * h);
      const r = Math.abs(dilateRadius);
      
      if (r === 0) {
        newMask.set(mask);
      } else {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let maxA = 0;
            let minA = 255;
            // A simple box filter for morphological operations
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                  const val = mask[ny * w + nx];
                  if (val > maxA) maxA = val;
                  if (val < minA) minA = val;
                }
              }
            }
            newMask[y * w + x] = dilateRadius > 0 ? maxA : minA;
          }
        }
      }

      // Draw original and apply new mask
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(origImg, 0, 0, w, h);
      const origData = ctx.getImageData(0, 0, w, h);
      
      // We also might want a soft thresholding, but simple morphology works.
      // If we expanded the mask, we need to blend.
      // For now, just set alpha to newMask.
      for (let i = 0; i < w * h; i++) {
        origData.data[i * 4 + 3] = newMask[i];
      }
      
      ctx.putImageData(origData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    }
  });
}

export interface SmartCropResult {
  newImageUrl?: string;
  croppedBounds?: {
    minX: number;
    minY: number;
    cropWidth: number;
    cropHeight: number;
    originalWidth: number;
    originalHeight: number;
  };
  trimmedPixels?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * Automatically trims transparent or invisible outer margin pixels from an image.
 */
export async function smartCropImage(
  imageUrl: string,
  alphaThreshold: number = 10
): Promise<SmartCropResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = img.width;
      const h = img.height;
      if (w === 0 || h === 0) return resolve({});

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve({});

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;

      // Scan all pixels to find non-transparent bounding box
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const alpha = data[idx + 3];

          // If alpha > alphaThreshold, pixel is visible
          if (alpha > alphaThreshold) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // If entire image is transparent or no visible content found
      if (maxX < minX || maxY < minY) {
        return resolve({});
      }

      const cropWidth = maxX - minX + 1;
      const cropHeight = maxY - minY + 1;

      // If no trimming needed (already tightly cropped)
      if (minX === 0 && minY === 0 && cropWidth === w && cropHeight === h) {
        return resolve({});
      }

      // Perform crop onto new canvas
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;
      const croppedCtx = croppedCanvas.getContext("2d");
      if (!croppedCtx) return resolve({});

      croppedCtx.drawImage(
        canvas,
        minX,
        minY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      const newImageUrl = croppedCanvas.toDataURL("image/png");

      resolve({
        newImageUrl,
        croppedBounds: {
          minX,
          minY,
          cropWidth,
          cropHeight,
          originalWidth: w,
          originalHeight: h,
        },
        trimmedPixels: {
          top: minY,
          bottom: h - (maxY + 1),
          left: minX,
          right: w - (maxX + 1),
        },
      });
    };
    img.onerror = () => resolve({});
    img.src = imageUrl;
  });
}


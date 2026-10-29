let canvasContext: CanvasRenderingContext2D | null = null;

function get2DContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!canvasContext) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvasContext = canvas.getContext("2d", { willReadFrequently: true });
  }
  return canvasContext;
}

/**
 * Converts any CSS color string (including oklab, oklch, color-mix) to an rgb() or rgba() string using browser canvas.
 */
export function convertCssColorToRgba(colorStr: string): string {
  const ctx = get2DContext();
  if (!ctx) return "rgba(0, 0, 0, 0)";

  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000000"; // Default fallback
    ctx.fillStyle = colorStr;

    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const a = Number((data[3] / 255).toFixed(3));

    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  } catch {
    return "rgba(0, 0, 0, 0)";
  }
}

/**
 * Replaces oklab(), oklch(), and color-mix() functions in CSS text with rgb() or rgba() equivalents.
 */
export function replaceUnsupportedCssColors(cssText: string): string {
  if (
    !cssText ||
    (!cssText.includes("oklab") &&
      !cssText.includes("oklch") &&
      !cssText.includes("color-mix"))
  ) {
    return cssText;
  }

  let updated = cssText;
  let prev = "";
  let iterations = 0;

  // Multiple passes to safely handle nested function declarations
  while (updated !== prev && iterations < 5) {
    prev = updated;
    iterations++;

    // Replace oklab(...)
    updated = updated.replace(/oklab\(([^()]+)\)/gi, (match) =>
      convertCssColorToRgba(match)
    );

    // Replace oklch(...)
    updated = updated.replace(/oklch\(([^()]+)\)/gi, (match) =>
      convertCssColorToRgba(match)
    );

    // Replace color-mix(...)
    updated = updated.replace(/color-mix\(([^()]+)\)/gi, (match) =>
      convertCssColorToRgba(match)
    );
  }

  // Final catch-all fallback for any stubborn unparsed oklab/oklch functions
  updated = updated
    .replace(/oklab\([^)]*\)/gi, "rgba(0, 0, 0, 0)")
    .replace(/oklch\([^)]*\)/gi, "rgba(0, 0, 0, 0)");

  return updated;
}

/**
 * Sanitizes a cloned Document object for html2canvas to prevent "unsupported color function" errors.
 */
export function sanitizeClonedDocument(clonedDoc: Document): void {
  try {
    // 1. Sanitize all <style> elements in the cloned document head/body
    const styleElements = clonedDoc.querySelectorAll("style");
    styleElements.forEach((styleEl) => {
      if (styleEl.textContent) {
        styleEl.textContent = replaceUnsupportedCssColors(styleEl.textContent);
      }
    });

    // 2. Sanitize all style attributes and computed color properties on all elements
    const allElements = clonedDoc.querySelectorAll<HTMLElement>("*");
    allElements.forEach((el) => {
      const styleAttr = el.getAttribute("style");
      if (
        styleAttr &&
        (styleAttr.includes("oklab") ||
          styleAttr.includes("oklch") ||
          styleAttr.includes("color-mix"))
      ) {
        el.setAttribute("style", replaceUnsupportedCssColors(styleAttr));
      }

      // Explicitly override computed color properties if they use oklab/oklch
      try {
        const view = clonedDoc.defaultView || window;
        const cs = view.getComputedStyle(el);
        if (cs) {
          const props = [
            "color",
            "background-color",
            "border-color",
            "border-top-color",
            "border-right-color",
            "border-bottom-color",
            "border-left-color",
            "outline-color",
            "fill",
            "stroke",
          ];
          props.forEach((prop) => {
            const val = cs.getPropertyValue(prop);
            if (
              val &&
              (val.includes("oklab") ||
                val.includes("oklch") ||
                val.includes("color-mix"))
            ) {
              el.style.setProperty(prop, convertCssColorToRgba(val));
            }
          });
        }
      } catch {
        // Ignore style access errors on unattached nodes
      }
    });
  } catch (err) {
    console.warn("Document color sanitization warning:", err);
  }
}

import { QRStyle } from "./types";

// Calculates the relative luminance of any hex color
const getRelativeLuminance = (hex: string): number => {
  // strip hash if present
  const rgbHex = hex.replace("#", "");
  if (rgbHex.length < 6) return 0.5; // fallback
  
  const r = parseInt(rgbHex.substring(0, 2), 16) / 255;
  const g = parseInt(rgbHex.substring(2, 4), 16) / 255;
  const b = parseInt(rgbHex.substring(4, 6), 16) / 255;

  const getLumeValue = (val: number) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * getLumeValue(r) + 0.7152 * getLumeValue(g) + 0.0722 * getLumeValue(b);
};

// Calculates accessibility color contrast ratio between foreground and background
export const getContrastRatio = (color1: string, color2: string): number => {
  try {
    const l1 = getRelativeLuminance(color1);
    const l2 = getRelativeLuminance(color2);
    const brighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    const ratio = (brighter + 0.05) / (darker + 0.05);
    return Math.round(ratio * 100) / 100;
  } catch (e) {
    return 4.5; // default fallback
  }
};

// Smart Offline Styling Fallbacks for when the user types a prompt but server Gemini API key is missing
export const getSmartStyleLibraryFallback = (prompt: string): { reasoning: string; style: Partial<QRStyle> } => {
  const text = prompt.toLowerCase();

  // 1. Nature / Forest / Bio / Ecologie
  if (text.includes("nature") || text.includes("vert") || text.includes("forest") || text.includes("bio") || text.includes("ecolo") || text.includes("bois") || text.includes("plantes")) {
    return {
      reasoning: "Thème Naturel détecté ! Style dominé par un vert sève et un fond crème organique avec des motifs en forme de cercles lisses pour rappeler l'eau ou la flore.",
      style: {
        dotStyle: "circle",
        backgroundColor: "#F4F7F4",
        backgroundGradient: true,
        backgroundGradientColors: ["#F4F7F4", "#E2EBE2"],
        dotColor: "#15803D",
        dotGradient: true,
        dotGradientColors: ["#16A34A", "#0E5E2F"],
        eyeOuterStyle: "circle",
        eyeInnerStyle: "circle",
        eyeOuterColor: "#0E5E2F",
        eyeInnerColor: "#16A34A",
        logoType: "emoji",
        logoValue: "🍃",
        frameBgColor: "#0E5E2F",
        frameTextColor: "#FFFFFF",
        frameText: "PLANTE VERT"
      }
    };
  }

  // 2. Coffee / Cafe / Cozy / Warm / Chocolat
  if (text.includes("café") || text.includes("cafe") || text.includes("cozy") || text.includes("chocolat") || text.includes("chaud") || text.includes("warm") || text.includes("miel") || text.includes("honey")) {
    return {
      reasoning: "Café Cozy détecté ! Nuances de lin chaud, marron torréfié et miel doré. Un emoji tasse accueillant orne le centre avec des formes enveloppantes.",
      style: {
        dotStyle: "rounded-connect",
        backgroundColor: "#FAF6F0",
        backgroundGradient: true,
        backgroundGradientColors: ["#FAF6F0", "#F2E8DF"],
        dotColor: "#5C4033",
        dotGradient: true,
        dotGradientColors: ["#8B5A2B", "#3E2723"],
        eyeOuterStyle: "extra-rounded",
        eyeInnerStyle: "rounded",
        eyeOuterColor: "#3E2723",
        eyeInnerColor: "#D2B48C",
        logoType: "emoji",
        logoValue: "☕",
        frameBgColor: "#5C4033",
        frameTextColor: "#F2E8DF",
        frameText: "COZY TIME"
      }
    };
  }

  // 3. Cyber / Futuristic / Neon / Electric / Gaming
  if (text.includes("cyber") || text.includes("retro") || text.includes("futur") || text.includes("neon") || text.includes("néon") || text.includes("gaming") || text.includes("electr") || text.includes("laser")) {
    return {
      reasoning: "Fusion Cyberpunk détectée ! Un fond noir d'encre contrasté d'un dégradé de violet et de rose néon électrique en forme de nœuds fusionnés pour un effet laser.",
      style: {
        dotStyle: "rounded-connect",
        backgroundColor: "#05070B",
        backgroundGradient: true,
        backgroundGradientColors: ["#05070B", "#10091D"],
        dotColor: "#FF007F",
        dotGradient: true,
        dotGradientColors: ["#FF007F", "#8B5CF6"],
        eyeOuterStyle: "extra-rounded",
        eyeInnerStyle: "diamond",
        eyeOuterColor: "#FF007F",
        eyeInnerColor: "#00F0FF",
        logoType: "emoji",
        logoValue: "👾",
        frameBgColor: "#8B5CF6",
        frameTextColor: "#00F0FF",
        frameText: "CYBER PLAY"
      }
    };
  }

  // 4. Gold / Luxury / Prestige / Or / Royal
  if (text.includes("gold") || text.includes("or") || text.includes("luxe") || text.includes("prestige") || text.includes("royal") || text.includes("mariage") || text.includes("chic") || text.includes("champagne")) {
    return {
      reasoning: "Ambiance Prestige Or détectée ! Alliance noble d'or satiné sur un fond sombre de marbre de jais avec des étoiles scintillantes.",
      style: {
        dotStyle: "star",
        backgroundColor: "#0F0F10",
        backgroundGradient: true,
        backgroundGradientColors: ["#0F0F10", "#202022"],
        dotColor: "#E2BA5A",
        dotGradient: true,
        dotGradientColors: ["#FEDE87", "#A5802E"],
        eyeOuterStyle: "square",
        eyeInnerStyle: "diamond",
        eyeOuterColor: "#FEDE87",
        eyeInnerColor: "#E2BA5A",
        logoType: "preset",
        logoValue: "star",
        frameBgColor: "#A5802E",
        frameTextColor: "#0F0F10",
        frameText: "EXCLUSIVE VIP"
      }
    };
  }

  // 5. Fire / Volcan / Red / Passion / Love / Amour
  if (text.includes("feu") || text.includes("flamme") || text.includes("rouge") || text.includes("red") || text.includes("love") || text.includes("amour") || text.includes("coeur") || text.includes("passion")) {
    return {
      reasoning: "Thème Passion Brûlante ! Dots diamants dans les tons carmins et pourpres avec un coeur au milieu.",
      style: {
        dotStyle: "diamond",
        backgroundColor: "#FFF5F5",
        backgroundGradient: true,
        backgroundGradientColors: ["#FFF5F5", "#FFE3E3"],
        dotColor: "#E53E3E",
        dotGradient: true,
        dotGradientColors: ["#E53E3E", "#9B1C1C"],
        eyeOuterStyle: "rounded",
        eyeInnerStyle: "circle",
        eyeOuterColor: "#9B1C1C",
        eyeInnerColor: "#E53E3E",
        logoType: "preset",
        logoValue: "heart",
        frameBgColor: "#9B1C1C",
        frameTextColor: "#FFF5F5",
        frameText: "AVEC AMOUR"
      }
    };
  }

  // 6. Default Dynamic based on word length
  const colors = [
    ["#4F46E5", "#06B6D4"], // ocean
    ["#EC4899", "#8B5CF6"], // magenta
    ["#10B981", "#3B82F6"], // emerald-blue
    ["#F59E0B", "#EF4444"], // sunset
  ];
  const colorPair = colors[prompt.length % colors.length];

  return {
    reasoning: `Inspiré par "${prompt}", j'ai composé une orchestration de contrastes colorés éclatants en utilisant une géométrie moderne pour magnifier votre lien !`,
    style: {
      dotStyle: "rounded-connect",
      backgroundColor: "#FFFFFF",
      backgroundGradient: true,
      backgroundGradientColors: ["#FFFFFF", "#F8FAFC"],
      dotColor: colorPair[0],
      dotGradient: true,
      dotGradientColors: colorPair,
      eyeOuterStyle: "rounded",
      eyeInnerStyle: "circle",
      eyeOuterColor: colorPair[0],
      eyeInnerColor: colorPair[1],
      logoType: "preset",
      logoValue: "globe",
      frameBgColor: colorPair[0],
      frameTextColor: "#FFFFFF",
      frameText: "SCAN RAPIDE"
    }
  };
};

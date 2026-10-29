export type DotStyle = "square" | "circle" | "dots" | "star" | "diamond" | "rounded-connect";
export type EyeOuterStyle = "square" | "rounded" | "circle" | "extra-rounded";
export type EyeInnerStyle = "square" | "rounded" | "circle" | "diamond";
export type LogoType = "none" | "emoji" | "preset" | "custom";
export type FrameStyle = "none" | "bubble" | "classic" | "badge" | "minimalist";

export interface QRStyle {
  dotStyle: DotStyle;
  backgroundColor: string;
  backgroundGradient: boolean;
  backgroundGradientType: "linear" | "radial";
  backgroundGradientColors: string[]; // hex codes, min 2 items
  dotColor: string;
  dotGradient: boolean;
  dotGradientType: "linear" | "radial";
  dotGradientColors: string[]; // hex codes, min 2 items
  eyeOuterStyle: EyeOuterStyle;
  eyeInnerStyle: EyeInnerStyle;
  eyeOuterColor: string;
  eyeInnerColor: string;
  logoType: LogoType;
  logoValue: string; // emoji character or preset key
  logoUrl?: string; // base64 or URL for custom logos
  logoSize: number; // 0.15 to 0.24 (fraction of QR size)
  logoBgColor: string; // cutout color, usually same as background or white
  logoBgShape: "circle" | "square" | "none";
  frameStyle: FrameStyle;
  frameText: string;
  frameTextColor: string;
  frameBgColor: string;
}

export interface PresetStyle {
  id: string;
  name: string;
  description: string;
  style: QRStyle;
}

export interface AIStyleSuggestionResponse {
  reasoning: string;
  style: QRStyle;
  matchedLogoPreset?: string; // If model thinks a certain logo fits (like globe, mail, etc.)
}

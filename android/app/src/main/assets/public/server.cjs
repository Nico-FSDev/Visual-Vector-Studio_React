var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.set("trust proxy", 1);
var apiLimiter = (0, import_express_rate_limit.default)({
  windowMs: 1 * 60 * 1e3,
  // 1 minute
  max: 15,
  // limit each IP to 15 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Rate limit exceeded. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED"
  }
});
app.use("/api/", apiLimiter);
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
app.use((err, req, res, next) => {
  if (err) {
    console.error("Express Parser/Middleware Error Intercepted:", err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Erreur de traitement de la requ\xEAte au serveur.",
      code: err.code || "REQUEST_ERROR"
    });
  }
  next();
});
var aiClient = null;
function getGeminiClient(customKey) {
  const key = customKey || process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY" || key === "") {
    throw new Error("La cl\xE9 d'API Gemini n'est pas configur\xE9e. Veuillez renseigner une cl\xE9 valide dans l'onglet des Param\xE8tres (Gemini API).");
  }
  if (customKey) {
    return new import_genai.GoogleGenAI({
      apiKey: customKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  if (!aiClient) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
async function generateContentWithRetry(ai, params, retriesLeft = 2, delayMs = 1500) {
  const modelsToTry = Array.from(/* @__PURE__ */ new Set([params.model, "gemini-2.5-flash", "gemini-1.5-flash"]));
  for (const model of modelsToTry) {
    let attempts = model === params.model ? retriesLeft : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`[Gemini Request] Model ${model}, Attempt ${attempt}/${attempts}`);
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config
        });
        if (response) {
          return response;
        }
      } catch (error) {
        const errorMsg = error?.message || String(error);
        const isUnavailable = errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE") || errorMsg.includes("high demand") || errorMsg.includes("overloaded");
        const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota") || errorMsg.includes("Rate limit");
        console.warn(`[Gemini Error] Model ${model}, Attempt ${attempt}: ${errorMsg}`);
        if (isRateLimit) {
          console.warn(`[Gemini Quota] Model ${model} rate limited or quota exceeded. Immediately trying fallback model.`);
          break;
        }
        if (isUnavailable && attempt < attempts) {
          const sleepTime = delayMs * attempt;
          console.log(`Sleeping for ${sleepTime}ms before retrying transient error...`);
          await new Promise((resolve) => setTimeout(resolve, sleepTime));
          continue;
        }
        if (errorMsg.includes("API key") || errorMsg.includes("not found") || errorMsg.includes("INVALID_ARGUMENT")) {
          throw new Error("Cl\xE9 d'API Invalide ou mod\xE8le introuvable. Veuillez v\xE9rifier vos param\xE8tres.");
        }
        if (attempt === attempts) {
          console.warn(`[Gemini Warning] Model ${model} exhausted. Attempting next fallback model if available.`);
        }
      }
    }
  }
  throw new Error("Saturation du service d'intelligence artificielle (Quota d\xE9pass\xE9). Veuillez r\xE9essayer dans quelques instants ou configurer votre cl\xE9 d'API personnelle dans les param\xE8tres.");
}
app.post("/api/test-key", async (req, res) => {
  const { customApiKey } = req.body;
  try {
    const ai = getGeminiClient(customApiKey);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "R\xE9ponds exactement avec le mot 'VALIDE'."
    });
    const text = response.text || "";
    if (text.includes("VALIDE") || text.trim().length > 0) {
      return res.json({ success: true, message: "La cl\xE9 d'API Gemini de Google est configur\xE9e et op\xE9rationnelle ! \u2728" });
    }
    throw new Error("R\xE9ponse inattendue de l'IA.");
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message || "La validation de la cl\xE9 d'API a \xE9chou\xE9." });
  }
});
app.post("/api/style-qr", async (req, res) => {
  const { prompt, customApiKey } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Un prompt valide est requis." });
  }
  try {
    const ai = getGeminiClient(customApiKey);
    const systemInstruction = `Tu es un designer graphique expert et ton r\xF4le est de concevoir un style visuel magnifique pour un QR code personnalis\xE9 en r\xE9ponse \xE0 la demande de l'utilisateur.
Le QR code doit rester lisible, donc veille \xE0 ce que les couleurs des dots (points de premier plan) contrastent fortement avec la couleur d'arri\xE8re-plan (ne mets pas d'arri\xE8res-plans trop proches de la couleur des points).

Les options autoris\xE9es pour chaque propri\xE9t\xE9 sont :
- dotStyle (style des modules de points) : "square" | "circle" | "dots" | "star" | "diamond" | "rounded-connect"
- eyeOuterStyle (style ext\xE9rieur des 3 yeux d'alignement) : "square" | "rounded" | "circle" | "extra-rounded"
- eyeInnerStyle (style int\xE9rieur des 3 yeux d'alignement) : "square" | "rounded" | "circle" | "diamond"
- logoType : "none" | "emoji" | "preset"
- logoValue : Si logoType est "emoji", retourne un emoji assorti (ex: "\u2615", "\u{1F33F}", "\u{1F6D2}", "\u2728"). Si logoType est "preset", choisis parmi : "globe", "phone", "mail", "wifi", "heart", "star", "github", "twitter".
- logoSize : Un nombre d\xE9cimal entre 0.16 et 0.22 (ex: 0.18).
- logoBgShape : "circle" | "square" | "none"
- frameStyle : "none" | "bubble" | "classic" | "badge" | "minimalist"
- frameText : Court texte incitatif en majuscules (ex: "SCANNE-MOI", "VISITEZ-MOI", "CAFE BIO") pas plus de 16 caract\xE8res.

G\xE9n\xE8re TOUJOURS des couleurs assorties au th\xE8me de l'utilisateur. Retourne un format JSON contenant une cl\xE9 'reasoning' (une explication en fran\xE7ais de 1-2 phrases d\xE9crivant l'ambiance choisie) et un objet 'style' contenant la configuration compl\xE8te.`;
    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: `Veuillez g\xE9n\xE9rer un style visuel de QR code pour la description suivante: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          required: ["reasoning", "style"],
          properties: {
            reasoning: {
              type: import_genai.Type.STRING,
              description: "Explication courte en fran\xE7ais des choix esth\xE9tiques pour ce th\xE8me."
            },
            style: {
              type: import_genai.Type.OBJECT,
              required: [
                "dotStyle",
                "backgroundColor",
                "backgroundGradient",
                "backgroundGradientType",
                "backgroundGradientColors",
                "dotColor",
                "dotGradient",
                "dotGradientType",
                "dotGradientColors",
                "eyeOuterStyle",
                "eyeInnerStyle",
                "eyeOuterColor",
                "eyeInnerColor",
                "logoType",
                "logoValue",
                "logoSize",
                "logoBgColor",
                "logoBgShape",
                "frameStyle",
                "frameText",
                "frameTextColor",
                "frameBgColor"
              ],
              properties: {
                dotStyle: { type: import_genai.Type.STRING, description: 'Format des points: "square" | "circle" | "dots" | "star" | "diamond" | "rounded-connect"' },
                backgroundColor: { type: import_genai.Type.STRING, description: 'Code hexad\xE9cimal de fond primaire, ex: "#FFFFFF"' },
                backgroundGradient: { type: import_genai.Type.BOOLEAN },
                backgroundGradientType: { type: import_genai.Type.STRING, description: '"linear" | "radial"' },
                backgroundGradientColors: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING }, description: "Au moins 2 codes hex." },
                dotColor: { type: import_genai.Type.STRING, description: 'Code hexad\xE9cimal primaire pour les points, ex: "#0F172A"' },
                dotGradient: { type: import_genai.Type.BOOLEAN },
                dotGradientType: { type: import_genai.Type.STRING, description: '"linear" | "radial"' },
                dotGradientColors: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING }, description: "Au moins 2 codes hex de d\xE9grad\xE9 contrastant." },
                eyeOuterStyle: { type: import_genai.Type.STRING, description: '"square" | "rounded" | "circle" | "extra-rounded"' },
                eyeInnerStyle: { type: import_genai.Type.STRING, description: '"square" | "rounded" | "circle" | "diamond"' },
                eyeOuterColor: { type: import_genai.Type.STRING, description: "Code hex pour le bord des yeux d'alignement." },
                eyeInnerColor: { type: import_genai.Type.STRING, description: "Code hex pour le centre des yeux d'alignement." },
                logoType: { type: import_genai.Type.STRING, description: '"none" | "emoji" | "preset"' },
                logoValue: { type: import_genai.Type.STRING, description: "L'emoji ou l'identifiant du preset" },
                logoSize: { type: import_genai.Type.NUMBER, description: "Fraction entre 0.16 et 0.22" },
                logoBgColor: { type: import_genai.Type.STRING, description: "Couleur de fond du badge de logo central pour d\xE9coupe." },
                logoBgShape: { type: import_genai.Type.STRING, description: '"circle" | "square" | "none"' },
                frameStyle: { type: import_genai.Type.STRING, description: '"none" | "bubble" | "classic" | "badge" | "minimalist"' },
                frameText: { type: import_genai.Type.STRING, description: "Texte incitatif court, ex: CODESCAN" },
                frameTextColor: { type: import_genai.Type.STRING, description: "Code hex de la couleur du texte" },
                frameBgColor: { type: import_genai.Type.STRING, description: "Code hex de fond du cadre ext\xE9rieur." }
              }
            }
          }
        }
      }
    });
    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Pas de texte retourn\xE9 par Gemini.");
    }
    const payload = JSON.parse(textResponse.trim());
    return res.json(payload);
  } catch (error) {
    console.error("Gemini QR Styling API Error:", error);
    return res.status(500).json({
      error: error.message || "Erreur lors de la g\xE9n\xE9ration par l'IA",
      isKeyMissing: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY === ""
    });
  }
});
app.post("/api/generate-logo", async (req, res) => {
  const { prompt, customApiKey } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Un prompt valide est requis." });
  }
  try {
    const ai = getGeminiClient(customApiKey);
    const systemInstruction = `Tu es un artiste vectoriel expert travaillant sur Adobe Illustrator d'origine. Ton r\xF4le est de concevoir des formes g\xE9om\xE9triques de haute qualit\xE9 pour g\xE9n\xE9rer un logo ou des \xE9l\xE9ments visuels assortis \xE0 la demande de l'utilisateur.
Le canvas d'\xE9dition fait une taille totale de 500 x 500 pixels. Tout \xE9l\xE9ment doit rester confin\xE9 dans ces coordonn\xE9es.
Tu peux renvoyer un ensemble coh\xE9rent de 2 \xE0 4 calques ordonn\xE9s de mani\xE8re logique (l'arri\xE8re-plan d'abord).

Les options pour les \xE9l\xE9ments sont :
- type : "rect" (rectangle) | "circle" (cercle/ellipse) | "star" (\xE9toile) | "text" (zone de texte)
- x : Position horizontale de l'\xE9l\xE9ment (0 \xE0 500).
- y : Position verticale de l'\xE9l\xE9ment (0 \xE0 500).
- width : Largeur de la bo\xEEte englobante (10 \xE0 450).
- height : Hauteur de la bo\xEEte englobante (10 \xE0 450).
- rotate : Angle de rotation de 0 \xE0 360 degr\xE9s.
- opacity : Valeur d\xE9cimale d'opacit\xE9 de 0.0 \xE0 1.0 (ex: 0.95).
- fill : Code couleur de fond hexadecimal (ex: "#E11D48").
- fillGradient : true ou false. Indique si l'\xE9l\xE9ment utilise un d\xE9grad\xE9.
- fillGradientType : "linear" | "radial".
- fillGradientColors : Un tableau de deux codes couleur hex (ex: ["#FB7185", "#BE123C"]).
- fillGradientAngle : Angle d'inclinaison de 0 \xE0 360.
- stroke : Code couleur hexac\xE9cimal du contour (ex: "#BE123C") ou "none" si pas de contour.
- strokeWidth : \xC9paisseur du trait de 0 \xE0 12.
- strokeDash : "solid" | "dashed".
- rx : Rayon de bordure (requis si type est "rect", entre 0 et 30).
- points : Sommets de l'\xE9toile (requis si type est "star", entre 3 et 12).
- textValue : Le texte brut affich\xE9 (requis si type est "text").
- fontFamily : "Inter" | "Space Grotesk" | "Playfair Display" | "JetBrains Mono" (requis si type est "text").
- fontWeight : "normal" | "bold" (requis si type est "text").

G\xE9n\xE8re TOUJOURS des couleurs artistiques et assorties au th\xE8me de l'utilisateur. Retourne un format JSON contenant une cl\xE9 'reasoning' (explication courte en fran\xE7ais parlant des choix graphiques) et un tableau 'elements' contenant la liste compl\xE8te des formes vectorielles.`;
    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: `Veuillez g\xE9n\xE9rer des \xE9l\xE9ments g\xE9om\xE9triques de logo vectoriel de haute qualit\xE9 pour la description suivante: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          required: ["reasoning", "elements"],
          properties: {
            reasoning: {
              type: import_genai.Type.STRING,
              description: "Explication courte en fran\xE7ais de la composition cr\xE9\xE9e."
            },
            elements: {
              type: import_genai.Type.ARRAY,
              description: "La pile de calques vectoriels, de l'arri\xE8re-plan vers le premier plan.",
              items: {
                type: import_genai.Type.OBJECT,
                required: [
                  "name",
                  "type",
                  "x",
                  "y",
                  "width",
                  "height",
                  "rotate",
                  "opacity",
                  "fill",
                  "fillGradient",
                  "fillGradientType",
                  "fillGradientColors",
                  "fillGradientAngle",
                  "stroke",
                  "strokeWidth",
                  "strokeDash"
                ],
                properties: {
                  name: { type: import_genai.Type.STRING, description: `Nom lisible du calque, ex: "Fond \xE9toil\xE9 d'or"` },
                  type: { type: import_genai.Type.STRING, description: '"rect" | "circle" | "star" | "text"' },
                  x: { type: import_genai.Type.INTEGER },
                  y: { type: import_genai.Type.INTEGER },
                  width: { type: import_genai.Type.INTEGER },
                  height: { type: import_genai.Type.INTEGER },
                  rotate: { type: import_genai.Type.INTEGER },
                  opacity: { type: import_genai.Type.NUMBER },
                  fill: { type: import_genai.Type.STRING },
                  fillGradient: { type: import_genai.Type.BOOLEAN },
                  fillGradientType: { type: import_genai.Type.STRING },
                  fillGradientColors: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
                  fillGradientAngle: { type: import_genai.Type.INTEGER },
                  stroke: { type: import_genai.Type.STRING },
                  strokeWidth: { type: import_genai.Type.INTEGER },
                  strokeDash: { type: import_genai.Type.STRING },
                  rx: { type: import_genai.Type.INTEGER },
                  points: { type: import_genai.Type.INTEGER },
                  textValue: { type: import_genai.Type.STRING },
                  fontFamily: { type: import_genai.Type.STRING },
                  fontWeight: { type: import_genai.Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Pas de texte retourn\xE9 par Gemini.");
    }
    const payload = JSON.parse(textResponse.trim());
    return res.json(payload);
  } catch (error) {
    console.error("Gemini Vector Logo API Error:", error);
    return res.status(500).json({
      error: error.message || "Erreur lors de la g\xE9n\xE9ration vectorielle par l'IA",
      isKeyMissing: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY === ""
    });
  }
});
app.post("/api/ai-erase", async (req, res) => {
  const { elements, mode, prompt, customApiKey } = req.body;
  if (!elements || !Array.isArray(elements)) {
    return res.status(400).json({ error: "Une liste valide de calques vectoriels (elements) est requise." });
  }
  try {
    const ai = getGeminiClient(customApiKey);
    const systemInstruction = `Tu es un assistant IA sp\xE9cialis\xE9 dans l'\xE9dition d'illustrations vectorielles SVG minimalistes.
Ton r\xF4le est d'effectuer une op\xE9ration d'effacement intelligent (Gomme AI) sur une liste et une pile d'\xE9l\xE9ments g\xE9om\xE9triques SVG qui composent une illustration.

Le mode d'effacement sp\xE9cifi\xE9 est l'un des suivants :
- "background" : Effacer l'arri\xE8re-plan (enlever ou vider les grands \xE9l\xE9ments de fond comme les rectangles ou cercles de taille globale en d\xE9but de pile qui forment le d\xE9cor d'arri\xE8re-plan).
- "foreground" : Effacer l'avant-plan (enlever ou masquer les d\xE9tails superpos\xE9s au-dessus / \xE0 la fin de la pile d'\xE9l\xE9ments).
- "objects" : Effacer les objets principaux (les formes distinctes identifiables composant le logo ou le sujet central, en gardant l'arri\xE8re-plan s'il y en a un).
- "decor" : Effacer le d\xE9cor (enlever le d\xE9cor/d\xE9cors secondaires comme des petites \xE9toiles, des contours stylis\xE9s de bordure, des petits cercles de d\xE9coration ou des fioritures).
- "custom" : Effacer s\xE9lectivement en fonction de la consigne (prompt) personnalis\xE9e de l'utilisateur (ex: "Gomme tous les \xE9l\xE9ments rouges", "Enl\xE8ve le texte", "Retire les \xE9toiles").

Tu re\xE7ois la liste actuelle des calques sous forme d'un tableau JSON. Chaque \xE9l\xE9ment a un "id" unique, un "name", un "type", des coordonn\xE9es, etc.
Analyse attentivement la structure esth\xE9tique de cette liste pour d\xE9terminer quels \xE9l\xE9ments doivent \xEAtre supprim\xE9s ou modifi\xE9s (par exemple en r\xE9glant leur opacity \xE0 0, ou en les filtrant compl\xE8tement du tableau).
Retourne TOUJOURS un objet JSON valide contenant :
1. "reasoning" : Une phrase d'explication courte et chaleureuse en fran\xE7ais d\xE9crivant l'action d'effacement intelligent effectu\xE9e.
2. "elements" : Le tableau complet des \xE9l\xE9ments restants (ou modifi\xE9s). Veille \xE0 ne PAS r\xE9inventer ou d\xE9truire la structure de l'illustration en dehors de la demande d'effacement. Conserve les IDs uniques des \xE9l\xE9ments restants intacts.`;
    const instructions = prompt ? `Consigne de l'utilisateur: "${prompt}" (Mode s\xE9lectionn\xE9 : ${mode})` : `Action demand\xE9e : Effacement en mode "${mode}"`;
    const simplifiedElements = elements.map((el) => {
      const { imageUrl, originalImageUrl, cutoutImageUrl, clipPathData, eraserStrokes, pathData, ...rest } = el;
      return rest;
    });
    const userPrompt = `${instructions}
Voici la structure actuelle des calques vectoriels sous forme de tableau JSON (les donn\xE9es lourdes d'image et de chemins ont \xE9t\xE9 masqu\xE9es pour la lisibilit\xE9):
${JSON.stringify(simplifiedElements, null, 2)}`;
    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          required: ["reasoning", "elements"],
          properties: {
            reasoning: {
              type: import_genai.Type.STRING,
              description: "Explication synth\xE9tique et chaleureuse en fran\xE7ais de l'action d'effacement intelligent effectu\xE9e."
            },
            elements: {
              type: import_genai.Type.ARRAY,
              description: "La pile de calques vectoriels filtr\xE9e de l'arri\xE8re-plan vers l'avant-plan.",
              items: {
                type: import_genai.Type.OBJECT,
                required: [
                  "id",
                  "name",
                  "type",
                  "x",
                  "y",
                  "width",
                  "height",
                  "rotate",
                  "opacity",
                  "fill",
                  "fillGradient",
                  "fillGradientType",
                  "fillGradientColors",
                  "fillGradientAngle",
                  "stroke",
                  "strokeWidth",
                  "strokeDash"
                ],
                properties: {
                  id: { type: import_genai.Type.STRING },
                  name: { type: import_genai.Type.STRING },
                  type: { type: import_genai.Type.STRING },
                  x: { type: import_genai.Type.INTEGER },
                  y: { type: import_genai.Type.INTEGER },
                  width: { type: import_genai.Type.INTEGER },
                  height: { type: import_genai.Type.INTEGER },
                  rotate: { type: import_genai.Type.INTEGER },
                  opacity: { type: import_genai.Type.NUMBER },
                  fill: { type: import_genai.Type.STRING },
                  fillGradient: { type: import_genai.Type.BOOLEAN },
                  fillGradientType: { type: import_genai.Type.STRING },
                  fillGradientColors: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
                  fillGradientAngle: { type: import_genai.Type.INTEGER },
                  stroke: { type: import_genai.Type.STRING },
                  strokeWidth: { type: import_genai.Type.INTEGER },
                  strokeDash: { type: import_genai.Type.STRING },
                  rx: { type: import_genai.Type.INTEGER },
                  points: { type: import_genai.Type.INTEGER },
                  textValue: { type: import_genai.Type.STRING },
                  fontFamily: { type: import_genai.Type.STRING },
                  fontWeight: { type: import_genai.Type.STRING },
                  isHidden: { type: import_genai.Type.BOOLEAN },
                  isLocked: { type: import_genai.Type.BOOLEAN }
                }
              }
            }
          }
        }
      }
    });
    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Pas de texte retourn\xE9 par Gemini.");
    }
    const payload = JSON.parse(textResponse.trim());
    return res.json(payload);
  } catch (error) {
    console.error("Gemini AI Erase API Error:", error);
    return res.status(500).json({
      error: error.message || "Erreur lors de l'effacement intelligent par l'IA",
      isKeyMissing: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY === ""
    });
  }
});
app.post("/api/parse-pdf", async (req, res) => {
  const { fileData, mimeType, customApiKey, currentElements, instruction } = req.body;
  try {
    const ai = getGeminiClient(customApiKey);
    let prompt = "";
    let contents = [];
    const responseSchema = {
      type: import_genai.Type.OBJECT,
      properties: {
        title: { type: import_genai.Type.STRING, description: "Titre principal du formulaire extrait ou g\xE9n\xE9r\xE9." },
        description: { type: import_genai.Type.STRING, description: "Breve introduction, description du contexte ou en-t\xEAte explicatif." },
        elements: {
          type: import_genai.Type.ARRAY,
          description: "La liste ordonn\xE9e s\xE9quentiellement de haut en bas de tous les blocs textuels, titres et champs de donn\xE9es \xE9ditables.",
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              id: { type: import_genai.Type.STRING, description: "Identifiant unique autog\xE9n\xE9r\xE9 de l'\xE9l\xE9ment (ex: elem_1, input_nom...)" },
              type: {
                type: import_genai.Type.STRING,
                description: "Type de l'\xE9l\xE9ment : 'title' (titre principal), 'section' (s\xE9parateur ou ent\xEAte de partie), 'text_block' (explications simples sans saisie), 'input_text' (champ de saisie standard court comme le nom, le pr\xE9nom, l'adresse, la date), 'checkbox' (case \xE0 cocher interactive), 'textarea' (paragraphe grand format comme des commentaires ou justifications)."
              },
              label: { type: import_genai.Type.STRING, description: "Le texte de l'\xE9l\xE9ment, la consigne ou le libell\xE9 de l'input (par exemple 'Nom de famille :', 'Je certifie sur l'honneur...')" },
              placeholder: { type: import_genai.Type.STRING, description: "L'indicateur d'aide pour la saisie (requis pour input_text / textarea)." },
              value: { type: import_genai.Type.STRING, description: "Contenu texte pr\xE9-rempli si d\xE9j\xE0 pr\xE9sent et d\xE9tect\xE9." },
              checked: { type: import_genai.Type.BOOLEAN, description: "True/False si l'\xE9l\xE9ment est une case \xE0 cocher et qu'elle semble coch\xE9e sur l'original." },
              required: { type: import_genai.Type.BOOLEAN, description: "True si le champ est obligatoire (indiqu\xE9 par une \xE9toile ou mention requise)." },
              layoutWidth: { type: import_genai.Type.STRING, description: "Indicateur d'horizontalit\xE9 : 'full' (par d\xE9faut, prend toute la largeur), 'half' (si deux champs sont c\xF4te-\xE0-c\xF4te sur la m\xEAme ligne), 'third' (si trois champs figurent sur la m\xEAme ligne)." }
            },
            required: ["id", "type", "label"]
          }
        }
      },
      required: ["title", "elements"]
    };
    if (fileData && mimeType) {
      contents.push({
        inlineData: {
          data: fileData,
          mimeType
        }
      });
      prompt = `Analyse attentivement cette pi\xE8ce jointe (qui est un formulaire ou document PDF ou image). Ton objectif est de la convertir en un formulaire interactif enti\xE8rement modifiable par l'utilisateur au clavier.
Recherche tous les champs o\xF9 un utilisateur remplirait normalement des informations \xE0 la main ou d'autres formats (les lignes horizontales pleines '_____', les lignes de points '.....', les rectangles blancs isol\xE9s) et convertis-les en objets \xE9ditables :
- 'input_text' : pour les lignes courtes (comme Nom, Pr\xE9nom, Date, Adresse, Ville...)
- 'textarea' : pour les zones plus larges d'explications de plusieurs lignes (comme 'Explication :', 'Motif de la demande :')
- 'checkbox' : pour toutes les cases d'options \xE0 cocher (comme '[ ]', '( )', 'Oui / Non')
- 'section' : pour d\xE9limiter les grandes cat\xE9gories ou cartes du document.
- 'text_block' : pour le corps de texte r\xE9gulier ou les clauses d'accord \xE0 lire.
Pense \xE0 utiliser la propri\xE9t\xE9 "layoutWidth" ("half" ou "third") lorsque des champs sont positionn\xE9s horizontalement sur la m\xEAme ligne dans la mise en page d'origine, par exemple pour Nom/Pr\xE9nom, ou Code Postal/Ville, afin de recr\xE9er l'horizontalit\xE9 du PDF d'origine.
Ne perds pas les informations textuelles cruciales du document. Conserve le fran\xE7ais s'il s'agit d'un formulaire fran\xE7ais.`;
      contents.push({ text: prompt });
    } else if (currentElements && instruction) {
      prompt = `Tu es un assistant de conception de formulaires interactifs.
Voici la structure actuelle du formulaire :
${JSON.stringify(currentElements, null, 2)}

L'utilisateur demande d'effectuer la modification suivante sur cette structure : "${instruction}"
Modifie, ajoute, supprime ou convertis les \xE9l\xE9ments de la liste de mani\xE8re coh\xE9rente, puis renvoie le nouveau formulaire int\xE9gralement mis \xE0 jour au format JSON respectant strictement le sch\xE9ma. Conserve les \xE9l\xE9ments existants s'ils ne sont pas affect\xE9s.`;
      contents.push({ text: prompt });
    } else {
      return res.status(400).json({ error: "Pi\xE8ce jointe valide ou liste d'\xE9l\xE9ments avec instruction requise." });
    }
    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: "Tu es un sp\xE9cialiste de la num\xE9risation de documents papier complexes. Convertis les formulaires inactifs en objets interactifs structur\xE9s complets et soign\xE9s sans perdre aucune information de valeur l\xE9gale ou technique.",
        responseMimeType: "application/json",
        responseSchema
      }
    });
    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Aucune structure n'a \xE9t\xE9 renvoy\xE9e par le mod\xE8le d'intelligence artificielle.");
    }
    const docFormSchema = JSON.parse(textResponse.trim());
    return res.json({ success: true, ...docFormSchema });
  } catch (error) {
    console.error("Gemini Parse PDF API Error:", error);
    return res.status(500).json({
      error: error.message || "Erreur durant l'analyse intelligente du document par Gemini.",
      isKeyMissing: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY === ""
    });
  }
});
app.post("/api/ai/whiteboard-to-slide", async (req, res) => {
  const { imageBase64, mimeType = "image/png", customApiKey, instructions, boardMode = "whiteboard" } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ success: false, error: "Image du tableau requise pour l'analyse visuelle." });
  }
  try {
    const ai = getGeminiClient(customApiKey);
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const contents = [
      {
        inlineData: {
          data: cleanBase64,
          mimeType
        }
      },
      {
        text: `Tu es un expert mondial en synth\xE8se visuelle, communication strat\xE9gique et conception de pr\xE9sentations professionnelles.
Analyse cette capture d'\xE9cran d'un ${boardMode === "blackboard" ? "Tableau Noir scolaire \xE0 la craie" : boardMode === "paperboard" ? "Paperboard de r\xE9union d'entreprise" : "Tableau Blanc p\xE9dagogique"}.
D\xE9crypte minutieusement tous les \xE9l\xE9ments visuels dessin\xE9s ou \xE9crits : \xE9criture manuscrite, titres, \xE9quations math\xE9matiques, organigrammes, diagrammes fl\xE9ch\xE9s, croquis, cartes mentales et annotations.

Consigne utilisateur additionnelle : "${instructions || "Synth\xE9tise fid\xE8lement et \xE9l\xE9gamment tous les concepts du tableau sous forme de diapositive ex\xE9cutive claire."}"

R\xE8gles de transcription et de synth\xE8se :
1. "title" : Titre court, direct et \xE9l\xE9gant synth\xE9tisant le sujet central (5 \xE0 8 mots max).
2. "subtitle" : Sous-titre apportant du contexte (ex: "Synth\xE8se de s\xE9ance & Orientations cl\xE9s").
3. "category" : Th\xE9matique (ex: "Strat\xE9gie", "Architecture Logicielle", "Sciences & Math\xE9matiques", "Design & UX").
4. "summary" : Synth\xE8se globale du tableau en 2 \xE0 3 phrases fluides.
5. "bulletPoints" : 3 \xE0 5 points cl\xE9s tr\xE8s soign\xE9s expliquant ce qui a \xE9t\xE9 dessin\xE9 ou not\xE9.
6. "diagramAnalysis" : Explication d\xE9taill\xE9e des sch\xE9mas, blocs, relations ou fl\xE8ches observ\xE9s sur le tableau.
7. "actionItems" : 2 \xE0 4 \xE9tapes suivantes, d\xE9cisions ou applications directes qui d\xE9coulent de ce tableau.
8. "speakerNotes" : Notes compl\xE8tes pour l'orateur expliquant la d\xE9marche p\xE9dagogique ou manag\xE9riale pour la pr\xE9sentation.
9. "suggestedColorTheme" : Th\xE8me couleur recommand\xE9 ("ocean-blue", "emerald-slate", "amber-warm", "violet-indigo").`
      }
    ];
    const slideSchema = {
      type: import_genai.Type.OBJECT,
      properties: {
        title: { type: import_genai.Type.STRING, description: "Titre principal de la slide" },
        subtitle: { type: import_genai.Type.STRING, description: "Sous-titre de la slide" },
        category: { type: import_genai.Type.STRING, description: "Cat\xE9gorie du sujet" },
        summary: { type: import_genai.Type.STRING, description: "Synth\xE8se g\xE9n\xE9rale du tableau" },
        bulletPoints: {
          type: import_genai.Type.ARRAY,
          items: { type: import_genai.Type.STRING },
          description: "Points cl\xE9s structur\xE9s de la slide"
        },
        diagramAnalysis: { type: import_genai.Type.STRING, description: "Analyse des sch\xE9mas, formes et dessins" },
        actionItems: {
          type: import_genai.Type.ARRAY,
          items: { type: import_genai.Type.STRING },
          description: "Actions ou conclusions identifi\xE9es"
        },
        speakerNotes: { type: import_genai.Type.STRING, description: "Notes de pr\xE9sentation pour l'orateur" },
        suggestedColorTheme: { type: import_genai.Type.STRING, description: "Th\xE8me sugg\xE9r\xE9 pour la slide" }
      },
      required: ["title", "subtitle", "summary", "bulletPoints", "speakerNotes"]
    };
    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: "Tu es un sp\xE9cialiste de la synth\xE8se visuelle et de la cr\xE9ation de pr\xE9sentations de niveau ex\xE9cutif. D\xE9crypte minutieusement l'\xE9criture manuscrite et les croquis pour les transformer en contenu clair et percutant.",
        responseMimeType: "application/json",
        responseSchema: slideSchema
      }
    });
    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Aucune structure renvoy\xE9e par le mod\xE8le d'intelligence artificielle.");
    }
    const slideData = JSON.parse(textResponse.trim());
    return res.json({ success: true, slide: slideData });
  } catch (error) {
    console.error("Gemini Whiteboard to Slide Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erreur durant l'analyse intelligente du tableau par Gemini.",
      isKeyMissing: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY"
    });
  }
});
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server loaded in full-stack mode, serving port ${PORT}`);
  });
}
setupServer();
//# sourceMappingURL=server.cjs.map

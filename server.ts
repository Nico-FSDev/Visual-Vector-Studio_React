import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable trust proxy for Cloud Run and reverse proxies so rateLimiter works correctly
app.set("trust proxy", 1);

// Apply rate limiting to all API routes
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // limit each IP to 15 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Rate limit exceeded. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED"
  }
});
app.use("/api/", apiLimiter);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Global error handler middleware to intercept syntax/payload errors to JSON format rather than HTML
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    console.error("Express Parser/Middleware Error Intercepted:", err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Erreur de traitement de la requête au serveur.",
      code: err.code || "REQUEST_ERROR"
    });
  }
  next();
});

// Lazy initialize Gemini client to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(customKey?: string): GoogleGenAI {
  const key = customKey || process.env.GEMINI_API_KEY;
  // We will throw a clear error or handle it. Let's handle it gracefully.
  if (!key || key === "MY_GEMINI_API_KEY" || key === "") {
    throw new Error("La clé d'API Gemini n'est pas configurée. Veuillez renseigner une clé valide dans l'onglet des Paramètres (Gemini API).");
  }
  
  if (customKey) {
    return new GoogleGenAI({
      apiKey: customKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

interface GenerateConfig {
  model: string;
  contents: any;
  config?: any;
}

// Robust helper to perform automatic retries on 503 (or other transient statuses) with backup fallbacks
async function generateContentWithRetry(ai: GoogleGenAI, params: GenerateConfig, retriesLeft = 2, delayMs = 1500): Promise<any> {
  const modelsToTry = Array.from(new Set([params.model, "gemini-2.5-flash", "gemini-1.5-flash"]));
  
  for (const model of modelsToTry) {
    let attempts = model === params.model ? retriesLeft : 1; // only retry on primary model if transient error
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`[Gemini Request] Model ${model}, Attempt ${attempt}/${attempts}`);
        const response = await ai.models.generateContent({
          model: model,
          contents: params.contents,
          config: params.config
        });
        
        if (response) {
          return response;
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        const isUnavailable = errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE") || errorMsg.includes("high demand") || errorMsg.includes("overloaded");
        const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota") || errorMsg.includes("Rate limit");
        
        console.warn(`[Gemini Error] Model ${model}, Attempt ${attempt}: ${errorMsg}`);
        
        if (isRateLimit) {
          console.warn(`[Gemini Quota] Model ${model} rate limited or quota exceeded. Immediately trying fallback model.`);
          break; // Break inner attempt loop to try next model immediately
        }

        if (isUnavailable && attempt < attempts) {
          const sleepTime = delayMs * attempt;
          console.log(`Sleeping for ${sleepTime}ms before retrying transient error...`);
          await new Promise((resolve) => setTimeout(resolve, sleepTime));
          continue;
        }
        
        // If it's a structural key error, throw immediately
        if (errorMsg.includes("API key") || errorMsg.includes("not found") || errorMsg.includes("INVALID_ARGUMENT")) {
          throw new Error("Clé d'API Invalide ou modèle introuvable. Veuillez vérifier vos paramètres.");
        }
        
        if (attempt === attempts) {
          console.warn(`[Gemini Warning] Model ${model} exhausted. Attempting next fallback model if available.`);
        }
      }
    }
  }
  
  throw new Error("Saturation du service d'intelligence artificielle (Quota dépassé). Veuillez réessayer dans quelques instants ou configurer votre clé d'API personnelle dans les paramètres.");
}

// API endpoint to test custom or environment Gemini API key validation
app.post("/api/test-key", async (req, res) => {
  const { customApiKey } = req.body;
  try {
    const ai = getGeminiClient(customApiKey);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Réponds exactement avec le mot 'VALIDE'."
    });
    const text = response.text || "";
    if (text.includes("VALIDE") || text.trim().length > 0) {
      return res.json({ success: true, message: "La clé d'API Gemini de Google est configurée et opérationnelle ! ✨" });
    }
    throw new Error("Réponse inattendue de l'IA.");
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || "La validation de la clé d'API a échoué." });
  }
});

// API endpoint to style QR code via Gemini AI based on user description
app.post("/api/style-qr", async (req, res) => {
  const { prompt, customApiKey } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Un prompt valide est requis." });
  }

  try {
    const ai = getGeminiClient(customApiKey);

    const systemInstruction = `Tu es un designer graphique expert et ton rôle est de concevoir un style visuel magnifique pour un QR code personnalisé en réponse à la demande de l'utilisateur.
Le QR code doit rester lisible, donc veille à ce que les couleurs des dots (points de premier plan) contrastent fortement avec la couleur d'arrière-plan (ne mets pas d'arrières-plans trop proches de la couleur des points).

Les options autorisées pour chaque propriété sont :
- dotStyle (style des modules de points) : "square" | "circle" | "dots" | "star" | "diamond" | "rounded-connect"
- eyeOuterStyle (style extérieur des 3 yeux d'alignement) : "square" | "rounded" | "circle" | "extra-rounded"
- eyeInnerStyle (style intérieur des 3 yeux d'alignement) : "square" | "rounded" | "circle" | "diamond"
- logoType : "none" | "emoji" | "preset"
- logoValue : Si logoType est "emoji", retourne un emoji assorti (ex: "☕", "🌿", "🛒", "✨"). Si logoType est "preset", choisis parmi : "globe", "phone", "mail", "wifi", "heart", "star", "github", "twitter".
- logoSize : Un nombre décimal entre 0.16 et 0.22 (ex: 0.18).
- logoBgShape : "circle" | "square" | "none"
- frameStyle : "none" | "bubble" | "classic" | "badge" | "minimalist"
- frameText : Court texte incitatif en majuscules (ex: "SCANNE-MOI", "VISITEZ-MOI", "CAFE BIO") pas plus de 16 caractères.

Génère TOUJOURS des couleurs assorties au thème de l'utilisateur. Retourne un format JSON contenant une clé 'reasoning' (une explication en français de 1-2 phrases décrivant l'ambiance choisie) et un objet 'style' contenant la configuration complète.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: `Veuillez générer un style visuel de QR code pour la description suivante: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["reasoning", "style"],
          properties: {
            reasoning: {
              type: Type.STRING,
              description: "Explication courte en français des choix esthétiques pour ce thème."
            },
            style: {
              type: Type.OBJECT,
              required: [
                "dotStyle", "backgroundColor", "backgroundGradient", "backgroundGradientType",
                "backgroundGradientColors", "dotColor", "dotGradient", "dotGradientType",
                "dotGradientColors", "eyeOuterStyle", "eyeInnerStyle", "eyeOuterColor", "eyeInnerColor",
                "logoType", "logoValue", "logoSize", "logoBgColor", "logoBgShape",
                "frameStyle", "frameText", "frameTextColor", "frameBgColor"
              ],
              properties: {
                dotStyle: { type: Type.STRING, description: 'Format des points: "square" | "circle" | "dots" | "star" | "diamond" | "rounded-connect"' },
                backgroundColor: { type: Type.STRING, description: 'Code hexadécimal de fond primaire, ex: "#FFFFFF"' },
                backgroundGradient: { type: Type.BOOLEAN },
                backgroundGradientType: { type: Type.STRING, description: '"linear" | "radial"' },
                backgroundGradientColors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Au moins 2 codes hex." },
                dotColor: { type: Type.STRING, description: 'Code hexadécimal primaire pour les points, ex: "#0F172A"' },
                dotGradient: { type: Type.BOOLEAN },
                dotGradientType: { type: Type.STRING, description: '"linear" | "radial"' },
                dotGradientColors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Au moins 2 codes hex de dégradé contrastant." },
                eyeOuterStyle: { type: Type.STRING, description: '"square" | "rounded" | "circle" | "extra-rounded"' },
                eyeInnerStyle: { type: Type.STRING, description: '"square" | "rounded" | "circle" | "diamond"' },
                eyeOuterColor: { type: Type.STRING, description: "Code hex pour le bord des yeux d'alignement." },
                eyeInnerColor: { type: Type.STRING, description: "Code hex pour le centre des yeux d'alignement." },
                logoType: { type: Type.STRING, description: '"none" | "emoji" | "preset"' },
                logoValue: { type: Type.STRING, description: "L'emoji ou l'identifiant du preset" },
                logoSize: { type: Type.NUMBER, description: "Fraction entre 0.16 et 0.22" },
                logoBgColor: { type: Type.STRING, description: "Couleur de fond du badge de logo central pour découpe." },
                logoBgShape: { type: Type.STRING, description: '"circle" | "square" | "none"' },
                frameStyle: { type: Type.STRING, description: '"none" | "bubble" | "classic" | "badge" | "minimalist"' },
                frameText: { type: Type.STRING, description: "Texte incitatif court, ex: CODESCAN" },
                frameTextColor: { type: Type.STRING, description: "Code hex de la couleur du texte" },
                frameBgColor: { type: Type.STRING, description: "Code hex de fond du cadre extérieur." }
              }
            }
          }
        }
      }
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Pas de texte retourné par Gemini.");
    }

    const payload = JSON.parse(textResponse.trim());
    return res.json(payload);
  } catch (error: any) {
    console.error("Gemini QR Styling API Error:", error);
    // Return structured error detail so front-end can show fallback
    return res.status(500).json({
      error: error.message || "Erreur lors de la génération par l'IA",
      isKeyMissing: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY === ""
    });
  }
});

// API endpoint to generate professional vector logo elements via Gemini AI based on user description
app.post("/api/generate-logo", async (req, res) => {
  const { prompt, customApiKey } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Un prompt valide est requis." });
  }

  try {
    const ai = getGeminiClient(customApiKey);

    const systemInstruction = `Tu es un artiste vectoriel expert travaillant sur Adobe Illustrator d'origine. Ton rôle est de concevoir des formes géométriques de haute qualité pour générer un logo ou des éléments visuels assortis à la demande de l'utilisateur.
Le canvas d'édition fait une taille totale de 500 x 500 pixels. Tout élément doit rester confiné dans ces coordonnées.
Tu peux renvoyer un ensemble cohérent de 2 à 4 calques ordonnés de manière logique (l'arrière-plan d'abord).

Les options pour les éléments sont :
- type : "rect" (rectangle) | "circle" (cercle/ellipse) | "star" (étoile) | "text" (zone de texte)
- x : Position horizontale de l'élément (0 à 500).
- y : Position verticale de l'élément (0 à 500).
- width : Largeur de la boîte englobante (10 à 450).
- height : Hauteur de la boîte englobante (10 à 450).
- rotate : Angle de rotation de 0 à 360 degrés.
- opacity : Valeur décimale d'opacité de 0.0 à 1.0 (ex: 0.95).
- fill : Code couleur de fond hexadecimal (ex: "#E11D48").
- fillGradient : true ou false. Indique si l'élément utilise un dégradé.
- fillGradientType : "linear" | "radial".
- fillGradientColors : Un tableau de deux codes couleur hex (ex: ["#FB7185", "#BE123C"]).
- fillGradientAngle : Angle d'inclinaison de 0 à 360.
- stroke : Code couleur hexacécimal du contour (ex: "#BE123C") ou "none" si pas de contour.
- strokeWidth : Épaisseur du trait de 0 à 12.
- strokeDash : "solid" | "dashed".
- rx : Rayon de bordure (requis si type est "rect", entre 0 et 30).
- points : Sommets de l'étoile (requis si type est "star", entre 3 et 12).
- textValue : Le texte brut affiché (requis si type est "text").
- fontFamily : "Inter" | "Space Grotesk" | "Playfair Display" | "JetBrains Mono" (requis si type est "text").
- fontWeight : "normal" | "bold" (requis si type est "text").

Génère TOUJOURS des couleurs artistiques et assorties au thème de l'utilisateur. Retourne un format JSON contenant une clé 'reasoning' (explication courte en français parlant des choix graphiques) et un tableau 'elements' contenant la liste complète des formes vectorielles.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: `Veuillez générer des éléments géométriques de logo vectoriel de haute qualité pour la description suivante: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["reasoning", "elements"],
          properties: {
            reasoning: {
              type: Type.STRING,
              description: "Explication courte en français de la composition créée."
            },
            elements: {
              type: Type.ARRAY,
              description: "La pile de calques vectoriels, de l'arrière-plan vers le premier plan.",
              items: {
                type: Type.OBJECT,
                required: [
                  "name", "type", "x", "y", "width", "height", "rotate", "opacity",
                  "fill", "fillGradient", "fillGradientType", "fillGradientColors", "fillGradientAngle",
                  "stroke", "strokeWidth", "strokeDash"
                ],
                properties: {
                  name: { type: Type.STRING, description: 'Nom lisible du calque, ex: "Fond étoilé d\'or"' },
                  type: { type: Type.STRING, description: '"rect" | "circle" | "star" | "text"' },
                  x: { type: Type.INTEGER },
                  y: { type: Type.INTEGER },
                  width: { type: Type.INTEGER },
                  height: { type: Type.INTEGER },
                  rotate: { type: Type.INTEGER },
                  opacity: { type: Type.NUMBER },
                  fill: { type: Type.STRING },
                  fillGradient: { type: Type.BOOLEAN },
                  fillGradientType: { type: Type.STRING },
                  fillGradientColors: { type: Type.ARRAY, items: { type: Type.STRING } },
                  fillGradientAngle: { type: Type.INTEGER },
                  stroke: { type: Type.STRING },
                  strokeWidth: { type: Type.INTEGER },
                  strokeDash: { type: Type.STRING },
                  rx: { type: Type.INTEGER },
                  points: { type: Type.INTEGER },
                  textValue: { type: Type.STRING },
                  fontFamily: { type: Type.STRING },
                  fontWeight: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Pas de texte retourné par Gemini.");
    }

    const payload = JSON.parse(textResponse.trim());
    return res.json(payload);
  } catch (error: any) {
    console.error("Gemini Vector Logo API Error:", error);
    return res.status(500).json({
      error: error.message || "Erreur lors de la génération vectorielle par l'IA",
      isKeyMissing: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY === ""
    });
  }
});

// API endpoint for dynamic AI-based vector erasing and background removal (Gomme AI)
app.post("/api/ai-erase", async (req, res) => {
  const { elements, mode, prompt, customApiKey } = req.body;

  if (!elements || !Array.isArray(elements)) {
    return res.status(400).json({ error: "Une liste valide de calques vectoriels (elements) est requise." });
  }

  try {
    const ai = getGeminiClient(customApiKey);

    const systemInstruction = `Tu es un assistant IA spécialisé dans l'édition d'illustrations vectorielles SVG minimalistes.
Ton rôle est d'effectuer une opération d'effacement intelligent (Gomme AI) sur une liste et une pile d'éléments géométriques SVG qui composent une illustration.

Le mode d'effacement spécifié est l'un des suivants :
- "background" : Effacer l'arrière-plan (enlever ou vider les grands éléments de fond comme les rectangles ou cercles de taille globale en début de pile qui forment le décor d'arrière-plan).
- "foreground" : Effacer l'avant-plan (enlever ou masquer les détails superposés au-dessus / à la fin de la pile d'éléments).
- "objects" : Effacer les objets principaux (les formes distinctes identifiables composant le logo ou le sujet central, en gardant l'arrière-plan s'il y en a un).
- "decor" : Effacer le décor (enlever le décor/décors secondaires comme des petites étoiles, des contours stylisés de bordure, des petits cercles de décoration ou des fioritures).
- "custom" : Effacer sélectivement en fonction de la consigne (prompt) personnalisée de l'utilisateur (ex: "Gomme tous les éléments rouges", "Enlève le texte", "Retire les étoiles").

Tu reçois la liste actuelle des calques sous forme d'un tableau JSON. Chaque élément a un "id" unique, un "name", un "type", des coordonnées, etc.
Analyse attentivement la structure esthétique de cette liste pour déterminer quels éléments doivent être supprimés ou modifiés (par exemple en réglant leur opacity à 0, ou en les filtrant complètement du tableau).
Retourne TOUJOURS un objet JSON valide contenant :
1. "reasoning" : Une phrase d'explication courte et chaleureuse en français décrivant l'action d'effacement intelligent effectuée.
2. "elements" : Le tableau complet des éléments restants (ou modifiés). Veille à ne PAS réinventer ou détruire la structure de l'illustration en dehors de la demande d'effacement. Conserve les IDs uniques des éléments restants intacts.`;

    const instructions = prompt 
      ? `Consigne de l'utilisateur: "${prompt}" (Mode sélectionné : ${mode})`
      : `Action demandée : Effacement en mode "${mode}"`;

    // Strip heavy payload properties (Base64 images, large SVG paths) before sending to the LLM
    // This prevents 500 errors (Payload too large) and AI context truncation
    const simplifiedElements = elements.map((el: any) => {
      const { imageUrl, originalImageUrl, cutoutImageUrl, clipPathData, eraserStrokes, pathData, ...rest } = el;
      return rest;
    });

    const userPrompt = `${instructions}
Voici la structure actuelle des calques vectoriels sous forme de tableau JSON (les données lourdes d'image et de chemins ont été masquées pour la lisibilité):
${JSON.stringify(simplifiedElements, null, 2)}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["reasoning", "elements"],
          properties: {
            reasoning: {
              type: Type.STRING,
              description: "Explication synthétique et chaleureuse en français de l'action d'effacement intelligent effectuée."
            },
            elements: {
              type: Type.ARRAY,
              description: "La pile de calques vectoriels filtrée de l'arrière-plan vers l'avant-plan.",
              items: {
                type: Type.OBJECT,
                required: [
                  "id", "name", "type", "x", "y", "width", "height", "rotate", "opacity",
                  "fill", "fillGradient", "fillGradientType", "fillGradientColors", "fillGradientAngle",
                  "stroke", "strokeWidth", "strokeDash"
                ],
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  x: { type: Type.INTEGER },
                  y: { type: Type.INTEGER },
                  width: { type: Type.INTEGER },
                  height: { type: Type.INTEGER },
                  rotate: { type: Type.INTEGER },
                  opacity: { type: Type.NUMBER },
                  fill: { type: Type.STRING },
                  fillGradient: { type: Type.BOOLEAN },
                  fillGradientType: { type: Type.STRING },
                  fillGradientColors: { type: Type.ARRAY, items: { type: Type.STRING } },
                  fillGradientAngle: { type: Type.INTEGER },
                  stroke: { type: Type.STRING },
                  strokeWidth: { type: Type.INTEGER },
                  strokeDash: { type: Type.STRING },
                  rx: { type: Type.INTEGER },
                  points: { type: Type.INTEGER },
                  textValue: { type: Type.STRING },
                  fontFamily: { type: Type.STRING },
                  fontWeight: { type: Type.STRING },
                  isHidden: { type: Type.BOOLEAN },
                  isLocked: { type: Type.BOOLEAN }
                }
              }
            }
          }
        }
      }
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Pas de texte retourné par Gemini.");
    }

    const payload = JSON.parse(textResponse.trim());
    return res.json(payload);
  } catch (error: any) {
    console.error("Gemini AI Erase API Error:", error);
    return res.status(500).json({
      error: error.message || "Erreur lors de l'effacement intelligent par l'IA",
      isKeyMissing: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY === ""
    });
  }
});

// API endpoint to parse PDF/Image document and extract structured form
app.post("/api/parse-pdf", async (req, res) => {
  const { fileData, mimeType, customApiKey, currentElements, instruction } = req.body;

  try {
    const ai = getGeminiClient(customApiKey);
    
    let prompt = "";
    let contents: any[] = [];

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Titre principal du formulaire extrait ou généré." },
        description: { type: Type.STRING, description: "Breve introduction, description du contexte ou en-tête explicatif." },
        elements: {
          type: Type.ARRAY,
          description: "La liste ordonnée séquentiellement de haut en bas de tous les blocs textuels, titres et champs de données éditables.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Identifiant unique autogénéré de l'élément (ex: elem_1, input_nom...)" },
              type: { 
                type: Type.STRING, 
                description: "Type de l'élément : 'title' (titre principal), 'section' (séparateur ou entête de partie), 'text_block' (explications simples sans saisie), 'input_text' (champ de saisie standard court comme le nom, le prénom, l'adresse, la date), 'checkbox' (case à cocher interactive), 'textarea' (paragraphe grand format comme des commentaires ou justifications)." 
              },
              label: { type: Type.STRING, description: "Le texte de l'élément, la consigne ou le libellé de l'input (par exemple 'Nom de famille :', 'Je certifie sur l'honneur...')" },
              placeholder: { type: Type.STRING, description: "L'indicateur d'aide pour la saisie (requis pour input_text / textarea)." },
              value: { type: Type.STRING, description: "Contenu texte pré-rempli si déjà présent et détecté." },
              checked: { type: Type.BOOLEAN, description: "True/False si l'élément est une case à cocher et qu'elle semble cochée sur l'original." },
              required: { type: Type.BOOLEAN, description: "True si le champ est obligatoire (indiqué par une étoile ou mention requise)." },
              layoutWidth: { type: Type.STRING, description: "Indicateur d'horizontalité : 'full' (par défaut, prend toute la largeur), 'half' (si deux champs sont côte-à-côte sur la même ligne), 'third' (si trois champs figurent sur la même ligne)." }
            },
            required: ["id", "type", "label"]
          }
        }
      },
      required: ["title", "elements"]
    };

    if (fileData && mimeType) {
      // Direct media extraction mode
      contents.push({
        inlineData: {
          data: fileData,
          mimeType: mimeType
        }
      });
      prompt = `Analyse attentivement cette pièce jointe (qui est un formulaire ou document PDF ou image). Ton objectif est de la convertir en un formulaire interactif entièrement modifiable par l'utilisateur au clavier.
Recherche tous les champs où un utilisateur remplirait normalement des informations à la main ou d'autres formats (les lignes horizontales pleines '_____', les lignes de points '.....', les rectangles blancs isolés) et convertis-les en objets éditables :
- 'input_text' : pour les lignes courtes (comme Nom, Prénom, Date, Adresse, Ville...)
- 'textarea' : pour les zones plus larges d'explications de plusieurs lignes (comme 'Explication :', 'Motif de la demande :')
- 'checkbox' : pour toutes les cases d'options à cocher (comme '[ ]', '( )', 'Oui / Non')
- 'section' : pour délimiter les grandes catégories ou cartes du document.
- 'text_block' : pour le corps de texte régulier ou les clauses d'accord à lire.
Pense à utiliser la propriété "layoutWidth" ("half" ou "third") lorsque des champs sont positionnés horizontalement sur la même ligne dans la mise en page d'origine, par exemple pour Nom/Prénom, ou Code Postal/Ville, afin de recréer l'horizontalité du PDF d'origine.
Ne perds pas les informations textuelles cruciales du document. Conserve le français s'il s'agit d'un formulaire français.`;
      contents.push({ text: prompt });
    } else if (currentElements && instruction) {
      // Conversational refinement mode
      prompt = `Tu es un assistant de conception de formulaires interactifs.
Voici la structure actuelle du formulaire :
${JSON.stringify(currentElements, null, 2)}

L'utilisateur demande d'effectuer la modification suivante sur cette structure : "${instruction}"
Modifie, ajoute, supprime ou convertis les éléments de la liste de manière cohérente, puis renvoie le nouveau formulaire intégralement mis à jour au format JSON respectant strictement le schéma. Conserve les éléments existants s'ils ne sont pas affectés.`;
      contents.push({ text: prompt });
    } else {
      return res.status(400).json({ error: "Pièce jointe valide ou liste d'éléments avec instruction requise." });
    }

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: "Tu es un spécialiste de la numérisation de documents papier complexes. Convertis les formulaires inactifs en objets interactifs structurés complets et soignés sans perdre aucune information de valeur légale ou technique.",
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Aucune structure n'a été renvoyée par le modèle d'intelligence artificielle.");
    }

    const docFormSchema = JSON.parse(textResponse.trim());
    return res.json({ success: true, ...docFormSchema });

  } catch (error: any) {
    console.error("Gemini Parse PDF API Error:", error);
    return res.status(500).json({
      error: error.message || "Erreur durant l'analyse intelligente du document par Gemini.",
      isKeyMissing: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY === ""
    });
  }
});

// API endpoint to analyze whiteboard content and synthesize into structured Google Slide data
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
          mimeType: mimeType
        }
      },
      {
        text: `Tu es un expert mondial en synthèse visuelle, communication stratégique et conception de présentations professionnelles.
Analyse cette capture d'écran d'un ${boardMode === "blackboard" ? "Tableau Noir scolaire à la craie" : boardMode === "paperboard" ? "Paperboard de réunion d'entreprise" : "Tableau Blanc pédagogique"}.
Décrypte minutieusement tous les éléments visuels dessinés ou écrits : écriture manuscrite, titres, équations mathématiques, organigrammes, diagrammes fléchés, croquis, cartes mentales et annotations.

Consigne utilisateur additionnelle : "${instructions || "Synthétise fidèlement et élégamment tous les concepts du tableau sous forme de diapositive exécutive claire."}"

Règles de transcription et de synthèse :
1. "title" : Titre court, direct et élégant synthétisant le sujet central (5 à 8 mots max).
2. "subtitle" : Sous-titre apportant du contexte (ex: "Synthèse de séance & Orientations clés").
3. "category" : Thématique (ex: "Stratégie", "Architecture Logicielle", "Sciences & Mathématiques", "Design & UX").
4. "summary" : Synthèse globale du tableau en 2 à 3 phrases fluides.
5. "bulletPoints" : 3 à 5 points clés très soignés expliquant ce qui a été dessiné ou noté.
6. "diagramAnalysis" : Explication détaillée des schémas, blocs, relations ou flèches observés sur le tableau.
7. "actionItems" : 2 à 4 étapes suivantes, décisions ou applications directes qui découlent de ce tableau.
8. "speakerNotes" : Notes complètes pour l'orateur expliquant la démarche pédagogique ou managériale pour la présentation.
9. "suggestedColorTheme" : Thème couleur recommandé ("ocean-blue", "emerald-slate", "amber-warm", "violet-indigo").`
      }
    ];

    const slideSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Titre principal de la slide" },
        subtitle: { type: Type.STRING, description: "Sous-titre de la slide" },
        category: { type: Type.STRING, description: "Catégorie du sujet" },
        summary: { type: Type.STRING, description: "Synthèse générale du tableau" },
        bulletPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Points clés structurés de la slide"
        },
        diagramAnalysis: { type: Type.STRING, description: "Analyse des schémas, formes et dessins" },
        actionItems: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Actions ou conclusions identifiées"
        },
        speakerNotes: { type: Type.STRING, description: "Notes de présentation pour l'orateur" },
        suggestedColorTheme: { type: Type.STRING, description: "Thème suggéré pour la slide" }
      },
      required: ["title", "subtitle", "summary", "bulletPoints", "speakerNotes"]
    };

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: "Tu es un spécialiste de la synthèse visuelle et de la création de présentations de niveau exécutif. Décrypte minutieusement l'écriture manuscrite et les croquis pour les transformer en contenu clair et percutant.",
        responseMimeType: "application/json",
        responseSchema: slideSchema
      }
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Aucune structure renvoyée par le modèle d'intelligence artificielle.");
    }

    const slideData = JSON.parse(textResponse.trim());
    return res.json({ success: true, slide: slideData });
  } catch (error: any) {
    console.error("Gemini Whiteboard to Slide Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erreur durant l'analyse intelligente du tableau par Gemini.",
      isKeyMissing: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY"
    });
  }
});

// Serve frontend build output or run dev middlewares
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server loaded in full-stack mode, serving port ${PORT}`);
  });
}

setupServer();

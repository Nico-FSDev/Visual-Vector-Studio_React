import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import pptxgen from "pptxgenjs";
import { auth } from "../firebase";
import { getCachedAccessToken, setCachedAccessToken } from "./googleDrive";

export interface DecryptedSlideContent {
  title: string;
  subtitle: string;
  category?: string;
  summary: string;
  bulletPoints: string[];
  diagramAnalysis?: string;
  actionItems?: string[];
  speakerNotes: string;
  suggestedColorTheme?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DrivePresentation {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

// Scopes strictly matching the configured and approved OAuth application
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/drive.file",
];

/**
 * Signs in via Firebase GoogleAuthProvider with Google Slides & Drive scopes.
 */
export async function authenticateGoogleForSlides(): Promise<string> {
  const existingToken = getCachedAccessToken();
  if (existingToken) {
    return existingToken;
  }

  const provider = new GoogleAuthProvider();
  REQUIRED_SCOPES.forEach((scope) => provider.addScope(scope));
  // Prompt user to select account or consent if needed
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error("Impossible d'obtenir le jeton d'accès Google Slides.");
    }

    setCachedAccessToken(credential.accessToken);
    return credential.accessToken;
  } catch (err: any) {
    console.error("Google Auth SignIn Error:", err);
    if (err?.code === "auth/popup-closed-by-user") {
      throw new Error("Fenêtre de connexion fermée avant la validation.");
    }
    if (err?.message?.includes("access_denied") || err?.code === "auth/access-denied") {
      throw new Error(
        "Accès refusé par Google (Erreur 403 : access_denied). Votre compte Google doit être listé dans les 'Utilisateurs tests' sur Google Cloud Console, ou utilisez l'export direct PPTX ci-dessous."
      );
    }
    throw err;
  }
}

/**
 * Lists user's Google Drive folders so the user can choose where to save the presentation.
 */
export async function listDriveFolders(accessToken: string): Promise<DriveFolder[]> {
  const q = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name)&pageSize=30&orderBy=name`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      setCachedAccessToken(null);
      throw new Error("Session Google expirée. Veuillez vous reconnecter.");
    }
    return [];
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({ id: f.id, name: f.name }));
}

/**
 * Lists user's existing Google Slides presentations from Google Drive.
 */
export async function listGoogleSlidePresentations(accessToken: string): Promise<DrivePresentation[]> {
  const q = "mimeType = 'application/vnd.google-apps.presentation' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,modifiedTime,webViewLink)&pageSize=30&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      setCachedAccessToken(null);
      throw new Error("Session Google expirée. Veuillez vous reconnecter.");
    }
    return [];
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink || `https://docs.google.com/presentation/d/${f.id}/edit`,
  }));
}

/**
 * Creates a brand new Google Slides presentation in Google Drive and injects the AI decrypted slide.
 */
export async function createNewPresentationWithSlide(
  accessToken: string,
  presentationName: string,
  folderId: string | null,
  slideData: DecryptedSlideContent
): Promise<{ presentationId: string; presentationUrl: string }> {
  // 1. Create the presentation
  const createUrl = "https://slides.googleapis.com/v1/presentations";
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: presentationName || slideData.title || "Whiteboard Session Slide",
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Échec de création de la présentation Google Slides : ${err}`);
  }

  const presentation = await createRes.json();
  const presentationId = presentation.presentationId;

  // 2. If target folder is specified and not root, move the file into the folder
  if (folderId && folderId !== "root") {
    try {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${presentationId}?addParents=${folderId}&fields=id,parents`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    } catch (e) {
      console.warn("Could not move to target folder, saved to root Drive:", e);
    }
  }

  // 3. Populate presentation with Title Slide & AI Content Slide
  await populatePresentationSlides(accessToken, presentationId, slideData, true);

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  };
}

/**
 * Appends a new slide to an existing Google Slides presentation.
 */
export async function appendSlideToExistingPresentation(
  accessToken: string,
  presentationId: string,
  slideData: DecryptedSlideContent
): Promise<{ presentationId: string; presentationUrl: string }> {
  await populatePresentationSlides(accessToken, presentationId, slideData, false);

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  };
}

/**
 * Builds Google Slides API batchUpdate commands to inject the slide, shapes, text, bullets, and speaker notes.
 */
async function populatePresentationSlides(
  accessToken: string,
  presentationId: string,
  slideData: DecryptedSlideContent,
  isNewPresentation: boolean
) {
  const slideId = `slide_ai_${Date.now()}`;
  const titleBoxId = `title_${Date.now()}`;
  const bodyBoxId = `body_${Date.now()}`;
  const sideBoxId = `side_${Date.now()}`;

  const requests: any[] = [];

  // Create a clean slide
  requests.push({
    createSlide: {
      objectId: slideId,
      slideLayoutReference: {
        predefinedLayout: "BLANK",
      },
    },
  });

  // Top header banner background or accent line
  const bannerId = `banner_${Date.now()}`;
  requests.push({
    createShape: {
      objectId: bannerId,
      shapeType: "RECTANGLE",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: 720, unit: "PT" },
          height: { magnitude: 6, unit: "PT" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: 0,
          translateY: 0,
          unit: "PT",
        },
      },
    },
  });

  // Fill banner with stylish accent color (Indigo / Cyan)
  requests.push({
    updateShapeProperties: {
      objectId: bannerId,
      fields: "shapeBackgroundFill.solidFill.color",
      shapeProperties: {
        shapeBackgroundFill: {
          solidFill: {
            color: {
              rgbColor: { red: 0.12, green: 0.44, blue: 0.88 },
            },
          },
        },
      },
    },
  });

  // Title Box (Slide Title & Subtitle)
  requests.push({
    createShape: {
      objectId: titleBoxId,
      shapeType: "TEXT_BOX",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: 660, unit: "PT" },
          height: { magnitude: 65, unit: "PT" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: 30,
          translateY: 20,
          unit: "PT",
        },
      },
    },
  });

  const titleText = `${slideData.title || "Whiteboard AI Synthesis"}\n${
    slideData.subtitle ? slideData.subtitle : "Analyse & Décryptage du Tableau"
  }`;

  requests.push({
    insertText: {
      objectId: titleBoxId,
      insertionIndex: 0,
      text: titleText,
    },
  });

  // Style Title (Bold, 22pt)
  requests.push({
    updateTextStyle: {
      objectId: titleBoxId,
      textRange: {
        startIndex: 0,
        endIndex: (slideData.title || "Whiteboard AI Synthesis").length,
      },
      style: {
        bold: true,
        fontSize: { magnitude: 22, unit: "PT" },
        foregroundColor: {
          opaqueColor: {
            rgbColor: { red: 0.09, green: 0.12, blue: 0.16 },
          },
        },
        fontFamily: "Roboto",
      },
      fields: "bold,fontSize,foregroundColor,fontFamily",
    },
  });

  // Style Subtitle (12pt, subtle gray)
  if (slideData.subtitle) {
    const subtitleStart = (slideData.title || "Whiteboard AI Synthesis").length + 1;
    requests.push({
      updateTextStyle: {
        objectId: titleBoxId,
        textRange: {
          startIndex: subtitleStart,
          endIndex: titleText.length,
        },
        style: {
          italic: true,
          fontSize: { magnitude: 12, unit: "PT" },
          foregroundColor: {
            opaqueColor: {
              rgbColor: { red: 0.38, green: 0.45, blue: 0.55 },
            },
          },
          fontFamily: "Roboto",
        },
        fields: "italic,fontSize,foregroundColor,fontFamily",
      },
    });
  }

  // Main Body Box (Key takeaways & bullets)
  requests.push({
    createShape: {
      objectId: bodyBoxId,
      shapeType: "TEXT_BOX",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: 420, unit: "PT" },
          height: { magnitude: 280, unit: "PT" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: 30,
          translateY: 95,
          unit: "PT",
        },
      },
    },
  });

  // Compose body text with bullet points
  let bodyContent = `Synthèse principale :\n${slideData.summary}\n\nPoints clés décryptés :\n`;
  if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
    slideData.bulletPoints.forEach((bp) => {
      bodyContent += `• ${bp}\n`;
    });
  } else {
    bodyContent += "• Données et schémas synthétisés depuis le tableau blanc.\n";
  }

  requests.push({
    insertText: {
      objectId: bodyBoxId,
      insertionIndex: 0,
      text: bodyContent,
    },
  });

  // Format body text style
  requests.push({
    updateTextStyle: {
      objectId: bodyBoxId,
      textRange: {
        type: "ALL",
      },
      style: {
        fontSize: { magnitude: 11, unit: "PT" },
        foregroundColor: {
          opaqueColor: {
            rgbColor: { red: 0.15, green: 0.18, blue: 0.22 },
          },
        },
        fontFamily: "Roboto",
      },
      fields: "fontSize,foregroundColor,fontFamily",
    },
  });

  // Side Box (Diagram Analysis & Action Items card)
  requests.push({
    createShape: {
      objectId: sideBoxId,
      shapeType: "ROUNDED_RECTANGLE",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: 230, unit: "PT" },
          height: { magnitude: 280, unit: "PT" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: 460,
          translateY: 95,
          unit: "PT",
        },
      },
    },
  });

  // Light soft gray/blue card background
  requests.push({
    updateShapeProperties: {
      objectId: sideBoxId,
      fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color",
      shapeProperties: {
        shapeBackgroundFill: {
          solidFill: {
            color: {
              rgbColor: { red: 0.96, green: 0.97, blue: 0.99 },
            },
          },
        },
        outline: {
          outlineFill: {
            solidFill: {
              color: {
                rgbColor: { red: 0.85, green: 0.88, blue: 0.93 },
              },
            },
          },
          weight: { magnitude: 1, unit: "PT" },
        },
      },
    },
  });

  let sideContent = "ANALYSE DU SCHÉMA\n";
  sideContent += `${slideData.diagramAnalysis || "Structure schématique et annotations visuelles analysées par IA."}\n\n`;

  if (slideData.actionItems && slideData.actionItems.length > 0) {
    sideContent += "PLAN D'ACTION :\n";
    slideData.actionItems.forEach((act) => {
      sideContent += `✓ ${act}\n`;
    });
  }

  requests.push({
    insertText: {
      objectId: sideBoxId,
      insertionIndex: 0,
      text: sideContent,
    },
  });

  requests.push({
    updateTextStyle: {
      objectId: sideBoxId,
      textRange: {
        type: "ALL",
      },
      style: {
        fontSize: { magnitude: 10, unit: "PT" },
        foregroundColor: {
          opaqueColor: {
            rgbColor: { red: 0.2, green: 0.25, blue: 0.32 },
          },
        },
        fontFamily: "Roboto",
      },
      fields: "fontSize,foregroundColor,fontFamily",
    },
  });

  // Send batchUpdate
  const updateUrl = `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`;
  const res = await fetch(updateUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn("Warning on Slides batchUpdate:", errText);
    // Even if styling warning occurs, presentation is created
  }
}

/**
 * Generates an executive-ready PowerPoint (.pptx) presentation directly in-browser.
 * Can be opened in Microsoft PowerPoint, Apple Keynote, or imported in 1 click
 * into Google Slides (File > Import Slides) without requiring OAuth authorization!
 */
export async function exportToPptxFile(
  slideData: DecryptedSlideContent,
  canvasDataUrl: string | null,
  fileName?: string
): Promise<void> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "Visual Vector Studio";
  pres.company = "Visual Vector Studio";
  pres.title = slideData.title || "Whiteboard Slide";

  const slide = pres.addSlide();

  // Top accent banner
  slide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.15,
    fill: { color: "3B82F6" },
    line: { color: "3B82F6" },
  });

  // Title & Subtitle block
  slide.addText(
    [
      {
        text: slideData.title || "Synthèse de Séance & Vision Stratégique",
        options: { fontSize: 22, bold: true, color: "0F172A", fontFace: "Arial" },
      },
      {
        text: "\n" + (slideData.subtitle || "Décryptage visuel automatique par IA Gemini"),
        options: { fontSize: 12, italic: true, color: "64748B", fontFace: "Arial" },
      },
    ],
    { x: 0.6, y: 0.4, w: 9.2, h: 1.0, margin: 0 }
  );

  // Category Tag badge
  if (slideData.category) {
    slide.addText(slideData.category.toUpperCase(), {
      x: 10.0,
      y: 0.45,
      w: 2.7,
      h: 0.35,
      fontSize: 9,
      bold: true,
      color: "1D4ED8",
      fill: { color: "EFF6FF" },
      line: { color: "BFDBFE", width: 1 },
      align: "center",
      fontFace: "Arial",
    });
  }

  // Left Section: Summary & Bullet Points
  const bulletItems = (slideData.bulletPoints || []).map((bp) => ({
    text: bp,
    options: { fontSize: 11, color: "1E293B", bullet: true, breakLine: true, fontFace: "Arial" },
  }));

  slide.addText(
    [
      {
        text: "SYNTHÈSE DU TABLEAU\n",
        options: { fontSize: 10, bold: true, color: "2563EB", fontFace: "Arial" },
      },
      {
        text: `${slideData.summary}\n\n`,
        options: { fontSize: 11, color: "334155", fontFace: "Arial" },
      },
      {
        text: "POINTS CLÉS & DÉCISIONS :\n",
        options: { fontSize: 10, bold: true, color: "2563EB", fontFace: "Arial" },
      },
      ...bulletItems,
    ],
    {
      x: 0.6,
      y: 1.6,
      w: 6.8,
      h: 5.3,
      fill: { color: "F8FAFC" },
      line: { color: "E2E8F0", width: 1 },
      margin: 0.25,
      valign: "top",
    }
  );

  // Right Top: Diagram Analysis & Action Items
  const actionItemsTexts = (slideData.actionItems || []).map((act) => ({
    text: `✓ ${act}`,
    options: { fontSize: 10, color: "065F46", breakLine: true, fontFace: "Arial" },
  }));

  slide.addText(
    [
      {
        text: "ANALYSE DU SCHÉMA / VISUEL\n",
        options: { fontSize: 10, bold: true, color: "4338CA", fontFace: "Arial" },
      },
      {
        text: `${slideData.diagramAnalysis || "Structure schématique interprétée."}\n\n`,
        options: { fontSize: 10, color: "475569", fontFace: "Arial" },
      },
      ...(actionItemsTexts.length > 0
        ? [
            {
              text: "PLAN D'ACTION RETENU :\n",
              options: { fontSize: 10, bold: true, color: "047857", fontFace: "Arial" },
            },
            ...actionItemsTexts,
          ]
        : []),
    ],
    {
      x: 7.7,
      y: 1.6,
      w: 5.0,
      h: canvasDataUrl ? 2.5 : 5.3,
      fill: { color: "F1F5F9" },
      line: { color: "CBD5E1", width: 1 },
      margin: 0.2,
      valign: "top",
    }
  );

  // Right Bottom: Canvas snapshot image (if available)
  if (canvasDataUrl) {
    try {
      slide.addImage({
        data: canvasDataUrl,
        x: 7.7,
        y: 4.3,
        w: 5.0,
        h: 2.6,
        rounding: true,
      });
    } catch (imgErr) {
      console.warn("Could not attach canvas image to PPTX slide:", imgErr);
    }
  }

  // Speaker Notes
  if (slideData.speakerNotes) {
    slide.addNotes(slideData.speakerNotes);
  }

  // File download
  const safeName = (fileName || slideData.title || "Diapositive-Tableau-IA")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  await pres.writeFile({ fileName: `${safeName}.pptx` });
}

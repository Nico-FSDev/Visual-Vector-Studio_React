import React, { useState, useRef, useEffect } from "react";
import { ThemedSelect } from "./ThemedSelect";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { sanitizeClonedDocument } from "../utils/colorSanitizer";
import { 
  FileText, 
  Upload, 
  Plus, 
  Trash2, 
  Download, 
  Printer, 
  ChevronUp, 
  ChevronDown, 
  CheckSquare, 
  Square, 
  Type, 
  Sparkles, 
  FileUp, 
  RotateCcw, 
  HelpCircle,
  Scissors,
  Check,
  Edit3,
  ListPlus,
  Move,
  Maximize2,
  Minimize2,
  Hand,
  Eraser,
  Highlighter,
  PenTool,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  Palette,
  UserCheck,
  UserPlus,
  Settings,
  Database,
  Save
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ImportSelectorModal } from "./ImportSelectorModal";
import { autosaveSessionState, recoverSessionState } from "../utils/persistence";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export interface FormElement {
  id: string;
  type: "title" | "section" | "text_block" | "input_text" | "checkbox" | "textarea";
  label: string;
  placeholder?: string;
  value?: string;
  checked?: boolean;
  required?: boolean;
  layoutWidth?: "full" | "half" | "third";
}

interface PDFEditorProps {
  isVS: boolean;
  geminiApiKey?: string;
  triggerToast: (msg: string) => void;
  setGlobalTab?: (tab: "logo" | "corporate" | "pdf" | "settings") => void;
  setSettingsActiveSubTab?: (subtab: "appearance" | "performance" | "gemini" | "language") => void;
}

// Helper auto-growing textarea component that wraps neatly matching word processor margins
const AutoGrowingTextarea = ({
  id,
  value,
  onChange,
  placeholder,
  className,
  isDynamic,
  maxChars
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  className: string;
  isDynamic: boolean;
  maxChars: number;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      if (isDynamic) {
        textarea.style.height = `${Math.max(20, textarea.scrollHeight)}px`;
      } else {
        textarea.style.height = "20px";
      }
    }
  }, [value, isDynamic]);

  return (
    <textarea
      id={`textarea-field-${id}`}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      rows={1}
      maxLength={isDynamic ? undefined : maxChars}
      style={{
        resize: "none",
        overflow: "hidden",
        minHeight: "20px"
      }}
    />
  );
};

// Predefined mock presets for instant preview
const PRESET_FORMS: {
  id: string;
  name: string;
  desc: string;
  title: string;
  description: string;
  elements: FormElement[];
}[] = [
  {
    id: "inscription",
    name: "Club d'Échecs - Inscription",
    desc: "Formulaire standard d'adhésion d'une association sportive ou culturelle.",
    title: "Bulletin d'Adhésion - Saison ChessClub 2026",
    description: "Veuillez remplir l'intégralité des informations ci-dessous pour valider votre inscription annuelle.",
    elements: [
      { id: "s1", type: "section", label: "1. Coordonnées de l'Adhérent" },
      { id: "f1", type: "input_text", label: "Nom de famille :", placeholder: "DUPONT" },
      { id: "f2", type: "input_text", label: "Prénom :", placeholder: "Marc" },
      { id: "f3", type: "input_text", label: "Date de naissance :", placeholder: "DD/MM/YYYY" },
      { id: "f4", type: "input_text", label: "Adresse postale complète :", placeholder: "15 rue des Cavaliers, 75000 Paris" },
      { id: "f5", type: "input_text", label: "Téléphone de contact :", placeholder: "06 12 34 56 78" },
      { id: "f6", type: "input_text", label: "Adresse Email :", placeholder: "contact@email.fr" },
      { id: "s2", type: "section", label: "2. Niveau & Cotisation" },
      { id: "c1", type: "checkbox", label: "Option Élite - Entraînements Grand Maître (250€/an)", checked: false },
      { id: "c2", type: "checkbox", label: "Option Découverte - Cours hebdomadaires loisirs (120€/an)", checked: true },
      { id: "c3", type: "checkbox", label: "Option Junior - Moins de 16 ans (80€/an)", checked: false },
      { id: "s3", type: "section", label: "3. Informations Complémentaires" },
      { id: "f7", type: "textarea", label: "Antécédents ou classements Elo précédents (si applicables) :", placeholder: "Renseignez vos anciens clubs ou classements..." },
      { id: "c4", type: "checkbox", label: "J'accepte le règlement intérieur ainsi que la publication des photos de tournois sur le site web.", checked: true },
      { id: "f8", type: "input_text", label: "Signature de l'adhérent (ou tuteur légal, précédée de 'Lu et approuvé') :", placeholder: "Tapez votre nom pour signer numériquement" }
    ]
  },
  {
    id: "autorisation",
    name: "Autorisation Parentale",
    desc: "Autorisation pour sorties scolaires ou activités exceptionnelles.",
    title: "Autorisation Parentale - Activités Périscolaires",
    description: "Document de décharge parentale obligatoire pour toute participation de l'enfant mineur.",
    elements: [
      { id: "sec_p1", type: "section", label: "Je soussigné(e) - Représentant Légal" },
      { id: "p1", type: "input_text", label: "Nom et Prénom du tuteur majeur :", placeholder: "Mme ou M. Martin Durand" },
      { id: "p2", type: "input_text", label: "En qualité de (Père, Mère, Tuteur) :", placeholder: "Mère" },
      { id: "p3", type: "input_text", label: "Numéro de téléphone d'urgence principal :", placeholder: "06 99 88 77 66" },
      { id: "sec_p2", type: "section", label: "Autorise l'enfant mineur" },
      { id: "p4", type: "input_text", label: "Nom et Prénom de l'enfant :", placeholder: "Lucas Durand" },
      { id: "p5", type: "input_text", label: "Classe de l'élève :", placeholder: "CM2 - Équipe A" },
      { id: "p6", type: "input_text", label: "À participer à la sortie suivante :", placeholder: "Visite du Musée des Sciences du 18 Juin" },
      { id: "sec_p3", type: "section", label: "Garanties d'Urgence médicale" },
      { id: "c_u1", type: "checkbox", label: "J'autorise l'accompagnateur ou le personnel médical à prendre toute décision d'urgence.", checked: true },
      { id: "p7", type: "textarea", label: "Allergies, régimes spécifiques ou recommandations médicales importantes :", placeholder: "Aucune allergie connue à ce jour..." },
      { id: "p8", type: "input_text", label: "Fait à :", placeholder: "Lyon" },
      { id: "p9", type: "input_text", label: "Le :", placeholder: "10 Juin 2026" }
    ]
  },
  {
    id: "constat",
    name: "Fiche d'État des Lieux",
    desc: "Formulaire d'inspection et inventaire rapide de logement.",
    title: "Fiche Simplifiée - État des Lieux d'Entrée",
    description: "Constat établi contradictoirement entre les parties lors de la remise des clés de location.",
    elements: [
      { id: "e1", type: "section", label: "1. Références Générales" },
      { id: "e2", type: "input_text", label: "Adresse du bien loué :", placeholder: "42 avenue de la Gare, Appt 3B, Bordeaux" },
      { id: "e3", type: "input_text", label: "Nom de l'occupant (locataire) :", placeholder: "Sarah Benamar" },
      { id: "e4", type: "input_text", label: "Nom du bailleur (propriétaire) :", placeholder: "Gisèle Dubourdieu" },
      { id: "e5", type: "input_text", label: "Nombre de clés remises :", placeholder: "2 trousseaux principaux" },
      { id: "e6", type: "section", label: "2. État Général par Pièce" },
      { id: "e7", type: "checkbox", label: "Pièce à vivre principale : En très bon état - Aucune dégradation.", checked: true },
      { id: "e8", type: "checkbox", label: "Cuisine : Électroménager testé et fonctionnel (Four / Plaques).", checked: true },
      { id: "e9", type: "checkbox", label: "Salle de Bain : Présence de traces d'usage sur la vasque.", checked: false },
      { id: "e10", type: "textarea", label: "Observations ou remarques annexes (ex: anomalies constatées sur les revêtements) :", placeholder: "Micro rayures sur le parquet de l'entrée." },
      { id: "e11", type: "input_text", label: "Signature Locataire :", placeholder: "Tapez votre nom pour acceptation" },
      { id: "e12", type: "input_text", label: "Signature Bailleur :", placeholder: "Signature propriétaire" }
    ]
  }
];

export const PDFEditor: React.FC<PDFEditorProps> = ({ 
  isVS, 
  geminiApiKey, 
  triggerToast,
  setGlobalTab,
  setSettingsActiveSubTab
}) => {
  // --- STATE ---
  const [title, setTitle] = useState<string>("Bulletin d'Adhésion - Saison ChessClub 2026");
  const [description, setDescription] = useState<string>("Veuillez remplir l'intégralité des informations ci-dessous pour valider votre inscription annuelle.");
  const [elements, setElements] = useState<FormElement[]>(PRESET_FORMS[0].elements);
  
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsingStep, setParsingStep] = useState<string>("");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(PRESET_FORMS[0].elements[0].id);
  
  // Dynamic filling mode
  const [isDynamicFilling, setIsDynamicFilling] = useState<boolean>(true);
  
  // Custom conversational input for Gemini prompt edits
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [isAiModifying, setIsAiModifying] = useState<boolean>(false);
  
  // Drag & drop file status
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick text inputs completion values
  const [formFilledValues, setFormFilledValues] = useState<Record<string, string>>({});
  const [formCheckedStates, setFormCheckedStates] = useState<Record<string, boolean>>({});

  const [hasRecovered, setHasRecovered] = useState(false);

  useEffect(() => {
    recoverSessionState().then(({state}) => {
       if (state && state.pdfElements && state.pdfElements.length > 0) {
         setElements(state.pdfElements);
         if (state.pdfDraftId) {
            // we could parse it and split title/description, but for simplicity let's assume pdfDraftId is custom
         }
       }
       setHasRecovered(true);
    });
  }, []);

  useEffect(() => {
    if (!hasRecovered) return;
    autosaveSessionState({
       pdfElements: elements
    });
  }, [elements, hasRecovered]);

  // API Key error modal indicator
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  // Active element helper
  const activeElement = elements.find(el => el.id === selectedElementId) || null;

  // Signature Drawing & Local Library State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastX = useRef<number>(0);
  const lastY = useRef<number>(0);
  const isDrawingRef = useRef<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Import Schema Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>("");
  const fileImportRef = useRef<HTMLInputElement>(null);

  // Expanded Signature Modal States & Refs
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  
  // Import Selector Modal States
  const [isImportSelectorOpen, setIsImportSelectorOpen] = useState<boolean>(false);
  const [importSelectorType, setImportSelectorType] = useState<"pdf_image" | "json">("pdf_image");
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalLastX = useRef<number>(0);
  const modalLastY = useRef<number>(0);
  const modalIsDrawingRef = useRef<boolean>(false);
  const [modalIsDrawing, setModalIsDrawing] = useState<boolean>(false);

  const [signatureLibrary, setSignatureLibrary] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("vvs_signature_library");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [stampedSignatures, setStampedSignatures] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("vvs_stamped_signatures");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [stampedOffsets, setStampedOffsets] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem("vvs_stamped_offsets");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // --- SUBTABS STATE FOR STUDIO PDF ---
  const [pdfActiveTab, setPdfActiveTab] = useState<"formulaire" | "editeur" | "convertisseur" | "gestionnaire">("editeur");

  // --- PDF CONVERTER STATES ---
  const [converterFile, setConverterFile] = useState<File | null>(null);
  const [converterDoc, setConverterDoc] = useState<any>(null);
  const [converterNumPages, setConverterNumPages] = useState<number>(0);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionProgress, setConversionProgress] = useState<number>(0);
  const [convertedImages, setConvertedImages] = useState<Array<{ pageNum: number; dataUrl: string; width: number; height: number }>>([]);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg" | "webp" | "pdfa1b" | "pdfa2b">("png");
  const [exportDPI, setExportDPI] = useState<150 | 300 | 600>(300);
  const [converterPageRange, setConverterPageRange] = useState<string>("all");
  const [customRangeString, setCustomRangeString] = useState<string>("");
  const [isConvertingToPDFA, setIsConvertingToPDFA] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // --- PDF TIMELINE / MONTAGE STATES ---
  const [montageFiles, setMontageFiles] = useState<Array<{ id: string; name: string; size: number; file: File; doc: any; pageThumbnails: string[] }>>([]);
  const [montageTimeline, setMontageTimeline] = useState<Array<{ id: string; sourceFileId: string; sourcePageNum: number; thumbnail: string; angle: number; isBlank?: boolean; blankColor?: string; blankSize?: "A4" | "Letter"; isImageFile?: boolean; imageFile?: File }>>([]);
  const [montageActiveIndex, setMontageActiveIndex] = useState<number>(-1);
  const [timelineZoom, setTimelineZoom] = useState<number>(1.0);
  const [montageViewMode, setMontageViewMode] = useState<"linear" | "grid">("linear");
  const [isExportingMontage, setIsExportingMontage] = useState<boolean>(false);
  const [montageSelectedIndices, setMontageSelectedIndices] = useState<number[]>([]);
  const [customSegmentationString, setCustomSegmentationString] = useState<string>("");
  const montageFileInputRef = useRef<HTMLInputElement | null>(null);

  // Dynamic CDN loaders for PDF-Lib & JSZip
  const loadPdfLib = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).PDFLib) {
        resolve((window as any).PDFLib);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
      script.onload = () => resolve((window as any).PDFLib);
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  };

  const loadJSZip = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).JSZip) {
        resolve((window as any).JSZip);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = () => resolve((window as any).JSZip);
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  };

  // Auto-load dependencies or feed current document as defaults
  useEffect(() => {
    if (pdfActiveTab === "convertisseur" && annotationPdfFile && !converterFile) {
      setConverterFile(annotationPdfFile);
      loadConverterPdf(annotationPdfFile);
    }
    if (pdfActiveTab === "gestionnaire" && annotationPdfFile && montageFiles.length === 0) {
      handleAddMontageFile(annotationPdfFile);
    }
  }, [pdfActiveTab]);

  const loadConverterPdf = async (file: File) => {
    try {
      const pdfjs = await loadPdfJS();
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      setConverterDoc(doc);
      setConverterNumPages(doc.numPages);
      setConvertedImages([]);
      setConversionProgress(0);
    } catch (err) {
      console.error(err);
      triggerToast("Erreur lors de l'analyse du document.");
    }
  };

  const handleAddMontageFile = async (file: File) => {
    try {
      const fileId = "file_" + Math.random().toString(36).substr(2, 9);
      const pdfjs = await loadPdfJS();
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      
      const thumbnails: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          thumbnails.push(canvas.toDataURL("image/jpeg", 0.7));
        }
      }

      const newFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        file,
        doc,
        pageThumbnails: thumbnails
      };

      setMontageFiles(prev => [...prev, newFile]);
      triggerToast(`📦 "${file.name}" ajouté au Chutier (${doc.numPages} pages)`);
      
      // Auto-add all pages to sequence if timeline is empty
      setMontageTimeline(prev => {
        if (prev.length === 0) {
          const initialPages = thumbnails.map((thumb, idx) => ({
            id: "page_" + Math.random().toString(36).substr(2, 9),
            sourceFileId: fileId,
            sourcePageNum: idx + 1,
            thumbnail: thumb,
            angle: 0
          }));
          setMontageActiveIndex(0);
          return initialPages;
        }
        return prev;
      });
    } catch (err) {
      console.error(err);
      triggerToast("Erreur lors de l'analyse du document PDF.");
    }
  };

  const handleConvertPDF = async () => {
    if (!converterFile || !converterDoc) {
      triggerToast("Veuillez d'abord sélectionner ou ouvrir un document PDF.");
      return;
    }

    setIsConverting(true);
    setConversionProgress(5);
    setConvertedImages([]);

    try {
      const pagesToConvert: number[] = [];
      
      if (converterPageRange === "all") {
        for (let i = 1; i <= converterNumPages; i++) pagesToConvert.push(i);
      } else if (converterPageRange === "current") {
        pagesToConvert.push(1);
      } else {
        const clean = customRangeString.replace(/\s+/g, "");
        const parts = clean.split(",");
        for (const part of parts) {
          if (part.includes("-")) {
            const [start, end] = part.split("-").map(Number);
            if (!isNaN(start) && !isNaN(end)) {
              for (let i = start; i <= end; i++) {
                if (i >= 1 && i <= converterNumPages) pagesToConvert.push(i);
              }
            }
          } else {
            const num = Number(part);
            if (!isNaN(num) && num >= 1 && num <= converterNumPages) {
              pagesToConvert.push(num);
            }
          }
        }
      }

      if (pagesToConvert.length === 0) {
        triggerToast("Plage de pages invalide. Exemples : 1-3, 5, 8");
        setIsConverting(false);
        return;
      }

      const results: Array<{ pageNum: number; dataUrl: string; width: number; height: number }> = [];
      const dpiScale = exportDPI / 72;

      for (let index = 0; index < pagesToConvert.length; index++) {
        const pageNum = pagesToConvert[index];
        const page = await converterDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: dpiScale });
        
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, viewport.width, viewport.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          
          let formatMime = "image/png";
          if (exportFormat === "jpeg") formatMime = "image/jpeg";
          else if (exportFormat === "webp") formatMime = "image/webp";
          
          const dataUrl = canvas.toDataURL(formatMime, exportFormat === "png" ? 1.0 : 0.92);
          results.push({
            pageNum,
            dataUrl,
            width: viewport.width,
            height: viewport.height
          });
        }
        
        const progress = Math.round(5 + ((index + 1) / pagesToConvert.length) * 95);
        setConversionProgress(progress);
      }

      setConvertedImages(results);
      triggerToast(`🎉 Conversion réussie ! ${results.length} page(s) convertie(s)`);
    } catch (err) {
      console.error(err);
      triggerToast("Une erreur s'est produite lors de la conversion.");
    } finally {
      setIsConverting(false);
    }
  };

  const handleConvertToPDFA = async (pdfaType: "pdfa1b" | "pdfa2b") => {
    if (!converterFile) {
      triggerToast("Veuillez d'abord charger un document PDF.");
      return;
    }

    setIsConvertingToPDFA(true);
    triggerToast("Compilation PDF/A en cours... Chargement de l'encodeur.");

    try {
      const PDFLib = await loadPdfLib();
      const arrayBuffer = await converterFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const catalog = pdfDoc.catalog;
      
      const xmpTypeLabel = pdfaType === "pdfa1b" ? "1" : "2";
      const xmpConformance = "B";

      const xmpMetadata = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <pdf:Producer>PDF Studio Pro PDF/A Standard Compiler</pdf:Producer>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:CreatorTool>Visual Vector Studio PDF Studio</xmp:CreatorTool>
   <xmp:CreateDate>${new Date().toISOString()}</xmp:CreateDate>
   <xmp:ModifyDate>${new Date().toISOString()}</xmp:ModifyDate>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <pdfaid:part>${xmpTypeLabel}</pdfaid:part>
   <pdfaid:conformance>${xmpConformance}</pdfaid:conformance>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

      const metadataStream = pdfDoc.context.stream(xmpMetadata, {
        Type: 'Metadata',
        Subtype: 'XML',
      });
      const metadataStreamRef = pdfDoc.context.register(metadataStream);
      catalog.set(PDFLib.PDFName.of('Metadata'), metadataStreamRef);

      const outputIntentDict = pdfDoc.context.obj({
        Type: 'OutputIntent',
        S: 'GTS_PDFA1',
        OutputConditionIdentifier: 'sRGB IEC61966-2.1',
        RegistryName: 'http://www.color.org',
      });
      const outputIntentRef = pdfDoc.context.register(outputIntentDict);
      catalog.set(PDFLib.PDFName.of('OutputIntents'), pdfDoc.context.obj([outputIntentRef]));

      const pdfaBytes = await pdfDoc.save();
      const blob = new Blob([pdfaBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = converterFile.name.replace(".pdf", "") + `-${pdfaType.toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      triggerToast(`🔒 PDF/A compilé et téléchargé ! Conforme ${pdfaType.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      triggerToast("Erreur lors de la compilation du format PDF/A.");
    } finally {
      setIsConvertingToPDFA(false);
    }
  };

  const downloadSingleImage = (img: { pageNum: number; dataUrl: string }, format: string) => {
    const a = document.createElement("a");
    a.href = img.dataUrl;
    a.download = `page-${img.pageNum}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllImagesAsZip = async () => {
    if (convertedImages.length === 0) return;
    setIsZipping(true);
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      
      convertedImages.forEach((img) => {
        const base64Data = img.dataUrl.split(",")[1];
        zip.file(`page-${img.pageNum}.${exportFormat}`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${converterFile ? converterFile.name.replace(".pdf", "") : "pdf-pages"}-images.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerToast("📦 Dossier ZIP contenant toutes les images téléchargé !");
    } catch (err) {
      console.error(err);
      triggerToast("Erreur lors de la génération ZIP. Téléchargements individuels...");
      convertedImages.forEach((img) => {
        downloadSingleImage(img, exportFormat);
      });
    } finally {
      setIsZipping(false);
    }
  };

  // --- PDF TIMELINE / MONTAGE HELPER FUNCTIONS ---
  const handleAddPageToTimeline = (fileId: string, pageNum: number, thumbnail: string) => {
    const newItem = {
      id: "page_" + Math.random().toString(36).substr(2, 9),
      sourceFileId: fileId,
      sourcePageNum: pageNum,
      thumbnail,
      angle: 0
    };
    setMontageTimeline(prev => [...prev, newItem]);
    setMontageActiveIndex(montageTimeline.length);
    triggerToast(`➕ Page ${pageNum} ajoutée à la séquence.`);
  };

  const handleAddAllPagesToTimeline = (fileObj: any) => {
    const newItems = fileObj.pageThumbnails.map((thumb: string, idx: number) => ({
      id: "page_" + Math.random().toString(36).substr(2, 9),
      sourceFileId: fileObj.id,
      sourcePageNum: idx + 1,
      thumbnail: thumb,
      angle: 0
    }));
    setMontageTimeline(prev => [...prev, ...newItems]);
    setMontageActiveIndex(montageTimeline.length);
    triggerToast(`➕ ${newItems.length} pages ajoutées à la séquence.`);
  };

  const handleRotateTimelineItem = (index: number) => {
    setMontageTimeline(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, angle: (item.angle + 90) % 360 };
      }
      return item;
    }));
    triggerToast("🔄 Rotation appliquée.");
  };

  const handleDuplicateTimelineItem = (index: number) => {
    const itemToDuplicate = montageTimeline[index];
    if (!itemToDuplicate) return;
    const newItem = {
      ...itemToDuplicate,
      id: "page_" + Math.random().toString(36).substr(2, 9),
    };
    setMontageTimeline(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, newItem);
      return next;
    });
    setMontageActiveIndex(index + 1);
    triggerToast("📋 Page dupliquée.");
  };

  const handleDeleteTimelineItem = (index: number) => {
    setMontageTimeline(prev => {
      const next = prev.filter((_, idx) => idx !== index);
      if (next.length === 0) setMontageActiveIndex(-1);
      else if (montageActiveIndex >= next.length) setMontageActiveIndex(next.length - 1);
      return next;
    });
    triggerToast("🗑️ Page retirée de la timeline.");
  };

  const handleMoveTimelineItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= montageTimeline.length) return;
    setMontageTimeline(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setMontageActiveIndex(toIndex);
  };

  const handleInsertBlankPage = (color: string, size: "A4" | "Letter", position: "before" | "after") => {
    const canvas = document.createElement("canvas");
    canvas.width = size === "A4" ? 210 * 2 : 216 * 2;
    canvas.height = size === "A4" ? 297 * 2 : 279 * 2;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const thumb = canvas.toDataURL("image/jpeg", 0.6);
    
    const newItem = {
      id: "blank_" + Math.random().toString(36).substr(2, 9),
      sourceFileId: "blank",
      sourcePageNum: 1,
      thumbnail: thumb,
      angle: 0,
      isBlank: true,
      blankColor: color,
      blankSize: size
    };

    setMontageTimeline(prev => {
      const next = [...prev];
      const insertIdx = montageActiveIndex >= 0 ? (position === "before" ? montageActiveIndex : montageActiveIndex + 1) : next.length;
      next.splice(insertIdx, 0, newItem);
      setMontageActiveIndex(insertIdx);
      return next;
    });
    triggerToast("⬜ Page blanche insérée.");
  };

  const handleInsertImagePage = (file: File, position: "before" | "after") => {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const thumb = e.target.result;
      const newItem = {
        id: "image_" + Math.random().toString(36).substr(2, 9),
        sourceFileId: "image",
        sourcePageNum: 1,
        thumbnail: thumb,
        angle: 0,
        isImageFile: true,
        imageFile: file
      };
      setMontageTimeline(prev => {
         const next = [...prev];
         const insertIdx = montageActiveIndex >= 0 ? (position === "before" ? montageActiveIndex : montageActiveIndex + 1) : next.length;
         next.splice(insertIdx, 0, newItem);
         setMontageActiveIndex(insertIdx);
         return next;
      });
      triggerToast(`🖼️ Image "${file.name}" insérée.`);
    };
    reader.readAsDataURL(file);
  };

  const handleSplitTimeline = async (rangesString: string) => {
    if (montageTimeline.length === 0) {
      triggerToast("La timeline est vide.");
      return;
    }
    const ranges = rangesString.split(";").map(r => r.trim()).filter(Boolean);
    if (ranges.length === 0) {
      triggerToast("Format de découpe invalide. ex : 1-2; 3-4");
      return;
    }

    triggerToast("Découpe et compilation des segments...");
    try {
      const PDFLib = await loadPdfLib();
      
      for (const range of ranges) {
        const parts = range.split("-").map(Number);
        let start = parts[0];
        let end = parts[1] || start;
        
        if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > montageTimeline.length) {
          triggerToast(`Plage invalide : "${range}". Ignorée.`);
          continue;
        }

        const newDoc = await PDFLib.PDFDocument.create();
        
        for (let i = start - 1; i < end; i++) {
          const item = montageTimeline[i];
          if (item.isBlank) {
            newDoc.addPage([595, 842]);
          } else if (item.isImageFile && item.imageFile) {
            const imgBuffer = await item.imageFile.arrayBuffer();
            let pdfImg;
            if (item.imageFile.type.includes("png")) {
              pdfImg = await newDoc.embedPng(imgBuffer);
            } else {
              pdfImg = await newDoc.embedJpg(imgBuffer);
            }
            const page = newDoc.addPage([pdfImg.width, pdfImg.height]);
            page.drawImage(pdfImg, { x: 0, y: 0, width: pdfImg.width, height: pdfImg.height });
          } else {
            const sourceFileObj = montageFiles.find(f => f.id === item.sourceFileId);
            if (sourceFileObj) {
              const sourceBytes = await sourceFileObj.file.arrayBuffer();
              const loadedSource = await PDFLib.PDFDocument.load(sourceBytes);
              const [copiedPage] = await newDoc.copyPages(loadedSource, [item.sourcePageNum - 1]);
              
              if (item.angle !== 0) {
                copiedPage.setRotation(PDFLib.degrees(item.angle));
              }
              newDoc.addPage(copiedPage);
            }
          }
        }

        const pdfBytes = await newDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Segment-${range}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      triggerToast("✂️ Ségmentation terminée avec succès !");
    } catch (err) {
      console.error(err);
      triggerToast("Erreur lors de la ségmentation des fichiers.");
    }
  };

  const handleExportMontagePDF = async () => {
    if (montageTimeline.length === 0) {
      triggerToast("Veuillez d'abord ajouter des pages au montage.");
      return;
    }

    setIsExportingMontage(true);
    triggerToast("Compilation de la séquence de montage en cours...");

    try {
      const PDFLib = await loadPdfLib();
      const finalDoc = await PDFLib.PDFDocument.create();

      for (let i = 0; i < montageTimeline.length; i++) {
        const item = montageTimeline[i];
        
        if (item.isBlank) {
          finalDoc.addPage([595, 842]);
        } else if (item.isImageFile && item.imageFile) {
          const imgBuffer = await item.imageFile.arrayBuffer();
          let pdfImg;
          if (item.imageFile.type.includes("png")) {
            pdfImg = await finalDoc.embedPng(imgBuffer);
          } else {
            pdfImg = await finalDoc.embedJpg(imgBuffer);
          }
          const page = finalDoc.addPage([pdfImg.width, pdfImg.height]);
          page.drawImage(pdfImg, { x: 0, y: 0, width: pdfImg.width, height: pdfImg.height });
        } else {
          const sourceFileObj = montageFiles.find(f => f.id === item.sourceFileId);
          if (sourceFileObj) {
            const sourceBytes = await sourceFileObj.file.arrayBuffer();
            const loadedSource = await PDFLib.PDFDocument.load(sourceBytes);
            const [copiedPage] = await finalDoc.copyPages(loadedSource, [item.sourcePageNum - 1]);
            
            if (item.angle !== 0) {
              copiedPage.setRotation(PDFLib.degrees(item.angle));
            }
            finalDoc.addPage(copiedPage);
          }
        }
      }

      const pdfBytes = await finalDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Séquence-Montage-${new Date().getTime()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      triggerToast("🎉 Montage compilé et exporté avec succès !");
    } catch (err) {
      console.error(err);
      triggerToast("Erreur lors de la compilation finale du document.");
    } finally {
      setIsExportingMontage(false);
    }
  };

  // --- PDF ANNOTATOR STATES ---
  const [pdfjsLoaded, setPdfjsLoaded] = useState<boolean>(false);
  const [annotationPdfFile, setAnnotationPdfFile] = useState<File | null>(null);
  const [annotationPdfDoc, setAnnotationPdfDoc] = useState<any>(null);
  const [annotationNumPages, setAnnotationNumPages] = useState<number>(0);
  const [annotationCurrentPage, setAnnotationCurrentPage] = useState<number>(1);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [annotationStrokes, setAnnotationStrokes] = useState<Record<number, any[]>>({});
  const [activeDrawingTool, setActiveDrawingTool] = useState<"main" | "plume" | "bille" | "surligneur" | "gomme">("main");
  const [drawingColor, setDrawingColor] = useState<string>("#111827");
  const [drawingThickness, setDrawingThickness] = useState<number>(4);
  const [undoHistory, setUndoHistory] = useState<Record<number, any[][]>>({});
  const [redoHistory, setRedoHistory] = useState<Record<number, any[][]>>({});
  const [annotationScale, setAnnotationScale] = useState<number>(1.3);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const annotatorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isAnnotatorDrawingRef = useRef<boolean>(false);
  const [isAnnotatorDrawing, setIsAnnotatorDrawing] = useState<boolean>(false);

  // --- PDF READER / OPENER CHOOSE MODE STATES ---
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [isPdfModeSelectorOpen, setIsPdfModeSelectorOpen] = useState<boolean>(false);
  const globalPdfInputRef = useRef<HTMLInputElement | null>(null);

  // --- GENERIC EVOLUTIVE PROFILE STATES ---
  const [isGenericProfileModalOpen, setIsGenericProfileModalOpen] = useState<boolean>(false);
  const [autoSaveNewInputsToProfile, setAutoSaveNewInputsToProfile] = useState<boolean>(false);
  
  // Initialize with fallback static defaults to ensure the interface never flashes blank
  const [genericProfile, setGenericProfile] = useState<Record<string, string>>({
    "Nom": "LOHBERGER",
    "Prénom": "Nicolas",
    "SIRET": "883 670 168 00029",
    "Adresse": "82 Boulevard Michelet, Résidence \"Le Grand St Giniez\", 13008 MARSEILLE",
    "E-mail": "lohbergerscholar@gmail.com",
    "Téléphone": "06 47 46 04 85",
    "Fait à": "MARSEILLE",
    "Signature": "Nicolas Lohberger"
  });

  const [isProfileLoaded, setIsProfileLoaded] = useState<boolean>(false);

  // Load User's Generic Profile from Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid, "private", "info");
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && data.genericProfile) {
              setGenericProfile(data.genericProfile);
            } else {
              // Profile data missing inside private info. Let's initialize with the current defaults.
              await updateDoc(docRef, {
                genericProfile: {
                  "Nom": "LOHBERGER",
                  "Prénom": "Nicolas",
                  "SIRET": "883 670 168 00029",
                  "Adresse": "82 Boulevard Michelet, Résidence \"Le Grand St Giniez\", 13008 MARSEILLE",
                  "E-mail": "lohbergerscholar@gmail.com",
                  "Téléphone": "06 47 46 04 85",
                  "Fait à": "MARSEILLE",
                  "Signature": "Nicolas Lohberger"
                },
                updatedAt: serverTimestamp()
              });
            }
          } else {
            // User private info document doesn't exist yet. Let's create it.
            await setDoc(docRef, {
              userId: user.uid,
              email: user.email || "",
              genericProfile: {
                "Nom": "LOHBERGER",
                "Prénom": "Nicolas",
                "SIRET": "883 670 168 00029",
                "Adresse": "82 Boulevard Michelet, Résidence \"Le Grand St Giniez\", 13008 MARSEILLE",
                "E-mail": "lohbergerscholar@gmail.com",
                "Téléphone": "06 47 46 04 85",
                "Fait à": "MARSEILLE",
                "Signature": "Nicolas Lohberger"
              },
              updatedAt: serverTimestamp()
            });
          }
          setIsProfileLoaded(true);
        } catch (error) {
          console.error("Error loading generic profile from Firestore:", error);
        }
      } else {
        setIsProfileLoaded(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Save Generic Profile to Firestore when it is modified and authenticated
  useEffect(() => {
    const user = auth.currentUser;
    // We must ensure the profile is fully loaded first to prevent overwriting with initial state
    if (user && isProfileLoaded) {
      const timer = setTimeout(async () => {
        try {
          const docRef = doc(db, "users", user.uid, "private", "info");
          await updateDoc(docRef, {
            genericProfile: genericProfile,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.error("Error updating generic profile in Firestore:", error);
        }
      }, 2000); // 2 seconds debounce for profile keystrokes

      return () => clearTimeout(timer);
    }
  }, [genericProfile, isProfileLoaded]);

  // --- FULLSCREEN STATES ---
  const [isPdfFullscreen, setIsPdfFullscreen] = useState<boolean>(false);
  const [showFullscreenHeader, setShowFullscreenHeader] = useState<boolean>(false);
  const [showFullscreenLeftMenu, setShowFullscreenLeftMenu] = useState<boolean>(false);
  const [showFullscreenRightMenu, setShowFullscreenRightMenu] = useState<boolean>(false);
  const [showPageStrip, setShowPageStrip] = useState<boolean>(true);
  const [isHandPanning, setIsHandPanning] = useState<boolean>(false);
  const isHandPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number; windowScrollTop?: number; windowScrollLeft?: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isPdfFullscreen) {
      // Disappear immediately when entering fullscreen
      setShowFullscreenHeader(false);
      setShowFullscreenLeftMenu(false);
      setShowFullscreenRightMenu(false);
      setAnnotationScale(1.8);
      triggerToast("📺 Mode Plein Écran Activé • Utilisez les chevrons aux bords pour afficher les outils.");
    } else {
      setShowFullscreenHeader(false);
      setShowFullscreenLeftMenu(false);
      setShowFullscreenRightMenu(false);
      setAnnotationScale(1.3);
    }
  }, [isPdfFullscreen]);

  const triggerPdfFileOpenChoice = (file: File) => {
    if (file.type === "application/pdf") {
      setPendingPdfFile(file);
      setIsPdfModeSelectorOpen(true);
    } else {
      setPdfActiveTab("formulaire");
      handleFile(file);
    }
  };

  // --- PDF.js CDN DYNAMIC LOAD ENGINE ---
  const loadPdfJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        resolve(pdfjsLib);
      };
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  };

  // Trigger PDF.js download when selecting drawing editor tab
  useEffect(() => {
    if (pdfActiveTab === "editeur" && !pdfjsLoaded) {
      setIsPdfLoading(true);
      loadPdfJS()
        .then(() => {
          setPdfjsLoaded(true);
          setIsPdfLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load PDF.js from CDN:", err);
          setIsPdfLoading(false);
          triggerToast("Échec de chargement du moteur PDF.js. Veuillez vérifier votre connexion.");
        });
    }
  }, [pdfActiveTab, pdfjsLoaded]);

  // Load PDF file helper
  const loadPdfDocFromFile = async (file: File) => {
    setIsPdfLoading(true);
    setAnnotationPdfFile(file);
    try {
      const pdfjs = await loadPdfJS();
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        try {
          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const pdfDoc = await loadingTask.promise;
          setAnnotationPdfDoc(pdfDoc);
          setAnnotationNumPages(pdfDoc.numPages);
          setAnnotationCurrentPage(1);
          setAnnotationStrokes({});
          setUndoHistory({});
          setRedoHistory({});
          setActiveDrawingTool("main");
          triggerToast(`PDF chargé avec succès : ${pdfDoc.numPages} pages.`);
        } catch (err) {
          console.error("PDF.js doc loading error:", err);
          triggerToast("Erreur lors du décodage du PDF.");
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("PDF.js initialization error:", err);
      triggerToast("Erreur d'initialisation du moteur PDF.");
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Render original PDF Page underlaid
  const renderPdfPage = async (pageNum: number) => {
    if (!annotationPdfDoc) return;
    setIsPdfLoading(true);
    try {
      const page = await annotationPdfDoc.getPage(pageNum);
      const canvas = annotatorCanvasRef.current;
      if (!canvas) {
        setIsPdfLoading(false);
        return;
      }
      const context = canvas.getContext("2d");
      if (!context) {
        setIsPdfLoading(false);
        return;
      }

      // Render scale
      const viewport = page.getViewport({ scale: annotationScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPdfDimensions({ width: viewport.width, height: viewport.height });

      // Match drawing canvas size
      const drawingCanvas = drawingCanvasRef.current;
      if (drawingCanvas) {
        drawingCanvas.width = viewport.width;
        drawingCanvas.height = viewport.height;
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      await page.render(renderContext).promise;
      
      // Delay redraw slightly to ensure canvases are ready
      setTimeout(() => {
        drawStrokes();
      }, 80);
    } catch (err) {
      console.error("Error rendering PDF page:", err);
      triggerToast("Erreur lors de l'affichage de la page PDF.");
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Trigger PDF page rendering
  useEffect(() => {
    if (annotationPdfDoc && pdfActiveTab === "editeur") {
      renderPdfPage(annotationCurrentPage);
    }
  }, [annotationPdfDoc, annotationCurrentPage, pdfActiveTab, annotationScale]);

  // Redraw vectors on the active overlay canvas
  const drawStrokes = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const strokes = annotationStrokes[annotationCurrentPage] || [];
    strokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.beginPath();
      
      if (stroke.type === "gomme") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = stroke.width;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
      }
      
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  };

  // Redraw effect when strokes or page changes
  useEffect(() => {
    if (pdfActiveTab === "editeur") {
      drawStrokes();
    }
  }, [annotationStrokes, annotationCurrentPage, pdfActiveTab]);

  // Mouse & touch handlers for drawings
  const startAnnotatorDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    let clientX, clientY;
    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    if (activeDrawingTool === "main") {
      isHandPanningRef.current = true;
      setIsHandPanning(true);
      const horizScrollEl = canvas.parentElement?.parentElement;
      const scrollEl = isPdfFullscreen 
        ? (scrollContainerRef.current || canvas.parentElement?.parentElement?.parentElement)
        : null;
      
      panStartRef.current = {
        x: clientX,
        y: clientY,
        scrollLeft: isPdfFullscreen && scrollEl ? scrollEl.scrollLeft : (horizScrollEl ? horizScrollEl.scrollLeft : 0),
        scrollTop: isPdfFullscreen && scrollEl ? scrollEl.scrollTop : 0,
        windowScrollTop: window.scrollY,
        windowScrollLeft: window.scrollX
      };
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    isAnnotatorDrawingRef.current = true;
    setIsAnnotatorDrawing(true);

    let finalColor = drawingColor;
    let finalWidth = drawingThickness;

    if (activeDrawingTool === "surligneur") {
      // Force alpha translucency for highlighter color
      if (drawingColor === "#111827") finalColor = "rgba(17, 24, 39, 0.3)";
      else if (drawingColor === "#2563eb") finalColor = "rgba(37, 99, 235, 0.35)";
      else if (drawingColor === "#dc2626") finalColor = "rgba(220, 38, 38, 0.35)";
      else if (drawingColor === "#16a34a") finalColor = "rgba(22, 163, 74, 0.35)";
      else finalColor = "rgba(234, 179, 8, 0.45)"; // yellow highlighter
      finalWidth = drawingThickness * 2.5;
    } else if (activeDrawingTool === "plume") {
      // Calligraphy pen: slightly wider responsive default
      finalWidth = drawingThickness * 1.5;
    } else if (activeDrawingTool === "bille") {
      // Ballpoint: thinner lines
      finalWidth = Math.max(1.5, drawingThickness * 0.7);
    } else if (activeDrawingTool === "gomme") {
      finalWidth = drawingThickness * 3;
    }

    const newStroke = {
      type: activeDrawingTool,
      color: finalColor,
      width: finalWidth,
      points: [{ x, y }]
    };

    const pageStrokes = annotationStrokes[annotationCurrentPage] || [];
    setAnnotationStrokes({
      ...annotationStrokes,
      [annotationCurrentPage]: [...pageStrokes, newStroke]
    });

    setRedoHistory({
      ...redoHistory,
      [annotationCurrentPage]: []
    });
  };

  const drawAnnotator = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    let clientX, clientY;
    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    if (activeDrawingTool === "main") {
      if (!isHandPanningRef.current) return;
      const dx = clientX - panStartRef.current.x;
      const dy = clientY - panStartRef.current.y;
      const canvas = drawingCanvasRef.current;
      const horizScrollEl = canvas?.parentElement?.parentElement;
      const scrollEl = isPdfFullscreen 
        ? (scrollContainerRef.current || canvas?.parentElement?.parentElement?.parentElement)
        : null;

      if (isPdfFullscreen && scrollEl) {
        scrollEl.scrollLeft = panStartRef.current.scrollLeft - dx;
        scrollEl.scrollTop = panStartRef.current.scrollTop - dy;
      } else {
        if (horizScrollEl) {
          horizScrollEl.scrollLeft = panStartRef.current.scrollLeft - dx;
        }
        if (panStartRef.current.windowScrollTop !== undefined) {
          window.scrollTo(
            window.scrollX,
            panStartRef.current.windowScrollTop - dy
          );
        }
      }
      return;
    }

    if (!isAnnotatorDrawingRef.current) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    const pageStrokes = [...(annotationStrokes[annotationCurrentPage] || [])];
    if (pageStrokes.length === 0) return;
    const lastStroke = { ...pageStrokes[pageStrokes.length - 1] };
    lastStroke.points = [...lastStroke.points, { x, y }];
    pageStrokes[pageStrokes.length - 1] = lastStroke;

    setAnnotationStrokes({
      ...annotationStrokes,
      [annotationCurrentPage]: pageStrokes
    });
  };

  const stopAnnotatorDrawing = () => {
    if (activeDrawingTool === "main") {
      if (isHandPanningRef.current) {
        isHandPanningRef.current = false;
        setIsHandPanning(false);
      }
      return;
    }

    if (isAnnotatorDrawingRef.current) {
      isAnnotatorDrawingRef.current = false;
      setIsAnnotatorDrawing(false);
      
      const pageStrokes = annotationStrokes[annotationCurrentPage] || [];
      const pageUndo = undoHistory[annotationCurrentPage] || [];
      setUndoHistory({
        ...undoHistory,
        [annotationCurrentPage]: [...pageUndo, pageStrokes]
      });
    }
  };

  const handleAnnotationFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadPdfDocFromFile(file);
    }
  };

  // Undo/Redo & Clean actions
  const handleUndo = () => {
    const pageStrokes = annotationStrokes[annotationCurrentPage] || [];
    if (pageStrokes.length === 0) return;
    
    const undoneStroke = pageStrokes[pageStrokes.length - 1];
    const newStrokes = pageStrokes.slice(0, -1);
    
    setAnnotationStrokes({
      ...annotationStrokes,
      [annotationCurrentPage]: newStrokes
    });
    
    const pageRedo = redoHistory[annotationCurrentPage] || [];
    setRedoHistory({
      ...redoHistory,
      [annotationCurrentPage]: [...pageRedo, undoneStroke]
    });
    
    const pageUndo = undoHistory[annotationCurrentPage] || [];
    setUndoHistory({
      ...undoHistory,
      [annotationCurrentPage]: pageUndo.slice(0, -1)
    });
    
    triggerToast("Dernier tracé annulé.");
  };

  const handleRedo = () => {
    const pageRedo = redoHistory[annotationCurrentPage] || [];
    if (pageRedo.length === 0) return;
    
    const redoneStroke = pageRedo[pageRedo.length - 1];
    const newRedo = pageRedo.slice(0, -1);
    
    setRedoHistory({
      ...redoHistory,
      [annotationCurrentPage]: newRedo
    });
    
    const pageStrokes = annotationStrokes[annotationCurrentPage] || [];
    const newStrokes = [...pageStrokes, redoneStroke];
    
    setAnnotationStrokes({
      ...annotationStrokes,
      [annotationCurrentPage]: newStrokes
    });
    
    const pageUndo = undoHistory[annotationCurrentPage] || [];
    setUndoHistory({
      ...undoHistory,
      [annotationCurrentPage]: [...pageUndo, newStrokes]
    });
    
    triggerToast("Tracé rétabli.");
  };

  const handleClearPage = () => {
    if (confirm("Voulez-vous vraiment effacer tous les tracés sur cette page ?")) {
      setAnnotationStrokes({
        ...annotationStrokes,
        [annotationCurrentPage]: []
      });
      setUndoHistory({
        ...undoHistory,
        [annotationCurrentPage]: []
      });
      setRedoHistory({
        ...redoHistory,
        [annotationCurrentPage]: []
      });
      triggerToast("Page effacée.");
    }
  };

  // Download high-DPI annotated PDF document
  const downloadAnnotatedPdf = async () => {
    if (!annotationPdfDoc || !annotationPdfFile) return;
    setIsPdfLoading(true);
    triggerToast("Génération du PDF annoté en cours...");
    
    try {
      const pdfjs = await loadPdfJS();
      let pdfOutput: jsPDF | null = null;

      for (let pageNum = 1; pageNum <= annotationNumPages; pageNum++) {
        const page = await annotationPdfDoc.getPage(pageNum);
        
        // 2x HD rendering resolution scale
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        
        const offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = viewport.width;
        offscreenCanvas.height = viewport.height;
        const offscreenCtx = offscreenCanvas.getContext("2d");
        
        if (!offscreenCtx) continue;
        
        // 1. Render PDF page
        const renderContext = {
          canvasContext: offscreenCtx,
          viewport: viewport,
        };
        await page.render(renderContext).promise;
        
        // 2. Render strokes on top (scaled by 2x)
        const strokes = annotationStrokes[pageNum] || [];
        strokes.forEach((stroke) => {
          if (!stroke.points || stroke.points.length === 0) return;
          offscreenCtx.beginPath();
          
          if (stroke.type === "gomme") {
            offscreenCtx.globalCompositeOperation = "destination-out";
            offscreenCtx.strokeStyle = "rgba(0,0,0,1)";
            offscreenCtx.lineWidth = stroke.width * scale;
          } else {
            offscreenCtx.globalCompositeOperation = "source-over";
            offscreenCtx.strokeStyle = stroke.color;
            offscreenCtx.lineWidth = stroke.width * scale;
          }
          
          offscreenCtx.lineCap = "round";
          offscreenCtx.lineJoin = "round";

          const sourceWidth = annotatorCanvasRef.current?.width || viewport.width / scale;
          const sourceHeight = annotatorCanvasRef.current?.height || viewport.height / scale;
          
          const scaleX = offscreenCanvas.width / sourceWidth;
          const scaleY = offscreenCanvas.height / sourceHeight;

          offscreenCtx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
          for (let i = 1; i < stroke.points.length; i++) {
            offscreenCtx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
          }
          offscreenCtx.stroke();
        });
        
        const imgData = offscreenCanvas.toDataURL("image/jpeg", 0.95);
        
        const ptWidth = viewport.width / scale;
        const ptHeight = viewport.height / scale;
        const orientation = ptWidth > ptHeight ? "landscape" : "portrait";
        
        if (pageNum === 1) {
          pdfOutput = new jsPDF({
            orientation,
            unit: "pt",
            format: [ptWidth, ptHeight]
          });
        } else if (pdfOutput) {
          pdfOutput.addPage([ptWidth, ptHeight], orientation);
        }
        
        if (pdfOutput) {
          pdfOutput.addImage(imgData, "JPEG", 0, 0, ptWidth, ptHeight);
        }
      }
      
      if (pdfOutput) {
        const originalName = annotationPdfFile.name.replace(/\.pdf$/i, "");
        pdfOutput.save(`${originalName}_annoté.pdf`);
        triggerToast("PDF annoté téléchargé avec succès !");
      }
    } catch (err) {
      console.error("PDF export generation error:", err);
      triggerToast("Erreur lors de la génération du PDF final.");
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Automatically save signature library updates
  useEffect(() => {
    localStorage.setItem("vvs_signature_library", JSON.stringify(signatureLibrary));
  }, [signatureLibrary]);

  useEffect(() => {
    localStorage.setItem("vvs_stamped_signatures", JSON.stringify(stampedSignatures));
  }, [stampedSignatures]);

  useEffect(() => {
    localStorage.setItem("vvs_stamped_offsets", JSON.stringify(stampedOffsets));
  }, [stampedOffsets]);

  // Adjust canvas for High DPI (Retina) display crispness & better tracking
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 450;
    const height = rect.height || 130;
    
    const dpr = window.devicePixelRatio || 1;
    // Align internal resolution with physical pixels for perfect crispness
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); 
      ctx.scale(dpr, dpr);
      
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#122ba6"; // Elegant intense midnight blue ink
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      initCanvas();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Helper to extract crisp client coordinates from Pointer Events
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Touch & Mouse Drawing Handlers (isolated segment drawing with pointer capture to handle liftoff flawlessly)
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      // safe fallback
    }
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    lastX.current = coords.x;
    lastY.current = coords.y;
    isDrawingRef.current = true;
    setIsDrawing(true);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineTo(coords.x + 0.1, coords.y + 0.1); // Small tap or dot creation
        ctx.stroke();
      }
    }
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    if (e.cancelable) {
      e.preventDefault();
    }
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Isolate path stroke to strictly connect segment endpoints and prevent trailing connect bugs
    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastX.current = coords.x;
    lastY.current = coords.y;
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      setIsDrawing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        // safe fallback
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastX.current = 0;
    lastY.current = 0;
    isDrawingRef.current = false;
    setIsDrawing(false);
  };

  // Expanded Signature Modal Coordinates & Handlers
  const getModalCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startModalDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.cancelable) {
      e.preventDefault();
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      // safe fallback
    }
    
    const coords = getModalCoordinates(e);
    if (!coords) return;
    
    modalLastX.current = coords.x;
    modalLastY.current = coords.y;
    modalIsDrawingRef.current = true;
    setModalIsDrawing(true);

    const canvas = modalCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineTo(coords.x + 0.1, coords.y + 0.1);
        ctx.stroke();
      }
    }
  };

  const drawModal = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!modalIsDrawingRef.current) return;
    if (e.cancelable) {
      e.preventDefault();
    }
    
    const coords = getModalCoordinates(e);
    if (!coords) return;
    
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(modalLastX.current, modalLastY.current);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    modalLastX.current = coords.x;
    modalLastY.current = coords.y;
  };

  const stopModalDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (modalIsDrawingRef.current) {
      modalIsDrawingRef.current = false;
      setModalIsDrawing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        // safe fallback
      }
    }
  };

  const clearModalCanvas = () => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    modalLastX.current = 0;
    modalLastY.current = 0;
    modalIsDrawingRef.current = false;
    setModalIsDrawing(false);
  };

  // High DPI Initialization for Expanded Modal Canvas upon opening
  useEffect(() => {
    if (isSignatureModalOpen) {
      const timer = setTimeout(() => {
        const canvas = modalCanvasRef.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 600;
        const height = rect.height || 300;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0); 
          ctx.scale(dpr, dpr);
          
          ctx.lineWidth = 3.5; // Sophisticated ultra-crisp thick line for high resolution
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = "#122ba6"; // Elegant vector ink
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isSignatureModalOpen]);

  const saveModalSignature = () => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const buffer = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = buffer.data;
    let hasDrawn = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 10) {
        hasDrawn = true;
        break;
      }
    }

    if (!hasDrawn) {
      triggerToast("⚠️ Veuillez tracer une signature sur le tableau avant de l'enregistrer.");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    setSignatureLibrary([dataUrl, ...signatureLibrary]);
    clearModalCanvas();
    setIsSignatureModalOpen(false);
    triggerToast("🖋️ Signature enregistrée dans votre bibliothèque locale !");
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Check if empty by counting pixels
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const buffer = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = buffer.data;
    let hasDrawn = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 10) {
        hasDrawn = true;
        break;
      }
    }

    if (!hasDrawn) {
      triggerToast("⚠️ Veuillez tracer une signature sur le tableau avant de l'enregistrer.");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    setSignatureLibrary([dataUrl, ...signatureLibrary]);
    clearCanvas();
    triggerToast("🖋️ Signature enregistrée dans votre bibliothèque locale !");
  };

  const handleApplySignature = (elementId: string, base64Image: string) => {
    setStampedSignatures({
      ...stampedSignatures,
      [elementId]: base64Image
    });
    triggerToast("✨ Signature apposée sur le champ sélectionné !");
  };

  const handleClearSignatureOnField = (elementId: string) => {
    const updated = { ...stampedSignatures };
    delete updated[elementId];
    setStampedSignatures(updated);

    const updatedOffsets = { ...stampedOffsets };
    delete updatedOffsets[elementId];
    setStampedOffsets(updatedOffsets);

    triggerToast("Signature retirée du champ.");
  };

  const startStampDrag = (e: React.PointerEvent<HTMLButtonElement>, elementId: string) => {
    e.preventDefault();
    const currentOffset = stampedOffsets[elementId] || { x: 0, y: 0 };
    const startX = e.clientX;
    const startY = e.clientY;
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setStampedOffsets(prev => ({
        ...prev,
        [elementId]: {
          x: currentOffset.x + dx,
          y: currentOffset.y + dy
        }
      }));
    };
    
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleDeleteSavedSignature = (indexToDelete: number) => {
    setSignatureLibrary(signatureLibrary.filter((_, idx) => idx !== indexToDelete));
    triggerToast("Signature supprimée de la bibliothèque.");
  };

  // Check if API key is present before smart features, open redirection window if missing
  const checkApiKeyOrOpenModal = (): boolean => {
    if (!geminiApiKey || geminiApiKey.trim() === "") {
      setIsApiKeyModalOpen(true);
      triggerToast("⚠️ Clé d'API Gemini manquante. Veuillez la configurer dans l'onglet Dédié.");
      return false;
    }
    return true;
  };

  // --- HANDLERS ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    const isPDF = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");

    if (!isPDF && !isImage) {
      triggerToast("Format de fichier non supporté. Veuillez choisir un PDF ou une Image.");
      return;
    }

    // Check API Key
    if (!checkApiKeyOrOpenModal()) {
      return;
    }

    setIsParsing(true);
    setParsingStep("Lecture du fichier...");

    try {
      // Read file content as base64
      const base64Data = await fileToBase64(file);
      setParsingStep("Connexion à l'IA de Google (Gemini 2.5)... Extraction de la structure vectorielle...");

      const res = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: file.type,
          customApiKey: geminiApiKey || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du traitement par l'IA.");
      }

      setParsingStep("Analyse terminée ! Rendu graphique interactif...");
      
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.elements) {
        setElements(data.elements);
        // Reset inputs
        setFormFilledValues({});
        setFormCheckedStates({});
        if (data.elements.length > 0) {
          setSelectedElementId(data.elements[0].id);
        }
      }

      triggerToast("✨ Document numérisé avec succès ! Tous les champs d'écriture ont été rendus interactifs !");
      
    } catch (err: any) {
      console.error(err);
      triggerToast(`Erreur d'analyse : ${err.message}`);
    } finally {
      setIsParsing(false);
      setParsingStep("");
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Str = (reader.result as string).split(",")[1];
        resolve(base64Str);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Convert current elements by conversational directive using Gemini
  const handleConversationalModify = async () => {
    if (!aiPrompt.trim()) {
      triggerToast("Veuillez saisir une consigne pour l'IA.");
      return;
    }

    // Check API Key
    if (!checkApiKeyOrOpenModal()) {
      return;
    }

    setIsAiModifying(true);
    triggerToast("L'IA ajuste votre document de formulaire...");

    try {
      const res = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentElements: elements,
          instruction: aiPrompt,
          customApiKey: geminiApiKey || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur de modification par l'IA.");
      }

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.elements) {
        setElements(data.elements);
      }
      setAiPrompt("");
      triggerToast("✨ Formulaire mis à jour par l'IA !");
    } catch (err: any) {
      console.error(err);
      triggerToast(`Échec de la modification : ${err.message}`);
    } finally {
      setIsAiModifying(false);
    }
  };

  // Preset quick load
  const loadPreset = (presetId: string) => {
    const preset = PRESET_FORMS.find(p => p.id === presetId);
    if (preset) {
      setTitle(preset.title);
      setDescription(preset.description);
      setElements(preset.elements);
      setFormFilledValues({});
      setFormCheckedStates({});
      if (preset.elements.length > 0) {
        setSelectedElementId(preset.elements[0].id);
      } else {
        setSelectedElementId(null);
      }
      triggerToast(`Modèle "${preset.name}" chargé !`);
    }
  };

  // --- GENERIC EVOLUTIVE PROFILE HELPERS ---
  const normalizeStr = (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9]/g, " "); // replace special chars with space
  };

  const findBestProfileValue = (label: string, profile: Record<string, string>) => {
    const normLabel = normalizeStr(label);
    
    // 1. Try exact normalized match
    for (const [key, val] of Object.entries(profile)) {
      const normKey = normalizeStr(key);
      if (normKey === normLabel) return val;
    }
    
    // 2. Try substring match (e.g. key is inside label, e.g. "email" inside "votre email")
    const keys = Object.keys(profile).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      const normKey = normalizeStr(key);
      if (normKey.length > 2 && (normLabel.includes(normKey) || normKey.includes(normLabel))) {
        return profile[key];
      }
    }
    return null;
  };

  const fillFromGenericProfile = () => {
    const nextTextValues = { ...formFilledValues };
    const nextCheckStates = { ...formCheckedStates };
    let matchCount = 0;

    elements.forEach(el => {
      if (el.type === "input_text" || el.type === "textarea") {
        const match = findBestProfileValue(el.label, genericProfile);
        if (match !== null && match !== undefined) {
          nextTextValues[el.id] = match;
          matchCount++;
        }
      } else if (el.type === "checkbox") {
        const match = findBestProfileValue(el.label, genericProfile);
        if (match !== null && match !== undefined) {
          const normMatch = match.toLowerCase();
          nextCheckStates[el.id] = normMatch === "true" || normMatch === "oui" || normMatch === "1" || normMatch === "yes" || normMatch === "checked";
          matchCount++;
        }
      }
    });

    setFormFilledValues(nextTextValues);
    setFormCheckedStates(nextCheckStates);
    
    if (matchCount > 0) {
      triggerToast(`✨ Profil Générique : ${matchCount} champ(s) complété(s) avec succès !`);
    } else {
      triggerToast("ℹ️ Aucun champ correspondant trouvé dans votre Profil Générique pour ce document.");
    }
  };

  const addFieldToGenericProfile = (key: string, value: string) => {
    if (!key.trim()) return;
    
    const cleanKey = key.replace(/[:*]/g, "").trim();
    
    setGenericProfile(prev => {
      const updated = {
        ...prev,
        [cleanKey]: value.trim()
      };
      return updated;
    });
    
    triggerToast(`✨ '${cleanKey}' a été enregistré dans votre profil générique !`);
  };

  const getMissingFieldsForProfile = () => {
    const missing: { label: string; value: string; elementId: string }[] = [];
    
    elements.forEach(el => {
      if (el.type === "input_text" || el.type === "textarea") {
        const val = formFilledValues[el.id];
        if (val && val.trim()) {
          const match = findBestProfileValue(el.label, genericProfile);
          const cleanLabel = el.label.replace(/[:*]/g, "").trim();
          
          if (!match) {
            if (!missing.some(m => normalizeStr(m.label) === normalizeStr(cleanLabel))) {
              missing.push({
                label: cleanLabel,
                value: val.trim(),
                elementId: el.id
              });
            }
          } else if (match.trim() !== val.trim()) {
            if (!missing.some(m => normalizeStr(m.label) === normalizeStr(cleanLabel))) {
              missing.push({
                label: cleanLabel,
                value: val.trim(),
                elementId: el.id
              });
            }
          }
        }
      }
    });
    
    return missing;
  };

  // Fill pre-fill form data simulation
  const fillSampleValues = () => {
    const sampleTextGeneric: Record<string, string> = {
      "nom": "LOHBERGER",
      "prenom": "Nicolas",
      "date": "10/06/1990",
      "adresse": "74 route de l'Océan, 33000 Bordeaux",
      "email": "n.lohberger.pro@gmail.com",
      "tel": "06.52.88.19.20",
      "fait": "Bordeaux",
      "signature": "Nicolas Lohberger"
    };

    const nextTextValues: Record<string, string> = {};
    const nextCheckStates: Record<string, boolean> = {};

    elements.forEach(el => {
      if (el.type === "input_text" || el.type === "textarea") {
        const key = Object.keys(sampleTextGeneric).find(k => el.label.toLowerCase().includes(k));
        if (key) {
          nextTextValues[el.id] = sampleTextGeneric[key];
        } else {
          nextTextValues[el.id] = el.placeholder || "Saisie exemple";
        }
      } else if (el.type === "checkbox") {
        nextCheckStates[el.id] = true;
      }
    });

    setFormFilledValues(nextTextValues);
    setFormCheckedStates(nextCheckStates);
    triggerToast("Formulaire de démonstration complété ! Devient éditable instantanément.");
  };

  const handleClearValues = () => {
    setFormFilledValues({});
    setFormCheckedStates({});
    triggerToast("Toutes les réponses de saisie ont été effacées.");
  };

  // Elements stack modifiers
  const handleUpdateElement = (updated: FormElement) => {
    setElements(elements.map(el => el.id === updated.id ? updated : el));
  };

  const handleDeleteElement = (id: string) => {
    const next = elements.filter(el => el.id !== id);
    setElements(next);
    if (selectedElementId === id) {
      setSelectedElementId(next.length > 0 ? next[0].id : null);
    }
    triggerToast("Élément supprimé");
  };

  const handleMoveElement = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= elements.length) return;

    const updated = [...elements];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setElements(updated);
  };

  const handleAddElement = (type: FormElement["type"]) => {
    const newId = "elem_" + Date.now();
    const newEl: FormElement = {
      id: newId,
      type: type,
      label: type === "checkbox" ? "Nouvelle proposition à cocher" : type === "section" ? "Sous-partie" : "Nouveau descriptif de saisie :",
      placeholder: (type === "input_text" || type === "textarea") ? "Cliquer pour saisir..." : undefined,
      required: false
    };

    setElements([...elements, newEl]);
    setSelectedElementId(newId);
    triggerToast("Élément ajouté à la suite.");
  };

  // Estimate max character count for a single line based on field label width
  const getLineCharLimit = (label: string): number => {
    const labelLen = label ? label.length : 0;
    return Math.max(15, 62 - Math.floor(labelLen * 0.6));
  };

  const triggerInputFill = (id: string, val: string) => {
    if (!isDynamicFilling) {
      const el = elements.find(item => item.id === id);
      if (el) {
        const currentIndex = elements.findIndex(item => item.id === id);
        const subsequentElements = elements.slice(currentIndex + 1);
        
        // Check if there is writing, section, or other descriptive block elements in the document after
        const hasWritingAfter = subsequentElements.some(item => 
          item.type === "input_text" || 
          item.type === "text_block" || 
          item.type === "section" || 
          item.type === "title" ||
          item.type === "checkbox" ||
          item.type === "textarea"
        );
        
        if (hasWritingAfter) {
          const limit = getLineCharLimit(el.label);
          if (val.length > limit) {
            triggerToast("🚫 Remplissage classique : écriture bloquée pour éviter de repousser le texte du document.");
            return;
          }
        }
      }
    }

    setFormFilledValues(prev => {
      const nextValues = {
        ...prev,
        [id]: val
      };
      
      if (autoSaveNewInputsToProfile && val.trim() !== "") {
        const el = elements.find(item => item.id === id);
        if (el && (el.type === "input_text" || el.type === "textarea")) {
          const cleanKey = el.label.replace(/[:*]/g, "").trim();
          if (cleanKey) {
            setGenericProfile(profilePrev => ({
              ...profilePrev,
              [cleanKey]: val.trim()
            }));
          }
        }
      }
      return nextValues;
    });
  };

  const toggleCheck = (id: string) => {
    setFormCheckedStates({
      ...formCheckedStates,
      [id]: !formCheckedStates[id]
    });
  };

  // Import schema manual JSON parser
  const handleImportSchema = () => {
    try {
      if (!importJsonText.trim()) {
        triggerToast("Veuillez coller le code JSON !");
        return;
      }
      
      const parsed = JSON.parse(importJsonText);
      
      if (Array.isArray(parsed)) {
        // Just the elements array copied from legacy "Copier code"
        setElements(parsed);
        triggerToast("Le code (éléments) a été importé avec succès !");
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.elements)) {
        // Complete structural schema with title, description, and possibly user-filled fields
        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        setElements(parsed.elements);

        if (parsed.formFilledValues) setFormFilledValues(parsed.formFilledValues);
        if (parsed.formCheckedStates) setFormCheckedStates(parsed.formCheckedStates);
        if (parsed.stampedSignatures) setStampedSignatures(parsed.stampedSignatures);
        if (parsed.stampedOffsets) setStampedOffsets(parsed.stampedOffsets);

        triggerToast("Document complet chargé avec vos modifications !");
      } else {
        triggerToast("Format de schéma invalide.");
        return;
      }
      
      setIsImportModalOpen(false);
      setImportJsonText("");
    } catch (err) {
      triggerToast("Erreur de lecture : JSON invalide !");
    }
  };

  // Professional PDF Export utility
  const componentRef = useRef<HTMLDivElement>(null);

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handlePrint = async () => {
    const elem = componentRef.current || document.getElementById("print-area-wrapper");
    if (!elem) {
      triggerToast("Erreur: zone d'impression introuvable !");
      return;
    }

    try {
      triggerToast("Génération du PDF en cours...");
      
      // 1. Active Export Mode pour re-render sans les champs vides et avec des dimensions ajustées
      setIsExporting(true);
      
      // Attendre que le DOM se mette à jour
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 2. Pagination intelligente DOM-basée
      // Au lieu de couper l'image à l'aveugle, on reconstruit le DOM page par page.
      const A4_WIDTH_PX = 800; // Même que notre max-w
      const A4_HEIGHT_PX = 1131; // Ratio A4 (800 * 1.414)
      const MARGIN_BOTTOM = 60; // Marge bas de page
      
      // Clone principal du wrapper
      const originalContent = elem.querySelector('.document-contents-wrapper');
      const footerContent = elem.querySelector('.document-footer-wrapper');
      
      if (!originalContent) throw new Error("Contenu du document introuvable.");

      const pages: HTMLDivElement[] = [];
      const createNewPageStruecture = () => {
        const page = document.createElement('div');
        page.className = "w-full bg-white text-neutral-900 border border-neutral-300 p-10 md:p-14 relative font-sans w-[800px] flex flex-col justify-start";
        page.style.minHeight = `${A4_HEIGHT_PX}px`;
        page.style.width = '800px';
        
        // Re-inject blueprint dots
        page.innerHTML = `
          <div class="absolute top-2 left-2 w-2 h-2 border-t border-l border-neutral-300"></div>
          <div class="absolute top-2 right-2 w-2 h-2 border-t border-r border-neutral-300"></div>
          <div class="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-neutral-300"></div>
          <div class="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-neutral-300"></div>
          <div class="page-content-wrapper flex flex-col w-full"></div>
        `;
        return page;
      };

      let currentPage = createNewPageStruecture();
      let currentContentWrapper = currentPage.querySelector('.page-content-wrapper') as HTMLDivElement;
      
      // Container invisible pour mesurer les hauteurs réelles
      const measureContainer = document.createElement('div');
      measureContainer.style.position = 'absolute';
      measureContainer.style.top = '-9999px';
      measureContainer.style.left = '0';
      measureContainer.style.width = '800px';
      measureContainer.style.backgroundColor = 'white';
      document.body.appendChild(measureContainer);
      
      let currentHeightEstimate = 112; // Représente le padding de la page (p-14 = 56px * 2)

      // Extraction de l'en-tête (Titre)
      const headerTitle = originalContent.querySelector('.document-header');
      if (headerTitle) {
        const clone = headerTitle.cloneNode(true) as HTMLElement;
        measureContainer.appendChild(clone);
        currentHeightEstimate += clone.offsetHeight;
        currentContentWrapper.appendChild(clone);
      }

      // Itération sur chaque bloc de l'éditeur (sections, textes, inputs)
      const elementsStack = originalContent.querySelector('.document-elements-stack');
      const blocks = elementsStack ? Array.from(elementsStack.children) : [];
      
      const elementsStackWrapperCurrent = document.createElement('div');
      elementsStackWrapperCurrent.className = "flex flex-wrap gap-x-4 gap-y-6 w-full";
      currentContentWrapper.appendChild(elementsStackWrapperCurrent);

      for (const block of blocks as HTMLElement[]) {
        const clone = block.cloneNode(true) as HTMLElement;
        
        // Ignorer les blocs cachés par le mode export
        if (window.getComputedStyle(clone).display === 'none' || clone.classList.contains('hidden')) {
           continue;
        }

        measureContainer.appendChild(clone);
        const blockHeight = clone.offsetHeight + 24; // +24px pour le margin-y approximatif
        
        // Logique de saut de page (Smart Pagination)
        if (currentHeightEstimate + blockHeight > A4_HEIGHT_PX - MARGIN_BOTTOM) {
          pages.push(currentPage);
          
          // Nouvelle page
          currentPage = createNewPageStruecture();
          currentContentWrapper = currentPage.querySelector('.page-content-wrapper') as HTMLDivElement;
          
          // Nouveau conteneur de stack
          const newStackWrapper = document.createElement('div');
          newStackWrapper.className = "flex flex-wrap gap-x-4 gap-y-6 w-full";
          currentContentWrapper.appendChild(newStackWrapper);
          
          newStackWrapper.appendChild(clone);
          currentHeightEstimate = 112 + blockHeight;
        } else {
          // Rentre toujours sur la page active
          elementsStackWrapperCurrent.parentElement?.lastElementChild?.appendChild(clone);
          currentHeightEstimate += blockHeight;
        }
      }

      // Ajout du footer sur la dernière page
      if (footerContent) {
        const clone = footerContent.cloneNode(true) as HTMLElement;
        measureContainer.appendChild(clone);
        const footerHeight = clone.offsetHeight + 40; // Marge
        
        if (currentHeightEstimate + footerHeight > A4_HEIGHT_PX - 20) {
          pages.push(currentPage);
          currentPage = createNewPageStruecture();
          currentPage.appendChild(clone);
        } else {
          // Push le footer vers le bas de la page courante if you want
          // ou juste l'ajouter
          clone.style.marginTop = 'auto'; // Si on veut conserver en bas
          currentContentWrapper.parentElement?.appendChild(clone);
        }
      }
      
      pages.push(currentPage);
      document.body.removeChild(measureContainer);

      // Rendu PDF final
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeightMM = pdf.internal.pageSize.getHeight();

      // Container for rendering html-to-image safely off-screen
      const renderContainer = document.createElement('div');
      renderContainer.style.position = 'fixed';
      renderContainer.style.left = '0';
      renderContainer.style.top = '0';
      renderContainer.style.zIndex = '-9999';
      renderContainer.style.opacity = '0.01';
      renderContainer.style.pointerEvents = 'none';
      document.body.appendChild(renderContainer);

      for (let i = 0; i < pages.length; i++) {
        renderContainer.appendChild(pages[i]);
        
        // Laisser le navigateur parser le CSS injecté
        await new Promise(resolve => setTimeout(resolve, 50)); 
        
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          windowWidth: 1200,
          windowHeight: 1600,
          onclone: (clonedDoc) => sanitizeClonedDocument(clonedDoc),
        });
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

        if (i > 0) pdf.addPage();
        
        // Pour éviter l'excès de blanc en bas de la dernière page, on calcule sa vraie hauteur
        // Mais jsPDF a des pages fixes (A4). L'image occupe tout le A4. Ca reste propre.
        pdf.addImage(dataUrl, "JPEG", 0, 0, pdfWidth, pageHeightMM);
        
        renderContainer.innerHTML = '';
      }
      
      document.body.removeChild(renderContainer);
      pdf.save(`${title ? title.replace(/\s+/g, '-').toLowerCase() : 'document'}-export.pdf`);
      
      setIsExporting(false);
      triggerToast("Document PDF exporté avec succès !");
    } catch (err) {
      setIsExporting(false);
      console.error("PDF Export error:", err);
      triggerToast("Une erreur s'est produite lors de pagination PDF dynamique.");
    }
  };

  return (
    <div 
      className={`w-full flex flex-col min-h-screen ${
        isPdfFullscreen ? "fixed inset-0 z-50 bg-[#0c0c0c] w-screen h-screen overflow-hidden" : ""
      } ${
        isVS ? "bg-[#181818] text-neutral-200" : "bg-slate-950 text-slate-100"
      }`}
    >
      
      {/* Dynamic Native Print Stylesheet */}
      <style>{`
        @media print {
          #print-area-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 1.5cm !important;
            background: white !important;
            color: black !important;
          }
          /* Custom input formatting inside printed page */
          input[type="text"], textarea {
            border-bottom: 1px solid #777 !important;
            border-top: none !important;
            border-left: none !important;
            border-right: none !important;
            background: transparent !important;
            color: black !important;
            padding: 2px !important;
            font-size: 11pt !important;
          }
          /* Checkbox styling on printable sheet */
          .print-check-box {
            border: 1.5px solid black !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Title block */}
      {!isPdfFullscreen && (
        <div className={`px-6 py-4 border-b ${
          isVS ? "border-[#2b2b2b] bg-[#1e1e1e]" : "border-slate-800 bg-slate-900/60"
        }`}>
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className={`p-2 rounded-lg ${
                  isVS ? "bg-[#f05a28]/10 text-[#f05a28]" : "bg-cyan-500/10 text-cyan-400"
                }`}>
                  <FileText className="w-5 h-5 animate-pulse" />
                </div>
                <h1 className="text-lg font-black tracking-tight flex items-center gap-1.5 font-sans">
                  PDF STUDIO
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isVS ? "bg-[#f05a28]/15 text-[#f05a28]" : "bg-cyan-500/15 text-cyan-300"
                  }`}>
                    PRO
                  </span>
                </h1>
              </div>
              <p className="text-xs text-neutral-400 max-w-2xl font-sans">
                Transformez vos documents en formulaires électroniques interactifs IA, ou dessinez et annotez vos PDF directement à la main.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Ouvre un PDF */}
              <button
                onClick={() => globalPdfInputRef.current?.click()}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-xl border transition-all cursor-pointer ${
                  isVS 
                    ? "bg-[#252525]/80 hover:bg-[#2d2d2d] border-[#3a3a3a] text-neutral-300" 
                    : "bg-slate-900 hover:bg-slate-850 border-slate-850 text-slate-300"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Ouvrir un PDF...
              </button>
              <input
                ref={globalPdfInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    triggerPdfFileOpenChoice(file);
                  }
                }}
              />

              {/* Subtabs Selector toggle */}
              <div className={`flex p-1 rounded-xl border shrink-0 overflow-x-auto max-w-full ${
                isVS ? "bg-[#181818] border-[#3a3a3a]" : "bg-slate-950 border-slate-850"
              }`}>
                <button
                  onClick={() => setPdfActiveTab("editeur")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    pdfActiveTab === "editeur"
                      ? isVS
                        ? "bg-[#f05a28] text-neutral-100 shadow-md"
                        : "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  Editeur PDF
                </button>
                <button
                  onClick={() => setPdfActiveTab("formulaire")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    pdfActiveTab === "formulaire"
                      ? isVS
                        ? "bg-[#f05a28] text-neutral-100 shadow-md"
                        : "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Formulaire PDF
                </button>
                <button
                  onClick={() => setPdfActiveTab("convertisseur")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    pdfActiveTab === "convertisseur"
                      ? isVS
                        ? "bg-[#f05a28] text-neutral-100 shadow-md"
                        : "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Convertisseur & PDF/A
                </button>
                <button
                  onClick={() => setPdfActiveTab("gestionnaire")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    pdfActiveTab === "gestionnaire"
                      ? isVS
                        ? "bg-[#f05a28] text-neutral-100 shadow-md"
                        : "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Montage & Gestion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {pdfActiveTab === "formulaire" && (
        <div className={isPdfFullscreen 
          ? "flex-1 w-full h-full relative overflow-hidden flex flex-col" 
          : "flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24"
        }>
        
        {/* Left Side: interactive form canvas paper sheet (cols-7) */}
        <div className={isPdfFullscreen 
          ? "w-full h-full overflow-auto flex flex-col items-center p-4 md:p-12 relative flex-1" 
          : "lg:col-span-7 flex flex-col gap-4"
        }>
          
          {/* File input and Drag area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
              dragActive
                ? isVS ? "border-[#f05a28] bg-[#f05a28]/5" : "border-cyan-400 bg-cyan-950/10"
                : isVS ? "border-[#3d3d3d] hover:border-neutral-500 bg-[#1e1e1e]/40" : "border-slate-850 hover:border-slate-700 bg-slate-900/10"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept="application/pdf,image/*"
              className="hidden"
            />
            
            {isParsing ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-3">
                <div className={`p-4 rounded-full animate-spin border-t-2 border-r-2 ${
                  isVS ? "border-[#f05a28]" : "border-cyan-400"
                }`}>
                  <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-neutral-200">Transcription Intelligente en cours...</h3>
                  <p className="text-xs text-neutral-450 animate-pulse italic">{parsingStep}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 cursor-pointer" onClick={() => {
                setImportSelectorType("pdf_image");
                setIsImportSelectorOpen(true);
              }}>
                <div className="flex justify-center">
                  <div className={`p-3 rounded-xl ${
                    isVS ? "bg-[#f05a28]/10 text-[#f05a28]" : "bg-cyan-500/10 text-cyan-400"
                  }`}>
                    <Upload className="w-7 h-7" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-200">
                    Déposer votre formulaire PDF ou Image de Scan ici
                  </h3>
                  <p className="text-[11px] text-neutral-450 mt-1">
                    Glissez-déposez ou cliquez pour parcourir • Supports PDF, PNG, JPG
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
                  <Sparkles className="w-3 h-3" />
                  IDÉAL : Détecte automatiquement les traits d'écritures pour générer des zones cliquables
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 font-mono">
              Artboard / Feuille imprimable (A4)
            </span>
            <div className="flex items-center gap-2">
              <button
                id="toggle-dynamic-filling"
                onClick={() => {
                  const NextState = !isDynamicFilling;
                  setIsDynamicFilling(NextState);
                  triggerToast(
                    NextState
                      ? "⚡ Remplissage Dynamique activé : Le texte d'écriture s'ajuste et s'étend automatiquement en créant de nouvelles lignes pour ne rien perdre."
                      : "🔒 Remplissage Dynamique désactivé : Limitation stricte de l'écriture pour correspondre exactement aux lignes statiques prédéfinies."
                  );
                }}
                className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                  isDynamicFilling
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                    : isVS
                      ? "bg-[#252525] border border-red-900/60 text-red-400 hover:bg-[#2c2222]"
                      : "bg-red-50 border border-red-200 text-red-650 hover:bg-red-100"
                }`}
                title="Active ou désactive le passage automatique à la ligne et le déplacement du texte en cas de dépassement."
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isDynamicFilling ? "bg-white animate-pulse" : "bg-red-500"}`} />
                <span>Remplissage Dynamique : {isDynamicFilling ? "Actif" : "Inactif"}</span>
              </button>
              <button
                onClick={fillSampleValues}
                className="px-2.5 py-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-md"
              >
                <Sparkles className="w-3 h-3" />
                Saisie Démo Auto
              </button>
              <button
                onClick={handleClearValues}
                className="px-2.5 py-1 text-[11px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Vider
              </button>
              
              {!isPdfFullscreen && (
                <button
                  onClick={() => setIsPdfFullscreen(true)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                    isVS 
                      ? "bg-[#252525] hover:bg-[#2d2d2d] border border-[#3a3a3a] text-neutral-300" 
                      : "bg-slate-800 hover:bg-slate-700 border border-slate-750 text-slate-100"
                  }`}
                  title="Passer en plein écran"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Plein Écran
                </button>
              )}
            </div>
          </div>

          {/* Form preview canvas styled as real A4 Sheet paper */}
          <div 
            id="print-area-wrapper"
            ref={componentRef}
            className={`w-full bg-white text-neutral-900 border border-neutral-300 rounded-lg p-10 md:p-14 shadow-2xl relative font-sans max-w-[800px] mx-auto ${
              isExporting ? "h-fit" : "min-h-[960px] flex flex-col justify-between"
            }`}
          >
            {/* Elegant corner guide dots mimicking blueprint canvas */}
            <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-neutral-300" />
            <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-neutral-300" />
            <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-neutral-300" />
            <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-neutral-300" />

            {/* Document contents */}
            <div className="document-contents-wrapper">
              {/* Header Title block */}
              <div className="document-header text-center pb-6 mb-8 border-b-2 border-neutral-800">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-center text-2xl font-black tracking-tight text-neutral-900 bg-transparent hover:bg-yellow-50 focus:bg-yellow-50 focus:outline-none border-b border-dashed border-transparent hover:border-yellow-400 p-1 mb-2 h-10 uppercase"
                />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-center text-sm text-neutral-500 bg-transparent hover:bg-yellow-50 focus:bg-yellow-50 focus:outline-none border-b border-dashed border-transparent hover:border-yellow-400 p-1 h-6 italic"
                />
              </div>

              {/* Elements Stack Rendering */}
              <div className="document-elements-stack flex flex-wrap gap-x-4 gap-y-6 w-full">
                {elements.length === 0 ? (
                  <div className="text-center py-24 border border-dashed border-neutral-200 rounded-lg bg-neutral-50 w-full">
                    <p className="text-sm text-neutral-400">Aucun élément dans votre document interactif.</p>
                    <p className="text-xs text-neutral-400 mt-1">Ajoutez des champs depuis le panneau latéral de droite.</p>
                  </div>
                ) : (
                  elements.map((el, idx) => {
                    const isSelected = selectedElementId === el.id;
                    const isFieldEmpty = !formFilledValues[el.id] && !stampedSignatures[el.id];
                    const shouldHideOnExport = isExporting && (el.type === 'input_text' || el.type === 'textarea') && isFieldEmpty;
                    
                    return (
                      <div
                        key={el.id}
                        onClick={() => setSelectedElementId(el.id)}
                        className={`group relative cursor-pointer p-2 rounded-lg transition-all ${
                          isSelected 
                            ? "bg-amber-500/5 ring-2 ring-amber-400/60" 
                            : "hover:bg-neutral-50/70"
                        } ${shouldHideOnExport ? "hidden" : ""} ${
                          el.layoutWidth === "half" ? "w-[calc(50%-0.6rem)]" : 
                          el.layoutWidth === "third" ? "w-[calc(33.33%-0.8rem)]" : "w-full"
                        }`}
                      >
                        {/* Selected label badge indicators */}
                        {isSelected && (
                          <span className="absolute -top-3.5 right-2 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider">
                            {el.type}
                          </span>
                        )}

                        {/* Title type */}
                        {el.type === "title" && (
                          <div className="text-center font-bold text-xl my-2 text-neutral-850">
                            {el.label}
                          </div>
                        )}

                        {/* Section Separator */}
                        {el.type === "section" && (
                          <div className="bg-neutral-100 text-neutral-800 text-xs uppercase font-extrabold px-3 py-1.5 rounded tracking-wide border-l-4 border-neutral-800 my-1 flex justify-between items-center">
                            <span>{el.label}</span>
                            {el.required && <span className="text-xs text-red-500 font-bold">*</span>}
                          </div>
                        )}

                        {/* Plain text block */}
                        {el.type === "text_block" && (
                          <div className="text-xs text-neutral-600 leading-relaxed font-sans pr-1">
                            {el.label}
                          </div>
                        )}

                        {/* Interactive Text field (transforms handwritten rules) */}
                        {el.type === "input_text" && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="text-[13px] font-semibold text-neutral-700 min-w-[200px] max-w-[280px] shrink-0">
                              {el.label}
                              {el.required && <span className="text-red-500 ml-1 font-bold">*</span>}
                            </label>
                            
                            {(() => {
                              const currentVal = formFilledValues[el.id] || "";
                              const limitValue = getLineCharLimit(el.label);
                              const isOverLimit = !isDynamicFilling && currentVal.length >= limitValue;
                              const matchVal = findBestProfileValue(el.label, genericProfile);
                              const isMissingOrDiff = currentVal.trim() !== "" && (!matchVal || matchVal.trim() !== currentVal.trim());
                              
                              return (
                                <div className={`flex-1 border-b transition-colors pb-0.5 relative flex items-center ${
                                  isOverLimit 
                                    ? "border-amber-500 bg-amber-500/5 focus-within:border-amber-600" 
                                    : "border-neutral-400 focus-within:border-amber-500"
                                }`}>
                                                                 {stampedSignatures[el.id] && (
                                    <>
                                      <div 
                                        className="absolute left-6 -top-8 h-12 z-10 pointer-events-none select-none flex items-end"
                                        style={{
                                          transform: `translate(${stampedOffsets[el.id]?.x || 0}px, ${stampedOffsets[el.id]?.y || 0}px)`
                                        }}
                                      >
                                        <img 
                                          src={stampedSignatures[el.id]} 
                                          alt="Sceau de signature" 
                                          className="max-h-full object-contain mix-blend-multiply opacity-95"
                                        />
                                      </div>

                                      <button
                                        type="button"
                                        onPointerDown={(e) => startStampDrag(e, el.id)}
                                        title="Ancre de signature : Cliquez ou touchez ici, puis glissez pour déplacer la signature"
                                        className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 bg-amber-500 text-slate-950 hover:bg-amber-600 rounded-full shadow border border-amber-400 cursor-move transition-all active:scale-110 z-20 print:hidden flex items-center justify-center animate-bounce-short"
                                        style={{ touchAction: "none" }}
                                      >
                                        <Move className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                  
                                  <AutoGrowingTextarea
                                    id={el.id}
                                    value={currentVal}
                                    onChange={(e) => triggerInputFill(el.id, e.target.value)}
                                    placeholder={el.placeholder || "Saisir ici..."}
                                    className="w-full text-sm font-sans text-neutral-900 bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-neutral-350 pr-16 resize-none overflow-hidden min-h-[20px]"
                                    isDynamic={isDynamicFilling}
                                    maxChars={limitValue}
                                  />

                                  {isOverLimit && (
                                    <span 
                                      className="absolute right-8 text-[9px] text-amber-600 font-mono font-bold animate-pulse"
                                      title="Limite de ligne atteinte (Remplissage classique actif)"
                                    >
                                      [STRICT]
                                    </span>
                                  )}

                                  {isMissingOrDiff && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addFieldToGenericProfile(el.label, currentVal);
                                      }}
                                      title="Enregistrer cette valeur dans votre profil générique"
                                      className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-cyan-600 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100 rounded border border-cyan-200 shadow-sm transition-all duration-200 z-20 print:hidden cursor-pointer flex items-center justify-center group/btn gap-1 text-[9px] font-bold"
                                    >
                                      <UserPlus className="w-2.5 h-2.5 animate-pulse" />
                                      <span className="hidden group-hover/btn:inline max-w-0 group-hover/btn:max-w-xs transition-all duration-300 overflow-hidden text-cyan-800 font-sans whitespace-nowrap">Mémoriser</span>
                                    </button>
                                  )}

                                  {stampedSignatures[el.id] && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleClearSignatureOnField(el.id);
                                      }}
                                      title="Retirer la signature"
                                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-red-500 hover:text-red-700 bg-white hover:bg-neutral-100 rounded-full border border-neutral-200 shadow-sm transition z-20 print:hidden cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Interactive Checkbox */}
                        {el.type === "checkbox" && (
                          <div className="flex items-start gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCheck(el.id);
                              }}
                              className={`print-check-box w-5 h-5 mt-0.5 rounded border flex items-center justify-center transition-all cursor-pointer ${
                                formCheckedStates[el.id]
                                  ? "bg-neutral-900 border-neutral-900 text-white font-bold"
                                  : "bg-white border-neutral-400 hover:border-neutral-950 text-transparent"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3px]" />
                            </button>
                            
                            <span 
                              onClick={() => toggleCheck(el.id)}
                              className="text-[13px] text-neutral-700 select-none leading-tight font-medium"
                            >
                              {el.label}
                              {el.required && <span className="text-red-500 ml-1 font-bold">*</span>}
                            </span>
                          </div>
                        )}

                        {/* Interactive textarea paragraph fields */}
                        {el.type === "textarea" && (
                          <div className="space-y-1.5">
                            <label className="text-[13px] font-semibold text-neutral-700 block">
                              {el.label}
                              {el.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <textarea
                              rows={3}
                              value={formFilledValues[el.id] || ""}
                              onChange={(e) => triggerInputFill(el.id, e.target.value)}
                              placeholder={el.placeholder || "Ajoutez des informations supplémentaires..."}
                              className="w-full text-xs font-sans text-neutral-800 bg-neutral-50 hover:bg-neutral-50/50 border border-neutral-200 rounded p-2 outline-none focus:border-neutral-800 placeholder-neutral-400 resize-none"
                            />
                          </div>
                        )}

                        {/* Row reposition helper controls shown on hover */}
                        <div className="absolute right-1 top-1 hidden group-hover:flex items-center gap-1 bg-white border border-neutral-200 rounded shadow px-1 py-0.5 z-10 print:hidden">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => { e.stopPropagation(); handleMoveElement(idx, "up"); }}
                            className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === elements.length - 1}
                            onClick={(e) => { e.stopPropagation(); handleMoveElement(idx, "down"); }}
                            className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteElement(el.id); }}
                            className="p-1 text-red-500 hover:text-red-700 cursor-pointer border-l border-neutral-100 pl-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Right Side: properties sidebar editor, insert tool & smart conversational directives (cols-5) */}
        <div className={isPdfFullscreen
          ? `fixed right-4 top-24 bottom-4 z-55 w-96 shadow-[0_12px_40px_rgba(0,0,0,0.9)] border backdrop-blur-md p-5 rounded-2xl overflow-y-auto transition-all duration-300 ${
              isVS ? "bg-[#1a1a1a]/95 border-[#333333] text-white" : "bg-slate-900/95 border-slate-850 text-slate-100"
            } ${showFullscreenRightMenu ? "opacity-100 translate-x-0 pointer-events-auto scale-100" : "opacity-0 translate-x-12 pointer-events-none scale-95"}`
          : "lg:col-span-5 flex flex-col gap-6"
        }>
          
          {/* Remplissage Automatique Intelligent (Profil Générique) */}
          <div className={`p-4 rounded-xl border relative overflow-hidden ${
            isVS ? "border-[#2d2d2d] bg-[#1e1e1e]" : "border-slate-800 bg-slate-900/40"
          }`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                Remplissage Automatique Intelligent
              </h3>
              <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded uppercase font-bold">
                Évolutif
              </span>
            </div>

            <p className="text-[11px] text-neutral-400 mb-4 leading-relaxed">
              Complétez n'importe quel formulaire instantanément grâce à votre profil de renseignements générique et dynamique.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={fillFromGenericProfile}
                className={`w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer`}
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                Remplir avec mon Profil Générique
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsGenericProfileModalOpen(true)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    isVS 
                      ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2e2e2e]" 
                      : "bg-slate-920 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Gérer mon Profil
                </button>

                <button
                  onClick={() => {
                    const missing = getMissingFieldsForProfile();
                    if (missing.length === 0) {
                      triggerToast("✅ Toutes les saisies du document sont déjà dans votre profil !");
                      return;
                    }
                    setGenericProfile(prev => {
                      const updated = { ...prev };
                      missing.forEach(m => {
                        updated[m.label] = m.value;
                      });
                      return updated;
                    });
                    triggerToast(`✨ ${missing.length} information(s) ajoutée(s) à votre profil générique !`);
                  }}
                  disabled={getMissingFieldsForProfile().length === 0}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isVS 
                      ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2e2e2e]" 
                      : "bg-slate-920 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                  title="Enregistrer toutes les nouvelles informations saisies dans votre profil"
                >
                  <Database className="w-3.5 h-3.5" />
                  Enregistrer Saisies ({getMissingFieldsForProfile().length})
                </button>
              </div>

              {/* Mini Status Grid */}
              <div className={`p-2.5 rounded-lg border flex flex-col gap-1.5 ${
                isVS ? "bg-black/20 border-neutral-850" : "bg-slate-950/20 border-slate-850"
              }`}>
                <div className="flex justify-between items-center text-[10px] text-neutral-400 font-sans">
                  <span>Champs enregistrés :</span>
                  <span className="font-bold text-neutral-200">{Object.keys(genericProfile).length}</span>
                </div>
                
                {/* Auto-save option checkbox */}
                <label className="flex items-center gap-2 cursor-pointer mt-0.5 select-none">
                  <input
                    type="checkbox"
                    checked={autoSaveNewInputsToProfile}
                    onChange={(e) => {
                      setAutoSaveNewInputsToProfile(e.target.checked);
                      triggerToast(e.target.checked 
                        ? "🔄 Apprentissage automatique activé : vos saisies seront ajoutées à votre profil générique."
                        : "⏹️ Apprentissage automatique désactivé."
                      );
                    }}
                    className="rounded border-neutral-400 text-cyan-500 focus:ring-cyan-500/20 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[10px] font-medium text-neutral-300">
                    Apprentissage automatique (sauver mes saisies)
                  </span>
                </label>
              </div>

              {/* Missing inputs warning list */}
              {getMissingFieldsForProfile().length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-550/10 border border-amber-500/20 space-y-1">
                  <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                    Informations prêtes à être mémorisées :
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pt-1">
                    {getMissingFieldsForProfile().map((m, i) => (
                      <span 
                        key={i} 
                        onClick={() => addFieldToGenericProfile(m.label, m.value)}
                        className="text-[9px] font-mono bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1 animate-pulse"
                        title={`Cliquez pour ajouter '${m.label}' à votre profil`}
                      >
                        + {m.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Export Actions Panel */}
          <div className={`p-4 rounded-xl border ${
            isVS ? "border-[#2d2d2d] bg-[#1e1e1e]" : "border-slate-800 bg-slate-900/40"
          }`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-emerald-400" />
              Options de Sortie & Exportation
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handlePrint()}
                className="col-span-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimer / Exporter en PDF A4
              </button>
              
              <button
                onClick={() => {
                  const exportPayload = {
                    title,
                    description,
                    elements,
                    formFilledValues,
                    formCheckedStates,
                    stampedSignatures,
                    stampedOffsets
                  };
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute("download", `${title.replace(/\s+/g, '-').toLowerCase()}-complet.json`);
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                  triggerToast("Données et schéma du formulaire exportés !");
                }}
                className={`py-2 text-[10px] sm:text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  isVS ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2e2e2e]" : "bg-slate-920 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Fichier.json
              </button>
              
              <button
                onClick={() => {
                  const exportPayload = {
                    title,
                    description,
                    elements,
                    formFilledValues,
                    formCheckedStates,
                    stampedSignatures,
                    stampedOffsets
                  };
                  navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
                  triggerToast("Toutes vos données ont été copiées !");
                }}
                className={`py-2 text-[10px] sm:text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  isVS ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2e2e2e]" : "bg-slate-920 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Copier (Out)
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className={`py-2 text-[10px] sm:text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  isVS ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2e2e2e]" : "bg-slate-920 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Importer JSON
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 mt-2.5 text-center leading-relaxed">
              💡 L'impression utilise les styles de page imprimante pour éliminer automatiquement les boutons et adapter la feuille directement au format A4 en HD.
            </p>
          </div>

          {/* Conversational Refiner (Gemini Form Builder Assistant) */}
          <div className={`p-4 rounded-xl border relative overflow-hidden ${
            isVS ? "border-[#2d2d2d] bg-[#1e1e1e]" : "border-slate-800 bg-slate-900/40"
          }`}>
            {/* Ambient decoration light mimicking high-intelligence design tool */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Assistant Intelligent de Structure
              </h3>
              <span className="text-[9px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase font-bold">
                Gemini 2.5
              </span>
            </div>

            <p className="text-[11px] text-neutral-400 mb-3 leading-relaxed">
              Pilotez l'organisation et le contenu de votre formulaire à la voix ou par directives textuelles. Modifiez globalement le document grâce à la puissance du LLM.
            </p>

            <div className="space-y-2">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Exemples : 'Ajoute un bloc Signature de garant', 'Traduis tout le formulaire en anglais', 'Rends obligatoire le champ d'adresse postale'... "
                className={`w-full text-xs p-2.5 rounded-lg outline-none border transition-all resize-none ${
                  isVS 
                    ? "bg-[#252525] border-[#363636] focus:border-[#f05a28] focus:ring-1 focus:ring-[#f05a28]/20 text-neutral-100 placeholder-neutral-500" 
                    : "bg-slate-950 border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 text-slate-100 placeholder-slate-500"
                }`}
                rows={3}
              />
              <button
                onClick={handleConversationalModify}
                disabled={isAiModifying || !aiPrompt.trim()}
                className={`w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isAiModifying ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Ajustement de la structure vectorielle...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Appliquer le Prompt d'Édition
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Insert Elements Block */}
          <div className={`p-4 rounded-xl border ${
            isVS ? "border-[#2d2d2d] bg-[#1e1e1e]" : "border-slate-800 bg-slate-900/40"
          }`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
              <ListPlus className="w-4 h-4 text-cyan-400" />
              Insérer un Champ de Saisie
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAddElement("section")}
                className={`p-2 rounded border text-left text-xs flex items-center gap-2 cursor-pointer hover:border-neutral-500 hover:bg-neutral-800/10 transition-all ${
                  isVS ? "border-[#2b2b2b]" : "border-slate-850"
                }`}
              >
                <div className="w-1.5 h-3 bg-neutral-500 rounded-sm shrink-0" />
                <span>Section Divider</span>
              </button>
              
              <button
                onClick={() => handleAddElement("input_text")}
                className={`p-2 rounded border text-left text-xs flex items-center gap-2 cursor-pointer hover:border-neutral-500 hover:bg-neutral-800/10 transition-all ${
                  isVS ? "border-[#2b2b2b]" : "border-slate-850"
                }`}
              >
                <Type className="w-3.5 h-3.5 text-cyan-400" />
                <span>Champ court</span>
              </button>

              <button
                onClick={() => handleAddElement("checkbox")}
                className={`p-2 rounded border text-left text-xs flex items-center gap-2 cursor-pointer hover:border-neutral-500 hover:bg-neutral-800/10 transition-all ${
                  isVS ? "border-[#2b2b2b]" : "border-slate-850"
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#ff9a00]" />
                <span>Case à cocher</span>
              </button>

              <button
                onClick={() => handleAddElement("textarea")}
                className={`p-2 rounded border text-left text-xs flex items-center gap-2 cursor-pointer hover:border-neutral-500 hover:bg-neutral-800/10 transition-all ${
                  isVS ? "border-[#2b2b2b]" : "border-slate-850"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zone Paragraphe</span>
              </button>

              <button
                onClick={() => handleAddElement("text_block")}
                className={`p-2 rounded border text-left text-xs flex items-center gap-2 cursor-pointer hover:border-neutral-500 hover:bg-neutral-800/10 transition-all col-span-2 ${
                  isVS ? "border-[#2b2b2b]" : "border-slate-850"
                }`}
              >
                <FileUp className="w-3.5 h-3.5 text-purple-400" />
                <span>Texte Explicatif Libre / Clauses</span>
              </button>
            </div>
          </div>

          {/* Sidebar Active Segment Properties Editor */}
          {activeElement ? (
            <div className={`p-4 rounded-xl border ${
              isVS ? "border-[#2d2d2d] bg-[#222222]" : "border-slate-800 bg-slate-900/60"
            }`}>
              <div className="flex items-center justify-between mb-3 border-b border-neutral-700/30 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-amber-500" />
                  Propriétés de l'élément sélectionné
                </h3>
                <button
                  onClick={() => handleDeleteElement(activeElement.id)}
                  className="text-red-400 hover:text-red-500 text-xs flex items-center gap-0.5 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Retirer
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                
                {/* Field Label / Text */}
                <div className="space-y-1">
                  <label className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider block">Libellé / Texte de consigne</label>
                  <input
                    type="text"
                    value={activeElement.label}
                    onChange={(e) => handleUpdateElement({ ...activeElement, label: e.target.value })}
                    className={`w-full p-2 rounded border outline-none ${
                      isVS ? "bg-[#181818] border-[#3a3a3a] text-neutral-100" : "bg-slate-950 border-slate-800 text-slate-100"
                    }`}
                  />
                </div>

                {/* Placeholder (only text inputs / area) */}
                {(activeElement.type === "input_text" || activeElement.type === "textarea") && (
                  <div className="space-y-1">
                    <label className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider block">Indice de saisie (Placeholder)</label>
                    <input
                      type="text"
                      value={activeElement.placeholder || ""}
                      onChange={(e) => handleUpdateElement({ ...activeElement, placeholder: e.target.value })}
                      className={`w-full p-2 rounded border outline-none ${
                        isVS ? "bg-[#181818] border-[#3a3a3a] text-neutral-100" : "bg-slate-950 border-slate-800 text-slate-100"
                      }`}
                    />
                  </div>
                )}

                {/* Required Flag / Checked Flag for checkboxes */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Configuration complémentaire</span>
                  
                  {activeElement.type === "checkbox" ? (
                    <button
                      onClick={() => handleUpdateElement({ ...activeElement, checked: !activeElement.checked })}
                      className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold cursor-pointer transition-all ${
                        activeElement.checked
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-neutral-800 text-neutral-400 border border-transparent"
                      }`}
                    >
                      Coché par défaut
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateElement({ ...activeElement, required: !activeElement.required })}
                      className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold cursor-pointer transition-all ${
                        activeElement.required
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : "bg-neutral-800 text-neutral-400 border border-transparent"
                      }`}
                    >
                      Obligatoire ({activeElement.required ? "Oui" : "Non"})
                    </button>
                  )}
                </div>

                {/* Type converter dropdown */}
                <div className="space-y-1 border-t border-neutral-700/30 pt-3.5">
                  <label className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider block">Convertir le type de champ</label>
                  <ThemedSelect
                    value={activeElement.type}
                    onChange={(val) => handleUpdateElement({ ...activeElement, type: val as any })}
                    options={[
                      { value: "section", label: "Titre de Partie / Séparateur" },
                      { value: "input_text", label: "Ligne de saisie (Texte Court)" },
                      { value: "checkbox", label: "Case à cocher (Interactive)" },
                      { value: "textarea", label: "Cadre de commentaire (Paragraphe)" },
                      { value: "text_block", label: "Texte de corps classique / Mentions" },
                    ]}
                    isVS={isVS}
                    size="sm"
                  />
                </div>

                <div className="flex gap-1 pt-2">
                  <button
                    disabled={elements.findIndex(el => el.id === activeElement.id) === 0}
                    onClick={() => handleMoveElement(elements.findIndex(el => el.id === activeElement.id), "up")}
                    className={`flex-1 py-1 px-2 border rounded hover:bg-neutral-800 flex items-center justify-center gap-1 cursor-pointer text-[10px] font-bold ${
                      isVS ? "border-neutral-700 text-neutral-300" : "border-slate-800 text-slate-350"
                    }`}
                  >
                    <ChevronUp className="w-3 h-3" /> Remonter
                  </button>
                  <button
                    disabled={elements.findIndex(el => el.id === activeElement.id) === elements.length - 1}
                    onClick={() => handleMoveElement(elements.findIndex(el => el.id === activeElement.id), "down")}
                    className={`flex-1 py-1 px-2 border rounded hover:bg-neutral-800 flex items-center justify-center gap-1 cursor-pointer text-[10px] font-bold ${
                      isVS ? "border-neutral-700 text-neutral-300" : "border-slate-800 text-slate-350"
                    }`}
                  >
                    <ChevronDown className="w-3 h-3" /> Descendre
                  </button>
                </div>

              </div>
            </div>
          ) : (
            <div className={`p-8 text-center border border-dashed rounded-xl ${
              isVS ? "border-neutral-800 bg-[#1e1e1e]/20" : "border-slate-900 bg-slate-900/5"
            }`}>
              <HelpCircle className="w-8 h-8 mx-auto mb-2 text-neutral-500 shrink-0" />
              <p className="text-xs text-neutral-400">Aucun élément sélectionné</p>
              <p className="text-[10px] text-neutral-500 mt-1">Sélectionnez une zone sur l'A4 de gauche pour l'éditer ici.</p>
            </div>
          )}

          {/* Signature Library & Manual Stylus Draw Panel */}
          <div className={`p-4 rounded-xl border ${
            isVS ? "border-[#2d2d2d] bg-[#1e1e1e]" : "border-slate-800 bg-slate-900/40"
          }`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5 flex items-center gap-1.5 border-b border-[#2d2d2d] pb-2">
              <Edit3 className="w-4 h-4 text-amber-500" />
              Bibliothèque de Signatures & Cachets
            </h3>

            {/* Canvas for tracing custom signature drawing */}
            <div className="space-y-3">
              <div>
                <label className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider block mb-1.5">
                  Tracer votre signature ci-dessous (souris ou tactile) :
                </label>
                <div className="relative border border-neutral-700 bg-white rounded-lg overflow-hidden h-[130px] shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={450}
                    height={150}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    onPointerCancel={stopDrawing}
                    className="w-full h-full cursor-crosshair bg-white touch-none"
                  />
                  <div className="absolute top-1 right-1 flex gap-1 print:hidden">
                    <button
                      type="button"
                      onClick={() => setIsSignatureModalOpen(true)}
                      className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-[9px] font-bold rounded shadow-sm transition cursor-pointer flex items-center gap-1 border border-neutral-700"
                    >
                      <Maximize2 className="w-2.5 h-2.5" /> Agrandir
                    </button>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="px-2 py-1 bg-neutral-800/90 hover:bg-neutral-800 text-neutral-300 text-[9px] font-bold rounded shadow-sm hover:text-white transition cursor-pointer"
                    >
                      Effacer
                    </button>
                    <button
                      type="button"
                      onClick={saveSignature}
                      className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[9px] font-black rounded shadow-sm transition cursor-pointer"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-neutral-500 mt-1 italic">
                  Dessinez d'un ou plusieurs traits libres et cliquez sur Enregistrer pour l'ajouter à votre collection. Usez de l'écran géant pour plus de confort.
                </p>
              </div>

              {/* List of saved signatures */}
              <div className="border-t border-neutral-700/20 pt-2.5">
                <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider block mb-2">
                  Vos signatures enregistrées ({signatureLibrary.length}) :
                </span>

                {signatureLibrary.length === 0 ? (
                  <div className="p-3 bg-neutral-900/30 border border-dashed border-neutral-800 rounded-lg text-center text-[11px] text-neutral-500">
                    Aucune signature dans la bibliothèque.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {signatureLibrary.map((sig, sigIdx) => {
                      const canStampActive = activeElement && activeElement.type === "input_text";
                      
                      return (
                        <div 
                          key={sigIdx}
                          className="group relative border border-neutral-300 hover:border-amber-500 rounded-lg bg-white p-2 flex flex-col items-center justify-center h-[75px] shadow-sm hover:shadow transition-all"
                        >
                          <img 
                            src={sig} 
                            alt={`Signature ${sigIdx + 1}`} 
                            className="max-h-[50px] max-w-full object-contain mix-blend-multiply" 
                          />
                          
                          {/* Apply stamps buttons overlay */}
                          <div className="absolute inset-x-0 bottom-0 bg-neutral-950/90 rounded-lg opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity p-1.5 h-full">
                            {canStampActive ? (
                              <button
                                type="button"
                                onClick={() => handleApplySignature(activeElement.id, sig)}
                                className="w-full py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[9px] text-center font-black rounded shadow transition cursor-pointer"
                              >
                                Apposer ici
                              </button>
                            ) : (
                              <span className="text-[8px] text-neutral-300 text-center leading-normal">
                                Sélectionnez un champ court pour l'apposer
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedSignature(sigIdx)}
                              className="text-red-400 hover:text-red-500 text-[8px] font-bold"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
      )}

      {pdfActiveTab === "editeur" && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-24 flex flex-col min-h-[500px]">
          {!annotationPdfDoc ? (
            /* Uploader Area */
            <div className={`flex flex-col items-center justify-center p-12 min-h-[400px] rounded-2xl border-2 border-dashed text-center transition-all duration-200 ${
              isVS ? "border-[#2b2b2b] bg-[#1e1e1e]/25" : "border-slate-800 bg-slate-900/10"
            }`}>
              <div className={`p-5 rounded-full mb-4 ${
                isVS ? "bg-[#f05a28]/10 text-[#f05a28]" : "bg-cyan-500/10 text-cyan-400"
              }`}>
                <Upload className="w-10 h-10 animate-bounce" />
              </div>
              <h3 className="text-base font-black text-neutral-200 mb-2 font-sans">UPLOADEZ VOTRE DOCUMENT PDF</h3>
              <p className="text-xs text-neutral-450 max-w-sm mb-6 leading-relaxed">
                Glissez-déposez un fichier PDF ici, ou cliquez sur le bouton ci-dessous pour le visionner et l'annoter avec vos outils de dessin vectoriel.
              </p>
              
              <label className={`px-5 py-3 text-xs font-black uppercase rounded-xl shadow-lg hover:shadow-xl hover:scale-102 transition duration-200 cursor-pointer flex items-center gap-2 ${
                isVS 
                  ? "bg-gradient-to-r from-[#f05a28] to-[#ff7a00] text-neutral-100" 
                  : "bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-extrabold"
              }`}>
                <FileUp className="w-4 h-4" />
                Sélectionner un PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleAnnotationFileChange}
                />
              </label>
            </div>
          ) : (
             /* PDF Annotator Workspace Grid */
             <div className={isPdfFullscreen
               ? "flex-1 w-full h-full relative overflow-hidden flex flex-col"
               : "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
             }>
               
               {/* Left Side: Toolbar & Configuration Panel (cols-4) */}
               <div className={isPdfFullscreen
                 ? `fixed left-4 top-24 bottom-4 z-55 w-80 shadow-[0_12px_40px_rgba(0,0,0,0.9)] border backdrop-blur-md p-5 rounded-2xl overflow-y-auto transition-all duration-300 ${
                     isVS ? "bg-[#1a1a1a]/95 border-[#333333] text-white" : "bg-slate-900/95 border-slate-850 text-slate-100"
                   } ${showFullscreenLeftMenu ? "opacity-100 translate-x-0 pointer-events-auto scale-100" : "opacity-0 -translate-x-12 pointer-events-none scale-95"}`
                 : "lg:col-span-4 flex flex-col gap-4"
               }>
                
                {/* Information Header card */}
                {!isPdfFullscreen && (
                <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
                  isVS ? "border-[#2b2b2b] bg-[#1e1e1e]" : "border-slate-800 bg-slate-900/60"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-450 font-mono">Fichier Actif</span>
                    <button
                      onClick={() => {
                        if (confirm("Voulez-vous charger un autre fichier PDF ? Vos modifications en cours seront perdues.")) {
                          setAnnotationPdfDoc(null);
                          setAnnotationPdfFile(null);
                          setAnnotationStrokes({});
                          setUndoHistory({});
                          setRedoHistory({});
                        }
                      }}
                      className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300 font-mono cursor-pointer transition-colors"
                    >
                      Changer
                    </button>
                  </div>
                  <h4 className="text-xs font-bold text-neutral-200 truncate max-w-full">
                    {annotationPdfFile?.name}
                  </h4>
                  <div className="flex gap-2 text-[9px] text-neutral-500 font-mono font-bold">
                    <span>PAGES : {annotationNumPages}</span>
                    <span>•</span>
                    <span>TAILLE : {(annotationPdfFile ? (annotationPdfFile.size / 1024 / 1024).toFixed(2) : 0)} MO</span>
                  </div>
                </div>
                )}

                {/* Toolbar Selector (simplified draw tools) */}
                <div className={`p-5 rounded-xl border flex flex-col gap-5 ${
                  isVS ? "border-[#2b2b2b] bg-[#1e1e1e]" : "border-slate-800 bg-slate-900/60"
                }`}>
                  {/* Tool selection list */}
                  <div>
                    <h4 className="text-[10px] uppercase font-bold tracking-wider text-neutral-455 mb-3 block font-mono">
                      Outils de Dessin & Annotation
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setActiveDrawingTool("main")}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-bold cursor-pointer transition-all col-span-2 ${
                          activeDrawingTool === "main"
                            ? isVS
                              ? "bg-[#f05a28]/10 border-[#f05a28] text-white"
                              : "bg-cyan-500/10 border-cyan-500 text-cyan-300"
                            : "border-neutral-800 hover:bg-[#252525] text-neutral-400"
                        }`}
                      >
                        <Hand className="w-4 h-4 text-emerald-400" />
                        Main / Déplacer le Document
                      </button>

                      <button
                        onClick={() => setActiveDrawingTool("plume")}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-bold cursor-pointer transition-all ${
                          activeDrawingTool === "plume"
                            ? isVS
                              ? "bg-[#f05a28]/10 border-[#f05a28] text-white"
                              : "bg-cyan-500/10 border-cyan-500 text-cyan-300"
                            : "border-neutral-800 hover:bg-[#252525] text-neutral-400"
                        }`}
                      >
                        <PenTool className="w-4 h-4 text-[#f05a28]" />
                        Stylo Plume
                      </button>
                      
                      <button
                        onClick={() => setActiveDrawingTool("bille")}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-bold cursor-pointer transition-all ${
                          activeDrawingTool === "bille"
                            ? isVS
                              ? "bg-[#f05a28]/10 border-[#f05a28] text-white"
                              : "bg-cyan-500/10 border-cyan-500 text-cyan-300"
                            : "border-neutral-800 hover:bg-[#252525] text-neutral-400"
                        }`}
                      >
                        <Edit3 className="w-4 h-4 text-blue-500" />
                        Stylo Bille
                      </button>

                      <button
                        onClick={() => setActiveDrawingTool("surligneur")}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-bold cursor-pointer transition-all ${
                          activeDrawingTool === "surligneur"
                            ? isVS
                              ? "bg-[#f05a28]/10 border-[#f05a28] text-white"
                              : "bg-cyan-500/10 border-cyan-500 text-cyan-300"
                            : "border-neutral-800 hover:bg-[#252525] text-neutral-400"
                        }`}
                      >
                        <Highlighter className="w-4 h-4 text-yellow-500" />
                        Surligneur
                      </button>

                      <button
                        onClick={() => setActiveDrawingTool("gomme")}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-bold cursor-pointer transition-all ${
                          activeDrawingTool === "gomme"
                            ? isVS
                              ? "bg-[#f05a28]/10 border-[#f05a28] text-white"
                              : "bg-cyan-500/10 border-cyan-500 text-cyan-300"
                            : "border-neutral-800 hover:bg-[#252525] text-neutral-400"
                        }`}
                      >
                        <Eraser className="w-4 h-4 text-rose-500" />
                        Gomme
                      </button>
                    </div>
                  </div>

                  {/* Colors - only visible if drawing and not Eraser */}
                  {activeDrawingTool !== "gomme" && activeDrawingTool !== "main" && (
                    <div className="border-t border-neutral-800/40 pt-4">
                      <h4 className="text-[10px] uppercase font-bold tracking-wider text-neutral-455 mb-3 block font-mono">
                        Couleur d'Encre
                      </h4>
                      <div className="flex items-center gap-3">
                        {[
                          { color: "#111827", name: "Noir", bgClass: "bg-neutral-900 border-neutral-700" },
                          { color: "#2563eb", name: "Bleu", bgClass: "bg-blue-600 border-blue-400" },
                          { color: "#dc2626", name: "Rouge", bgClass: "bg-red-600 border-red-400" },
                          { color: "#16a34a", name: "Vert", bgClass: "bg-green-600 border-green-400" },
                          { color: "#eab308", name: "Jaune", bgClass: "bg-yellow-500 border-yellow-300" }
                        ].map((c) => (
                          <button
                            key={c.color}
                            onClick={() => setDrawingColor(c.color)}
                            title={c.name}
                            className={`w-8 h-8 rounded-full cursor-pointer border transition-all ${c.bgClass} ${
                              drawingColor === c.color 
                                ? "ring-2 ring-offset-2 ring-offset-[#1e1e1e] ring-cyan-500 scale-110" 
                                : "hover:scale-105"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stroke thickness - only visible if drawing/erasing */}
                  {activeDrawingTool !== "main" && (
                    <div className="border-t border-neutral-800/40 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] uppercase font-bold tracking-wider text-neutral-455 font-mono">
                          Épaisseur du tracé
                        </h4>
                        <span className="text-[10px] font-bold text-neutral-300 font-mono">{drawingThickness} px</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={drawingThickness}
                          onChange={(e) => setDrawingThickness(parseInt(e.target.value))}
                          className="flex-1 accent-cyan-500 h-1 bg-neutral-800 rounded-lg cursor-pointer"
                        />
                        <div className="w-8 h-8 rounded border border-neutral-800 flex items-center justify-center bg-black/40 shrink-0">
                          <div 
                            className="rounded-full transition-all" 
                            style={{ 
                              width: `${Math.max(2, Math.min(20, drawingThickness))}px`, 
                              height: `${Math.max(2, Math.min(20, drawingThickness))}px`,
                              backgroundColor: activeDrawingTool === "gomme" ? "#f43f5e" : drawingColor 
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="border-t border-neutral-800/40 pt-4 grid grid-cols-3 gap-2">
                    <button
                      onClick={handleUndo}
                      disabled={!(annotationStrokes[annotationCurrentPage]?.length > 0)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-[10px] font-bold transition-all ${
                        annotationStrokes[annotationCurrentPage]?.length > 0
                          ? "border-neutral-850 hover:bg-[#252525] text-neutral-200 cursor-pointer"
                          : "border-neutral-900/60 text-neutral-600 cursor-not-allowed"
                      }`}
                      title="Annuler le dernier tracé"
                    >
                      <Undo2 className="w-4 h-4 mb-1" />
                      Annuler
                    </button>

                    <button
                      onClick={handleRedo}
                      disabled={!(redoHistory[annotationCurrentPage]?.length > 0)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-[10px] font-bold transition-all ${
                        redoHistory[annotationCurrentPage]?.length > 0
                          ? "border-neutral-850 hover:bg-[#252525] text-neutral-200 cursor-pointer"
                          : "border-neutral-900/60 text-neutral-600 cursor-not-allowed"
                      }`}
                      title="Rétablir le tracé"
                    >
                      <Redo2 className="w-4 h-4 mb-1" />
                      Rétablir
                    </button>

                    <button
                      onClick={handleClearPage}
                      disabled={!(annotationStrokes[annotationCurrentPage]?.length > 0)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-[10px] font-bold text-red-400 transition-all ${
                        annotationStrokes[annotationCurrentPage]?.length > 0
                          ? "border-neutral-850 hover:bg-red-950/25 text-red-400 hover:border-red-900 cursor-pointer"
                          : "border-neutral-900/60 text-neutral-600 cursor-not-allowed"
                      }`}
                      title="Tout effacer sur cette page"
                    >
                      <Trash2 className="w-4 h-4 mb-1" />
                      Effacer
                    </button>
                  </div>
                </div>

                {/* Main Download Button */}
                <button
                  onClick={downloadAnnotatedPdf}
                  className={`w-full py-4 text-xs font-black uppercase rounded-xl shadow-lg hover:shadow-xl hover:scale-102 transition flex items-center justify-center gap-2.5 cursor-pointer ${
                    isVS 
                      ? "bg-gradient-to-r from-[#f05a28] to-[#ff7a00] text-neutral-100" 
                      : "bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950"
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Exporter le PDF Annoté
                </button>
              </div>

              {/* Right Side: Interactive PDF Render Viewport (cols-8) */}
              <div 
                ref={scrollContainerRef}
                className={isPdfFullscreen
                  ? "w-full h-full overflow-auto relative flex-1 bg-[#090909] select-none"
                  : "lg:col-span-8 flex flex-col gap-4"
                }
              >
                <div className={isPdfFullscreen 
                  ? "min-w-full min-h-full flex flex-col items-center justify-start p-6 md:p-16 gap-6" 
                  : "w-full flex flex-col gap-4"
                }>
                  
                  {/* Page Selection Bar */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between w-full ${
                    isPdfFullscreen ? "max-w-4xl" : ""
                  } ${
                    isVS ? "border-[#2b2b2b] bg-[#1e1e1e]" : "border-slate-800 bg-slate-900/60"
                  }`}>
                    <button
                      onClick={() => setAnnotationCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={annotationCurrentPage === 1}
                      className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                        annotationCurrentPage === 1
                          ? "border-neutral-900/60 text-neutral-600 cursor-not-allowed"
                          : "border-neutral-800 hover:bg-[#252525] text-neutral-300 cursor-pointer"
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Précédent
                    </button>

                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-neutral-200 font-sans">
                          Page {annotationCurrentPage} sur {annotationNumPages}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-neutral-550 uppercase mt-0.5 tracking-wider">
                          {(annotationStrokes[annotationCurrentPage]?.length || 0)} TRACÉS ACTIFS
                        </span>
                      </div>
                      
                      {/* Integrated Zoom Controls */}
                      <div className={`flex items-center gap-1 border rounded-lg p-0.5 ${
                        isVS ? "border-neutral-800 bg-black/40" : "border-slate-850 bg-slate-950/40"
                      }`}>
                        <button
                          onClick={() => setAnnotationScale(prev => Math.max(0.6, prev - 0.2))}
                          className="px-2 py-1 rounded hover:bg-[#252525] text-neutral-400 hover:text-white transition-all font-mono font-bold text-xs cursor-pointer"
                          title="Zoomer Arrière"
                        >
                          -
                        </button>
                        <span className="text-[10px] font-mono font-bold text-neutral-300 px-1 min-w-[36px] text-center">
                          {Math.round(annotationScale * 100)}%
                        </span>
                        <button
                          onClick={() => setAnnotationScale(prev => Math.min(3.5, prev + 0.2))}
                          className="px-2 py-1 rounded hover:bg-[#252525] text-neutral-400 hover:text-white transition-all font-mono font-bold text-xs cursor-pointer"
                          title="Zoomer Avant"
                        >
                          +
                        </button>
                      </div>

                      {!isPdfFullscreen && (
                        <button
                          onClick={() => setIsPdfFullscreen(true)}
                          className={`p-1.5 rounded-lg border text-neutral-400 hover:text-white transition-all cursor-pointer ${
                            isVS ? "border-neutral-800 hover:bg-[#252525]" : "border-slate-800 hover:bg-slate-900/60"
                          }`}
                          title="Passer en plein écran"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setAnnotationCurrentPage(prev => Math.min(annotationNumPages, prev + 1))}
                      disabled={annotationCurrentPage === annotationNumPages}
                      className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                        annotationCurrentPage === annotationNumPages
                          ? "border-neutral-900/60 text-neutral-600 cursor-not-allowed"
                          : "border-neutral-800 hover:bg-[#252525] text-neutral-300 cursor-pointer"
                      }`}
                    >
                      Suivant
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* PDF rendering area sheet container */}
                  <div className={isPdfFullscreen 
                    ? "pb-6 flex justify-center w-full" 
                    : "w-full overflow-x-auto pb-4 flex justify-center"
                  }>
                    <div 
                      className="relative shrink-0 shadow-2xl border border-neutral-800 bg-white rounded-xl overflow-hidden" 
                      style={{ 
                        width: pdfDimensions.width ? `${pdfDimensions.width}px` : "auto", 
                        height: pdfDimensions.height ? `${pdfDimensions.height}px` : "auto",
                        minHeight: "400px" 
                      }}
                    >
                      
                      {/* Native underlaid canvas */}
                      <canvas
                        ref={annotatorCanvasRef}
                        className="block bg-white"
                      />

                      {/* Annotation vector drawing overlay */}
                      <canvas
                        ref={drawingCanvasRef}
                        onMouseDown={startAnnotatorDrawing}
                        onMouseMove={drawAnnotator}
                        onMouseUp={stopAnnotatorDrawing}
                        onMouseLeave={stopAnnotatorDrawing}
                        onTouchStart={startAnnotatorDrawing}
                        onTouchMove={drawAnnotator}
                        onTouchEnd={stopAnnotatorDrawing}
                        className={`absolute top-0 left-0 w-full h-full touch-none ${
                          activeDrawingTool === "main"
                            ? isHandPanning
                              ? "cursor-grabbing"
                              : "cursor-grab"
                            : "cursor-crosshair"
                        }`}
                      />

                      {/* Loader overlay */}
                      {isPdfLoading && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20 transition-all">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mb-3" />
                          <span className="text-xs font-bold text-neutral-300 font-mono uppercase tracking-widest animate-pulse">
                            Moteur PDF Actif...
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clickable Quick Thumbnail Page Strip */}
                  <div className={`p-3 rounded-xl border transition-all duration-300 w-full ${
                    isPdfFullscreen ? "max-w-4xl" : ""
                  } ${
                    isVS ? "border-[#2b2b2b] bg-[#1e1e1e]/40" : "border-slate-800 bg-slate-900/30"
                  }`}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        Accès Rapide aux Pages {!showPageStrip && `(${annotationNumPages})`}
                      </h4>
                      <button
                        onClick={() => setShowPageStrip(!showPageStrip)}
                        className={`p-1 rounded-md border transition-all cursor-pointer ${
                          isVS ? "border-neutral-800 hover:bg-[#252525] text-neutral-400 hover:text-white" : "border-slate-800 hover:bg-slate-900/60 text-slate-400 hover:text-white"
                        }`}
                        title={showPageStrip ? "Masquer le bandeau de pages" : "Afficher le bandeau de pages"}
                      >
                        {showPageStrip ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    
                    {showPageStrip && (
                      <div className="flex gap-2 overflow-x-auto pt-3 pb-1">
                        {Array.from({ length: annotationNumPages }).map((_, idx) => {
                          const pageNum = idx + 1;
                          const hasAnnotations = (annotationStrokes[pageNum]?.length || 0) > 0;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setAnnotationCurrentPage(pageNum)}
                              className={`min-w-16 h-16 rounded-lg border flex flex-col justify-between p-2 cursor-pointer transition-all ${
                                annotationCurrentPage === pageNum
                                  ? isVS
                                    ? "bg-[#f05a28]/10 border-[#f05a28] text-white ring-1 ring-[#f05a28]"
                                    : "bg-cyan-500/10 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500"
                                  : "bg-[#181818] border-neutral-850 hover:border-neutral-700 text-neutral-400"
                              }`}
                            >
                              <span className="text-[9px] font-bold font-mono">P. {pageNum}</span>
                              {hasAnnotations && (
                                <span className="text-[8px] bg-cyan-500/15 text-cyan-400 px-1 py-0.5 rounded font-mono font-bold uppercase shrink-0 self-end">
                                  ★ {annotationStrokes[pageNum].length}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </div>
          )}
        </div>
      )}

      {/* --- PDF CONVERTER TAB --- */}
      {pdfActiveTab === "convertisseur" && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-24 flex flex-col gap-6 font-sans">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Panel: Conversion Parameters */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              <div className={`p-5 rounded-2xl border ${
                isVS ? "bg-[#1e1e1e] border-[#2d2d2d]" : "bg-slate-900 border-slate-800"
              } shadow-lg`}>
                <h3 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#f05a28]" />
                  Paramètres d'Exportation
                </h3>

                {/* File Dropzone / Indicator */}
                <div className="mb-5">
                  <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-2 font-mono">
                    Document Source
                  </label>
                  {converterFile ? (
                    <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      isVS ? "bg-[#121212] border-[#2b2b2b]" : "bg-slate-950 border-slate-850"
                    }`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-4 h-4 shrink-0 text-[#f05a28]" />
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold truncate text-neutral-200">{converterFile.name}</p>
                          <p className="text-[9px] font-mono text-neutral-500">{converterNumPages} pages • {(converterFile.size / (1024 * 1024)).toFixed(2)} Mo</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setConverterFile(null);
                          setConverterDoc(null);
                          setConverterNumPages(0);
                          setConvertedImages([]);
                        }}
                        className="text-neutral-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10 cursor-pointer"
                        title="Retirer le document"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "application/pdf";
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setConverterFile(file);
                            loadConverterPdf(file);
                          }
                        };
                        input.click();
                      }}
                      className={`p-6 rounded-xl border-2 border-dashed text-center cursor-pointer hover:border-[#f05a28] transition-all ${
                        isVS ? "bg-[#121212] border-neutral-800 text-neutral-400" : "bg-slate-950 border-slate-850 text-slate-400"
                      }`}
                    >
                      <Upload className="w-6 h-6 mx-auto mb-2 text-neutral-500 animate-bounce" />
                      <p className="text-xs font-bold text-neutral-300">Cliquer pour charger un PDF</p>
                      <p className="text-[9px] text-neutral-500 mt-1">Glisser-déposer disponible également</p>
                    </div>
                  )}
                </div>

                {/* Export Format Select */}
                <div className="mb-5">
                  <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-2 font-mono">
                    Format de Destination
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-neutral-400">Formats d'Images Standards :</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(["png", "jpeg", "webp"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            onClick={() => setExportFormat(fmt)}
                            className={`py-2 text-[10px] font-black rounded-lg transition-all border uppercase cursor-pointer ${
                              exportFormat === fmt
                                ? isVS
                                  ? "bg-[#f05a28] border-[#f05a28] text-white"
                                  : "bg-cyan-500 border-cyan-500 text-slate-950 font-extrabold"
                                : isVS
                                  ? "bg-[#121212] border-neutral-800 text-neutral-400 hover:text-white"
                                  : "bg-slate-950 border-slate-850 text-slate-400 hover:text-white"
                            }`}
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-2.5">
                      <span className="text-[9px] font-bold text-neutral-400">Format d'Archivage Conforme (ISO) :</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => {
                            setExportFormat("pdfa1b");
                            handleConvertToPDFA("pdfa1b");
                          }}
                          disabled={isConvertingToPDFA}
                          className={`py-2 text-[10px] font-black rounded-lg transition-all border uppercase cursor-pointer flex flex-col items-center justify-center ${
                            exportFormat === "pdfa1b"
                              ? "bg-[#f05a28] border-[#f05a28] text-white"
                              : isVS
                                ? "bg-[#121212] border-neutral-800 text-neutral-300 hover:text-white"
                                : "bg-slate-950 border-slate-850 text-slate-300 hover:text-white"
                          }`}
                        >
                          <span>PDF/A-1b</span>
                          <span className="text-[8px] opacity-75 font-normal">ISO 19005-1 (Archivage simple)</span>
                        </button>
                        <button
                          onClick={() => {
                            setExportFormat("pdfa2b");
                            handleConvertToPDFA("pdfa2b");
                          }}
                          disabled={isConvertingToPDFA}
                          className={`py-2 text-[10px] font-black rounded-lg transition-all border uppercase cursor-pointer flex flex-col items-center justify-center ${
                            exportFormat === "pdfa2b"
                              ? "bg-[#f05a28] border-[#f05a28] text-white"
                              : isVS
                                ? "bg-[#121212] border-neutral-800 text-neutral-300 hover:text-white"
                                : "bg-slate-950 border-slate-850 text-slate-300 hover:text-white"
                          }`}
                        >
                          <span>PDF/A-2b</span>
                          <span className="text-[8px] opacity-75 font-normal">ISO 19005-2 (Nouveau standard)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DPI Resolution Selector (only for image formats) */}
                {["png", "jpeg", "webp"].includes(exportFormat) && (
                  <div className="mb-5">
                    <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-2 font-mono">
                      Résolution de Rendu (DPI)
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([150, 300, 600] as const).map((dpi) => (
                        <button
                          key={dpi}
                          onClick={() => setExportDPI(dpi)}
                          className={`py-1.5 text-[10px] font-black rounded-lg transition-all border cursor-pointer ${
                            exportDPI === dpi
                              ? isVS
                                ? "bg-[#f05a28] border-[#f05a28] text-white"
                                : "bg-cyan-500 border-cyan-500 text-slate-950"
                              : isVS
                                ? "bg-[#121212] border-[#2b2b2b] text-neutral-400 hover:text-white"
                                : "bg-slate-950 border-slate-850 text-slate-400 hover:text-white"
                          }`}
                        >
                          {dpi} DPI
                          <span className="text-[8px] block font-mono font-normal">
                            {dpi === 150 ? "Basse" : dpi === 300 ? "Haute" : "Ultra"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Page Selection Selector (only for image formats) */}
                {["png", "jpeg", "webp"].includes(exportFormat) && (
                  <div className="mb-6">
                    <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-2 font-mono">
                      Sélection des Pages
                    </label>
                    <div className="space-y-2.5">
                      <ThemedSelect
                        value={converterPageRange}
                        onChange={(val) => setConverterPageRange(val)}
                        options={[
                          { value: "all", label: `Toutes les pages (${converterNumPages})` },
                          { value: "current", label: "Uniquement la première page" },
                          { value: "custom", label: "Sélection personnalisée..." },
                        ]}
                        isVS={isVS}
                        size="sm"
                      />

                      {converterPageRange === "custom" && (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={customRangeString}
                            onChange={(e) => setCustomRangeString(e.target.value)}
                            placeholder="ex: 1-3, 5, 7"
                            className={`w-full p-2 text-xs rounded-lg border outline-none ${
                              isVS ? "bg-[#121212] border-[#2d2d2d] text-white focus:border-[#f05a28]" : "bg-slate-950 border-slate-850 text-white focus:border-cyan-500"
                            }`}
                          />
                          <p className="text-[9px] text-neutral-500 leading-normal font-sans">
                            Séparez les pages par des virgules et les plages par des tirets. Exemple : <code className="font-mono bg-[#1c1c1c] p-0.5 rounded text-neutral-300">1-3, 5, 8</code>.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Main Conversion Trigger */}
                {["png", "jpeg", "webp"].includes(exportFormat) ? (
                  <button
                    onClick={handleConvertPDF}
                    disabled={isConverting || !converterFile}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                      isConverting || !converterFile
                        ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                        : isVS
                          ? "bg-gradient-to-r from-[#f05a28] to-[#ff7a00] hover:brightness-110 text-white"
                          : "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:brightness-110"
                    }`}
                  >
                    {isConverting ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                        Traitement en cours ({conversionProgress}%)
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Lancer la Conversion d'Images
                      </>
                    )}
                  </button>
                ) : (
                  <div className={`p-3 rounded-xl text-center text-[10px] leading-normal ${
                    isVS ? "bg-[#f05a28]/10 border border-[#f05a28]/25 text-neutral-300" : "bg-cyan-500/10 border border-cyan-500/25 text-neutral-300"
                  }`}>
                    <span className="font-bold block text-white mb-1">Standard d'Archivage Actif</span>
                    La conversion PDF/A se lance instantanément en cliquant sur le bouton de format ci-dessus.
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Interactive Images Grid / Batch Area */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              
              {/* Batch Actions and Header info */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                isVS ? "bg-[#1e1e1e] border-[#2d2d2d]" : "bg-slate-900 border-slate-800"
              } shadow-lg`}>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-200">
                    Console d'Images Converties
                  </h4>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    {convertedImages.length === 0
                      ? "En attente du lancement de la conversion d'images."
                      : `${convertedImages.length} page(s) convertie(s) avec succès.`}
                  </p>
                </div>

                {convertedImages.length > 0 && (
                  <button
                    onClick={downloadAllImagesAsZip}
                    disabled={isZipping}
                    className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md text-white ${
                      isVS 
                        ? "bg-gradient-to-r from-[#f05a28] to-[#ff7a00] hover:brightness-110" 
                        : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110"
                    }`}
                  >
                    {isZipping ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        Compression ZIP...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Télécharger le ZIP de toutes les images
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Conversion Loading Progress bar if active */}
              {isConverting && (
                <div className={`p-6 rounded-2xl border flex flex-col gap-2.5 items-center justify-center ${
                  isVS ? "bg-[#1e1e1e] border-[#2d2d2d]" : "bg-slate-900 border-slate-800"
                }`}>
                  <div className="animate-pulse flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#f05a28]" />
                    <span className="text-xs font-bold font-mono text-neutral-300">CONVERSION DU DOCUMENT EN COURS...</span>
                  </div>
                  <div className="w-full max-w-md h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#f05a28] to-[#ff7a00] rounded-full transition-all duration-300"
                      style={{ width: `${conversionProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500 font-bold">{conversionProgress}% TERMINÉ</span>
                </div>
              )}

              {/* Converted images display or blank state */}
              {convertedImages.length === 0 ? (
                !isConverting && (
                  <div className={`flex-1 flex flex-col items-center justify-center p-12 min-h-[350px] border-2 border-dashed rounded-2xl ${
                    isVS ? "border-[#2b2b2b] bg-[#1e1e1e]/20" : "border-slate-850 bg-slate-900/10"
                  }`}>
                    <div className="p-4 rounded-full bg-neutral-850 text-neutral-500 mb-4 animate-pulse">
                      <Download className="w-8 h-8" />
                    </div>
                    <h5 className="text-xs font-bold text-neutral-300 uppercase tracking-widest">Aperçu du Convertisseur</h5>
                    <p className="text-[10px] text-neutral-500 mt-1 max-w-sm text-center">
                      Configurez vos critères d'exportation d'images à gauche et lancez la conversion pour afficher les miniatures haute définition.
                    </p>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {convertedImages.map((img) => (
                    <div
                      key={img.pageNum}
                      className={`relative group rounded-xl border overflow-hidden transition-all duration-300 shadow-md ${
                        isVS ? "bg-[#1e1e1e] border-[#2d2d2d] hover:border-[#f05a28]" : "bg-slate-900 border-slate-800 hover:border-cyan-500"
                      }`}
                    >
                      <img
                        src={img.dataUrl}
                        alt={`Page ${img.pageNum}`}
                        className="w-full h-auto object-contain max-h-[220px]"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Overlay card details */}
                      <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md font-mono text-[9px] font-bold text-white shadow-md">
                        P. {img.pageNum}
                      </div>

                      {/* Download Page Button overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => downloadSingleImage(img, exportFormat)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 hover:bg-[#f05a28] hover:border-[#f05a28] text-white font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Télécharger Page
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* --- PDF MONTAGE / TIMELINE TAB (Adobe Inspired) --- */}
      {pdfActiveTab === "gestionnaire" && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-24 flex flex-col gap-6 font-sans">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Column 1: Chutier / Project Bin (3 cols) */}
            <div className="lg:col-span-3 flex flex-col gap-5">
              <div className={`p-4 rounded-2xl border ${
                isVS ? "bg-[#1e1e1e] border-[#2d2d2d]" : "bg-slate-900 border-slate-800"
              } shadow-lg flex-1 flex flex-col min-h-[400px]`}>
                
                <div className="flex items-center justify-between mb-3 border-b border-neutral-800 pb-2.5">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 font-mono">
                    <Database className="w-3.5 h-3.5 text-[#f05a28]" />
                    Le Chutier (Source Bin)
                  </h4>
                  
                  <button
                    onClick={() => montageFileInputRef.current?.click()}
                    className={`p-1 rounded bg-[#2c2c2c] hover:bg-[#f05a28] text-white transition-colors cursor-pointer`}
                    title="Ajouter un PDF au Chutier"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <input
                    ref={montageFileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAddMontageFile(file);
                    }}
                  />
                </div>

                {/* Chutier file list */}
                {montageFiles.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <p className="text-[10px] text-neutral-500 font-sans leading-normal">
                      Aucun document source dans le chutier. Utilisez le bouton <code className="font-mono bg-[#181818] px-1 py-0.5 rounded text-neutral-400 font-bold">+</code> ou chargez un fichier pour commencer.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[450px] pr-1">
                    {montageFiles.map((fileObj) => (
                      <div
                        key={fileObj.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isVS ? "bg-[#121212] border-[#2b2b2b] hover:border-neutral-700" : "bg-slate-950 border-slate-850 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 overflow-hidden mb-2">
                          <div className="overflow-hidden">
                            <p className="text-[10px] font-bold truncate text-neutral-200">{fileObj.name}</p>
                            <p className="text-[8px] font-mono text-neutral-500">
                              {fileObj.pageThumbnails.length} p. • {(fileObj.size / (1024 * 1024)).toFixed(2)} Mo
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setMontageFiles(prev => prev.filter(f => f.id !== fileObj.id));
                              setMontageTimeline(prev => prev.filter(p => p.sourceFileId !== fileObj.id));
                              triggerToast(`🗑️ "${fileObj.name}" retiré du projet.`);
                            }}
                            className="text-neutral-500 hover:text-red-400 p-0.5"
                            title="Retirer ce fichier"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Page thumbnails inside this file */}
                        <div className="grid grid-cols-4 gap-1 mt-1">
                          {fileObj.pageThumbnails.map((thumb, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleAddPageToTimeline(fileObj.id, idx + 1, thumb)}
                              className="relative group border border-neutral-800 rounded hover:border-[#f05a28] overflow-hidden cursor-pointer"
                              title={`Ajouter la page ${idx + 1}`}
                            >
                              <img src={thumb} className="w-full h-auto object-contain" referrerPolicy="no-referrer" />
                              <span className="absolute bottom-0 right-0 bg-black/75 px-1 py-0.2 rounded font-mono text-[7px] font-bold text-white">
                                {idx + 1}
                              </span>
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Plus className="w-3 h-3 text-white" />
                              </div>
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => handleAddAllPagesToTimeline(fileObj)}
                          className="w-full text-center text-[8px] uppercase font-black tracking-wider text-[#f05a28] hover:text-white transition-colors border border-dashed border-[#f05a28]/30 rounded-lg py-1 mt-2.5 cursor-pointer"
                        >
                          Ajouter tout à la séquence
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Program Monitor / Selection details (9 cols) */}
            <div className="lg:col-span-9 flex flex-col gap-5">
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                
                {/* Visualizer Frame (Program Monitor) (7 cols) */}
                <div className="md:col-span-8 flex flex-col">
                  <div className={`p-4 rounded-2xl border ${
                    isVS ? "bg-[#1e1e1e] border-[#2d2d2d]" : "bg-slate-900 border-slate-800"
                  } shadow-lg flex-1 flex flex-col items-center justify-center min-h-[350px] relative`}>
                    
                    <span className="absolute top-3 left-3 text-[8px] uppercase tracking-wider font-mono font-black text-[#f05a28]">
                      PROGRAM MONITOR • APERÇU DE SÉQUENCE
                    </span>

                    {montageActiveIndex >= 0 && montageActiveIndex < montageTimeline.length ? (
                      <div className="flex flex-col items-center gap-4 py-4">
                        <div
                          className="transition-transform duration-300 relative shadow-2xl rounded-lg border border-neutral-800 max-h-[250px] overflow-hidden"
                          style={{
                            transform: `rotate(${montageTimeline[montageActiveIndex].angle}deg)`
                          }}
                        >
                          <img
                            src={montageTimeline[montageActiveIndex].thumbnail}
                            alt="Aperçu du plan actif"
                            className="max-h-[250px] w-auto object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="text-center">
                          <span className="font-mono text-[9px] text-neutral-400 font-bold uppercase tracking-widest block">
                            Frame Sélectionnée • Index {montageActiveIndex + 1} / {montageTimeline.length}
                          </span>
                          <span className="text-[10px] font-sans text-neutral-300">
                            {montageTimeline[montageActiveIndex].isBlank 
                              ? `Page Blanche (${montageTimeline[montageActiveIndex].blankSize})` 
                              : `Source Page ${montageTimeline[montageActiveIndex].sourcePageNum}`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center flex flex-col items-center gap-3 py-12">
                        <Scissors className="w-10 h-10 text-neutral-600 animate-pulse" />
                        <p className="text-xs text-neutral-400 font-sans font-bold uppercase tracking-wider">
                          Séquence Vide ou Aucun Plan Actif
                        </p>
                        <p className="text-[10px] text-neutral-500 max-w-xs leading-normal">
                          Sélectionnez une vignette de la timeline ou chargez vos documents à gauche pour monter la séquence.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sequence Controls Panel (4 cols) */}
                <div className="md:col-span-4 flex flex-col gap-4">
                  <div className={`p-4 rounded-2xl border flex-1 flex flex-col ${
                    isVS ? "bg-[#1e1e1e] border-[#2d2d2d]" : "bg-slate-900 border-slate-800"
                  } shadow-lg`}>
                    
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-2 mb-3.5 font-mono">
                      Contrôles du Plan Sélectionné
                    </h4>

                    {montageActiveIndex >= 0 && montageActiveIndex < montageTimeline.length ? (
                      <div className="space-y-3.5 flex-1 flex flex-col justify-between">
                        
                        {/* Frame actions */}
                        <div className="space-y-2">
                          <button
                            onClick={() => handleRotateTimelineItem(montageActiveIndex)}
                            className={`w-full py-2.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 cursor-pointer ${
                              isVS ? "bg-[#121212] border-neutral-800 hover:bg-[#252525] text-neutral-200" : "bg-slate-950 border-slate-850 hover:bg-slate-900 text-slate-200"
                            }`}
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-[#f05a28]" />
                            Faire Pivoter de 90°
                          </button>

                          <button
                            onClick={() => handleDuplicateTimelineItem(montageActiveIndex)}
                            className={`w-full py-2.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 cursor-pointer ${
                              isVS ? "bg-[#121212] border-neutral-800 hover:bg-[#252525] text-neutral-200" : "bg-slate-950 border-slate-850 hover:bg-slate-900 text-slate-200"
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5 text-[#f05a28]" />
                            Dupliquer la Page
                          </button>

                          <button
                            onClick={() => handleDeleteTimelineItem(montageActiveIndex)}
                            className="w-full py-2.5 text-xs font-bold rounded-xl bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Retirer de la Séquence
                          </button>
                        </div>

                        {/* Page reordering buttons */}
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          <button
                            onClick={() => handleMoveTimelineItem(montageActiveIndex, montageActiveIndex - 1)}
                            disabled={montageActiveIndex === 0}
                            className={`py-2 text-[10px] font-black uppercase rounded-lg border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              montageActiveIndex === 0
                                ? "bg-neutral-800 border-neutral-800 text-neutral-600 cursor-not-allowed"
                                : isVS
                                  ? "bg-[#121212] border-[#2b2b2b] hover:bg-[#181818] text-white"
                                  : "bg-slate-950 border-slate-850 hover:bg-slate-900 text-white"
                            }`}
                          >
                            ◀ Déplacer
                          </button>
                          <button
                            onClick={() => handleMoveTimelineItem(montageActiveIndex, montageActiveIndex + 1)}
                            disabled={montageActiveIndex === montageTimeline.length - 1}
                            className={`py-2 text-[10px] font-black uppercase rounded-lg border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              montageActiveIndex === montageTimeline.length - 1
                                ? "bg-neutral-800 border-neutral-800 text-neutral-600 cursor-not-allowed"
                                : isVS
                                  ? "bg-[#121212] border-[#2b2b2b] hover:bg-[#181818] text-white"
                                  : "bg-slate-950 border-slate-850 hover:bg-slate-900 text-white"
                            }`}
                          >
                            Déplacer ▶
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-center">
                        <p className="text-[10px] text-neutral-500 leading-normal">
                          Sélectionnez une vignette pour activer les outils d'édition, rotation et déplacement.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Staging actions: Insert Blank Page / Custom Images */}
              <div className={`p-4 rounded-2xl border grid grid-cols-1 md:grid-cols-12 gap-5 ${
                isVS ? "bg-[#1e1e1e] border-[#2d2d2d]" : "bg-slate-900 border-slate-800"
              } shadow-lg`}>
                
                {/* Insert blank section (6 cols) */}
                <div className="md:col-span-6 space-y-3">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono">
                    Insérer une Page Blanche
                  </h5>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleInsertBlankPage("#ffffff", "A4", "after")}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded bg-[#1c1c1c] hover:bg-[#252525] border border-neutral-800 text-neutral-300 transition-all cursor-pointer`}
                    >
                      + A4 Blanche
                    </button>
                    <button
                      onClick={() => handleInsertBlankPage("#000000", "A4", "after")}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded bg-[#1c1c1c] hover:bg-[#252525] border border-neutral-800 text-neutral-300 transition-all cursor-pointer`}
                    >
                      + A4 Noire
                    </button>
                    <button
                      onClick={() => handleInsertBlankPage("#183059", "A4", "after")}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded bg-[#1c1c1c] hover:bg-[#252525] border border-neutral-800 text-neutral-300 transition-all cursor-pointer`}
                    >
                      + A4 Bleue
                    </button>
                  </div>
                </div>

                {/* Insert Image page section (6 cols) */}
                <div className="md:col-span-6 space-y-3 border-t md:border-t-0 md:border-l border-neutral-850 pt-3 md:pt-0 md:pl-5">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono">
                    Insérer des Images (PNG/JPG)
                  </h5>
                  <button
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) handleInsertImagePage(file, "after");
                      };
                      input.click();
                    }}
                    className={`w-full py-1.5 text-[10px] font-bold rounded bg-[#1c1c1c] hover:bg-[#f05a28] border border-neutral-800 text-neutral-200 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Importer Image comme Page
                  </button>
                </div>

              </div>

              {/* Segmenter and Merge export section */}
              <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center md:justify-between gap-6 ${
                isVS ? "bg-[#1e1e1e] border-[#2d2d2d]" : "bg-slate-900 border-slate-800"
              } shadow-lg`}>
                
                {/* Segmenter / Cutting station */}
                <div className="flex-1 space-y-2">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1">
                    <Scissors className="w-3.5 h-3.5 text-[#f05a28]" />
                    SÉGMENTATION & DÉCOUPE
                  </h5>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSegmentationString}
                      onChange={(e) => setCustomSegmentationString(e.target.value)}
                      placeholder="Plages de découpe, ex : 1-2; 3-4"
                      className={`flex-1 p-2 text-xs rounded-xl border outline-none ${
                        isVS ? "bg-[#121212] border-[#2d2d2d] text-white focus:border-[#f05a28]" : "bg-slate-950 border-slate-850 text-white focus:border-cyan-500"
                      }`}
                    />
                    <button
                      onClick={() => handleSplitTimeline(customSegmentationString)}
                      className={`px-3 py-2 text-[10px] font-black uppercase rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer`}
                    >
                      Segmenter
                    </button>
                  </div>
                </div>

                {/* Primary compile action */}
                <div className="shrink-0">
                  <button
                    onClick={handleExportMontagePDF}
                    disabled={isExportingMontage || montageTimeline.length === 0}
                    className={`w-full md:w-auto px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                      isExportingMontage || montageTimeline.length === 0
                        ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                        : isVS
                          ? "bg-gradient-to-r from-[#f05a28] to-[#ff7a00] hover:brightness-110 text-white"
                          : "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:brightness-110"
                    }`}
                  >
                    {isExportingMontage ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                        Compilation...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Compiler & Exporter le Montage (.pdf)
                      </>
                    )}
                  </button>
                </div>

              </div>

            </div>

          </div>

          {/* Timeline Sequence horizontal track (Bottom Panel) */}
          <div className={`p-5 rounded-2xl border ${
            isVS ? "bg-[#1e1e1e] border-[#2d2d2d]" : "bg-slate-900 border-slate-800"
          } shadow-lg flex flex-col gap-3.5`}>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#f05a28] animate-ping" />
                <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-200 font-mono">
                  SÉQUENCE DE MONTAGE (Timeline Track)
                </h4>
              </div>

              {/* Timeline scale zoom slider */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-neutral-500 uppercase font-mono">Échelle Track :</span>
                <input
                  type="range"
                  min="0.6"
                  max="1.6"
                  step="0.1"
                  value={timelineZoom}
                  onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Scrollable grid sequence */}
            {montageTimeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-[#121212]/50 rounded-xl">
                <p className="text-[10px] text-neutral-500 font-sans">
                  La timeline est vide. Cliquez sur un plan à gauche dans le Chutier pour l'injecter ici.
                </p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto py-4 pr-4 border border-dashed border-neutral-800/40 rounded-xl bg-neutral-950/40 p-4 scrollbar-thin">
                {montageTimeline.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setMontageActiveIndex(idx)}
                    className={`relative shrink-0 flex flex-col items-center p-2 rounded-xl border transition-all duration-300 cursor-pointer ${
                      montageActiveIndex === idx
                        ? "bg-[#f05a28]/10 border-[#f05a28] ring-1 ring-[#f05a28]"
                        : "bg-[#121212] border-neutral-850 hover:border-neutral-700"
                    }`}
                    style={{
                      width: `${120 * timelineZoom}px`
                    }}
                  >
                    
                    {/* Index tag */}
                    <div className="absolute top-1.5 left-1.5 bg-black/85 backdrop-blur px-1.5 py-0.5 rounded font-mono text-[8px] font-black text-white shadow">
                      P. {idx + 1}
                    </div>

                    {/* Miniature Page preview */}
                    <div
                      className="transition-transform duration-300 shadow overflow-hidden rounded bg-white flex items-center justify-center"
                      style={{
                        transform: `rotate(${item.angle}deg)`,
                        width: `${90 * timelineZoom}px`,
                        height: `${125 * timelineZoom}px`
                      }}
                    >
                      <img
                        src={item.thumbnail}
                        className="max-h-full max-w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Visual details metadata line */}
                    <div className="w-full mt-2.5 flex items-center justify-between text-[8px] font-mono font-bold text-neutral-400">
                      <span>{item.isBlank ? "BLANK" : "PDF"}</span>
                      {item.angle > 0 && <span className="text-[#f05a28]">{item.angle}°</span>}
                    </div>

                    {/* Miniature command bar */}
                    <div className="absolute top-1.5 right-1.5 flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTimelineItem(idx);
                        }}
                        className="bg-red-500/90 text-white p-0.5 rounded shadow hover:bg-red-600 transition-colors"
                        title="Retirer la page"
                      >
                        ✕
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Redirection Modal for Missing API Key */}
      <AnimatePresence>
        {isApiKeyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`max-w-md w-full p-6 rounded-2xl border shadow-2xl relative ${
                isVS 
                  ? "bg-[#1f1f1f] border-neutral-700/60 text-neutral-200" 
                  : "bg-slate-900 border-slate-800 text-slate-100"
              }`}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(false)}
                className="absolute top-4 right-4 text-neutral-450 hover:text-neutral-250 transition-colors cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${
                  isVS ? "bg-[#f05a28]/15 text-[#f05a28]" : "bg-cyan-500/10 text-cyan-400"
                }`}>
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight uppercase">Clé d'API Gemini Requise</h3>
                  <p className="text-[10px] text-neutral-400 font-mono font-bold">ASSISTANCE INTELLIGENTE DÉSACTIVÉE</p>
                </div>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-neutral-300 font-sans">
                <p>
                  Pour pouvoir utiliser l'<strong>analyse documentaire par Scan PDF/Image</strong> et l'<strong>assistant intelligent par consigne prompt</strong>, vous devez configurer votre clé d'API Gemini personnelle.
                </p>
                <div className={`p-3 rounded-lg border text-[11px] h-20 overflow-y-auto flex items-center ${
                  isVS ? "bg-[#181818] border-[#2e2e2e]" : "bg-slate-950 border-slate-850"
                }`}>
                  <p className="text-neutral-400 font-sans italic">
                    "La clé d'API s'enregistre de manière sécurisée de votre côté dans l'onglet Gemini de l'écran des Paramètres ou dans les variables d'environnement de l'applet."
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsApiKeyModalOpen(false)}
                  className={`py-2 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                    isVS 
                      ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2d2d2d]" 
                      : "bg-slate-920 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsApiKeyModalOpen(false);
                    // Trigger redirection
                    if (setGlobalTab && setSettingsActiveSubTab) {
                      setGlobalTab("settings");
                      setSettingsActiveSubTab("gemini");
                      triggerToast("Redirection vers la configuration de clé d'API Gemini réussie !");
                    } else {
                      triggerToast("Onglet Paramètres introuvable, veuillez cliquer sur l'icône Rouage en haut à droite.");
                    }
                  }}
                  className={`py-2 text-xs font-bold text-white rounded-lg transition-all shadow-md cursor-pointer text-center ${
                    isVS 
                      ? "bg-gradient-to-r from-[#f05a28] to-[#ff7a00] hover:brightness-110" 
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  }`}
                >
                  Aller aux Paramètres
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Expanded Signature Canvas Modal Overlay */}
        {isSignatureModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-2xl p-6 rounded-2xl shadow-2xl border ${
                isVS 
                  ? "bg-[#181818] border-[#2e2e2e] text-[#cccccc]" 
                  : "bg-slate-900 border-slate-800 text-slate-100"
              }`}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  clearModalCanvas();
                  setIsSignatureModalOpen(false);
                }}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-200 transition-colors text-lg font-bold cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${
                  isVS ? "bg-[#f05a28]/15 text-[#f05a28]" : "bg-amber-500/10 text-amber-500"
                }`}>
                  <Maximize2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight uppercase">Écran Géant de Signature</h3>
                  <p className="text-[10px] text-neutral-400 font-mono font-bold">HAUTE RÉSOLUTION & TRACÉ FLUIDE MULTI-COUPS</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Profitez d'un grand tableau d'écriture pour dessiner votre signature ou vos parafes avec une précision millimétrée. Le tracé prend en compte les levées de stylo ou de doigt pour ne pas créer de tracés parasites.
                </p>

                <div className="relative border-2 border-dashed border-neutral-700 bg-white rounded-xl overflow-hidden h-[300px] shadow-inner">
                  <canvas
                    ref={modalCanvasRef}
                    onPointerDown={startModalDrawing}
                    onPointerMove={drawModal}
                    onPointerUp={stopModalDrawing}
                    onPointerLeave={stopModalDrawing}
                    onPointerCancel={stopModalDrawing}
                    className="w-full h-full cursor-crosshair bg-white touch-none"
                  />
                  <div className="absolute bottom-3 right-3 flex gap-2">
                    <button
                      type="button"
                      onClick={clearModalCanvas}
                      className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-lg shadow transition cursor-pointer"
                    >
                      Effacer tout
                    </button>
                    <button
                      type="button"
                      onClick={saveModalSignature}
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-lg shadow-md hover:scale-102 transition cursor-pointer"
                    >
                      Enregistrer dans ma collection
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    clearModalCanvas();
                    setIsSignatureModalOpen(false);
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                    isVS 
                      ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2d2d2d]" 
                      : "bg-slate-800 border-slate-705 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Fermer sans enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Import JSON Modal Overlay */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-lg p-6 rounded-2xl shadow-2xl border ${
                isVS 
                  ? "bg-[#181818] border-[#2e2e2e] text-[#cccccc]" 
                  : "bg-slate-900 border-slate-800 text-slate-100"
              }`}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportJsonText("");
                }}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-200 transition-colors text-lg font-bold cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${
                  isVS ? "bg-[#f05a28]/15 text-[#f05a28]" : "bg-emerald-500/10 text-emerald-400"
                }`}>
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight uppercase">Importer un Schéma JSON</h3>
                  <p className="text-[10px] text-neutral-400 font-mono font-bold">REPRENDRE L'ÉDITION D'UN WORKSPACE</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Importez un fichier JSON ou collez ci-dessous le code JSON que vous aviez exporté précédemment.
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    className="hidden"
                    ref={fileImportRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      // Validate file type
                      if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json' && file.type !== 'text/plain') {
                        triggerToast("Veuillez sélectionner un fichier JSON valide.");
                        return;
                      }

                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const result = event.target?.result;
                          if (typeof result === "string") {
                            setImportJsonText(result);
                          }
                        } catch (error) {
                          triggerToast("Erreur lors de la lecture du fichier.");
                        }
                      };
                      reader.readAsText(file);
                      // Reset to allow selecting same file again if needed
                      if (fileImportRef.current) {
                        fileImportRef.current.value = "";
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImportSelectorType("json");
                      setIsImportSelectorOpen(true);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault(); // Prevents double firing with onClick on some devices
                      setImportSelectorType("json");
                      setIsImportSelectorOpen(true);
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 cursor-pointer transition-colors w-full ${
                      isVS 
                        ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2d2d2d]" 
                        : "bg-slate-800 border-slate-705 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    Parcourir un fichier .json
                  </button>
                </div>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-neutral-700"></div>
                  <span className="flex-shrink-0 mx-4 text-xs text-neutral-500 font-medium">OU</span>
                  <div className="flex-grow border-t border-neutral-700"></div>
                </div>

                <textarea
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="Collez le texte JSON ici... ex: [ { id: ... } ]"
                  className={`w-full h-32 p-3 text-xs font-mono rounded-lg border outline-none resize-none ${
                    isVS 
                      ? "bg-[#121212] border-[#2e2e2e] text-neutral-300 focus:border-[#f05a28]" 
                      : "bg-slate-950 border-slate-800 text-neutral-300 focus:border-amber-500"
                  }`}
                  spellCheck={false}
                />
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportJsonText("");
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                    isVS 
                      ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2d2d2d]" 
                      : "bg-slate-800 border-slate-705 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleImportSchema}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black rounded-lg shadow-md hover:scale-102 transition cursor-pointer"
                >
                  Importer et Appliquer
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Generic Evolutive Profile Modal Overlay */}
        {isGenericProfileModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-2xl p-6 rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] ${
                isVS 
                  ? "bg-[#181818] border-[#2e2e2e] text-[#cccccc]" 
                  : "bg-slate-900 border-slate-800 text-slate-100"
              }`}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsGenericProfileModalOpen(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-200 transition-colors text-lg font-bold cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${
                  isVS ? "bg-[#f05a28]/15 text-[#f05a28]" : "bg-cyan-500/10 text-cyan-400"
                }`}>
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight uppercase">Mon Profil de Renseignement Générique</h3>
                  <p className="text-[10px] text-cyan-400 font-mono font-bold">SYSTÈME DE REMPLISSAGE AUTOMATIQUE ÉVOLUTIF</p>
                </div>
              </div>

              <div className="overflow-y-auto pr-1 flex-1 space-y-5">
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Ce profil centralise vos informations récurrentes. L'application utilise ces clés pour remplir automatiquement n'importe quel document (formulaire, mandat, facture, etc.). Modifiez les clés pour correspondre aux intitulés de vos formulaires habituels !
                </p>

                {/* Profile Fields List */}
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold tracking-wider text-neutral-500 px-1 font-mono">
                    <div className="col-span-4">Intitulé du Champ (Clé)</div>
                    <div className="col-span-7">Valeur Enregistrée</div>
                    <div className="col-span-1 text-center">Action</div>
                  </div>

                  <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                    {Object.entries(genericProfile).map(([key, value], idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={key}
                            onChange={(e) => {
                              const newKey = e.target.value;
                              if (newKey === key) return;
                              setGenericProfile(prev => {
                                const updated = { ...prev };
                                delete updated[key];
                                updated[newKey] = value;
                                return updated;
                              });
                            }}
                            className={`w-full text-xs p-2 rounded border outline-none font-semibold ${
                              isVS 
                                ? "bg-[#121212] border-[#2d2d2d] text-neutral-200 focus:border-[#f05a28]" 
                                : "bg-slate-950 border-slate-800 text-slate-100 focus:border-cyan-500"
                            }`}
                            placeholder="ex: Email"
                          />
                        </div>
                        <div className="col-span-7">
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setGenericProfile(prev => ({
                                ...prev,
                                [key]: newValue
                              }));
                            }}
                            className={`w-full text-xs p-2 rounded border outline-none ${
                              isVS 
                                ? "bg-[#121212] border-[#2d2d2d] text-neutral-300 focus:border-[#f05a28]" 
                                : "bg-slate-950 border-slate-800 text-slate-200 focus:border-cyan-500"
                            }`}
                            placeholder="ex: n.lohberger.pro@gmail.com"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setGenericProfile(prev => {
                                const updated = { ...prev };
                                delete updated[key];
                                return updated;
                              });
                              triggerToast(`🗑️ Clé '${key}' retirée du profil.`);
                            }}
                            className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                            title="Supprimer ce champ de renseignement"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {Object.keys(genericProfile).length === 0 && (
                      <div className="text-center py-6 text-xs text-neutral-500 italic">
                        Votre profil est vide. Ajoutez des clés ou laissez le logiciel apprendre de vos saisies !
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const tempKey = `Nouveau champ ${Object.keys(genericProfile).length + 1}`;
                      setGenericProfile(prev => ({
                        ...prev,
                        [tempKey]: ""
                      }));
                    }}
                    className={`mt-2 py-1.5 px-3 rounded border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      isVS 
                        ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2e2e2e]" 
                        : "bg-slate-800 border-slate-705 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <Plus className="w-4 h-4 text-cyan-400" />
                    Ajouter une information personnalisée (ex: IBAN, ID, etc.)
                  </button>
                </div>

                {/* Suggestions Section: dynamic learning from document */}
                {getMissingFieldsForProfile().length > 0 && (
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    isVS ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-500/5 border-amber-500/10"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                      <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                        Saisies détectées dans le document actuel non enregistrées :
                      </h4>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Ces informations ont été écrites dans le formulaire ci-présent mais ne sont pas mémorisées dans votre Profil Générique. Cliquez pour les mémoriser et automatiser vos futurs formulaires !
                    </p>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {getMissingFieldsForProfile().map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-black/30 border border-neutral-800">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-neutral-200">{item.label}</span>
                            <span className="text-[10px] text-neutral-400 font-mono truncate max-w-sm">{item.value}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => addFieldToGenericProfile(item.label, item.value)}
                            className="py-1 px-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            Mémoriser
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const missing = getMissingFieldsForProfile();
                          setGenericProfile(prev => {
                            const updated = { ...prev };
                            missing.forEach(m => {
                              updated[m.label] = m.value;
                            });
                            return updated;
                          });
                          triggerToast(`✨ ${missing.length} information(s) mémorisée(s) dans votre profil !`);
                        }}
                        className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Tout mémoriser dans le Profil
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-6 pt-4 border-t border-neutral-800 flex justify-end gap-3 shrink-0 font-sans">
                <button
                  type="button"
                  onClick={() => setIsGenericProfileModalOpen(false)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                    isVS 
                      ? "bg-[#252525] border-[#3a3a3a] text-neutral-300 hover:bg-[#2d2d2d]" 
                      : "bg-slate-800 border-slate-705 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsGenericProfileModalOpen(false);
                    triggerToast("✅ Profil Générique sauvegardé avec succès.");
                  }}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-black rounded-lg shadow-md hover:scale-102 transition cursor-pointer"
                >
                  Confirmer et Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Selector Modal logic */}
      <AnimatePresence>
        {isImportSelectorOpen && (
          <ImportSelectorModal
            isVS={isVS}
            type={importSelectorType}
            onClose={() => setIsImportSelectorOpen(false)}
            onSelectedLocal={() => {
              if (importSelectorType === "pdf_image") {
                fileInputRef.current?.click();
              } else {
                fileImportRef.current?.click();
              }
            }}
            onSelectedDriveFile={(name, content) => {
              if (importSelectorType === "pdf_image") {
                // Content is a Blob
                const blob = content as Blob;
                const fileType = name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : blob.type || 'image/jpeg';
                triggerPdfFileOpenChoice(new File([blob], name, { type: fileType }));
              } else {
                // Content is a string
                setImportJsonText(content as string);
                setIsImportModalOpen(true);
              }
            }}
            triggerToast={triggerToast}
          />
        )}
      </AnimatePresence>

      {/* --- IMMERSIVE FULLSCREEN TOP FLOATING CONTROL BAR --- */}
      {isPdfFullscreen && (
        <AnimatePresence>
          {showFullscreenHeader && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: -20, x: "-50%" }}
              className={`fixed top-4 left-1/2 z-55 flex items-center justify-between gap-6 px-6 py-2.5 rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.85)] border backdrop-blur-md ${
                isVS ? "bg-[#1c1c1c]/95 border-[#333333] text-white" : "bg-slate-900/95 border-slate-800 text-slate-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className={`w-4 h-4 ${isVS ? "text-[#f05a28]" : "text-cyan-400"}`} />
                <span className="text-xs font-black uppercase tracking-wider font-mono">
                  LECTURE PLEIN ÉCRAN • {pdfActiveTab === "editeur" ? "ÉDITEUR PDF" : "FORMULAIRE PDF"}
                </span>
                <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2.5 py-0.5 rounded-full font-bold">
                  {pdfActiveTab === "editeur" 
                    ? `Page ${annotationCurrentPage} sur ${annotationNumPages}` 
                    : "Formulaire Actif"
                  }
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Floating Header Zoom Controls */}
                <div className={`flex items-center gap-1 border rounded-full p-0.5 ${
                  isVS ? "border-neutral-800 bg-black/60" : "border-slate-800 bg-slate-950/60"
                }`}>
                  <button
                    onClick={() => setAnnotationScale(prev => Math.max(0.6, prev - 0.2))}
                    className="px-2 py-0.5 rounded-full hover:bg-[#252525] text-neutral-400 hover:text-white transition-all font-mono font-bold text-xs cursor-pointer"
                    title="Zoomer Arrière"
                  >
                    -
                  </button>
                  <span className="text-[10px] font-mono font-bold text-neutral-300 px-1 min-w-[36px] text-center">
                    {Math.round(annotationScale * 100)}%
                  </span>
                  <button
                    onClick={() => setAnnotationScale(prev => Math.min(3.5, prev + 0.2))}
                    className="px-2 py-0.5 rounded-full hover:bg-[#252525] text-neutral-400 hover:text-white transition-all font-mono font-bold text-xs cursor-pointer"
                    title="Zoomer Avant"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => {
                    setIsPdfFullscreen(false);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all duration-150 cursor-pointer ${
                    isVS ? "bg-[#f05a28] hover:bg-[#ff6c3a] text-white" : "bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold"
                  }`}
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  Quitter le Plein Écran
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* --- CHEVRON TOGGLES FOR FULLSCREEN MENUS --- */}
      {isPdfFullscreen && (
        <button
          onClick={() => setShowFullscreenHeader(!showFullscreenHeader)}
          className={`fixed left-1/2 -translate-x-1/2 z-55 px-4 py-1.5 rounded-b-2xl border border-t-0 shadow-[0_4px_20px_rgba(0,0,0,0.8)] cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 text-[10px] uppercase font-black tracking-wider font-mono ${
            isVS 
              ? "bg-[#1c1c1c]/95 border-[#333333] hover:bg-[#252525] text-neutral-300" 
              : "bg-slate-900/95 border-slate-800 hover:bg-slate-800 text-slate-300"
          }`}
          style={{
            top: showFullscreenHeader ? "58px" : "0px",
          }}
          title={showFullscreenHeader ? "Masquer la barre de contrôle" : "Afficher la barre de contrôle"}
        >
          {showFullscreenHeader ? <ChevronUp className="w-3.5 h-3.5 text-[#f05a28]" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />}
          <span>Menu</span>
        </button>
      )}

      {/* Chevron to toggle Left Menu (Outils) */}
      {isPdfFullscreen && pdfActiveTab === "editeur" && (
        <button
          onClick={() => setShowFullscreenLeftMenu(!showFullscreenLeftMenu)}
          className={`fixed top-1/2 -translate-y-1/2 z-55 p-2 rounded-r-2xl border border-l-0 shadow-[0_4px_20px_rgba(0,0,0,0.8)] cursor-pointer transition-all duration-300 flex items-center justify-center ${
            isVS 
              ? "bg-[#1c1c1c]/95 border-[#333333] hover:bg-[#252525] text-neutral-300" 
              : "bg-slate-900/95 border-slate-800 hover:bg-slate-800 text-slate-300"
          }`}
          style={{
            left: showFullscreenLeftMenu ? "336px" : "0px",
          }}
          title={showFullscreenLeftMenu ? "Masquer les outils" : "Afficher les outils"}
        >
          {showFullscreenLeftMenu ? <ChevronLeft className="w-5 h-5 text-[#f05a28]" /> : <ChevronRight className="w-5 h-5 text-cyan-400" />}
        </button>
      )}

      {/* Chevron to toggle Right Menu (Propriétés) */}
      {isPdfFullscreen && pdfActiveTab === "formulaire" && (
        <button
          onClick={() => setShowFullscreenRightMenu(!showFullscreenRightMenu)}
          className={`fixed top-1/2 -translate-y-1/2 z-55 p-2 rounded-l-2xl border border-r-0 shadow-[0_4px_20px_rgba(0,0,0,0.8)] cursor-pointer transition-all duration-300 flex items-center justify-center ${
            isVS 
              ? "bg-[#1c1c1c]/95 border-[#333333] hover:bg-[#252525] text-neutral-300" 
              : "bg-slate-900/95 border-slate-800 hover:bg-slate-800 text-slate-300"
          }`}
          style={{
            right: showFullscreenRightMenu ? "400px" : "0px",
          }}
          title={showFullscreenRightMenu ? "Masquer les propriétés" : "Afficher les propriétés"}
        >
          {showFullscreenRightMenu ? <ChevronRight className="w-5 h-5 text-[#f05a28]" /> : <ChevronLeft className="w-5 h-5 text-cyan-400" />}
        </button>
      )}

      {/* --- MODE SELECTOR MODAL (CHOICE BETWEEN EDITOR AND FORMULAIRE) --- */}
      <AnimatePresence>
        {isPdfModeSelectorOpen && pendingPdfFile && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`max-w-xl w-full rounded-2xl border p-6 shadow-2xl relative overflow-hidden ${
                isVS ? "bg-[#1e1e1e] border-[#333333] text-neutral-100" : "bg-slate-900 border-slate-800 text-slate-100"
              }`}
            >
              {/* Ribbon Accent */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${
                isVS ? "from-[#f05a28] to-[#ff7a00]" : "from-cyan-500 to-indigo-500"
              }`} />
              
              <h3 className="text-base font-black uppercase tracking-tight mb-2 mt-2 flex items-center gap-2 font-sans">
                <FileText className={isVS ? "text-[#f05a28]" : "text-cyan-400"} />
                Options de Lecture PDF Studio
              </h3>
              
              <p className="text-xs text-neutral-400 mb-5 leading-relaxed font-sans">
                Le fichier <span className="font-semibold text-neutral-200 font-mono text-[11px] bg-neutral-800/60 px-1.5 py-0.5 rounded">{pendingPdfFile.name}</span> a été importé avec succès. Comment souhaitez-vous l'ouvrir ?
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* Mode A: Annotator */}
                <button
                  onClick={() => {
                    setPdfActiveTab("editeur");
                    loadPdfDocFromFile(pendingPdfFile);
                    setIsPdfModeSelectorOpen(false);
                    setPendingPdfFile(null);
                    triggerToast("Ouverture dans l'Éditeur PDF (Mode Dessin & Annotation)");
                  }}
                  className={`p-4 rounded-xl border text-left flex flex-col gap-3 transition-all group cursor-pointer ${
                    isVS 
                      ? "bg-[#252525]/50 border-[#2d2d2d] hover:border-[#f05a28] hover:bg-[#2d2d2d]/50" 
                      : "bg-slate-950/40 border-slate-800 hover:border-cyan-500 hover:bg-slate-900/40"
                  }`}
                >
                  <div className={`p-2.5 rounded-lg w-fit ${
                    isVS ? "bg-[#f05a28]/10 text-[#f05a28]" : "bg-cyan-500/10 text-cyan-400"
                  }`}>
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide text-neutral-200 group-hover:text-white">Éditeur & Annotations</h4>
                    <p className="text-[10px] text-neutral-450 mt-1 leading-snug">
                      Dessinez à la main, surlignez, signez et écrivez des notes manuscrites vectorielles sur le document.
                    </p>
                  </div>
                </button>
                
                {/* Mode B: Formulaire */}
                <button
                  onClick={() => {
                    setPdfActiveTab("formulaire");
                    handleFile(pendingPdfFile);
                    setIsPdfModeSelectorOpen(false);
                    setPendingPdfFile(null);
                    triggerToast("Ouverture dans l'Éditeur de Formulaires PDF (Mode Saisie au Clavier)");
                  }}
                  className={`p-4 rounded-xl border text-left flex flex-col gap-3 transition-all group cursor-pointer ${
                    isVS 
                      ? "bg-[#252525]/50 border-[#2d2d2d] hover:border-[#f05a28] hover:bg-[#2d2d2d]/50" 
                      : "bg-slate-950/40 border-slate-800 hover:border-cyan-500 hover:bg-slate-900/40"
                  }`}
                >
                  <div className={`p-2.5 rounded-lg w-fit ${
                    isVS ? "bg-[#f05a28]/10 text-[#f05a28]" : "bg-cyan-500/10 text-cyan-400"
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide text-neutral-200 group-hover:text-white">Formulaires Saisissables</h4>
                    <p className="text-[10px] text-neutral-450 mt-1 leading-snug">
                      Transformez les lignes d'écriture en champs de texte interactifs éditables au clavier, avec détection IA.
                    </p>
                  </div>
                </button>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setIsPdfModeSelectorOpen(false);
                    setPendingPdfFile(null);
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    isVS ? "bg-[#252525] hover:bg-[#2d2d2d] text-neutral-400" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  Annuler l'import
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

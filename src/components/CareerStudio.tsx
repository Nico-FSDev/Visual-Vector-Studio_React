import React, { useState, useRef, useEffect } from "react";
import { ThemedSelect, ThemedSelectOption } from "./ThemedSelect";
import {
  Briefcase,
  FileText,
  User,
  Image as ImageIcon,
  Sparkles,
  Download,
  Printer,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  Palette,
  Layout,
  QrCode as QrIcon,
  Globe,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Sliders,
  Maximize2,
  Eye,
  EyeOff,
  Edit3,
  Copy,
  Layers,
  Award,
  BookOpen,
  Film,
  Smile,
  Zap,
  RefreshCw,
  UploadCloud,
  ArrowUp,
  ArrowDown,
  GripVertical,
  CheckSquare,
  Square,
} from "lucide-react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { sanitizeClonedDocument } from "../utils/colorSanitizer";
import { GoogleGenAI } from "@google/genai";

// --- TYPES & INTERFACES ---

export type IndustryCategory =
  | "Corporate & Business"
  | "Tech & Engineering"
  | "Visual Arts & Design"
  | "Performing Arts & Entertainment"
  | "Academia Science & Medicine";

export interface MatrixTaxonomyItem {
  id: string;
  category: IndustryCategory;
  primaryMaterial: string;
  formatAndFileType: string;
  sizeRatioLength: string;
  coreContentRequirements: string;
  presetRoleKey: TargetJobRole;
}

export const MATRIX_TAXONOMY: MatrixTaxonomyItem[] = [
  // Corporate & Business
  {
    id: "corp_resume",
    category: "Corporate & Business",
    primaryMaterial: "Traditional Resume",
    formatAndFileType: "PDF, DOCX",
    sizeRatioLength: "US Letter (8.5x11\") or A4, 1-2 pages maximum",
    coreContentRequirements: "Highlight clear career trajectory, leadership experience, and hard numbers.",
    presetRoleKey: "marketing_executive",
  },
  {
    id: "corp_cover_letter",
    category: "Corporate & Business",
    primaryMaterial: "Cover Letter",
    formatAndFileType: "PDF",
    sizeRatioLength: "US Letter or A4, 1 page (300-400 words)",
    coreContentRequirements: "Highlight clear career trajectory, leadership experience, and hard numbers.",
    presetRoleKey: "marketing_executive",
  },
  {
    id: "corp_linkedin",
    category: "Corporate & Business",
    primaryMaterial: "LinkedIn Profile",
    formatAndFileType: "Live Web URL",
    sizeRatioLength: "N/A (Standardized Web Profile)",
    coreContentRequirements: "Highlight clear career trajectory, leadership experience, and hard numbers.",
    presetRoleKey: "marketing_executive",
  },
  {
    id: "corp_exec_bio",
    category: "Corporate & Business",
    primaryMaterial: "Executive Bio",
    formatAndFileType: "PDF",
    sizeRatioLength: "US Letter or A4, 1 page (Narrative format)",
    coreContentRequirements: "Highlight clear career trajectory, leadership experience, and hard numbers.",
    presetRoleKey: "marketing_executive",
  },

  // Tech & Engineering
  {
    id: "tech_resume",
    category: "Tech & Engineering",
    primaryMaterial: "Technical Resume",
    formatAndFileType: "PDF",
    sizeRatioLength: "US Letter or A4, 1-2 pages (ATS optimized)",
    coreContentRequirements: "List programming languages, frameworks, tools. Link to repos/live projects showing clean code.",
    presetRoleKey: "fullstack_techlead",
  },
  {
    id: "tech_code_portfolio",
    category: "Tech & Engineering",
    primaryMaterial: "Code Portfolio",
    formatAndFileType: "Live URL (GitHub, GitLab)",
    sizeRatioLength: "N/A",
    coreContentRequirements: "List programming languages, frameworks, tools. Link to repos/live projects showing clean code.",
    presetRoleKey: "fullstack_techlead",
  },
  {
    id: "tech_personal_site",
    category: "Tech & Engineering",
    primaryMaterial: "Personal Website",
    formatAndFileType: "Live Web URL",
    sizeRatioLength: "Desktop (1920x1080) & Mobile responsive",
    coreContentRequirements: "List programming languages, frameworks, tools. Link to repos/live projects showing clean code.",
    presetRoleKey: "fullstack_techlead",
  },
  {
    id: "tech_case_study_deck",
    category: "Tech & Engineering",
    primaryMaterial: "Case Study / Deck",
    formatAndFileType: "PDF, PPTX",
    sizeRatioLength: "16:9 aspect ratio, 5-10 slides",
    coreContentRequirements: "List programming languages, frameworks, tools. Link to repos/live projects showing clean code.",
    presetRoleKey: "uiux_designer",
  },

  // Visual Arts & Design
  {
    id: "design_creative_resume",
    category: "Visual Arts & Design",
    primaryMaterial: "Creative Resume",
    formatAndFileType: "PDF",
    sizeRatioLength: "US Letter or A4, 1 page (Custom designed)",
    coreContentRequirements: "Curate absolute best work. Include case studies explaining client problem, process, and impact.",
    presetRoleKey: "editorial_designer",
  },
  {
    id: "design_digital_portfolio",
    category: "Visual Arts & Design",
    primaryMaterial: "Digital Portfolio",
    formatAndFileType: "Live Web URL, PDF",
    sizeRatioLength: "1920x1080px (Web), 16:9 or Landscape A4/US Letter (PDF)",
    coreContentRequirements: "Curate absolute best work. Include case studies explaining client problem, process, and impact.",
    presetRoleKey: "concept_artist",
  },
  {
    id: "design_print_book",
    category: "Visual Arts & Design",
    primaryMaterial: "Print Book/Folio",
    formatAndFileType: "Physical Binder/Book",
    sizeRatioLength: "11x14\", 8x10\", A3, or A4",
    coreContentRequirements: "Curate absolute best work. Include case studies explaining client problem, process, and impact.",
    presetRoleKey: "editorial_designer",
  },
  {
    id: "design_teaser_minibook",
    category: "Visual Arts & Design",
    primaryMaterial: "Teaser / Mini-Book",
    formatAndFileType: "PDF",
    sizeRatioLength: "3-5 pages (A short preview attached to emails)",
    coreContentRequirements: "Curate absolute best work. Include case studies explaining client problem, process, and impact.",
    presetRoleKey: "character_designer",
  },

  // Performing Arts & Entertainment
  {
    id: "perf_headshot",
    category: "Performing Arts & Entertainment",
    primaryMaterial: "Headshot (Acting)",
    formatAndFileType: "JPEG, Print",
    sizeRatioLength: "8x10 inches (Print), High-Res (Digital)",
    coreContentRequirements: "List union status, physical attributes. Models give measurements. Reels start with strongest performance.",
    presetRoleKey: "actor_performer",
  },
  {
    id: "perf_theatrical_resume",
    category: "Performing Arts & Entertainment",
    primaryMaterial: "Theatrical Resume",
    formatAndFileType: "PDF, Print",
    sizeRatioLength: "8x10 inches (Trimmed and stapled to back of headshot)",
    coreContentRequirements: "List union status, physical attributes. Models give measurements. Reels start with strongest performance.",
    presetRoleKey: "actor_performer",
  },
  {
    id: "perf_comp_card",
    category: "Performing Arts & Entertainment",
    primaryMaterial: "Comp Card (Modeling)",
    formatAndFileType: "Physical, PDF",
    sizeRatioLength: "5.5x8.5 inches (Double-sided, 4-5 images)",
    coreContentRequirements: "List union status, physical attributes. Models give measurements. Reels start with strongest performance.",
    presetRoleKey: "model_compcard",
  },
  {
    id: "perf_demo_reel",
    category: "Performing Arts & Entertainment",
    primaryMaterial: "Demo Reel",
    formatAndFileType: "MP4, YouTube/Vimeo URL",
    sizeRatioLength: "16:9 ratio, 1080p, 1 to 3 minutes maximum",
    coreContentRequirements: "List union status, physical attributes. Models give measurements. Reels start with strongest performance.",
    presetRoleKey: "cinematographer",
  },

  // Academia Science & Medicine
  {
    id: "academia_cv",
    category: "Academia Science & Medicine",
    primaryMaterial: "Curriculum Vitae (CV)",
    formatAndFileType: "PDF",
    sizeRatioLength: "US Letter or A4, Unlimited pages (Often 5-15+)",
    coreContentRequirements: "Detail degrees, fellowships, grants secured, peer-reviewed publications, presentations, affiliations.",
    presetRoleKey: "stage_director",
  },
  {
    id: "academia_research_statement",
    category: "Academia Science & Medicine",
    primaryMaterial: "Research Statement",
    formatAndFileType: "PDF",
    sizeRatioLength: "US Letter or A4, 2-3 pages",
    coreContentRequirements: "Detail degrees, fellowships, grants secured, peer-reviewed publications, presentations, affiliations.",
    presetRoleKey: "stage_director",
  },
  {
    id: "academia_teaching_dossier",
    category: "Academia Science & Medicine",
    primaryMaterial: "Teaching Dossier",
    formatAndFileType: "PDF",
    sizeRatioLength: "US Letter or A4, 5-10 pages",
    coreContentRequirements: "Detail degrees, fellowships, grants secured, peer-reviewed publications, presentations, affiliations.",
    presetRoleKey: "stage_director",
  },
  {
    id: "academia_publication_list",
    category: "Academia Science & Medicine",
    primaryMaterial: "Publication List",
    formatAndFileType: "PDF",
    sizeRatioLength: "US Letter or A4, Varies based on career length",
    coreContentRequirements: "Detail degrees, fellowships, grants secured, peer-reviewed publications, presentations, affiliations.",
    presetRoleKey: "stage_director",
  },
];

export type TargetJobRole =
  | "character_designer"
  | "concept_artist"
  | "model_compcard"
  | "actor_performer"
  | "cinematographer"
  | "makeup_sfx"
  | "stage_director"
  | "fullstack_techlead"
  | "editorial_designer"
  | "uiux_designer"
  | "marketing_executive";

export type StudioMode = "cv" | "visual_portfolio";

export type CVLayoutType = "asymmetric_2col" | "executive_1col" | "split_5050";

export type ThemePalette =
  | "slate_executive"
  | "dark_cyber"
  | "amber_studio"
  | "emerald_executive"
  | "warm_editorial"
  | "gold_onyx";

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  period: string;
  location: string;
  bullets: string[];
}

export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  year: string;
  details?: string;
}

export type CustomFieldSection = 
  | "header" 
  | "summary" 
  | "experience" 
  | "education" 
  | "skills" 
  | "contact" 
  | "portfolio_specs";

export interface CustomField {
  id: string;
  title: string;
  value: string;
  section: CustomFieldSection;
  isVisible: boolean;
}

export interface SkillCategory {
  id: string;
  category: string;
  skills: string[]; // e.g., ["ZBrush 95%", "Maya", "Photoshop", "Unreal Engine 5"]
}

export interface CVData {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  githubOrPortfolio: string;
  photoUrl: string;
  profileSummary: string;
  experiences: ExperienceItem[];
  education: EducationItem[];
  skillCategories: SkillCategory[];
  languages: string[];
  certifications: string[];
  portfolioQrUrl: string;
  customFields?: CustomField[];
}

export type VisualTemplateType =
  | "character_sheet"
  | "cinema_pitch"
  | "artist_portfolio"
  | "model_card"
  | "book_showcase";

export interface VisualDeckData {
  templateType: VisualTemplateType;
  title: string;
  subtitle: string;
  artistName: string;
  contactInfo: string;
  heroImage: string;
  galleryImages: { title: string; url: string; caption?: string }[];
  colorPalette: string[]; // e.g. ["#1A1A24", "#F05A28", "#00A7FA", "#E2E8F0"]
  specsTable: { label: string; value: string }[];
  loreOrDescription: string;
  customFields?: CustomField[];
}

interface CareerStudioProps {
  isVS?: boolean;
  geminiApiKey?: string;
  triggerToast?: (msg: string) => void;
}

// --- INITIAL JOB PRESETS DATA ---

const PRESET_JOBS: Record<
  TargetJobRole,
  {
    label: string;
    iconName: string;
    category: string;
    description: string;
    defaultCV: CVData;
    defaultVisual: VisualDeckData;
  }
> = {
  character_designer: {
    label: "Character Designer (Cinéma & Jeux Vidéo)",
    iconName: "Film",
    category: "Cinéma & Jeu Vidéo",
    description: "Standard professionnel pour studio d'animation, cinéma & jeux AAA (Turnaround, Expressions, Palette, Polycount).",
    defaultCV: {
      fullName: "Alexandre Moreau",
      jobTitle: "Senior Character Designer & Concept Artist AAA",
      email: "alexandre.moreau@studio-art.com",
      phone: "+33 6 12 34 56 78",
      location: "Paris, France / Remote",
      website: "https://alexmoreau-art.com",
      githubOrPortfolio: "https://artstation.com/alexmoreau",
      photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Character Designer passionné fort de 8 ans d'expérience dans l'industrie cinématographique et le jeu vidéo AAA. Spécialisé dans le design de personnages expressifs, les model sheets d'anatomie, la création de créatures et l'intégration Pipeline sous Unreal Engine 5 & ZBrush.",
      experiences: [
        {
          id: "exp-1",
          role: "Lead Character Designer",
          company: "Nexus Game Studios AAA",
          period: "2022 - Présent",
          location: "Paris",
          bullets: [
            "Direction artistique du design des 12 personnages principaux d'un RPG d'action d'envergure mondiale.",
            "Supervision d'une équipe de 5 concept artists et modéliseurs 3D Character.",
            "Création des Model Sheets de référence (Turnarounds 360°, feuillets d'expressions faciales, anatomy callouts).",
            "Mise en place des contraintes de rig et d'anatomie en étroite collaboration avec l'équipe de Rigging & Animation.",
          ],
        },
        {
          id: "exp-2",
          role: "Senior Character Concept Artist",
          company: "Illusion VFX & Cinema",
          period: "2019 - 2022",
          location: "Lyon",
          bullets: [
            "Conception visuelle des créatures et costumes pour 3 longs-métrages de science-fiction.",
            "Production de clés de rendu photoréalistes sous ZBrush, KeyShot et Photoshop.",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "Master 2 Direction Artistique & Concept Art",
          institution: "École GOBELINS / Supinfocom",
          year: "2018",
          details: "Félicitations du jury - Spécialisation anatomie & création numérique.",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Logiciels & Pipeline",
          skills: ["ZBrush (Expert)", "Adobe Photoshop", "Unreal Engine 5", "Blender 3D", "Substance Painter", "Marvelous Designer"],
        },
        {
          id: "sk-2",
          category: "Compétences Artistiques",
          skills: ["Anatomie humaine & animale", "Character Turnaround 360°", "Design de Costumes", "Silhouettes & Shape Language", "Color Script"],
        },
      ],
      languages: ["Français (Natif)", "Anglais (Bilingue Professionnel)"],
      certifications: ["ZBrush Certified Master", "Unreal Engine Character Pipeline Specialist"],
      portfolioQrUrl: "https://artstation.com/alexmoreau",
    },
    defaultVisual: {
      templateType: "character_sheet",
      title: "Kaelen - Le Rôdeur de Nébuleuse",
      subtitle: "Character Sheet & Turnaround de Référence - Cinéma / Jeu Vidéo AAA",
      artistName: "Alexandre Moreau",
      contactInfo: "alexandre.moreau@studio-art.com | ArtStation: /alexmoreau",
      heroImage: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "Vue de Face & Profil", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80", caption: "Anatomie & Armure tactique" },
        { title: "Planche d'Expressions", url: "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=600&q=80", caption: "Émotions: Colère, Détermination, Calme" },
        { title: "Accessoires & Équipement", url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=600&q=80", caption: "Module Cybernétique & Holster" },
      ],
      colorPalette: ["#0F172A", "#38BDF8", "#F59E0B", "#EF4444", "#94A3B8"],
      specsTable: [
        { label: "Nom du Personnage", value: "Kaelen Vance" },
        { label: "Rôle / Classe", value: "Cyber Rôdeur / Éclaireur" },
        { label: "Polycount Cible", value: "85,000 Triangles (Next-Gen)" },
        { label: "Set de Textures", value: "4x Maps 4K PBR (Albedo, Roughness, Normal, Metallic)" },
        { label: "Moteur Cible", value: "Unreal Engine 5.4 (MetaHuman Rig compatible)" },
      ],
      loreOrDescription:
        "Ancien officier de reconnaissance sur la station orbitale Titan-9. Kaelen combine une armure composite légère en polymère isolant et des implants oculaires de ciblage thermique. Design axé sur des lignes acérées et une silhouette asymétrique immédiatement reconnaissable en silhouette test.",
    },
  },

  concept_artist: {
    label: "Directeur Artistique & Concept Artist (Pitch Cinéma)",
    iconName: "Palette",
    category: "Cinéma & Art Visuel",
    description: "Pitch visuel de production, étude de lumière, d'atmosphère et de clés de scène.",
    defaultCV: {
      fullName: "Éléonore Saint-Germain",
      jobTitle: "Directrice Artistique & Environment Concept Artist",
      email: "contact@eleonoresg.design",
      phone: "+33 6 89 01 23 45",
      location: "Bordeaux / Remote Worldwide",
      website: "https://eleonoresg.design",
      githubOrPortfolio: "https://behance.net/eleonoresg",
      photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Directrice Artistique chevronnée spécialisée dans le Worldbuilding visuel, le lighting mood-board et les pitch decks pour le cinéma de science-fiction et de fantasy. Expertise en matte painting, compositions scéniques à fort impact et direction de création visuelle globale.",
      experiences: [
        {
          id: "exp-1",
          role: "Directrice Artistique Adjointe",
          company: "Chronos VFX Productions",
          period: "2020 - Présent",
          location: "Paris / Londres",
          bullets: [
            "Conception de la direction artistique visuelle de 2 séries fantastiques diffusées à l'international.",
            "Création de plus de 150 Keyframes d'environnements complexes et color scripts.",
            "Coordination de l'équipe de 8 concept artists et matte painters.",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "Diplôme National Supérieur d'Arts Plastiques",
          institution: "Beaux-Arts de Paris",
          year: "2017",
          details: "Major de promotion - Option Arts Numériques & Scénographie.",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Expertise Visuelle",
          skills: ["Environment Concept Art", "Matte Painting 8K", "Lighting & Color Script", "Composition Cinématographique", "3D Coat & Blender"],
        },
      ],
      languages: ["Français", "Anglais", "Espagnol"],
      certifications: ["Cinema Concept Master Class", "Keyframe Composition Excellence Award"],
      portfolioQrUrl: "https://eleonoresg.design",
    },
    defaultVisual: {
      templateType: "cinema_pitch",
      title: "CHRONOS : La Cité Flottante d'Aethel",
      subtitle: "Dossier de Pitch Visuel & Direction Artistique pour la Production Cinématographique",
      artistName: "Éléonore Saint-Germain",
      contactInfo: "contact@eleonoresg.design | Portfolio: eleonoresg.design",
      heroImage: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "Keyframe 01 - Approche du Sanctuaire", url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80", caption: "Lumière dorée du soir - Brouillard volumétrique" },
        { title: "Keyframe 02 - La Chambre d'Énergie", url: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=80", caption: "Contraste néon cyan vs ombres denses" },
      ],
      colorPalette: ["#020617", "#0EA5E9", "#F59E0B", "#10B981", "#64748B"],
      specsTable: [
        { label: "Projet Cinéma", value: "CHRONOS (Long-Métrage Sci-Fi)" },
        { label: "Ratio d'Image", value: "2.39:1 Anamorphic Cinema" },
        { label: "Logiciels de Rendu", value: "Blender Cycles + Photoshop Matte Painting" },
        { label: "Palette Dominante", value: "Ambre chaud (#F59E0B) & Cyan profond (#0EA5E9)" },
      ],
      loreOrDescription:
        "Vue générale de la cité flottante d'Aethel lors de l'éclipse solaire de l'an 3042. La composition utilise une focale large 24mm pour marquer la gigantisme des spires d'extraction d'énergie plasma.",
    },
  },

  model_compcard: {
    label: "Mannequin & Talent (Model Composite Card)",
    iconName: "User",
    category: "Mode & Agence",
    description: "Fiche composite standard de casting (Comp Card) avec mesures précises, portraits et book d'agence.",
    defaultCV: {
      fullName: "Sasha Laurent",
      jobTitle: "Mannequin Modèle Professional & Talent Comédienne",
      email: "sasha.laurent@agency-models.com",
      phone: "+33 6 55 44 33 22",
      location: "Paris / Milan / New York",
      website: "https://sashalaurent-models.com",
      githubOrPortfolio: "https://instagram.com/sashalaurent_model",
      photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Modèle professionnel représenté par des agences internationales majeures à Paris et Milan. Spécialisée dans les défilés Haute Couture, les campagnes de marque de luxe, les éditoriaux magazines et les publicités télévisées.",
      experiences: [
        {
          id: "exp-1",
          role: "Modèle de Défilé & Campagne",
          company: "Haute Couture Fashion Week",
          period: "2021 - Présent",
          location: "Paris / Milan",
          bullets: [
            "Modèle podium pour 15+ maisons de couture lors des Fashion Weeks de Paris & Milan.",
            "Égérie campagne internationale beauté et prêt-à-porter de luxe.",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "Formation Internationale de Théâtre & Expression Scénique",
          institution: "Cours Florent Paris",
          year: "2020",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Spécialités Modèle",
          skills: ["Défilé Runway", "Shooting Éditorial", "Publicité TV & Vidéo", "Pose Beauté & Cosmetique", "Comédie / Acting"],
        },
      ],
      languages: ["Français (Natif)", "Anglais (Bilingue)", "Italien (Courant)"],
      certifications: ["Représentation Agence Elite / VIVA Models"],
      portfolioQrUrl: "https://sashalaurent-models.com",
    },
    defaultVisual: {
      templateType: "model_card",
      title: "Sasha Laurent - Official Model Comp Card",
      subtitle: "Carte Composite de Casting International - Agence & Directeurs de Casting",
      artistName: "Sasha Laurent",
      contactInfo: "Réservation Agence: booking@viva-models.com | Tél: +33 1 42 68 55 00",
      heroImage: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "Portrait Beauté Headshot", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80", caption: "Lumière naturelle neutre" },
        { title: "Plein Pied Commercial", url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80", caption: "Style Prêt-à-Porter Chic" },
        { title: "Profil & Mouvement", url: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=600&q=80", caption: "Postures dynamique & studio" },
      ],
      colorPalette: ["#18181B", "#F4F4F5", "#D4AF37", "#A1A1AA"],
      specsTable: [
        { label: "Hauteur", value: "178 cm / 5'10\"" },
        { label: "Poitrine / Bust", value: "85 cm / 33B" },
        { label: "Taille / Waist", value: "61 cm / 24\"" },
        { label: "Hanches / Hips", value: "89 cm / 35\"" },
        { label: "Yeux / Eyes", value: "Verts / Green" },
        { label: "Cheveux / Hair", value: "Châtains clairs / Light Brown" },
        { label: "Pointure / Shoes", value: "39 EU / 8 US" },
      ],
      loreOrDescription:
        "Modèle disponible pour campagnes internationales, défilés de mode, éditoriaux presse, cosmétique et rôles à la télévision. Passport international valide et disponible en déplacement mondial.",
    },
  },

  actor_performer: {
    label: "Acteur & Comédien (Cinéma & Théâtre)",
    iconName: "Smile",
    category: "Théâtre & Cinéma",
    description: "Book de comédien, headshots casting, mensurations physiques, bande-démo (showreel) et rôles majeurs au théâtre et à l'écran.",
    defaultCV: {
      fullName: "Julien Vaneau",
      jobTitle: "Comédien & Acteur (Théâtre, Longs-Métrages & Doublage)",
      email: "julien.vaneau@agence-talents.fr",
      phone: "+33 6 88 77 66 55",
      location: "Paris / Tournage Europe",
      website: "https://julienvaneau-comedien.com",
      githubOrPortfolio: "https://vimeo.com/julienvaneau-showreel",
      photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Comédien passionné diplômé du Conservatoire National Supérieur d'Art Dramatique (CNSAD). 10 ans d'expérience au théâtre classique et contemporain ainsi que dans des séries TV et longs-métrages. Maîtrise des techniques d'improvisation, du jeu face caméra et du travail de voix / doublage.",
      experiences: [
        {
          id: "exp-1",
          role: "Rôle Principal (Cyrano) - Théâtre",
          company: "Compagnie Molière & Théâtre National",
          period: "2022 - 2024",
          location: "Paris / Tournée Nationale",
          bullets: [
            "Interprétation du rôle titre sur 120 représentations au Théâtre de l'Odéon et en tournée européenne.",
            "Direction d'ateliers d'escrime artistique et de diction dramatique pour la troupe.",
          ],
        },
        {
          id: "exp-2",
          role: "Rôle Secondaire (Capitaine Moreau) - Cinéma",
          company: "Gaumont / Canal+ Création Originale",
          period: "2021",
          location: "Paris / Marseille",
          bullets: [
            "Rôle récurrent dans la saison 2 de la série dramatique historique 'Les Ombres de Paris'.",
            "Jeu d'acteur immersif face caméra, cascades physiques et escrime ancienne.",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "Diplôme National Supérieur Professionnel de Comédien",
          institution: "CNSAD Paris (Conservatoire National Supérieur)",
          year: "2018",
          details: "Masterclass sous la direction de grands metteurs en scène.",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Jeu & Spécialités Scéniques",
          skills: ["Jeu Face Caméra", "Théâtre Classique & Versification", "Doublage & Voix Off (Studio)", "Improvisation Théâtrale", "Escrime Artistique & Combat Scénique", "Chant Baryton"],
        },
      ],
      languages: ["Français (Natif - Accent Neutre)", "Anglais (Bilingue - Accent Britannique/US)", "Italien (Courant)"],
      certifications: ["Permis B & Moto", "Attestation Escrime de Spectacle Niveau 3"],
      portfolioQrUrl: "https://vimeo.com/julienvaneau-showreel",
    },
    defaultVisual: {
      templateType: "model_card",
      title: "Julien Vaneau - Carte Casting & Book Comédien",
      subtitle: "Fiche d'Artiste & Mensurations Casting - Agence Artistique",
      artistName: "Julien Vaneau",
      contactInfo: "Agent Artistique : Agence Cinesens - contact@cinesens-agency.fr | Tél: +33 1 45 60 70 80",
      heroImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "01. Headshot Face Studio", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80", caption: "Lumière studio expressive" },
        { title: "02. Portrait Sourire / Comédie", url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80", caption: "Expression chaleureuse et naturelle" },
        { title: "03. Vue Profil Neutre", url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80", caption: "Profil casting haute définition" },
        { title: "04. Plan En Pied (Full Body)", url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80", caption: "Posture et silhouette élégante" },
        { title: "05. Rôle Dramatique / Dark", url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80", caption: "Look Cinéma Noir & Émotion" },
        { title: "06. Photo de Scène / Plateau", url: "https://images.unsplash.com/photo-1469488865564-c2de10f69f96?auto=format&fit=crop&w=600&q=80", caption: "En jeu sur plateau de tournage" },
      ],
      colorPalette: ["#18181B", "#E4E4E7", "#B91C1C", "#71717A"],
      specsTable: [
        { label: "Taille / Height", value: "182 cm / 6'0\"" },
        { label: "Confection / Suit", value: "50 EU / 40R US" },
        { label: "Pointure / Shoes", value: "43 EU / 10 US" },
        { label: "Yeux / Eyes", value: "Noisette / Hazel" },
        { label: "Cheveux / Hair", value: "Bruns ondulés / Dark Brown" },
        { label: "Tessiture Voix", value: "Baryton chaud (Voice-over & Doublage)" },
        { label: "Bande-Démo / Showreel", value: "vimeo.com/julienvaneau-showreel (HD 4K)" },
      ],
      loreOrDescription:
        "Comédien représenté par l'Agence Cinesens. Disponible pour rôles au cinéma, séries TV, pièces de théâtre classiques et contemporaines, ainsi que doublage voix et voix off publicitaires.",
    },
  },

  cinematographer: {
    label: "Chef Opérateur & Directeur de la Photographie",
    iconName: "Film",
    category: "Cinéma & Audiovisuel",
    description: "Book de cadrage et de lumière, showreel optique, configurations caméras (ARRI/RED) et grilles d'éclairage.",
    defaultCV: {
      fullName: "Antoine Lambert",
      jobTitle: "Chef Opérateur & Directeur de la Photographie (AFC / Director of Photography)",
      email: "antoine.lambert@dop-cinema.com",
      phone: "+33 6 12 99 88 77",
      location: "Paris / International",
      website: "https://antoinelambert-dop.com",
      githubOrPortfolio: "https://vimeo.com/antoinelambert-showreel",
      photoUrl: "https://images.unsplash.com/photo-1500048993953-d23a43622f07?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Directeur de la photographie avec 11 ans d'expérience sur longs-métrages, séries télévisées et publicités de luxe. Spécialisé dans l'éclairage dramatique, la maîtrise des optiques anamorphic vintage et les rigs de caméras haute dynamique (ARRI Alexa 35, RED V-Raptor, Sony VENICE).",
      experiences: [
        {
          id: "exp-1",
          role: "Directeur de la Photographie (Long-Métrage)",
          company: "Pathé & Wild Bunch Productions",
          period: "2023",
          location: "France / Islande",
          bullets: [
            "Direction de l'image du long-métrage dramatique 'L'Hiver Obscur' tourné en conditions extrêmes en Islande.",
            "Choix des séries d'optiques Cooke Anamorphic /i Full Frame et boîtier ARRI Alexa LF.",
            "Supervision d'une équipe image de 14 techniciens (cadreurs, gaffers, pointeurs, étalonneurs).",
          ],
        },
        {
          id: "exp-2",
          role: "Chef Opérateur Publicité & Clips",
          company: "Iconoclast / Prodigious",
          period: "2019 - 2022",
          location: "Paris / Milan",
          bullets: [
            "Création de la signature visuelle pour plus de 40 campagnes publicitaires automobiles et parfums de luxe.",
            "Collaboration étroite avec les étalonneurs sur DaVinci Resolve Studio pour la création de LUTs de tournage personnalisées.",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "Master Image & Cinéma",
          institution: "École Nationale Supérieure Louis-Lumière",
          year: "2015",
          details: "Mention Très Bien - Spécialisation Éclairage & Optiques.",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Caméras & Rigs",
          skills: ["ARRI Alexa 35 & LF", "RED V-Raptor 8K", "Sony VENICE 2", "Optiques Anamorphic & Sphériques Vintage", "Steadicam & Rigs Ronin 2"],
        },
        {
          id: "sk-2",
          category: "Lumière & Post-Production",
          skills: ["Éclairage Plateau Grand Format (HMI/LED Astera/SkyPanel)", "Color Grading DaVinci Resolve", "Création de LUTs On-Set", "Lighting Diagrams & CineSync"],
        },
      ],
      languages: ["Français (Natif)", "Anglais (Bilingue)"],
      certifications: ["Membre Associé AFC (Association Française des Directeurs de la Photographie)"],
      portfolioQrUrl: "https://antoinelambert-dop.com",
    },
    defaultVisual: {
      templateType: "cinema_pitch",
      title: "L'Hiver Obscur - Dossier d'Image & Stills",
      subtitle: "Showcase Direction de la Photographie & Rendu Optique 35mm",
      artistName: "Antoine Lambert, AFC",
      contactInfo: "antoine.lambert@dop-cinema.com | Agent: agents-cinematographers.com",
      heroImage: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "Still 01 - Plan Éclairage Nuit", url: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80", caption: "Optique Cooke Anamorphic 50mm - T2.3" },
        { title: "Still 02 - Portrait Lumière Naturelle", url: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?auto=format&fit=crop&w=600&q=80", caption: "ARRI Alexa 35 + Filtre Diffusion Pro-Mist" },
      ],
      colorPalette: ["#0B0F19", "#1E293B", "#38BDF8", "#F59E0B"],
      specsTable: [
        { label: "Caméra Principale", value: "ARRI Alexa 35 Large Format" },
        { label: "Série d'Optiques", value: "Cooke Anamorphic /i Full Frame Plus" },
        { label: "Format d'Image", value: "2.39:1 Anamorphic Uncropped" },
        { label: "Workflow Étalonnage", value: "ACEScct / DaVinci Resolve 32-bit float" },
      ],
      loreOrDescription:
        "Étude d'éclairage pour les séquences nocturnes de 'L'Hiver Obscur'. Utilisation de tubes LED Astera Titan synchronisés et projecteurs ARRI SkyPanel S360 pour simuler une aurore boréale pulsée.",
    },
  },

  makeup_sfx: {
    label: "Make-up Artist & Prothésiste SFX",
    iconName: "Palette",
    category: "Cinéma, Théâtre & SFX",
    description: "Portfolio de maquillages effets spéciaux, prothèses silicone/latex, transformations d'acteurs et maquillages de scène.",
    defaultCV: {
      fullName: "Clara Deschamps",
      jobTitle: "Chef Maquilleuse & Artiste Prothésiste SFX Cinéma/Théâtre",
      email: "clara.sfx@makeup-studio.fr",
      phone: "+33 6 33 22 11 00",
      location: "Paris / Lyon",
      website: "https://claradeschamps-sfx.com",
      githubOrPortfolio: "https://instagram.com/claradeschamps_sfx",
      photoUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Chef Maquilleuse et Prothésiste SFX d'expérience avec 8 ans de travail sur les plateaux de tournage cinématographiques et dans les théâtres nationaux. Spécialisée dans la sculpture ZBrush/terre, les moulages en silicone Platsil Gel, l'application de prothèses ultra-photoréalistes et le maquillage beauté/époque.",
      experiences: [
        {
          id: "exp-1",
          role: "Chef Prothésiste & Maquilleuse SFX",
          company: "Atelier Effets Spéciaux Métamorphose",
          period: "2021 - Présent",
          location: "Paris",
          bullets: [
            "Conception et pose des 45 prothèses faciales en silicone pour le long-métrage fantastique 'L'Enfant de la Nuit'.",
            "Moulage d'acteurs (lifecasting en alginate et silicone), tirage en mousse de latex et peinture à l'alcool Skin Illustrator.",
          ],
        },
        {
          id: "exp-2",
          role: "Maquilleuse Plateau & Théâtre",
          company: "Opéra National de Paris & Comédie-Française",
          period: "2018 - 2021",
          location: "Paris",
          bullets: [
            "Création des maquillages historiques et pose de perruques / postiches pour les solistes d'opéra.",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "Diplôme d'État Maquillage Artistique & Effets Spéciaux",
          institution: "ITM Paris (Institut Technique du Maquillage)",
          year: "2017",
          details: "Spécialisation prothèses avancées & animatronique.",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Techniques SFX & Moulage",
          skills: ["Lifecasting (Empreinte silicone/alginate)", "Sculpture Prothétique (Chavant / ZBrush)", "Tirage Silicone Platsil Gel & Mousse Latex", "Peinture Alcool & Aérographe", "Pose de Postiches & Perruques d'Époque", "Maquillage Beauté & High-Definition HD"],
        },
      ],
      languages: ["Français", "Anglais"],
      certifications: ["Certification SFX Prosthetics Master (London Makeup Academy)"],
      portfolioQrUrl: "https://claradeschamps-sfx.com",
    },
    defaultVisual: {
      templateType: "character_sheet",
      title: "Prothèse Creature SFX - Transformation 'Gorgone'",
      subtitle: "Fiche Technique & Breakdown de Transformation Maquillage / SFX Cinéma",
      artistName: "Clara Deschamps",
      contactInfo: "clara.sfx@makeup-studio.fr | Instagram: @claradeschamps_sfx",
      heroImage: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "Sculpture en Chavant NSP", url: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80", caption: "Étape 1: Modelage des rides et textures de peau" },
        { title: "Tirage Silicone & Peinture Aérographe", url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80", caption: "Étape 2: Injection Platsil Gel 10 & pigments" },
        { title: "Pose Finale sur Acteur sur Plateau", url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80", caption: "Étape 3: Raccord des bords à l'acétone et raccord HD" },
      ],
      colorPalette: ["#1C1917", "#B91C1C", "#D97706", "#78350F"],
      specsTable: [
        { label: "Matériau Prothèse", value: "Silicone Platsil Gel 10 encapsulé Baldiez" },
        { label: "Temps de Pose", value: "3h30 par session de tournage" },
        { label: "Durabilité", value: "Résistance à l'eau, sueur et projecteurs chauds" },
        { label: "Adhésif Raccord", value: "Pros-Aide & Medical Grade Silicone Adhesive" },
      ],
      loreOrDescription:
        "Prothèse intégrale du visage et du cou conçue pour le personnage principal du long-métrage. Les bords ultra-fins de 0.1mm se fondent parfaitement sous caméra 8K sans raccord visible.",
    },
  },

  stage_director: {
    label: "Metteur en Scène & Scénographe (Théâtre & Opéra)",
    iconName: "BookOpen",
    category: "Théâtre & Live",
    description: "Dossier d'intention de mise en scène, plans de scénographie théâtrale, distribution et maquettes 3D de plateau.",
    defaultCV: {
      fullName: "Matthias Thorne",
      jobTitle: "Metteur en Scène & Scénographe (Théâtre & Opéra)",
      email: "matthias.thorne@theatre-creation.org",
      phone: "+33 6 99 88 77 11",
      location: "Paris / Strasbourg",
      website: "https://matthiasthorne-theatre.org",
      githubOrPortfolio: "https://matthiasthorne-theatre.org/dossiers",
      photoUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Metteur en scène et scénographe renommé avec 14 ans d'activité dans les théâtres nationaux et festivals d'art dramatique européens. Spécialisé dans la réécriture visuelle contemporaine de textes classiques, l'intégration de dispositifs scéniques automatisés et la direction d'acteurs de premier plan.",
      experiences: [
        {
          id: "exp-1",
          role: "Metteur en Scène Principal",
          company: "Théâtre National de Strasbourg / Festival d'Avignon",
          period: "2020 - Présent",
          location: "Strasbourg / Avignon",
          bullets: [
            "Conception et mise en scène de la création 'Macbeth - Les Ombres du Pouvoir' au Cour d'Honneur du Palais des Papes.",
            "Direction d'une équipe de 22 comédiens, 10 musiciens et 15 techniciens de plateau.",
            "Création de la scénographie modulaire inclinée avec projections vidéo immersives.",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "Diplôme de Mise en Scène & Scénographie",
          institution: "École du Théâtre National de Bretagne (TNB)",
          year: "2013",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Direction & Scénographie",
          skills: ["Mise en Scène Théâtrale & Opéra", "Conception Scénographique 3D (SketchUp / Blender)", "Direction d'Acteurs & Dramaturgie", "Plan de Feu & Création Lumière", "Dispositifs Scéniques Mécanisés"],
        },
      ],
      languages: ["Français", "Anglais", "Allemand"],
      certifications: ["Lauréat du Prix de la Critique Théâtrale 2022"],
      portfolioQrUrl: "https://matthiasthorne-theatre.org",
    },
    defaultVisual: {
      templateType: "cinema_pitch",
      title: "Macbeth : Dossier d'Intention & Scénographie",
      subtitle: "Notes de Mise en Scène & Maquette 3D de Plateau - Festival d'Avignon",
      artistName: "Matthias Thorne",
      contactInfo: "matthias.thorne@theatre-creation.org | Tél: +33 1 40 10 20 30",
      heroImage: "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "Maquette 3D du Plateau Incliné", url: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=600&q=80", caption: "Miroir d'eau réfléchissant et plan incliné 15°" },
        { title: "Création Lumière - Acte III", url: "https://images.unsplash.com/photo-1469488865564-c2de10f69f96?auto=format&fit=crop&w=600&q=80", caption: "Douche de lumière blanche rasante" },
      ],
      colorPalette: ["#09090B", "#DC2626", "#71717A", "#FAFAFA"],
      specsTable: [
        { label: "Scène Cible", value: "Plateau d'Opéra / Cour d'Honneur (25m ouverture)" },
        { label: "Durée Spectacle", value: "2h15 sans entracte" },
        { label: "Distribution", value: "14 Comédiens + 4 Performeurs physiques" },
        { label: "Effets Spécialisés", value: "Brouillard lourd CO2 + Écran d'eau brumisée" },
      ],
      loreOrDescription:
        "Note d'intention : Cette mise en scène de Macbeth transpose le drame shakespearien dans un espace scénique épuré au sol d'eau sombre, où chaque geste des acteurs laisse des rides indélébiles sur le miroir du pouvoir.",
    },
  },

  fullstack_techlead: {
    label: "Développeur Full-Stack & Tech Lead",
    iconName: "Zap",
    category: "Informatique & Tech",
    description: "Format 2 colonnes asymétriques axé sur l'architecture logicielle, les stacks techniques et les réalisations chiffrées.",
    defaultCV: {
      fullName: "Marc-Antoine Dubois",
      jobTitle: "Senior Full-Stack Architect & Tech Lead",
      email: "marc.dubois@devtech.io",
      phone: "+33 6 44 22 11 00",
      location: "Lyon, France",
      website: "https://marcdubois.dev",
      githubOrPortfolio: "https://github.com/marcdubois-dev",
      photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Architecte Web Full-Stack avec 9 ans d'expérience dans la conception d'applications SaaS haute performance à fort trafic. Spécialiste React, TypeScript, Node.js, architectures Serverless et bases de données scalables (Firestore/PostgreSQL). Passionné par la qualité de code, le CI/CD et l'expérience développeur.",
      experiences: [
        {
          id: "exp-1",
          role: "Tech Lead Full-Stack",
          company: "CloudScale Software Inc.",
          period: "2021 - Présent",
          location: "Remote",
          bullets: [
            "Conception et encadrement de l'architecture d'un SaaS utilisé par 250,000 utilisateurs quotidiens.",
            "Optimisation des performances React/Vite (temps de chargement réduit de 45%).",
            "Mise en place du pipeline CI/CD automatisé et supervision des tests d'intégration.",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "Diplôme d'Ingénieur en Informatique",
          institution: "INSA Lyon",
          year: "2017",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Languages & Frameworks",
          skills: ["TypeScript", "React / Next.js", "Node.js / Express", "Tailwind CSS", "Python / FastApi", "GraphQL"],
        },
        {
          id: "sk-2",
          category: "Databases & Cloud Infrastructure",
          skills: ["Firebase / Firestore", "PostgreSQL / Cloud SQL", "Docker & Kubernetes", "Google Cloud Platform", "Vite & Vitest"],
        },
      ],
      languages: ["Français (Natif)", "Anglais (Courant C1)"],
      certifications: ["Google Cloud Professional Cloud Architect", "AWS Certified Developer"],
      portfolioQrUrl: "https://marcdubois.dev",
    },
    defaultVisual: {
      templateType: "artist_portfolio",
      title: "CloudScale Core Platform Architecture",
      subtitle: "Vitrine Technique & Showcase d'Ingénierie Logicielle High-Performance",
      artistName: "Marc-Antoine Dubois",
      contactInfo: "marc.dubois@devtech.io | GitHub: github.com/marcdubois-dev",
      heroImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "Dashboard temps-réel React", url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80", caption: "Data viz D3.js + Recharts" },
        { title: "Architecture Microservices Backend", url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80", caption: "Node.js, Redis, Cloud Run" },
      ],
      colorPalette: ["#0F172A", "#3B82F6", "#10B981", "#64748B"],
      specsTable: [
        { label: "Uptime Système", value: "99.99% SLA Cloud" },
        { label: "Latence API Moyenne", value: "< 45 ms" },
        { label: "Couverture de Tests", value: "92% Unit & Integration tests" },
      ],
      loreOrDescription:
        "Présentation de la refonte globale de l'application SaaS CloudScale. Migration vers une architecture micro-frontends temps réel sur Cloud Run avec synchronisation optimisée.",
    },
  },

  editorial_designer: {
    label: "Auteur & Designer Éditorial (Book & Publishing)",
    iconName: "BookOpen",
    category: "Édition & Graphisme",
    description: "Présentation de livres, revues d'art, maquettes de mise en page, grilles typographiques et couvertures.",
    defaultCV: {
      fullName: "Camille Valette",
      jobTitle: "Designer Éditorial & Designer Typographique",
      email: "camille@valette-design.fr",
      phone: "+33 6 11 22 33 44",
      location: "Nantes, France",
      website: "https://valette-design.fr",
      githubOrPortfolio: "https://behance.net/camillevalette",
      photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Designer Éditorial passionné par le livre d'art, la typographie et le design de publication. Spécialisé dans l'élaboration de grilles typographiques rigoureuses, le choix de papiers nobles et la création de couvertures de caractère pour maisons d'édition indépendantes et institutionnelles.",
      experiences: [
        {
          id: "exp-1",
          role: "Designer Éditorial Senior",
          company: "Éditions du Regard",
          period: "2019 - Présent",
          location: "Paris / Nantes",
          bullets: [
            "Conception graphique complète de 20+ beaux livres d'art et d'architecture.",
            "Gestion de la fabrication imprimée (calage machine, choix des reliures et dorures).",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "DNSEP Design Graphique & Typographie",
          institution: "Écoles des Beaux-Arts d'Éxeter / Nantes",
          year: "2018",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Maquette & Print",
          skills: ["Adobe InDesign (Expert)", "Design Typographique", "Prépresse & Imprimerie", "Reliure d'Art & Suivi de Fabrication", "Grilles d'Édition"],
        },
      ],
      languages: ["Français", "Anglais"],
      certifications: ["Prix du Plus Beau Livre d'Art 2023"],
      portfolioQrUrl: "https://valette-design.fr",
    },
    defaultVisual: {
      templateType: "book_showcase",
      title: "L'Art du Mouvement : Catalogue d'Exposition",
      subtitle: "Showcase Éditorial & Spécifications Typographiques de Livre d'Art",
      artistName: "Camille Valette",
      contactInfo: "camille@valette-design.fr | Website: valette-design.fr",
      heroImage: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "Double Page d'Ouverture", url: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80", caption: "Grille à 12 colonnes & typographie serife" },
        { title: "Reliure & Couverture Marquée à Chaud", url: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=600&q=80", caption: "Toile de coton brute & dorure à chaud" },
      ],
      colorPalette: ["#1F1F1F", "#FBF9F5", "#C5A059", "#4A5568"],
      specsTable: [
        { label: "Format du Livre", value: "220 x 280 mm (Relié cartonné)" },
        { label: "Pagination", value: "240 Pages sur Papier Fedrigoni Symbol Tatami 150g" },
        { label: "Police de Titre", value: "Caslon Display & Univers LT Std" },
        { label: "Impression", value: "Quadrichromie Offset HR + 1 Ton Direct Pantone Gold" },
      ],
      loreOrDescription:
        "Ouvrage de référence imprimé à 2 000 exemplaires pour la biennale d'art contemporain. Design centré sur des marges généreuses et un rythme de lecture fluide.",
    },
  },

  uiux_designer: {
    label: "UI/UX & Product Designer",
    iconName: "Sliders",
    category: "Design Numérique",
    description: "Dossier de candidature axé sur le Design System, les wireframes, l'expérience utilisateur et les prototypes.",
    defaultCV: {
      fullName: "Maya Lin",
      jobTitle: "Lead UI/UX & Product Designer",
      email: "maya.lin@designstudio.io",
      phone: "+33 6 77 88 99 00",
      location: "Paris, France",
      website: "https://mayalin.design",
      githubOrPortfolio: "https://figma.com/@mayalin",
      photoUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Product Designer passionnée comptant 7 ans d'expérience dans la création d'interfaces complexes simples et intuitives. Spécialiste de l'architecture de Design Systems multi-plateformes, des ateliers de recherche utilisateurs et du prototypage interactif sous Figma & ProtoPie.",
      experiences: [
        {
          id: "exp-1",
          role: "Lead Product Designer",
          company: "Fintech Horizon",
          period: "2021 - Présent",
          location: "Paris",
          bullets: [
            "Refonte de l'expérience d'onboarding mobile (+38% de conversion).",
            "Création et maintenance du Design System tokenisé (utilisé par 30+ designers & devs).",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "Master Design d'Interaction & UX",
          institution: "L'École de Design Nantes Atlantique",
          year: "2019",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Design & UX Tools",
          skills: ["Figma & Tokens", "Recherche Utilisateur & Testing", "Prototypage Interactif", "Design System Architecture", "Micro-interactions Motion"],
        },
      ],
      languages: ["Français", "Anglais"],
      certifications: ["Figma Certified Design Systems Specialist"],
      portfolioQrUrl: "https://mayalin.design",
    },
    defaultVisual: {
      templateType: "artist_portfolio",
      title: "Fintech Horizon Mobile App Case Study",
      subtitle: "Présentation de Case Study UX/UI & Architecture de Design System",
      artistName: "Maya Lin",
      contactInfo: "maya.lin@designstudio.io | Portfolio: mayalin.design",
      heroImage: "https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "Composants du Design System", url: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&w=600&q=80", caption: "Boutons, cartes et variantes de thème" },
        { title: "User Journey & Wireframes Low-fi", url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80", caption: "Cartographie du parcours d'investissement" },
      ],
      colorPalette: ["#09090B", "#6366F1", "#10B981", "#E0E7FF"],
      specsTable: [
        { label: "Livrables", value: "Figma File, Specs iOS/Android, Design Tokens JSON" },
        { label: "Métrique Clé", value: "+38% Taux de Conversion Onboarding" },
      ],
      loreOrDescription:
        "Étude de cas détaillée de l'application Horizon. De la recherche d'empathie utilisateur aux composants Figma haute fidélité prêts pour les développeurs.",
    },
  },

  marketing_executive: {
    label: "Directeur Marketing & Communication",
    iconName: "Briefcase",
    category: "Corporate & Strategie",
    description: "Curriculum Vitae exécutif 1 colonne haute lisibilité avec résumé d'impact et indicateurs de croissance.",
    defaultCV: {
      fullName: "Victorien de Saint-Alban",
      jobTitle: "Directeur Marketing & Stratégie de Marque Global",
      email: "victorien.stalban@corporate.com",
      phone: "+33 1 40 50 60 70",
      location: "Paris 8ème / Genève",
      website: "https://victorien-stalban.com",
      githubOrPortfolio: "https://linkedin.com/in/victorien-stalban",
      photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
      profileSummary:
        "Dirigeant marketing chevronné avec 12 ans d'expérience dans la croissance d'entreprises internationales et le repositionnement de marques premium. Expert en stratégie Omnicanale, campagnes à fort retour sur investissement et direction d'équipes pluridisciplinaires.",
      experiences: [
        {
          id: "exp-1",
          role: "Chief Marketing Officer (CMO)",
          company: "Luxuria Group Global",
          period: "2020 - Présent",
          location: "Paris",
          bullets: [
            "Pilotage d'un budget marketing de 12M€ et encadrement de 35 collaborateurs.",
            "Augmentation du chiffre d'affaires e-commerce de +62% en 2 ans.",
          ],
        },
      ],
      education: [
        {
          id: "edu-1",
          degree: "MBA Executive Marketing & Management",
          institution: "HEC Paris",
          year: "2016",
        },
      ],
      skillCategories: [
        {
          id: "sk-1",
          category: "Management & Stratégie",
          skills: ["Stratégie de Marque", "Growth Marketing & Acquisition", "Direction Budgétaire (10M€+)", "Communication de Crise", "Partenariats Stratégiques"],
        },
      ],
      languages: ["Français", "Anglais", "Allemand"],
      certifications: ["HEC Executive Leadership Certification"],
      portfolioQrUrl: "https://linkedin.com/in/victorien-stalban",
    },
    defaultVisual: {
      templateType: "artist_portfolio",
      title: "Campagne Global Rebranding Luxuria 2024",
      subtitle: "Dossier de Présentation de Stratégie de Marque & Impact Commercial",
      artistName: "Victorien de Saint-Alban",
      contactInfo: "victorien.stalban@corporate.com | Paris / Genève",
      heroImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
      galleryImages: [
        { title: "Déploiement Omnicanal", url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80", caption: "Campagne Affichage & Digital" },
        { title: "Résultats de Croissance", url: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80", caption: "Croissance du CA de +62%" },
      ],
      colorPalette: ["#0F172A", "#D4AF37", "#1E293B", "#F8FAFC"],
      specsTable: [
        { label: "Budget de Campagne", value: "12 Millions €" },
        { label: "Audience Touchée", value: "45 Millions d'impressions internationales" },
      ],
      loreOrDescription:
        "Bilan stratégique et visuel du repositionnement global de Luxuria Group sur le marché européen et asiatique.",
    },
  },
};

export const CareerStudio: React.FC<CareerStudioProps> = ({
  isVS = true,
  geminiApiKey,
  triggerToast = (_msg: string) => {},
}) => {
  // --- STATE ---
  const [selectedRoleKey, setSelectedRoleKey] = useState<TargetJobRole>("character_designer");
  const [selectedCategory, setSelectedCategory] = useState<IndustryCategory>("Corporate & Business");
  const [selectedMatrixId, setSelectedMatrixId] = useState<string>("corp_resume");
  const [studioMode, setStudioMode] = useState<StudioMode>("cv");
  const [cvLayout, setCvLayout] = useState<CVLayoutType>("asymmetric_2col");
  const [themePalette, setThemePalette] = useState<ThemePalette>("slate_executive");

  // Get active matrix taxonomy item
  const activeMatrixSpec = MATRIX_TAXONOMY.find((m) => m.id === selectedMatrixId) || MATRIX_TAXONOMY[0];

  // Editable CV Data
  const [cvData, setCvData] = useState<CVData>(PRESET_JOBS.character_designer.defaultCV);

  // Editable Visual Deck Data
  const [visualData, setVisualData] = useState<VisualDeckData>(PRESET_JOBS.character_designer.defaultVisual);

  // QR Code preview data URL
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // AI & UI State
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [activeTabSubEditor, setActiveTabSubEditor] = useState<"info" | "experience" | "skills" | "custom_fields" | "design">("info");
  const [isPreviewExpanded, setIsPreviewExpanded] = useState<boolean>(false);
  const [isInteractivePreview, setIsInteractivePreview] = useState<boolean>(true);

  // Custom Fields State
  const [customFields, setCustomFields] = useState<CustomField[]>([
    {
      id: "cf-1",
      title: "Mensurations / Specs",
      value: "Taille: 182cm | Poids: 75kg | Pointure: 43 | Confection: 50",
      section: "header",
      isVisible: true,
    },
    {
      id: "cf-2",
      title: "Projets Clés / Highlights",
      value: "Lauréat Festival International du Film & Direction Artistique 2024",
      section: "summary",
      isVisible: true,
    },
  ]);

  // Section Visibility Map (Check/Uncheck Fields)
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({
    photo: true,
    header: true,
    contact: true,
    summary: true,
    experiences: true,
    education: true,
    skills: true,
    languages: true,
    qrcode: true,
    heroImage: true,
    lore: true,
    specs: true,
    palette: true,
    gallery: true,
  });

  // Section Reordering State (CV & Visual Deck)
  const [cvSectionOrder, setCvSectionOrder] = useState<string[]>([
    "summary",
    "experiences",
    "education",
    "skills",
    "custom_fields",
  ]);

  const [visualSectionOrder, setVisualSectionOrder] = useState<string[]>([
    "heroImage",
    "lore",
    "specs",
    "palette",
    "custom_fields",
    "gallery",
  ]);

  const documentRef = useRef<HTMLDivElement>(null);
  const singlePhotoInputRef = useRef<HTMLInputElement>(null);
  const heroImageInputRef = useRef<HTMLInputElement>(null);
  const multiPhotoInputRef = useRef<HTMLInputElement>(null);

  // Toggle Visibility of any field or section
  const toggleVisibility = (key: string) => {
    setVisibilityMap((prev) => {
      const nextVal = !prev[key];
      triggerToast(`${key} : ${nextVal ? "Visible" : "Masqué"}`);
      return { ...prev, [key]: nextVal };
    });
  };

  // Move CV Section Up/Down
  const moveCvSection = (sectionKey: string, direction: "up" | "down") => {
    setCvSectionOrder((prev) => {
      const index = prev.indexOf(sectionKey);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  // Move Visual Section Up/Down
  const moveVisualSection = (sectionKey: string, direction: "up" | "down") => {
    setVisualSectionOrder((prev) => {
      const index = prev.indexOf(sectionKey);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  // Photo Upload Handlers
  const handleSinglePhotoFile = (e: React.ChangeEvent<HTMLInputElement>, target: "profile" | "hero") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        if (target === "profile") {
          setCvData((prev) => ({ ...prev, photoUrl: result }));
          triggerToast("Photo de profil importée avec succès !");
        } else {
          setVisualData((prev) => ({ ...prev, heroImage: result }));
          triggerToast("Image héroïque de couverture importée !");
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleMultiPhotosFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let loadedCount = 0;
    const newItems: { title: string; url: string; caption?: string }[] = [];

    (Array.from(files) as File[]).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          newItems.push({
            title: `Photo ${visualData.galleryImages.length + idx + 1}`,
            url: result,
            caption: `Importé depuis ${file.name}`,
          });
        }
        loadedCount++;
        if (loadedCount === files.length) {
          setVisualData((prev) => ({
            ...prev,
            galleryImages: [...prev.galleryImages, ...newItems],
          }));
          triggerToast(`${loadedCount} Photo(s) ajoutée(s) au Book/Portfolio !`);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  // Custom Fields Handlers
  const addCustomField = (targetSection: CustomFieldSection = "summary") => {
    const newField: CustomField = {
      id: `cf-${Date.now()}`,
      title: "Nouveau Champ Personnalisé",
      value: "Saisissez la valeur ici...",
      section: targetSection,
      isVisible: true,
    };
    setCustomFields((prev) => [...prev, newField]);
    triggerToast("Nouveau champ personnalisé ajouté !");
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    setCustomFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
    triggerToast("Champ supprimé.");
  };

  const moveCustomField = (id: string, direction: "up" | "down") => {
    setCustomFields((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  // Auto-generate QR code whenever portfolio URL changes
  useEffect(() => {
    const url = cvData.portfolioQrUrl || "https://artstation.com";
    QRCode.toDataURL(url, { margin: 1, width: 250, color: { dark: "#0f172a", light: "#ffffff" } })
      .then((dataUrl) => setQrCodeDataUrl(dataUrl))
      .catch((err) => console.error("QR Code error:", err));
  }, [cvData.portfolioQrUrl]);

  // Handle Preset Selection Change
  const handleJobRoleChange = (roleKey: TargetJobRole) => {
    setSelectedRoleKey(roleKey);
    const preset = PRESET_JOBS[roleKey];
    if (preset) {
      setCvData(preset.defaultCV);
      setVisualData(preset.defaultVisual);
      triggerToast(`Modèle chargé : ${preset.label}`);
    }
  };

  // Handle Matrix Item Selection
  const handleMatrixSelect = (matrixId: string) => {
    setSelectedMatrixId(matrixId);
    const item = MATRIX_TAXONOMY.find((m) => m.id === matrixId);
    if (item) {
      setSelectedCategory(item.category);
      if (item.presetRoleKey && PRESET_JOBS[item.presetRoleKey]) {
        handleJobRoleChange(item.presetRoleKey);
      }
      triggerToast(`Format sélectionné : ${item.primaryMaterial} (${item.formatAndFileType})`);
    }
  };

  // --- GEMINI AI ENHANCER ---
  const handleAiEnhanceSummary = async () => {
    setIsAiGenerating(true);
    try {
      if (geminiApiKey) {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Tu es un expert en recrutement et direction artistique international. Rédige un résumé de profil professionnel captivant, très percutant et élégant (environ 3-4 phrases) pour un candidat postulant au poste de "${cvData.jobTitle}".
Catégorie Industrielle : ${activeMatrixSpec.category}.
Matériau / Support : ${activeMatrixSpec.primaryMaterial} (${activeMatrixSpec.formatAndFileType}).
Exigence Clé de Contenu : "${activeMatrixSpec.coreContentRequirements}".
Voici les éléments actuels du candidat : ${cvData.profileSummary}.
Donne uniquement le texte amélioré sans fioriture ni guillemets en respectant scrupuleusement l'exigence clé de contenu.`,
        });
        if (response.text) {
          setCvData((prev) => ({ ...prev, profileSummary: response.text.trim() }));
          triggerToast("Résumé optimisé selon la norme secteur par Gemini IA !");
        }
      } else {
        // Intelligent local enhancement fallback
        const enhanced = `${cvData.profileSummary} Spécialiste aligné sur les exigences de la catégorie ${activeMatrixSpec.category}, j'apporte des résultats chiffrés et une expertise avérée.`;
        setCvData((prev) => ({ ...prev, profileSummary: enhanced }));
        triggerToast("Résumé enrichi ! (Ajoutez votre clé Gemini API pour l'IA personnalisée)");
      }
    } catch (error) {
      console.error("AI Error:", error);
      triggerToast("Erreur lors de la génération IA.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // --- EXPORT FUNCTIONS ---
  const handleExportPDF = async () => {
    if (!documentRef.current) return;
    triggerToast("Génération du document PDF haute définition en cours...");
    try {
      const element = documentRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: null,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: element.offsetWidth,
        height: element.offsetHeight,
        windowWidth: 1200,
        windowHeight: Math.max(1600, element.offsetHeight + 200),
        onclone: (clonedDoc) => {
          sanitizeClonedDocument(clonedDoc);
          const clonedEl = clonedDoc.querySelector<HTMLElement>("[data-pdf-canvas='true']");
          if (clonedEl) {
            clonedEl.style.transform = "none";
            clonedEl.style.margin = "0";
            clonedEl.style.position = "relative";
            clonedEl.style.top = "0";
            clonedEl.style.left = "0";
            clonedEl.style.boxShadow = "none";
          }
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfPageHeight = pdf.internal.pageSize.getHeight(); // 297mm
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Render page 1
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pdfPageHeight;

      // Slice additional pages if content exceeds single A4 page
      while (heightLeft > 0) {
        position -= pdfPageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= pdfPageHeight;
      }

      pdf.save(`${cvData.fullName.replace(/\s+/g, "_")}_${studioMode === "cv" ? "CV" : "Portfolio"}.pdf`);
      triggerToast("PDF téléchargé avec succès !");
    } catch (err) {
      console.error("PDF Export error:", err);
      triggerToast("Erreur lors de la création du PDF. Impression standard lancée.");
      window.print();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Theme style mapping
  const getThemeClasses = () => {
    switch (themePalette) {
      case "dark_cyber":
        return {
          bg: "bg-slate-950 text-slate-100",
          accent: "text-cyan-400 bg-cyan-950/60 border-cyan-500/30",
          accentBg: "bg-cyan-500",
          sidebarBg: "bg-slate-900 border-slate-800",
          cardBg: "bg-slate-900/80 border-slate-800",
          pill: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20",
          textPrimary: "text-white",
          textSecondary: "text-slate-400",
        };
      case "amber_studio":
        return {
          bg: "bg-[#18181b] text-zinc-100",
          accent: "text-[#f05a28] bg-[#f05a28]/10 border-[#f05a28]/30",
          accentBg: "bg-[#f05a28]",
          sidebarBg: "bg-[#141414] border-[#27272a]",
          cardBg: "bg-[#202024] border-[#27272a]",
          pill: "bg-[#f05a28]/10 text-[#f05a28] border border-[#f05a28]/20",
          textPrimary: "text-zinc-50",
          textSecondary: "text-zinc-400",
        };
      case "emerald_executive":
        return {
          bg: "bg-emerald-950 text-emerald-50",
          accent: "text-emerald-400 bg-emerald-900/40 border-emerald-600/30",
          accentBg: "bg-emerald-500",
          sidebarBg: "bg-emerald-900/40 border-emerald-800/50",
          cardBg: "bg-emerald-900/20 border-emerald-800/40",
          pill: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
          textPrimary: "text-emerald-100",
          textSecondary: "text-emerald-300/70",
        };
      case "gold_onyx":
        return {
          bg: "bg-neutral-950 text-amber-100",
          accent: "text-amber-400 bg-amber-950/40 border-amber-600/30",
          accentBg: "bg-amber-500",
          sidebarBg: "bg-neutral-900 border-neutral-800",
          cardBg: "bg-neutral-900/70 border-neutral-800",
          pill: "bg-amber-500/10 text-amber-300 border border-amber-500/20",
          textPrimary: "text-amber-50",
          textSecondary: "text-neutral-400",
        };
      case "warm_editorial":
        return {
          bg: "bg-[#FAF7F2] text-[#2C2A29]",
          accent: "text-[#8B5E34] bg-[#F0ECE1] border-[#D9D2C3]",
          accentBg: "bg-[#8B5E34]",
          sidebarBg: "bg-[#F3EFE6] border-[#E5DEC9]",
          cardBg: "bg-white border-[#E2DAC6]",
          pill: "bg-[#8B5E34]/10 text-[#8B5E34] border border-[#8B5E34]/20",
          textPrimary: "text-[#1C1B1A]",
          textSecondary: "text-[#6B655F]",
        };
      case "slate_executive":
      default:
        return {
          bg: "bg-slate-900 text-slate-100",
          accent: "text-blue-400 bg-blue-950/50 border-blue-500/30",
          accentBg: "bg-blue-600",
          sidebarBg: "bg-slate-950 border-slate-800",
          cardBg: "bg-slate-800/60 border-slate-700/60",
          pill: "bg-blue-500/10 text-blue-300 border border-blue-500/20",
          textPrimary: "text-white",
          textSecondary: "text-slate-400",
        };
    }
  };

  const currentTheme = getThemeClasses();

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-neutral-950 text-neutral-100 overflow-hidden relative select-none">
      {/* HIDDEN FILE INPUTS FOR PHOTO IMPORT */}
      <input
        type="file"
        ref={singlePhotoInputRef}
        onChange={(e) => handleSinglePhotoFile(e, "profile")}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={heroImageInputRef}
        onChange={(e) => handleSinglePhotoFile(e, "hero")}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={multiPhotoInputRef}
        onChange={handleMultiPhotosFile}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* HEADER TOOLBAR */}
      <div className="shrink-0 bg-neutral-900/90 border-b border-neutral-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 z-30 shadow-lg">
        {/* Left: Section Title & Job Selector Dropdown */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-neutral-950 shadow-md">
            <Briefcase className="w-5 h-5 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-white">
                Career & Application Studio
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Normes Pro & Artistes
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">
              Curriculum Vitae 2 Colonnes, Portfolios & Model Sheets pour le recrutement
            </p>
          </div>
        </div>

        {/* Center: Job Role Dropdown Selector */}
        <div className="flex items-center gap-2 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800 shadow-inner w-72 md:w-80">
          <label className="text-[10px] uppercase font-bold text-neutral-400 px-1 shrink-0 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-amber-400" />
            Cible :
          </label>
          <div className="flex-1">
            <ThemedSelect
              value={selectedRoleKey}
              onChange={(val) => handleJobRoleChange(val as TargetJobRole)}
              options={Object.entries(PRESET_JOBS).map(([key, item]) => ({
                value: key as TargetJobRole,
                label: item.label,
                category: item.category,
              }))}
              isVS={isVS}
              size="sm"
            />
          </div>
        </div>

        {/* Right: Export & Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Photo Import Button */}
          <div className="relative group">
            <button
              onClick={() => {
                if (studioMode === "cv") {
                  singlePhotoInputRef.current?.click();
                } else {
                  multiPhotoInputRef.current?.click();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-xs rounded-lg border border-amber-500/30 transition cursor-pointer shadow-sm"
              title="Importer une photo depuis vos fichiers"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Importer Photo</span>
            </button>
          </div>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs rounded-lg shadow-md transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Télécharger PDF</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs rounded-lg border border-neutral-700 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer</span>
          </button>

          <button
            onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
            className={`p-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
              isPreviewExpanded
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"
            }`}
            title="Plein écran Aperçu"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SUB-BAR MODE & LAYOUT CONTROLS */}
      <div className="shrink-0 bg-neutral-900/60 border-b border-neutral-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-20">
        {/* Studio Mode Switcher */}
        <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800 gap-1">
          <button
            onClick={() => setStudioMode("cv")}
            className={`flex items-center gap-2 px-3 py-1 rounded-md font-bold transition cursor-pointer ${
              studioMode === "cv"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Curriculum Vitae (CV Pro)</span>
          </button>

          <button
            onClick={() => setStudioMode("visual_portfolio")}
            className={`flex items-center gap-2 px-3 py-1 rounded-md font-bold transition cursor-pointer ${
              studioMode === "visual_portfolio"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>2. Portfolio Artiste & Pitch Visuel</span>
          </button>
        </div>

        {/* Layout & Style options depending on mode */}
        {studioMode === "cv" ? (
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase text-neutral-400">Layout CV :</span>
            <div className="flex bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 gap-1">
              <button
                onClick={() => setCvLayout("asymmetric_2col")}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                  cvLayout === "asymmetric_2col" ? "bg-neutral-800 text-amber-400" : "text-neutral-400"
                }`}
              >
                2 Colonnes (Large + Court)
              </button>
              <button
                onClick={() => setCvLayout("executive_1col")}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                  cvLayout === "executive_1col" ? "bg-neutral-800 text-amber-400" : "text-neutral-400"
                }`}
              >
                1 Colonne Exécutif
              </button>
              <button
                onClick={() => setCvLayout("split_5050")}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                  cvLayout === "split_5050" ? "bg-neutral-800 text-amber-400" : "text-neutral-400"
                }`}
              >
                Équilibré 50/50
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-neutral-400">Modèle Visuel :</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[11px] font-bold border border-amber-500/20 uppercase">
              {visualData.templateType.replace("_", " ")}
            </span>
          </div>
        )}

        {/* Theme Palette Switcher */}
        <div className="flex items-center gap-2 w-64">
          <Palette className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <div className="flex-1">
            <ThemedSelect
              value={themePalette}
              onChange={(val) => setThemePalette(val as ThemePalette)}
              options={[
                { value: "slate_executive", label: "Slate Executive (Bleu / Gris)" },
                { value: "dark_cyber", label: "Studio Dark (Cyber Neon)" },
                { value: "amber_studio", label: "Amber Studio (Orange / Zinc)" },
                { value: "emerald_executive", label: "Émeraude Luxe" },
                { value: "gold_onyx", label: "Or & Onyx (Haute Couture)" },
                { value: "warm_editorial", label: "Éditorial Papier Crème" },
              ]}
              isVS={isVS}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* MATRIX TAXONOMY & FORMAT SPECIFICATIONS BAR */}
      <div className="shrink-0 bg-neutral-900 border-b border-neutral-800/80 px-4 py-2.5 space-y-2 z-10 shadow-md">
        {/* Industry Category Navigation Tabs */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1 mr-1">
              <Layers className="w-3.5 h-3.5" /> Secteur :
            </span>
            {(
              [
                "Corporate & Business",
                "Tech & Engineering",
                "Visual Arts & Design",
                "Performing Arts & Entertainment",
                "Academia Science & Medicine",
              ] as IndustryCategory[]
            ).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  const firstMatch = MATRIX_TAXONOMY.find((m) => m.category === cat);
                  if (firstMatch) {
                    handleMatrixSelect(firstMatch.id);
                  }
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                    : "bg-neutral-950/60 text-neutral-400 border border-neutral-800 hover:text-white hover:bg-neutral-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Deliverables Format Dropdown for selected Category */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold uppercase text-neutral-400">Format Deliverable :</span>
            <div className="w-64">
              <ThemedSelect
                value={selectedMatrixId}
                onChange={(val) => handleMatrixSelect(val)}
                options={MATRIX_TAXONOMY.filter((m) => m.category === selectedCategory).map((m) => ({
                  value: m.id,
                  label: `${m.primaryMaterial} (${m.formatAndFileType})`,
                  category: m.category,
                }))}
                isVS={isVS}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* ACTIVE FORMAT SPECIFICATION & CORE CONTENT REQUIREMENTS CARD */}
        <div className="bg-neutral-950/90 border border-amber-500/30 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-white text-xs tracking-wide">
                  {activeMatrixSpec.primaryMaterial}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                  {activeMatrixSpec.formatAndFileType}
                </span>
                <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-medium text-[10px] border border-neutral-700">
                  {activeMatrixSpec.sizeRatioLength}
                </span>
              </div>
              <p className="text-[11px] text-amber-200/90 mt-0.5 flex items-center gap-1 italic">
                <span className="font-bold not-italic text-amber-400">Exigence Contenu :</span> &quot;{activeMatrixSpec.coreContentRequirements}&quot;
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAiEnhanceSummary}
              disabled={isAiGenerating}
              className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-xs rounded-lg shadow transition cursor-pointer disabled:opacity-50"
              title="Générer / optimiser le résumé selon les exigences clés du secteur avec Gemini IA"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAiGenerating ? "IA en cours..." : "IA Optimiser (Norme Sectorielle)"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT WORKSPACE (SPLIT PANE: EDITOR LEFT / LIVE PREVIEW RIGHT) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: FORM EDITORS */}
        {!isPreviewExpanded && (
          <div className="w-full md:w-[480px] lg:w-[520px] bg-neutral-900/90 border-r border-neutral-800 flex flex-col overflow-hidden shrink-0">
            {/* Editor Sub-Tab Navigation */}
            <div className="flex border-b border-neutral-800 bg-neutral-950/60 p-2 gap-1 shrink-0">
              <button
                onClick={() => setActiveTabSubEditor("info")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTabSubEditor === "info"
                    ? "bg-neutral-800 text-amber-400 border border-neutral-700"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Identité</span>
              </button>

              <button
                onClick={() => setActiveTabSubEditor("experience")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTabSubEditor === "experience"
                    ? "bg-neutral-800 text-amber-400 border border-neutral-700"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Parcours</span>
              </button>

              <button
                onClick={() => setActiveTabSubEditor("skills")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTabSubEditor === "skills"
                    ? "bg-neutral-800 text-amber-400 border border-neutral-700"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Compétences</span>
              </button>

              <button
                onClick={() => setActiveTabSubEditor("custom_fields")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTabSubEditor === "custom_fields"
                    ? "bg-neutral-800 text-amber-400 border border-neutral-700"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Champs & Visibilité</span>
              </button>

              <button
                onClick={() => setActiveTabSubEditor("design")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTabSubEditor === "design"
                    ? "bg-neutral-800 text-amber-400 border border-neutral-700"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{studioMode === "cv" ? "QR & Bio" : "Visuels Deck"}</span>
              </button>
            </div>

            {/* Form Fields Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {studioMode === "cv" ? (
                <>
                  {/* TAB 1: IDENTITÉ & CONTACT */}
                  {activeTabSubEditor === "info" && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                        <User className="w-4 h-4" /> Information Personnelle
                      </h3>

                      <div className="space-y-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-xs">
                        <div>
                          <label className="block text-neutral-400 mb-1 font-semibold">Nom Complet</label>
                          <input
                            type="text"
                            value={cvData.fullName}
                            onChange={(e) => setCvData({ ...cvData, fullName: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white font-bold focus:border-amber-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-neutral-400 mb-1 font-semibold">Titre du Poste / Spécialité</label>
                          <input
                            type="text"
                            value={cvData.jobTitle}
                            onChange={(e) => setCvData({ ...cvData, jobTitle: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-neutral-400 mb-1 font-semibold">Email</label>
                            <input
                              type="email"
                              value={cvData.email}
                              onChange={(e) => setCvData({ ...cvData, email: e.target.value })}
                              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-neutral-400 mb-1 font-semibold">Téléphone</label>
                            <input
                              type="text"
                              value={cvData.phone}
                              onChange={(e) => setCvData({ ...cvData, phone: e.target.value })}
                              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-neutral-400 mb-1 font-semibold">Localisation</label>
                            <input
                              type="text"
                              value={cvData.location}
                              onChange={(e) => setCvData({ ...cvData, location: e.target.value })}
                              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-neutral-400 mb-1 font-semibold">Photo Profil URL</label>
                            <input
                              type="text"
                              value={cvData.photoUrl}
                              onChange={(e) => setCvData({ ...cvData, photoUrl: e.target.value })}
                              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-neutral-400 mb-1 font-semibold">Site Web / Portfolio URL</label>
                          <input
                            type="text"
                            value={cvData.website}
                            onChange={(e) => setCvData({ ...cvData, website: e.target.value, portfolioQrUrl: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Bio Summary with AI Enhancer */}
                      <div className="space-y-2 bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-xs">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-neutral-300">Résumé de Profil Professionnel</label>
                          <button
                            onClick={handleAiEnhanceSummary}
                            disabled={isAiGenerating}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            {isAiGenerating ? "Génération..." : "Optimiser via IA"}
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={cvData.profileSummary}
                          onChange={(e) => setCvData({ ...cvData, profileSummary: e.target.value })}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-white text-xs focus:border-amber-500 focus:outline-none leading-relaxed"
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 2: EXPÉRIENCES & ÉDUDATION */}
                  {activeTabSubEditor === "experience" && (
                    <div className="space-y-4 text-xs">
                      <div className="flex items-center justify-between">
                        <h3 className="font-black uppercase text-amber-400 tracking-wider">
                          Expériences Professionnelles
                        </h3>
                        <button
                          onClick={() => {
                            const newExp: ExperienceItem = {
                              id: `exp-${Date.now()}`,
                              role: "Nouveau Poste",
                              company: "Studio / Entreprise",
                              period: "2023 - 2024",
                              location: "Paris",
                              bullets: ["Réalisation majeure N°1", "Projet d'envergure"],
                            };
                            setCvData({ ...cvData, experiences: [...cvData.experiences, newExp] });
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 bg-neutral-800 text-amber-400 rounded border border-neutral-700 hover:bg-neutral-700 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Ajouter Expérience
                        </button>
                      </div>

                      {cvData.experiences.map((exp, idx) => (
                        <div key={exp.id} className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-400 text-[11px]"># {idx + 1} - {exp.role}</span>
                            <button
                              onClick={() => {
                                setCvData({
                                  ...cvData,
                                  experiences: cvData.experiences.filter((e) => e.id !== exp.id),
                                });
                              }}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={exp.role}
                              onChange={(e) => {
                                const next = [...cvData.experiences];
                                next[idx].role = e.target.value;
                                setCvData({ ...cvData, experiences: next });
                              }}
                              placeholder="Intitulé du poste"
                              className="bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                            />
                            <input
                              type="text"
                              value={exp.company}
                              onChange={(e) => {
                                const next = [...cvData.experiences];
                                next[idx].company = e.target.value;
                                setCvData({ ...cvData, experiences: next });
                              }}
                              placeholder="Entreprise / Studio"
                              className="bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={exp.period}
                              onChange={(e) => {
                                const next = [...cvData.experiences];
                                next[idx].period = e.target.value;
                                setCvData({ ...cvData, experiences: next });
                              }}
                              placeholder="Période (ex: 2021 - Présent)"
                              className="bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                            />
                            <input
                              type="text"
                              value={exp.location}
                              onChange={(e) => {
                                const next = [...cvData.experiences];
                                next[idx].location = e.target.value;
                                setCvData({ ...cvData, experiences: next });
                              }}
                              placeholder="Ville / Pays"
                              className="bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-neutral-400 mb-1">Missions (une par ligne)</label>
                            <textarea
                              rows={3}
                              value={exp.bullets.join("\n")}
                              onChange={(e) => {
                                const next = [...cvData.experiences];
                                next[idx].bullets = e.target.value.split("\n");
                                setCvData({ ...cvData, experiences: next });
                              }}
                              className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white leading-relaxed"
                            />
                          </div>
                        </div>
                      ))}

                      {/* Formation & Diplômes */}
                      <div className="pt-2 border-t border-neutral-800 space-y-2">
                        <h3 className="font-black uppercase text-amber-400 tracking-wider">Formation & Diplômes</h3>
                        {cvData.education.map((edu, idx) => (
                          <div key={edu.id} className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800 space-y-1.5">
                            <input
                              type="text"
                              value={edu.degree}
                              onChange={(e) => {
                                const next = [...cvData.education];
                                next[idx].degree = e.target.value;
                                setCvData({ ...cvData, education: next });
                              }}
                              placeholder="Diplôme"
                              className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white font-bold"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={edu.institution}
                                onChange={(e) => {
                                  const next = [...cvData.education];
                                  next[idx].institution = e.target.value;
                                  setCvData({ ...cvData, education: next });
                                }}
                                placeholder="École / Université"
                                className="bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                              />
                              <input
                                type="text"
                                value={edu.year}
                                onChange={(e) => {
                                  const next = [...cvData.education];
                                  next[idx].year = e.target.value;
                                  setCvData({ ...cvData, education: next });
                                }}
                                placeholder="Année"
                                className="bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: COMPÉTENCES & LANGUES */}
                  {activeTabSubEditor === "skills" && (
                    <div className="space-y-4 text-xs">
                      <h3 className="font-black uppercase text-amber-400 tracking-wider">Catégories de Compétences</h3>
                      {cvData.skillCategories.map((cat, idx) => (
                        <div key={cat.id} className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                          <input
                            type="text"
                            value={cat.category}
                            onChange={(e) => {
                              const next = [...cvData.skillCategories];
                              next[idx].category = e.target.value;
                              setCvData({ ...cvData, skillCategories: next });
                            }}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white font-bold"
                          />
                          <div>
                            <label className="block text-[10px] text-neutral-400 mb-1">Compétences (séparées par une virgule)</label>
                            <input
                              type="text"
                              value={cat.skills.join(", ")}
                              onChange={(e) => {
                                const next = [...cvData.skillCategories];
                                next[idx].skills = e.target.value.split(",").map((s) => s.trim());
                                setCvData({ ...cvData, skillCategories: next });
                              }}
                              className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                            />
                          </div>
                        </div>
                      ))}

                      <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                        <label className="font-bold text-neutral-300">Langues pratiquées</label>
                        <input
                          type="text"
                          value={cvData.languages.join(", ")}
                          onChange={(e) =>
                            setCvData({ ...cvData, languages: e.target.value.split(",").map((s) => s.trim()) })
                          }
                          className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB: CHAMPS PERSONNALISÉS & VISIBILITÉ */}
                  {activeTabSubEditor === "custom_fields" && (
                    <div className="space-y-5 text-xs">
                      {/* Section 1: Visibility Checkboxes */}
                      <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                          <h3 className="font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                            <Eye className="w-4 h-4 text-amber-400" />
                            Apostrophes & Masquage des Éléments
                          </h3>
                          <span className="text-[10px] text-neutral-400">Cochez/Décochez pour afficher</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-neutral-200 font-semibold">
                          <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800 cursor-pointer hover:border-amber-500/40">
                            <input
                              type="checkbox"
                              checked={visibilityMap.photo ?? true}
                              onChange={() => toggleVisibility("photo")}
                              className="accent-amber-500 w-4 h-4 rounded"
                            />
                            <span>Photo Profil / Portrait</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800 cursor-pointer hover:border-amber-500/40">
                            <input
                              type="checkbox"
                              checked={visibilityMap.summary ?? true}
                              onChange={() => toggleVisibility("summary")}
                              className="accent-amber-500 w-4 h-4 rounded"
                            />
                            <span>Résumé / Profil</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800 cursor-pointer hover:border-amber-500/40">
                            <input
                              type="checkbox"
                              checked={visibilityMap.contact ?? true}
                              onChange={() => toggleVisibility("contact")}
                              className="accent-amber-500 w-4 h-4 rounded"
                            />
                            <span>Bloc Contact & Réseaux</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800 cursor-pointer hover:border-amber-500/40">
                            <input
                              type="checkbox"
                              checked={visibilityMap.experiences ?? true}
                              onChange={() => toggleVisibility("experiences")}
                              className="accent-amber-500 w-4 h-4 rounded"
                            />
                            <span>Expériences Pro</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800 cursor-pointer hover:border-amber-500/40">
                            <input
                              type="checkbox"
                              checked={visibilityMap.education ?? true}
                              onChange={() => toggleVisibility("education")}
                              className="accent-amber-500 w-4 h-4 rounded"
                            />
                            <span>Formation & Diplômes</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800 cursor-pointer hover:border-amber-500/40">
                            <input
                              type="checkbox"
                              checked={visibilityMap.skills ?? true}
                              onChange={() => toggleVisibility("skills")}
                              className="accent-amber-500 w-4 h-4 rounded"
                            />
                            <span>Compétences Clés</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800 cursor-pointer hover:border-amber-500/40">
                            <input
                              type="checkbox"
                              checked={visibilityMap.qrcode ?? true}
                              onChange={() => toggleVisibility("qrcode")}
                              className="accent-amber-500 w-4 h-4 rounded"
                            />
                            <span>QR Code Portfolio</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800 cursor-pointer hover:border-amber-500/40">
                            <input
                              type="checkbox"
                              checked={visibilityMap.gallery ?? true}
                              onChange={() => toggleVisibility("gallery")}
                              className="accent-amber-500 w-4 h-4 rounded"
                            />
                            <span>Galerie Photos / Book</span>
                          </label>
                        </div>
                      </div>

                      {/* Section 2: Custom Fields List */}
                      <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                          <h3 className="font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                            <Plus className="w-4 h-4 text-amber-400" />
                            Champs Personnalisés
                          </h3>
                          <button
                            onClick={() => addCustomField("summary")}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] rounded transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Ajouter</span>
                          </button>
                        </div>

                        {customFields.length === 0 ? (
                          <p className="text-neutral-500 italic text-[11px] text-center py-3">
                            Aucun champ personnalisé créé. Cliquez sur "Ajouter" pour créer votre premier champ sur mesure.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {customFields.map((cf, idx) => (
                              <div
                                key={cf.id}
                                className="bg-neutral-900 p-3 rounded-lg border border-neutral-800 space-y-2 relative"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => moveCustomField(cf.id, "up")}
                                      disabled={idx === 0}
                                      className="p-1 rounded bg-neutral-800 text-neutral-300 disabled:opacity-30 hover:bg-neutral-700"
                                      title="Déplacer vers le haut"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => moveCustomField(cf.id, "down")}
                                      disabled={idx === customFields.length - 1}
                                      className="p-1 rounded bg-neutral-800 text-neutral-300 disabled:opacity-30 hover:bg-neutral-700"
                                      title="Déplacer vers le bas"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                    <span className="font-bold text-amber-400 text-[11px]">Champ #{idx + 1}</span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1 text-[10px] text-neutral-300 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={cf.isVisible}
                                        onChange={(e) => updateCustomField(cf.id, { isVisible: e.target.checked })}
                                        className="accent-amber-500"
                                      />
                                      <span>Afficher</span>
                                    </label>
                                    <button
                                      onClick={() => removeCustomField(cf.id)}
                                      className="text-red-400 hover:text-red-300 p-1"
                                      title="Supprimer le champ"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] text-neutral-400 mb-0.5 font-semibold">
                                    Titre du Champ
                                  </label>
                                  <input
                                    type="text"
                                    value={cf.title}
                                    onChange={(e) => updateCustomField(cf.id, { title: e.target.value })}
                                    className="w-full bg-neutral-950 border border-neutral-700 rounded p-1.5 text-white font-bold"
                                    placeholder="ex: Mensurations, Récompenses, Agent..."
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] text-neutral-400 mb-0.5 font-semibold">
                                    Valeur du Champ
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={cf.value}
                                    onChange={(e) => updateCustomField(cf.id, { value: e.target.value })}
                                    className="w-full bg-neutral-950 border border-neutral-700 rounded p-1.5 text-white leading-relaxed"
                                    placeholder="Saisissez les détails de ce champ..."
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] text-neutral-400 mb-0.5 font-semibold">
                                    Rattacher à la Section
                                  </label>
                                  <ThemedSelect
                                    value={cf.section}
                                    onChange={(val) => updateCustomField(cf.id, { section: val as CustomFieldSection })}
                                    options={[
                                      { value: "header", label: "En-tête / Informations Générales" },
                                      { value: "summary", label: "Résumé & Profil" },
                                      { value: "experience", label: "Expériences Professionnelles" },
                                      { value: "education", label: "Formation & Diplômes" },
                                      { value: "skills", label: "Compétences & Langues" },
                                      { value: "contact", label: "Contact & Réseaux Sidebar" },
                                      { value: "portfolio_specs", label: "Spécifications & Book Visuel" },
                                    ]}
                                    isVS={isVS}
                                    size="sm"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: INTEGRATION QR & OPTIONS */}
                  {activeTabSubEditor === "design" && (
                    <div className="space-y-4 text-xs">
                      <h3 className="font-black uppercase text-amber-400 tracking-wider">QR Code Portfolio Intégré</h3>
                      <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-3">
                        <p className="text-neutral-400 text-[11px]">
                          Le QR code permet aux recruteurs de scanner directement votre CV papier pour accéder à votre portfolio interactif, ArtStation ou site web.
                        </p>
                        <div>
                          <label className="block text-neutral-400 mb-1 font-semibold">Cible du QR Code</label>
                          <input
                            type="text"
                            value={cvData.portfolioQrUrl}
                            onChange={(e) => setCvData({ ...cvData, portfolioQrUrl: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                          />
                        </div>

                        {qrCodeDataUrl && (
                          <div className="flex items-center gap-3 bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                            <img src={qrCodeDataUrl} alt="QR Code Preview" className="w-16 h-16 rounded bg-white p-1" />
                            <div>
                              <span className="text-[10px] text-green-400 font-bold block">✓ QR Code Généré</span>
                              <span className="text-[10px] text-neutral-400">{cvData.portfolioQrUrl}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* VISUAL DECK FORM EDITOR */
                <div className="space-y-4 text-xs">
                  <h3 className="font-black uppercase text-amber-400 tracking-wider">
                    Éditeur de Planche / Deck Visuel
                  </h3>

                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-3">
                    <div>
                      <label className="block text-neutral-400 mb-1 font-semibold">Titre du Projet / Modèle</label>
                      <input
                        type="text"
                        value={visualData.title}
                        onChange={(e) => setVisualData({ ...visualData, title: e.target.value })}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-400 mb-1 font-semibold">Sous-titre / Spécification</label>
                      <input
                        type="text"
                        value={visualData.subtitle}
                        onChange={(e) => setVisualData({ ...visualData, subtitle: e.target.value })}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-neutral-400 font-semibold">Image Héroïque de Couverture</label>
                        <button
                          type="button"
                          onClick={() => heroImageInputRef.current?.click()}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-neutral-800 text-amber-400 rounded border border-neutral-700 hover:bg-neutral-700 cursor-pointer"
                        >
                          <UploadCloud className="w-3 h-3" /> Importer Photo
                        </button>
                      </div>
                      <input
                        type="text"
                        value={visualData.heroImage}
                        onChange={(e) => setVisualData({ ...visualData, heroImage: e.target.value })}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white"
                        placeholder="https://..."
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-400 mb-1 font-semibold">Description / Lore de Présentation</label>
                      <textarea
                        rows={3}
                        value={visualData.loreOrDescription}
                        onChange={(e) => setVisualData({ ...visualData, loreOrDescription: e.target.value })}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-white leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Visual Gallery items */}
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                      <h4 className="font-bold text-neutral-300">Galerie de Références (Vues & Planches)</h4>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => multiPhotoInputRef.current?.click()}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded transition cursor-pointer"
                          title="Importer plusieurs photos à la fois pour le book/compcard"
                        >
                          <UploadCloud className="w-3 h-3" />
                          <span>Importer Photos</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newImg = {
                              title: `Photo ${visualData.galleryImages.length + 1}`,
                              url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
                              caption: "Nouvelle référence visuelle",
                            };
                            setVisualData({
                              ...visualData,
                              galleryImages: [...visualData.galleryImages, newImg],
                            });
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-neutral-800 text-amber-400 rounded border border-neutral-700 hover:bg-neutral-700 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Ajouter Vue</span>
                        </button>
                      </div>
                    </div>

                    {visualData.galleryImages.map((img, idx) => (
                      <div key={idx} className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-400">Photo #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = visualData.galleryImages.filter((_, i) => i !== idx);
                              setVisualData({ ...visualData, galleryImages: next });
                            }}
                            className="text-red-400 hover:text-red-300 text-[10px] flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Supprimer
                          </button>
                        </div>

                        <input
                          type="text"
                          value={img.title}
                          onChange={(e) => {
                            const next = [...visualData.galleryImages];
                            next[idx].title = e.target.value;
                            setVisualData({ ...visualData, galleryImages: next });
                          }}
                          placeholder="Titre de la vue"
                          className="w-full bg-neutral-950 border border-neutral-700 rounded p-1.5 text-white font-semibold"
                        />
                        <input
                          type="text"
                          value={img.url}
                          onChange={(e) => {
                            const next = [...visualData.galleryImages];
                            next[idx].url = e.target.value;
                            setVisualData({ ...visualData, galleryImages: next });
                          }}
                          placeholder="Image URL (ou importez via le bouton ci-dessus)"
                          className="w-full bg-neutral-950 border border-neutral-700 rounded p-1.5 text-white text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RIGHT PANEL: LIVE PREVIEW CONTAINER */}
        <div className="flex-1 bg-neutral-950 p-4 lg:p-8 overflow-y-auto flex flex-col items-center justify-start">
          {/* Interactive Mode Bar above canvas */}
          <div className="w-full max-w-[850px] mb-3 flex items-center justify-between bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-neutral-300 shadow-md">
            <div className="flex items-center gap-2 font-bold">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Aperçu Interactif : Survolez les blocs pour les déplacer ou les masquer</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => addCustomField("summary")}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-bold text-[11px] rounded-lg border border-amber-500/30 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Champ Sur Mesure</span>
              </button>
            </div>
          </div>

          {/* THE PRINTABLE / EXPORTABLE A4 RENDERING CANVAS */}
          <div
            ref={documentRef}
            data-pdf-canvas="true"
            className={`w-full max-w-[850px] min-h-[1100px] shadow-2xl rounded-sm p-8 transition-all duration-300 ${currentTheme.bg}`}
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {studioMode === "cv" ? (
              /* --- CV RENDERER --- */
              <div className="h-full flex flex-col justify-between">
                {/* HEADER BLOCK */}
                {visibilityMap.header !== false && (
                  <div className="group relative border-b border-current/20 pb-6 mb-6 flex items-start justify-between gap-6 transition hover:ring-2 hover:ring-amber-500/40 rounded-lg p-2 -m-2">
                    {/* Floating Controls for Header */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 bg-neutral-900/95 text-white p-1 rounded-md border border-neutral-700 shadow-lg z-20">
                      <button
                        onClick={() => toggleVisibility("header")}
                        className="p-1 hover:text-amber-400"
                        title="Masquer l'en-tête"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1">
                      <h1 className={`text-3xl font-black uppercase tracking-tight ${currentTheme.textPrimary}`}>
                        {cvData.fullName}
                      </h1>
                      <h2 className={`text-sm font-bold uppercase tracking-wider mt-1 ${currentTheme.accent}`}>
                        {cvData.jobTitle}
                      </h2>
                      {visibilityMap.summary !== false && (
                        <p className={`text-xs mt-3 leading-relaxed max-w-xl ${currentTheme.textSecondary}`}>
                          {cvData.profileSummary}
                        </p>
                      )}

                      {/* Header Attached Custom Fields */}
                      {customFields
                        .filter((cf) => cf.section === "header" && cf.isVisible)
                        .map((cf) => (
                          <div key={cf.id} className="mt-3 p-2 bg-black/10 rounded-md border border-current/20 text-xs">
                            <span className={`font-bold block uppercase tracking-wider text-[10px] ${currentTheme.accent}`}>
                              {cf.title}
                            </span>
                            <span className="opacity-90 leading-relaxed block whitespace-pre-line">{cf.value}</span>
                          </div>
                        ))}
                    </div>

                    {/* Profile Avatar / Photo */}
                    {visibilityMap.photo !== false && cvData.photoUrl && (
                      <div className="relative group/avatar shrink-0">
                        <img
                          src={cvData.photoUrl}
                          alt={cvData.fullName}
                          className="w-24 h-24 rounded-xl object-cover border-2 border-current/30 shadow-md"
                        />
                        <button
                          onClick={() => singlePhotoInputRef.current?.click()}
                          className="absolute inset-0 bg-black/60 text-white font-bold text-[10px] flex items-center justify-center rounded-xl opacity-0 group-hover/avatar:opacity-100 transition cursor-pointer"
                        >
                          Changer Photo
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* BODY CONTENT ACCORDING TO LAYOUT TYPE */}
                {cvLayout === "asymmetric_2col" ? (
                  /* ASYMMETRIC 2-COLUMNS: LARGE MAIN RIGHT + SHORT SIDEBAR LEFT */
                  <div className="grid grid-cols-12 gap-8 flex-1">
                    {/* LEFT SHORT SIDEBAR (35% Width -> 4 cols) */}
                    <div className={`col-span-4 p-4 rounded-xl space-y-6 ${currentTheme.sidebarBg}`}>
                      {/* Contact Info */}
                      {visibilityMap.contact !== false && (
                        <div className="group relative transition hover:ring-1 hover:ring-amber-500/30 p-1.5 -m-1.5 rounded-lg">
                          <h4 className={`text-xs font-black uppercase tracking-wider mb-3 ${currentTheme.accent}`}>
                            Contact & Réseaux
                          </h4>
                          <div className="space-y-2 text-[11px]">
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              <span className="truncate">{cvData.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              <span>{cvData.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              <span>{cvData.location}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Globe className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              <span className="truncate">{cvData.website}</span>
                            </div>
                          </div>

                          {/* Contact Section Custom Fields */}
                          {customFields
                            .filter((cf) => cf.section === "contact" && cf.isVisible)
                            .map((cf) => (
                              <div key={cf.id} className="mt-3 pt-2 border-t border-current/20 text-[11px]">
                                <span className={`font-bold block uppercase tracking-wider text-[10px] ${currentTheme.accent}`}>
                                  {cf.title}
                                </span>
                                <span className="opacity-90">{cf.value}</span>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Skills Breakdown */}
                      {visibilityMap.skills !== false && cvData.skillCategories.map((cat) => (
                        <div key={cat.id}>
                          <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${currentTheme.accent}`}>
                            {cat.category}
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {cat.skills.map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${currentTheme.pill}`}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Languages */}
                      {visibilityMap.skills !== false && cvData.languages.length > 0 && (
                        <div>
                          <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${currentTheme.accent}`}>
                            Langues
                          </h4>
                          <ul className="text-[11px] space-y-1 opacity-90">
                            {cvData.languages.map((lang, lIdx) => (
                              <li key={lIdx}>• {lang}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Portfolio QR Code Integration */}
                      {visibilityMap.qrcode !== false && qrCodeDataUrl && (
                        <div className="pt-2 border-t border-current/20 flex flex-col items-center text-center">
                          <img
                            src={qrCodeDataUrl}
                            alt="QR Portfolio"
                            className="w-20 h-20 bg-white p-1 rounded-lg shadow-sm mb-1"
                          />
                          <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                            Scan Portfolio
                          </span>
                        </div>
                      )}
                    </div>

                    {/* RIGHT LARGE MAIN COLUMN (65% Width -> 8 cols) */}
                    <div className="col-span-8 space-y-6">
                      {/* Dynamic Sections Reordered */}
                      {cvSectionOrder.map((sectionKey, sIdx) => {
                        if (sectionKey === "summary" && visibilityMap.summary !== false) {
                          const summaryFields = customFields.filter((cf) => cf.section === "summary" && cf.isVisible);
                          if (summaryFields.length === 0) return null;
                          return (
                            <div key="sec-summary" className="group relative p-2 -m-2 rounded-lg border border-transparent hover:border-amber-500/30 transition">
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 bg-neutral-900/95 text-white p-1 rounded border border-neutral-700 text-[10px] z-20">
                                <button onClick={() => moveCvSection("summary", "up")} disabled={sIdx === 0} className="p-1 hover:text-amber-400 disabled:opacity-30">
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button onClick={() => moveCvSection("summary", "down")} disabled={sIdx === cvSectionOrder.length - 1} className="p-1 hover:text-amber-400 disabled:opacity-30">
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                              {summaryFields.map((cf) => (
                                <div key={cf.id} className="mb-3">
                                  <h3 className={`text-xs font-black uppercase tracking-wider pb-1 mb-2 border-b border-current/20 ${currentTheme.accent}`}>
                                    {cf.title}
                                  </h3>
                                  <p className="text-xs leading-relaxed opacity-90">{cf.value}</p>
                                </div>
                              ))}
                            </div>
                          );
                        }

                        if (sectionKey === "experiences" && visibilityMap.experiences !== false) {
                          return (
                            <div key="sec-exp" className="group relative p-2 -m-2 rounded-lg border border-transparent hover:border-amber-500/30 transition">
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 bg-neutral-900/95 text-white p-1 rounded border border-neutral-700 text-[10px] z-20">
                                <button onClick={() => moveCvSection("experiences", "up")} disabled={sIdx === 0} className="p-1 hover:text-amber-400 disabled:opacity-30">
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button onClick={() => moveCvSection("experiences", "down")} disabled={sIdx === cvSectionOrder.length - 1} className="p-1 hover:text-amber-400 disabled:opacity-30">
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button onClick={() => toggleVisibility("experiences")} className="p-1 hover:text-amber-400">
                                  <EyeOff className="w-3 h-3" />
                                </button>
                              </div>

                              <h3 className={`text-xs font-black uppercase tracking-wider pb-1 mb-4 border-b border-current/20 ${currentTheme.accent}`}>
                                Expériences Professionnelles
                              </h3>
                              <div className="space-y-5">
                                {cvData.experiences.map((exp) => (
                                  <div key={exp.id} className="space-y-1.5">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <h4 className={`text-sm font-bold ${currentTheme.textPrimary}`}>{exp.role}</h4>
                                        <span className="text-xs font-semibold opacity-80">{exp.company} • {exp.location}</span>
                                      </div>
                                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${currentTheme.pill}`}>
                                        {exp.period}
                                      </span>
                                    </div>
                                    <ul className="text-xs space-y-1 opacity-90 pl-3 list-disc">
                                      {exp.bullets.map((b, bIdx) => (
                                        <li key={bIdx}>{b}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}

                                {/* Experience Attached Custom Fields */}
                                {customFields
                                  .filter((cf) => cf.section === "experience" && cf.isVisible)
                                  .map((cf) => (
                                    <div key={cf.id} className="pt-2 border-t border-current/20">
                                      <h4 className={`text-xs font-bold ${currentTheme.textPrimary}`}>{cf.title}</h4>
                                      <p className="text-xs opacity-90 mt-1">{cf.value}</p>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          );
                        }

                        if (sectionKey === "education" && visibilityMap.education !== false) {
                          return (
                            <div key="sec-edu" className="group relative p-2 -m-2 rounded-lg border border-transparent hover:border-amber-500/30 transition">
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 bg-neutral-900/95 text-white p-1 rounded border border-neutral-700 text-[10px] z-20">
                                <button onClick={() => moveCvSection("education", "up")} disabled={sIdx === 0} className="p-1 hover:text-amber-400 disabled:opacity-30">
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button onClick={() => moveCvSection("education", "down")} disabled={sIdx === cvSectionOrder.length - 1} className="p-1 hover:text-amber-400 disabled:opacity-30">
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button onClick={() => toggleVisibility("education")} className="p-1 hover:text-amber-400">
                                  <EyeOff className="w-3 h-3" />
                                </button>
                              </div>

                              <h3 className={`text-xs font-black uppercase tracking-wider pb-1 mb-3 border-b border-current/20 ${currentTheme.accent}`}>
                                Formation & Certifications
                              </h3>
                              <div className="space-y-3">
                                {cvData.education.map((edu) => (
                                  <div key={edu.id} className="flex items-start justify-between">
                                    <div>
                                      <h4 className={`text-xs font-bold ${currentTheme.textPrimary}`}>{edu.degree}</h4>
                                      <span className="text-[11px] opacity-80">{edu.institution}</span>
                                      {edu.details && <p className="text-[10px] italic opacity-70 mt-0.5">{edu.details}</p>}
                                    </div>
                                    <span className="text-[11px] font-semibold opacity-70">{edu.year}</span>
                                  </div>
                                ))}

                                {/* Education Attached Custom Fields */}
                                {customFields
                                  .filter((cf) => cf.section === "education" && cf.isVisible)
                                  .map((cf) => (
                                    <div key={cf.id} className="pt-2 border-t border-current/20">
                                      <h4 className={`text-xs font-bold ${currentTheme.textPrimary}`}>{cf.title}</h4>
                                      <p className="text-xs opacity-90 mt-1">{cf.value}</p>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>
                ) : (
                  /* CLASSIC 1-COLUMN EXECUTIVE LAYOUT */
                  <div className="space-y-6">
                    {visibilityMap.experiences !== false && (
                      <div>
                        <h3 className={`text-xs font-black uppercase tracking-wider pb-1 mb-3 border-b border-current/20 ${currentTheme.accent}`}>
                          Expérience Professionnelle
                        </h3>
                        <div className="space-y-5">
                          {cvData.experiences.map((exp) => (
                            <div key={exp.id} className="space-y-1">
                              <div className="flex items-baseline justify-between">
                                <h4 className={`text-sm font-bold ${currentTheme.textPrimary}`}>{exp.role} — <span className="font-normal opacity-90">{exp.company}</span></h4>
                                <span className="text-xs font-semibold opacity-70">{exp.period}</span>
                              </div>
                              <ul className="text-xs space-y-1 pl-4 list-disc opacity-90">
                                {exp.bullets.map((b, bIdx) => (
                                  <li key={bIdx}>{b}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-current/20">
                      {visibilityMap.education !== false && (
                        <div>
                          <h4 className={`text-xs font-black uppercase tracking-wider mb-2 ${currentTheme.accent}`}>Diplômes & Formation</h4>
                          {cvData.education.map((edu) => (
                            <div key={edu.id} className="mb-2">
                              <span className="text-xs font-bold block">{edu.degree}</span>
                              <span className="text-[11px] opacity-80">{edu.institution} ({edu.year})</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {visibilityMap.skills !== false && (
                        <div>
                          <h4 className={`text-xs font-black uppercase tracking-wider mb-2 ${currentTheme.accent}`}>Compétences Clés</h4>
                          <div className="flex flex-wrap gap-1">
                            {cvData.skillCategories.flatMap((c) => c.skills).map((sk, idx) => (
                              <span key={idx} className={`text-[10px] px-2 py-0.5 rounded ${currentTheme.pill}`}>
                                {sk}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* --- ARTIST VISUAL PORTFOLIO DECK RENDERER --- */
              <div className="space-y-6">
                {/* DECK HEADER */}
                <div className="border-b-2 border-current/30 pb-4 flex items-start justify-between">
                  <div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded ${currentTheme.pill}`}>
                      {visualData.templateType.replace("_", " ")}
                    </span>
                    <h1 className={`text-2xl font-black uppercase tracking-tight mt-2 ${currentTheme.textPrimary}`}>
                      {visualData.title}
                    </h1>
                    <h2 className={`text-xs font-bold uppercase tracking-wider ${currentTheme.accent}`}>
                      {visualData.subtitle}
                    </h2>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black block">{visualData.artistName}</span>
                    <span className="text-[10px] opacity-70 block">{visualData.contactInfo}</span>
                  </div>
                </div>

                {/* HERO VISUAL WITH IMPORT OVERLAY */}
                {visibilityMap.heroImage !== false && visualData.heroImage && (
                  <div className="relative group/hero rounded-xl overflow-hidden shadow-lg border border-current/20 max-h-[420px]">
                    <img src={visualData.heroImage} alt="Hero Artwork" className="w-full h-full object-cover" />
                    <button
                      onClick={() => heroImageInputRef.current?.click()}
                      className="absolute inset-0 bg-black/60 text-white font-bold text-xs flex items-center justify-center gap-2 opacity-0 group-hover/hero:opacity-100 transition cursor-pointer"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Changer Photo Couverture</span>
                    </button>
                  </div>
                )}

                {/* LORE / SPECS / PALETTE GRID */}
                <div className="grid grid-cols-12 gap-6">
                  {/* Lore Description (7 cols) */}
                  <div className="col-span-7 space-y-3">
                    {visibilityMap.lore !== false && (
                      <div>
                        <h4 className={`text-xs font-black uppercase tracking-wider ${currentTheme.accent}`}>
                          Note d'Intention & Spécifications Conceptuelles
                        </h4>
                        <p className="text-xs leading-relaxed opacity-90 mt-1">{visualData.loreOrDescription}</p>
                      </div>
                    )}

                    {/* Custom Fields in Visual Deck */}
                    {customFields
                      .filter((cf) => (cf.section === "portfolio_specs" || cf.section === "summary") && cf.isVisible)
                      .map((cf) => (
                        <div key={cf.id} className="pt-2 border-t border-current/20">
                          <h4 className={`text-xs font-black uppercase tracking-wider ${currentTheme.accent}`}>
                            {cf.title}
                          </h4>
                          <p className="text-xs opacity-90 mt-0.5">{cf.value}</p>
                        </div>
                      ))}

                    {/* Color Swatches Palette */}
                    {visibilityMap.palette !== false && visualData.colorPalette && visualData.colorPalette.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 opacity-70">
                          Palette de Couleurs & Shaders
                        </span>
                        <div className="flex gap-2">
                          {visualData.colorPalette.map((color, cIdx) => (
                            <div key={cIdx} className="flex flex-col items-center">
                              <div
                                className="w-8 h-8 rounded-lg shadow-inner border border-white/20"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-[9px] font-mono mt-0.5 opacity-80">{color}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Specs Table (5 cols) */}
                  {visibilityMap.specs !== false && (
                    <div className={`col-span-5 p-4 rounded-xl space-y-2 text-xs ${currentTheme.sidebarBg}`}>
                      <h4 className={`font-black uppercase tracking-wider text-[11px] mb-2 ${currentTheme.accent}`}>
                        Données Techniques Produit / Mensurations
                      </h4>
                      {visualData.specsTable.map((spec, sIdx) => (
                        <div key={sIdx} className="flex justify-between border-b border-current/10 pb-1">
                          <span className="opacity-70 font-medium">{spec.label}</span>
                          <span className="font-bold">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* GALLERY VIEWS (RESPONSIVE MULTI-PHOTO GRID SUPPORTING 2 TO 6+ PHOTOS) */}
                {visibilityMap.gallery !== false && (
                  <div className="pt-4 border-t border-current/20 group relative">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className={`text-xs font-black uppercase tracking-wider ${currentTheme.accent}`}>
                        Planches de Référence & Galerie Photos ({visualData.galleryImages.length} Visuels)
                      </h4>
                      <button
                        onClick={() => multiPhotoInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] rounded transition cursor-pointer shadow-sm"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Importer Photos (Compcard / Book)</span>
                      </button>
                    </div>

                    <div className={`grid gap-4 ${visualData.galleryImages.length >= 6 ? "grid-cols-3" : visualData.galleryImages.length >= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {visualData.galleryImages.map((img, idx) => (
                        <div key={idx} className="space-y-1.5 group/card relative">
                          <div className="h-44 rounded-lg overflow-hidden border border-current/20 bg-black/40 shadow-sm relative">
                            <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                            <button
                              onClick={() => {
                                const next = visualData.galleryImages.filter((_, i) => i !== idx);
                                setVisualData({ ...visualData, galleryImages: next });
                              }}
                              className="absolute top-1 right-1 p-1 bg-black/80 text-red-400 rounded opacity-0 group-hover/card:opacity-100 transition hover:bg-black"
                              title="Supprimer cette photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-xs font-bold block truncate">{img.title}</span>
                          {img.caption && <span className="text-[10px] opacity-70 block truncate">{img.caption}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CareerStudio;

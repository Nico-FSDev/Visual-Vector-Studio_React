# Guide d'Export & Intégration : Whiteboard / Blackboard / Paperboard Studio
### Pour toute application Vite + React + TypeScript avec Tailwind CSS & Lucide React

Ce guide détaille pas-à-pas comment exporter et intégrer le studio complet de tableau interactif (**Tableau Blanc**, **Tableau Noir à la Craie**, et **Paperboard / Grilles d'Écriture**) dans un nouveau projet ou une application React existante.

---

## 1. Caractéristiques de l'Architecture Exportée

- **100% Autonome & Découplé** : Ne nécessite **aucun store global** (ni Redux, ni Zustand, ni Context API lourd). L'état vit intégralement dans des hooks standards (`useState`, `useRef`, `useCallback`).
- **Moteur Canvas 2D Natif** : Aucun framework lourd de canvas (pas de Fabric.js, Konva ou Pixi.js). Rendu HTML5 ultra-performant à 60 FPS avec support tactile (`touch-none` et Pointer Events).
- **3 Modes de Tableau Réalistes** :
  1. **Tableau Blanc (Whiteboard)** : Feutre effaçable à sec, feutre fin, surligneur biseauté translucide, gomme propre, tracé de formes vectorielles et insertion de texte.
  2. **Tableau Noir (Blackboard)** : Texture ardoise sombre, craie texturée avec génération dynamique de particules de poussière minérale, éponge humide avec traînée de lavage à l'eau, palette de craies pastel (blanche, jaune, cyan, rose, menthe, pêche).
  3. **Paperboard / Feuilles de Cours** : Papier grainé chaud, plume calligraphique à largeur de trait variable selon la vélocité (`speed-adjusted stroke`), crayon graphite HB, quadrillages (quadrillage 5x5mm, lignes d'écriture d'écolier, papier à points).
- **Instruments de Précision Géométrique** :
  - **Règle métrique de 30 cm** : Déplacement libre, échelle exacte 1 cm = 20 px, graduations millimétriques et centimétriques, rotation pas-à-pas (+15°) ou rotation continue magnétique avec accroche aux angles cardinaux (0°, 30°, 45°, 60°, 90°, etc.), modale de traçage de segments paramétriques.
  - **Compas technique à balustre** : Molette moletée en laiton, pointe sèche pivotante, rayon réglable par glisser-déposer, traçage direct de cercles complets ou d'arcs paramétriques en degrés ou radians.
- **Suite Complète d'Actions & Exports** :
  - Historique Annuler / Rétablir illimité (`Undo2` / `Redo2`).
  - Capture d'instantanés avec galerie miniature intégrée.
  - Téléchargement d'image haute définition (PNG).
  - Sauvegarde et chargement d'état vectoriel complet (JSON).
  - Format d'impression document / vector PDF via dialogue d'impression système.

---

## 2. Prérequis & Installation dans le Projet Cible

Dans votre projet Vite + React + TypeScript :

```bash
# 1. Installer la seule dépendance externe : les icônes Lucide
npm install lucide-react
```

### Configuration Tailwind CSS

Assurez-vous que votre configuration Tailwind scanne bien les fichiers `.tsx` :

#### Si vous utilisez Tailwind CSS v3 (`tailwind.config.js`) :
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

#### Si vous utilisez Tailwind CSS v4 (`src/index.css`) :
```css
@import "tailwindcss";
```

---

## 3. Emplacement du Fichier Composant

Copiez le fichier autonome :
`src/export-package/StandaloneWhiteboardStudio.tsx`

Et déposez-le dans votre application cible :
`src/components/StandaloneWhiteboardStudio.tsx`

---

## 4. Exemples d'Utilisation

### Exemple 1 : Page Plein Écran Dédiée

```tsx
// src/App.tsx
import React from "react";
import { StandaloneWhiteboardStudio } from "./components/StandaloneWhiteboardStudio";

export default function App() {
  return (
    <div className="w-screen h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Barre de titre optionnelle */}
      <header className="h-14 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between text-white shrink-0">
        <h1 className="text-sm font-bold tracking-wide">Mon Studio Tableau Blanc</h1>
        <span className="text-xs text-slate-400">Prêt pour la présentation</span>
      </header>

      {/* Conteneur du tableau prenant 100% de l'espace restant */}
      <main className="flex-1 w-full h-full overflow-hidden">
        <StandaloneWhiteboardStudio
          initialMode="whiteboard"
          onExportPNG={(dataUrl) => {
            console.log("Image PNG exportée :", dataUrl.substring(0, 50));
          }}
          triggerToast={(msg) => console.log("Notification :", msg)}
        />
      </main>
    </div>
  );
}
```

### Exemple 2 : Tableau Noir pour Enseignement Scientifique ou Mathématique

```tsx
import React from "react";
import { StandaloneWhiteboardStudio } from "./components/StandaloneWhiteboardStudio";

export function MathClassroom() {
  return (
    <div className="w-full h-[700px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      <StandaloneWhiteboardStudio
        initialMode="blackboard"
      />
    </div>
  );
}
```

---

## 5. Propriétés TypeScript (`Props`)

Le composant accepte les props suivantes (toutes optionnelles) :

```typescript
export interface StandaloneWhiteboardStudioProps {
  /** Mode initial au montage du composant : "whiteboard" | "blackboard" | "paperboard" (défaut: "whiteboard") */
  initialMode?: "whiteboard" | "blackboard" | "paperboard";

  /** Classes Tailwind CSS additionnelles sur le conteneur racine */
  className?: string;

  /** Contrôle externe de l'état plein écran */
  isFullscreen?: boolean;

  /** Callback déclenché lors du clic sur le bouton plein écran */
  onToggleFullscreen?: (fullscreen: boolean) => void;

  /** Callback de notification (remplace le toast interne si renseigné) */
  triggerToast?: (message: string) => void;

  /** Callback personnalisé lors de l'export PNG (pour envoi vers un cloud, S3, Firebase...) */
  onExportPNG?: (dataUrl: string) => void;

  /** Callback personnalisé lors de l'export JSON */
  onExportJSON?: (jsonString: string) => void;
}
```

---

## 6. Détails Techniques & Formules Mathématiques

### 1. Précision Métrique de la Règle
- L'échelle calibrée est de **20 pixels pour 1 centimètre** (1 mm = 2 px).
- Les graduations s'étendent de **0 à 30 cm** (largeur active de 600 px + 10 px de marges de chanfrein).
- Pour calculer les coordonnées canvas d'un segment tracé à la règle orientée à un angle $\theta$ (en radians) et positionnée à $(x_{ruler}, y_{ruler})$ :
  $$x = x_{ruler} + (\text{margin} + cm \times 20) \cdot \cos(\theta)$$
  $$y = y_{ruler} + (\text{margin} + cm \times 20) \cdot \sin(\theta)$$

### 2. Géométrie Trigonométrique du Compas
- Le compas modélise un compas d'architecte avec pointe sèche ancrée à $(x_c, y_c)$ et mine graphite à une distance $r$ sous un angle $\alpha$ :
  $$x_{pencil} = x_c + r \cdot \cos(\alpha)$$
  $$y_{pencil} = y_c + r \cdot \sin(\alpha)$$
- La tête d'articulation (charnière) s'élève perpendiculairement au segment pointe-mine pour offrir un aspect 3D réaliste avec des reflets d'acier et de laiton.

### 3. Simulation Réaliste de la Craie
- Contrairement à un simple trait opaque, la craie applique un jitter stochastique : des micro-particules de poudre sont projetées le long du vecteur de tracé proportionnellement au diamètre du bâton de craie avec une opacité aléatoire comprise entre 0.10 et 0.45.

---

## 7. Personnalisations Courantes

### Ajouter une Couleur Personnalisée
Pour ajouter une couleur dans la palette, ajoutez simplement l'objet `{ name: "Nom", value: "#hex" }` dans `WHITEBOARD_COLORS`, `BLACKBOARD_CHALK_COLORS`, ou `PAPERBOARD_COLORS`.

### Connecter un Sauvegarde Automatique en Base de Données
Utilisez le prop `onExportJSON` :
```tsx
<StandaloneWhiteboardStudio
  onExportJSON={async (json) => {
    await fetch("/api/save-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    });
  }}
/>
```

const fs = require('fs');

let content = fs.readFileSync('src/components/WhiteboardStudio.tsx', 'utf8');

// Regex to match button blocks with titles and spans
// It's a bit tricky. Let's do it manually using String replacements.

// We will target specific buttons by their title attributes.
const updates = [
  {
    findTitle: 'title="Marqueur fin (Tracé précis & feutre sec)"',
    name: "Marqueur fin",
    desc: "Tracé précis & feutre sec"
  },
  {
    findTitle: 'title="Marqueur ogive (Pointe ronde & éclat brillant)"',
    name: "Marqueur ogive",
    desc: "Pointe ronde & éclat brillant"
  },
  {
    findTitle: 'title="Marqueur biseauté (Tracé large & surlignage)"',
    name: "Marqueur biseauté",
    desc: "Tracé large & surlignage"
  },
  {
    findTitle: 'title="Tampon effaceur magnétique (Feutre pour tableau blanc)"',
    name: "Tampon effaceur magnétique",
    desc: "Feutre pour tableau blanc"
  },
  {
    findTitle: 'title="Bâton de craie (Dense au ralenti, estompé & poudreux en vitesse)"',
    name: "Bâton de craie",
    desc: "Dense au ralenti, estompé & poudreux en vitesse"
  },
  {
    findTitle: 'title="Feutre ardoise (Encre dense opaque & nuance dynamique)"',
    name: "Feutre ardoise",
    desc: "Encre dense opaque & nuance dynamique"
  },
  {
    findTitle: 'title="Craie biseautée (Ruban calligraphique sur ardoise)"',
    name: "Craie biseautée",
    desc: "Ruban calligraphique sur ardoise"
  },
  {
    findTitle: 'title="Tampon feutre (Effacement en 3 passages avec traînée de poussière)"',
    name: "Tampon feutre",
    desc: "Effacement en 3 passages avec traînée de poussière"
  },
  {
    findTitle: 'title="Éponge humide (Nettoyage à l\'eau & trace sombre)"',
    name: "Éponge humide",
    desc: "Nettoyage à l'eau & trace sombre"
  },
  {
    findTitle: 'title="Crayon graphite HB (Grain graphite naturel & friction papier)"',
    name: "Crayon graphite HB",
    desc: "Grain graphite naturel & friction papier"
  },
  {
    findTitle: 'title="Stylo plume (Plume biseautée 45°, calligraphie & gouttes d\'encre)"',
    name: "Stylo plume",
    desc: "Plume biseautée 45°, calligraphie & gouttes d'encre"
  },
  {
    findTitle: 'title="Pinceau Lavis Aquarelle (Diffusion d\'eau, glacis translucide & auréole)"',
    name: "Pinceau Lavis Aquarelle",
    desc: "Diffusion d'eau, glacis translucide & auréole"
  },
  {
    findTitle: 'title="Feutre papier (Absorption buvard & superposition d\'encres)"',
    name: "Feutre papier",
    desc: "Absorption buvard & superposition d'encres"
  },
  {
    findTitle: 'title="Gomme à papier (Gomme douce mie de pain)"',
    name: "Gomme à papier",
    desc: "Gomme douce mie de pain"
  },
  {
    findTitle: 'title="Ligne droite"',
    name: "Ligne droite",
    desc: "Tracé rectiligne"
  },
  {
    findTitle: 'title="Flèche d\'annotation"',
    name: "Flèche d'annotation",
    desc: "Vecteur directionnel"
  },
  {
    findTitle: 'title="Rectangle"',
    name: "Rectangle",
    desc: "Forme géométrique"
  },
  {
    findTitle: 'title="Cercle / Ellipse"',
    name: "Cercle / Ellipse",
    desc: "Forme géométrique"
  },
  {
    findTitle: 'title="Texte / Note manuscrite"',
    name: "Texte / Note",
    desc: "Annotation manuscrite"
  },
  {
    findTitle: 'title="Afficher / Masquer la Règle Graduée"',
    name: "Règle Graduée",
    desc: "Mesure & angles virtuels"
  },
  {
    findTitle: 'title="Afficher / Masquer le Compas"',
    name: "Compas",
    desc: "Tracé de cercles parfaits"
  }
];

let replaced = 0;

for (const update of updates) {
  // First, find the title="..." and remove it
  let titleIndex = content.indexOf(update.findTitle);
  if (titleIndex === -1) {
    console.log("NOT FOUND:", update.findTitle);
    continue;
  }
  
  // Remove the title attribute
  content = content.replace(update.findTitle, "");
  
  // Now find the <span class="absolute left-full...</span> inside that button block.
  // The button block starts before titleIndex and ends at </button>
  let buttonEnd = content.indexOf('</button>', titleIndex);
  
  let spanStart = content.lastIndexOf('<span', buttonEnd);
  let spanEnd = content.indexOf('</span>', spanStart) + 7;
  
  if (spanStart !== -1 && spanStart > titleIndex) {
    let oldSpan = content.substring(spanStart, spanEnd);
    let newTooltip = `
                  <div className="absolute left-full ml-2 flex flex-col bg-slate-900 border border-slate-700 text-white rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-30 w-max overflow-hidden">
                    <div className="px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap">
                      ${update.name}
                    </div>
                    <div className="px-2.5 text-[9px] text-slate-400 whitespace-nowrap max-h-0 opacity-0 group-hover:max-h-10 group-hover:pb-1.5 group-hover:opacity-100 transition-all duration-300 delay-700 ease-in-out">
                      ${update.desc}
                    </div>
                  </div>`.trimStart();
    content = content.substring(0, spanStart) + newTooltip + content.substring(spanEnd);
    replaced++;
  } else {
    // Some buttons (like shapes) didn't have the span previously
    // Let's insert the new tooltip right before the </button>
    let newTooltip = `
              <div className="absolute left-full ml-2 flex flex-col bg-slate-900 border border-slate-700 text-white rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-30 w-max overflow-hidden">
                <div className="px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap">
                  ${update.name}
                </div>
                <div className="px-2.5 text-[9px] text-slate-400 whitespace-nowrap max-h-0 opacity-0 group-hover:max-h-10 group-hover:pb-1.5 group-hover:opacity-100 transition-all duration-300 delay-700 ease-in-out">
                  ${update.desc}
                </div>
              </div>\n            `;
    content = content.substring(0, buttonEnd) + newTooltip + content.substring(buttonEnd);
    replaced++;
  }
}

fs.writeFileSync('src/components/WhiteboardStudio.tsx', content, 'utf8');
console.log("Replaced:", replaced);

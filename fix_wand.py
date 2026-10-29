import sys

with open('src/components/IllustratorCanvas.tsx', 'r') as f:
    lines = f.readlines()

new_lines = lines[:3143]

replacement = """      const isAddSelection = e.shiftKey || isShiftPressed || magicWandMultiSelect;

      if (targetId) {
        const clicked = elements.find((el) => el.id === targetId);
        if (clicked) {
          if (clicked.type === "image" && clicked.imageUrl) {
            // RASTER TARGET
            import("../utils/RasterOperations").then(
              ({ processMagicWandOnImage }) => {
                setAiFeedback("Analyse du motif de l'image en cours...");
                processMagicWandOnImage(
                  clicked.imageUrl!,
                  clicked.x,
                  clicked.y,
                  clicked.width,
                  clicked.height,
                  pos.x,
                  pos.y,
                  magicWandTolerance,
                  activeTool === "color-select" ? "color-select" : "wand",
                  canvasBgColor,
                )
                  .then(({ newPathData, colorHex, width, height }) => {
                    if (newPathData) {
                      if (magicWandAutoExtract) {
                        const newId = `wand-${Date.now()}`;
                        const newElement: VectorElement = {
                          id: newId,
                          name: `Extraction Magique Image`,
                          type: "path",
                          x: clicked.x,
                          y: clicked.y,
                          width: width || clicked.width,
                          height: height || clicked.height,
                          rotate: 0,
                          opacity: 1,
                          fill: colorHex ? `${colorHex}cc` : "#2c2c2c",
                          fillGradient: false,
                          fillGradientColors: [],
                          fillGradientType: "linear",
                          fillGradientAngle: 0,
                          stroke: "none",
                          strokeWidth: 0,
                          strokeDash: "solid",
                          pathData: newPathData,
                          isHidden: false,
                          isLocked: false,
                        };
                        const newElements = [...elements, newElement];
                        pushStateToHistory(newElements);
                          
                        if (isSubtractSelection) {
                          setAiFeedback("Image extraite avec succès (ignorée car mode soustraction actif).");
                        } else if (isAddSelection) {
                          setSelectedElementIds([...selectedElementIds, newId]);
                          setSelectedElementId(newId);
                          setAiFeedback("Image extraite et ajoutée à la sélection !");
                        } else {
                          setSelectedElementIds([newId]);
                          setSelectedElementId(newId);
                          setAiFeedback("Motif de l'image vectorisé et extrait avec succès !");
                        }
                      } else {
                        // PREVIEW MASK MODE (Marching ants equivalent)
                        if (isSubtractSelection) {
                          setWandPreviewMasks([]);
                          setAiFeedback("Sélection annulée.");
                        } else if (isAddSelection) {
                          setWandPreviewMasks((prev) => [...prev, newPathData]);
                          setSelectedElementIds([]); // clear permanent selection to focus on mask
                          setSelectedElementId(null);
                          setAiFeedback("Zone ajoutée à la sélection magique.");
                        } else {
                          setWandPreviewMasks([newPathData]);
                          setSelectedElementIds([]); // clear permanent selection
                          setSelectedElementId(null);
                          setAiFeedback("Zone sélectionnée !");
                        }
                      }
                    } else {
                      setAiFeedback("La zone cliquée n'a pas pu être extraite.");
                    }
                  })
                  .catch((err) => {
                    console.error(err);
                    setAiFeedback("Erreur lors de l'extraction de l'image.");
                  });
              },
            );
            return;
          }
"""

new_lines.append(replacement)
new_lines.extend(lines[3234:]) # Skip up to 3234

with open('src/components/IllustratorCanvas.tsx', 'w') as f:
    f.writelines(new_lines)

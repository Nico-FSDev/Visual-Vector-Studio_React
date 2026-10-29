import sys

with open('src/components/IllustratorCanvas.tsx', 'r') as f:
    content = f.read()

target1 = """  const [wandPreviewMasks, setWandPreviewMasks] = useState<string[]>([]);"""

replacement1 = """  const [wandPreviewMasks, setWandPreviewMasks] = useState<string[]>([]);
  const [wandTargetId, setWandTargetId] = useState<string | null>(null);"""

target2 = """                        // PREVIEW MASK MODE (Marching ants equivalent)
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
                        }"""

replacement2 = """                        // PREVIEW MASK MODE (Marching ants equivalent)
                        if (isSubtractSelection) {
                          setWandPreviewMasks([]);
                          setWandTargetId(null);
                          setAiFeedback("Sélection annulée.");
                        } else if (isAddSelection) {
                          setWandPreviewMasks((prev) => [...prev, newPathData]);
                          setWandTargetId(clicked.id);
                          setSelectedElementIds([]); // clear permanent selection to focus on mask
                          setSelectedElementId(null);
                          setAiFeedback("Zone ajoutée à la sélection magique.");
                        } else {
                          setWandPreviewMasks([newPathData]);
                          setWandTargetId(clicked.id);
                          setSelectedElementIds([]); // clear permanent selection
                          setSelectedElementId(null);
                          setAiFeedback("Zone sélectionnée !");
                        }"""

target3 = """      if (e.key === "Escape") {
        setSelectedElementIds([]);
        setSelectedElementId(null);
        setWandPreviewMasks([]);
      }"""

replacement3 = """      if (e.key === "Escape") {
        setSelectedElementIds([]);
        setSelectedElementId(null);
        setWandPreviewMasks([]);
        setWandTargetId(null);
      }"""

new_content = content.replace(target1, replacement1).replace(target2, replacement2).replace(target3, replacement3)
with open('src/components/IllustratorCanvas.tsx', 'w') as f:
    f.write(new_content)
print("Updated wand target!")

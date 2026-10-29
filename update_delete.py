import sys

with open('src/components/IllustratorCanvas.tsx', 'r') as f:
    content = f.read()

target = """      // Delete (Suppr) ou Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedElementIds.length > 0) {
          const updated = elements.filter(
            (el) => !selectedElementIds.includes(el.id),
          );
          setElements(updated);
          setSelectedElementIds([]);
          setSelectedElementId(null);
          pushStateToHistory(updated);
          setAiFeedback(`${selectedElementIds.length} élément(s) supprimé(s).`);
        }
      }"""

replacement = """      // Delete (Suppr) ou Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        
        // Handle raster mask deletion first
        if (wandPreviewMasks.length > 0 && wandTargetId) {
          const updated = elements.map((el) => {
            if (el.id === wandTargetId) {
              const newStrokes = wandPreviewMasks.map(mask => ({ path: mask, size: 0, isArea: true }));
              return {
                ...el,
                eraserStrokes: [...(el.eraserStrokes || []), ...newStrokes]
              };
            }
            return el;
          });
          setElements(updated);
          pushStateToHistory(updated);
          setWandPreviewMasks([]);
          setWandTargetId(null);
          setAiFeedback("Zone effacée de l'image.");
        } 
        // Handle standard element deletion
        else if (selectedElementIds.length > 0) {
          const updated = elements.filter(
            (el) => !selectedElementIds.includes(el.id),
          );
          setElements(updated);
          setSelectedElementIds([]);
          setSelectedElementId(null);
          pushStateToHistory(updated);
          setAiFeedback(`${selectedElementIds.length} élément(s) supprimé(s).`);
        }
      }"""

new_content = content.replace(target, replacement)
with open('src/components/IllustratorCanvas.tsx', 'w') as f:
    f.write(new_content)
print("Updated delete logic!")

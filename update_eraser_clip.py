import sys

with open('src/components/IllustratorCanvas.tsx', 'r') as f:
    content = f.read()

target = """    } else if (activeTool === "eraser") {
      const activeWandPaths = selectedElementIds
        .map((id) => elements.find((el) => el.id === id))
        .filter((el) => el && el.type === "path" && el.pathData);

      // If we have a selected path (like a magic wand selection), use it as a clipping mask
      const clipPathData =
        activeWandPaths.length > 0 ? activeWandPaths[0]?.pathData : undefined;"""

replacement = """    } else if (activeTool === "eraser") {
      const activeWandPaths = selectedElementIds
        .map((id) => elements.find((el) => el.id === id))
        .filter((el) => el && el.type === "path" && el.pathData);

      // If we have a selected path (like a magic wand selection), use it as a clipping mask
      let clipPathData =
        activeWandPaths.length > 0 ? activeWandPaths[0]?.pathData : undefined;
        
      // Override with active preview masks if any exist
      if (wandPreviewMasks.length > 0) {
        clipPathData = wandPreviewMasks.join(" ");
      }"""

new_content = content.replace(target, replacement)
with open('src/components/IllustratorCanvas.tsx', 'w') as f:
    f.write(new_content)
print("Updated eraser clip!")

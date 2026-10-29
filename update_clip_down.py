import sys

with open('src/components/IllustratorCanvas.tsx', 'r') as f:
    content = f.read()

target = """    // Extract active magic wand selection path to serve as clipping mask
    const activeWandPaths = selectedElementIds
      .map((id) => elements.find((el) => el.id === id))
      .filter((el) => el && el.type === "path" && el.pathData);
    const activeClipPathData =
      activeWandPaths.length > 0 ? activeWandPaths[0]?.pathData : undefined;"""

replacement = """    // Extract active magic wand selection path to serve as clipping mask
    const activeWandPaths = selectedElementIds
      .map((id) => elements.find((el) => el.id === id))
      .filter((el) => el && el.type === "path" && el.pathData);
    let activeClipPathData =
      activeWandPaths.length > 0 ? activeWandPaths[0]?.pathData : undefined;
    
    // Override with active preview masks if any exist
    if (wandPreviewMasks.length > 0) {
      activeClipPathData = wandPreviewMasks.join(" ");
    }"""

new_content = content.replace(target, replacement)
with open('src/components/IllustratorCanvas.tsx', 'w') as f:
    f.write(new_content)
print("Updated clip path in mouse down!")

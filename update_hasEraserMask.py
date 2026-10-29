import sys

with open('src/components/IllustratorCanvas.tsx', 'r') as f:
    content = f.read()

target = """                    const hasEraserMask =
                      isTargetOfEraser &&
                      ((el.eraserStrokes && el.eraserStrokes.length > 0) ||
                        (isDrawing &&
                          activeTool === "eraser" &&
                          eraserMode === "pixel" &&
                          currentPathPoints.length > 0));"""

replacement = """                    const hasEraserMask =
                      (el.eraserStrokes && el.eraserStrokes.length > 0) ||
                      (isTargetOfEraser &&
                        isDrawing &&
                        activeTool === "eraser" &&
                        eraserMode === "pixel" &&
                        currentPathPoints.length > 0);"""

new_content = content.replace(target, replacement)
with open('src/components/IllustratorCanvas.tsx', 'w') as f:
    f.write(new_content)
print("Updated hasEraserMask!")

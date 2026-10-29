import sys

with open('src/components/IllustratorCanvas.tsx', 'r') as f:
    content = f.read()

target = """                  {/* Live active eraser stroke visualization in real-time while dragging */}
                  {isDrawing &&"""

replacement = """                  {/* Magic Wand temporary preview masks (Marching Ants) */}
                  {wandPreviewMasks.map((maskData, i) => (
                    <path
                      key={`preview-mask-${i}`}
                      d={maskData}
                      fill="rgba(0, 167, 250, 0.1)"
                      stroke="#00a7fa"
                      strokeWidth={1.5}
                      strokeDasharray="4,2"
                      pointerEvents="none"
                    />
                  ))}

                  {/* Live active eraser stroke visualization in real-time while dragging */}
                  {isDrawing &&"""

if target in content:
    new_content = content.replace(target, replacement)
    with open('src/components/IllustratorCanvas.tsx', 'w') as f:
        f.write(new_content)
    print("Replaced!")
else:
    print("Target not found.")

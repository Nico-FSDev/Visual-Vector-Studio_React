import sys

with open('src/components/IllustratorCanvas.tsx', 'r') as f:
    content = f.read()

target1 = """  clipPathData?: string; // Clipping mask path for restricting drawing into constrained areas
  eraserStrokes?: { path: string; size: number }[]; // Pixel eraser strokes applying to this specific element"""

replacement1 = """  clipPathData?: string; // Clipping mask path for restricting drawing into constrained areas
  eraserStrokes?: { path: string; size: number; isArea?: boolean }[]; // Pixel eraser strokes applying to this specific element"""

target2 = """                          {hasRecordedStrokes &&
                            el.eraserStrokes!.map((stroke, index) => (
                              <path
                                key={index}
                                d={stroke.path}
                                stroke="black"
                                fill="none"
                                strokeWidth={stroke.size}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            ))}"""

replacement2 = """                          {hasRecordedStrokes &&
                            el.eraserStrokes!.map((stroke, index) => (
                              <path
                                key={index}
                                d={stroke.path}
                                stroke={stroke.isArea ? "none" : "black"}
                                fill={stroke.isArea ? "black" : "none"}
                                strokeWidth={stroke.isArea ? 0 : stroke.size}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            ))}"""

new_content = content.replace(target1, replacement1).replace(target2, replacement2)
with open('src/components/IllustratorCanvas.tsx', 'w') as f:
    f.write(new_content)
print("Updated eraser strokes!")

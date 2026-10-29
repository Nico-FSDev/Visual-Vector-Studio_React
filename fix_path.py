import sys

with open('src/components/IllustratorCanvas.tsx', 'r') as f:
    content = f.read()

target = """                          {isSelected && (
                            <rect
                              x={el.x}
                              y={el.y}
                              width={el.width}
                              height={el.height}
                              fill="none"
                              stroke="#00a7fa"
                              strokeWidth={1.5}
                              transform={rotOrigin}
                              pointerEvents="none"
                            />
                          )}
                        </g>
                      );
                    }

                    // Custom typographies"""

replacement = """                          {isSelected && (
                            <path
                              d={el.pathData}
                              fill="none"
                              stroke="#00a7fa"
                              strokeWidth={1.5}
                              strokeDasharray="4,2"
                              transform={rotOrigin}
                              pointerEvents="none"
                            />
                          )}
                        </g>
                      );
                    }

                    // Custom typographies"""

if target in content:
    new_content = content.replace(target, replacement)
    with open('src/components/IllustratorCanvas.tsx', 'w') as f:
        f.write(new_content)
    print("Replaced!")
else:
    print("Target not found.")

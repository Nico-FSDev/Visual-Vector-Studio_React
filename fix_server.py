import sys

with open('server.ts', 'r') as f:
    content = f.read()

target = """    const userPrompt = `${instructions}
Voici la structure actuelle des calques vectoriels sous forme de tableau JSON:
${JSON.stringify(elements, null, 2)}`;"""

replacement = """    // Strip heavy payload properties (Base64 images, large SVG paths) before sending to the LLM
    // This prevents 500 errors (Payload too large) and AI context truncation
    const simplifiedElements = elements.map((el: any) => {
      const { imageUrl, originalImageUrl, cutoutImageUrl, clipPathData, eraserStrokes, pathData, ...rest } = el;
      return rest;
    });

    const userPrompt = `${instructions}
Voici la structure actuelle des calques vectoriels sous forme de tableau JSON (les données lourdes d'image et de chemins ont été masquées pour la lisibilité):
${JSON.stringify(simplifiedElements, null, 2)}`;"""

new_content = content.replace(target, replacement)
with open('server.ts', 'w') as f:
    f.write(new_content)
print("Updated server prompt!")

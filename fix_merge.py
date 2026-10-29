import sys

with open('server.ts', 'r') as f:
    content = f.read()

target = """    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Pas de texte retourné par Gemini.");
    }
    const payload = JSON.parse(textResponse.trim());
    return res.json(payload);"""

replacement = """    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("Pas de texte retourné par Gemini.");
    }
    const payload = JSON.parse(textResponse.trim());
    
    // Merge back the heavy properties (images, paths) that were stripped
    if (payload.elements && Array.isArray(payload.elements)) {
      payload.elements = payload.elements.map((aiEl: any) => {
        const originalEl = elements.find((el: any) => el.id === aiEl.id);
        if (originalEl) {
          return { ...aiEl, 
            imageUrl: originalEl.imageUrl, 
            originalImageUrl: originalEl.originalImageUrl,
            cutoutImageUrl: originalEl.cutoutImageUrl,
            clipPathData: originalEl.clipPathData,
            eraserStrokes: originalEl.eraserStrokes,
            pathData: originalEl.pathData
          };
        }
        return aiEl;
      });
    }

    return res.json(payload);"""

new_content = content.replace(target, replacement)
with open('server.ts', 'w') as f:
    f.write(new_content)
print("Updated merge logic!")

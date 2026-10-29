import sys

with open('src/utils/RasterOperations.ts', 'r') as f:
    content = f.read()

target = """            if (clipPathData) {
                ctx.save();
                const pathObj = new Path2D(clipPathData);
                ctx.clip(pathObj);
            }
            
            // Setup erase stroke
            const scaleX = w / imgW;
            const scaleY = height / imgH;
            
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            
            // The radius in SVG space needs scaling. We average the scale.
            const scaleAvg = (scaleX + scaleY) / 2;
            ctx.lineWidth = eraseRadius * 2 * scaleAvg;
            
            ctx.beginPath();
            const firstPt = strokePoints[0];
            ctx.moveTo((firstPt.x - imgX) * scaleX, (firstPt.y - imgY) * scaleY);
            
            for (let i = 1; i < strokePoints.length; i++) {
                const pt = strokePoints[i];
                ctx.lineTo((pt.x - imgX) * scaleX, (pt.y - imgY) * scaleY);
            }
            
            // If it's a single point click, draw a small line to ensure a circle is drawn (because lineCap=round)
            if (strokePoints.length === 1) {
                ctx.lineTo((firstPt.x - imgX) * scaleX + 0.1, (firstPt.y - imgY) * scaleY);
            }
            
            ctx.stroke();

            if (clipPathData) {
                ctx.restore();
            }"""

replacement = """            // Setup transform from global canvas coordinates to local image pixel coordinates
            const scaleX = w / imgW;
            const scaleY = height / imgH;
            
            ctx.save();
            ctx.scale(scaleX, scaleY);
            ctx.translate(-imgX, -imgY);

            if (clipPathData) {
                const pathObj = new Path2D(clipPathData);
                ctx.clip(pathObj);
            }
            
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = eraseRadius * 2; // Radius doesn't need manual scaling because context is scaled
            
            ctx.beginPath();
            const firstPt = strokePoints[0];
            ctx.moveTo(firstPt.x, firstPt.y);
            
            for (let i = 1; i < strokePoints.length; i++) {
                const pt = strokePoints[i];
                ctx.lineTo(pt.x, pt.y);
            }
            
            // If it's a single point click, draw a small line to ensure a circle is drawn (because lineCap=round)
            if (strokePoints.length === 1) {
                ctx.lineTo(firstPt.x + 0.1, firstPt.y + 0.1);
            }
            
            ctx.stroke();
            ctx.restore();"""

new_content = content.replace(target, replacement)
with open('src/utils/RasterOperations.ts', 'w') as f:
    f.write(new_content)
print("Updated processEraserOnImage!")

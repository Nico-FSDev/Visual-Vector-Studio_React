import { contours } from 'd3-contour';

const w = 3;
const h = 3;
const mask = new Float32Array(w * h);
mask.fill(1);
const contourGen = contours().size([w, h]).thresholds([0.5]);
const results = contourGen(mask);
console.log(JSON.stringify(results, null, 2));

import { contours } from 'd3-contour';

const w = 3;
const h = 3;

const maskW = w + 2;
const maskH = h + 2;
const paddedMask = new Float32Array(maskW * maskH);

// fill inner w, h with 1
for (let y=0; y<h; y++) {
  for (let x=0; x<w; x++) {
    paddedMask[(y+1)*maskW + (x+1)] = 1;
  }
}

const contourGen = contours().size([maskW, maskH]).thresholds([0.5]);
const results = contourGen(paddedMask);
console.log(JSON.stringify(results, null, 2));

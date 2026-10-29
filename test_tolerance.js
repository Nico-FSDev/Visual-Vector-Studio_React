const tolerance = 30;
const toleranceVal = tolerance * 2.55;
const maxDistSq = toleranceVal * toleranceVal * 3;

console.log("toleranceVal:", toleranceVal);
console.log("maxDistSq:", maxDistSq);

const r1=100, g1=100, b1=100;
const r2=150, g2=150, b2=150;
const distSq = Math.pow(r1-r2, 2) + Math.pow(g1-g2, 2) + Math.pow(b1-b2, 2);
console.log("distSq (100 to 150):", distSq);
console.log("Matches?", distSq <= maxDistSq);

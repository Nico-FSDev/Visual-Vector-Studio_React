const fs = require('fs');
let content = fs.readFileSync('src/components/WhiteboardStudio.tsx', 'utf8');

// Find Chalk Stick, Wet Sponge, Beveled Chalk, Felt Buffer
const wetSpongeStart = content.indexOf('{/* Blackboard Wet Sponge */}');
const wetSpongeEnd = content.indexOf('</button>', wetSpongeStart) + 9;
const wetSpongeStr = content.substring(wetSpongeStart, wetSpongeEnd);

const feltBufferStart = content.indexOf('{/* Felt Buffer (3-pass progressive erasure with chalk dust smear) */}');
const feltBufferEnd = content.indexOf('</button>', feltBufferStart) + 9;

if (wetSpongeStart !== -1 && feltBufferStart !== -1) {
  // Remove wetSpongeStr
  let newContent = content.substring(0, wetSpongeStart) + content.substring(wetSpongeEnd);
  
  // Need to find feltBufferEnd in the *new* string since we just removed a chunk before it
  let newFeltBufferEnd = newContent.indexOf('</button>', newContent.indexOf('{/* Felt Buffer')) + 9;
  
  newContent = newContent.substring(0, newFeltBufferEnd) + '\n\n                ' + wetSpongeStr + newContent.substring(newFeltBufferEnd);
  
  // also clean up any double new lines left where wet sponge used to be
  newContent = newContent.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  fs.writeFileSync('src/components/WhiteboardStudio.tsx', newContent, 'utf8');
  console.log("Reordered successfully");
} else {
  console.log("Could not find start tokens");
}

const translatePathData = (path, dx, dy) => {
  if (!path) return path;
  let isX = true;
  return path.replace(/([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g, (match, cmd, num) => {
    if (cmd) {
      if (cmd.toUpperCase() === 'Z') { isX = true; return cmd; }
      if (cmd.toUpperCase() === 'H') { isX = true; return cmd; }
      if (cmd.toUpperCase() === 'V') { isX = false; return cmd; }
      isX = true;
      return cmd;
    }
    if (num !== undefined) {
       const val = parseFloat(num);
       let res = val;
       if (isX) res += dx;
       else res += dy;
       isX = !isX;
       return res.toString();
    }
    return match;
  });
};
console.log(translatePathData("M 10 20 L 30.5 40 Q 50 60, 70 80 Z", 5, -5));
console.log(translatePathData("M10,20L30,40Z", 5, -5));

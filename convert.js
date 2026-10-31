const fs = require('fs');
const content = fs.readFileSync('C:/programing/antigravity/template/mouse.txt', 'utf8');

const startMarker = 'useEffect(() => {';
const endMarker = '  }, [';
const startIdx = content.indexOf(startMarker) + startMarker.length;
const endIdx = content.lastIndexOf(endMarker);

let logic = content.substring(startIdx, endIdx);

logic = logic.replace('const canvas = canvasRef.current;', '');
logic = logic.replace(/let config = \{[\s\S]*?COLOR\n    \};/, '');

const finalCode = `function initSplashCursor(canvas, customConfig = {}) {
  let config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1440,
    CAPTURE_RESOLUTION: 512,
    DENSITY_DISSIPATION: 3.5,
    VELOCITY_DISSIPATION: 2,
    PRESSURE: 0.1,
    PRESSURE_ITERATIONS: 20,
    CURL: 3,
    SPLAT_RADIUS: 0.2,
    SPLAT_FORCE: 6000,
    SHADING: true,
    COLOR_UPDATE_SPEED: 10,
    BACK_COLOR: { r: 0.5, g: 0, b: 0 },
    TRANSPARENT: true,
    RAINBOW_MODE: true,
    COLOR: '#ff0000',
    PAUSED: false,
    ...customConfig
  };
  \n` + logic + `\n}\n`;

fs.writeFileSync('C:/programing/antigravity/template/home/splashcursor.js', finalCode);
console.log('Conversion successful.');

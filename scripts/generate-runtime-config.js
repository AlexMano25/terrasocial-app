const fs = require('fs');
const path = require('path');

const apiBase = (process.env.TERRASOCIAL_API_BASE || '').trim();
const outputPath = path.join(__dirname, '..', 'js', 'runtime-config.js');

const body = `// Auto-generated at build time.\n// Do not edit manually.\nwindow.TERRASOCIAL_API_BASE = ${JSON.stringify(apiBase)};\n`;

fs.writeFileSync(outputPath, body, 'utf8');
console.log(`runtime-config generated: ${outputPath}`);
console.log(`TERRASOCIAL_API_BASE=${apiBase || '(empty -> fallback logic)'}`);

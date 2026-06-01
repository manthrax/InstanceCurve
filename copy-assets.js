import fs from 'fs';
import path from 'path';

const filesToCopy = ['parts.glb', 'bugger.js'];

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

filesToCopy.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join('dist', file));
    console.log(`Copied ${file} to dist/`);
  } else {
    console.warn(`Warning: ${file} not found at root`);
  }
});

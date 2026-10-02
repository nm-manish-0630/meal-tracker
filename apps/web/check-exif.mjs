import piexif from 'piexifjs';
import fs from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node check-exif.mjs <path-to-jpeg>');
  process.exit(1);
}

const binaryStr = fs.readFileSync(path).toString('binary');
const exifObj = piexif.load(binaryStr);
console.log(JSON.stringify(exifObj, null, 2));

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import JSZip from 'jszip';

const [sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath || !targetPath) throw new Error('Usage: node scripts/package-web.mjs <dist-directory> <output.zip>');
const source = resolve(sourcePath);
const target = resolve(targetPath);
const archive = new JSZip();
const addDirectory = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) addDirectory(file);
    else if (entry.isFile()) {
      // ZIP paths use forward slashes on every host, including Windows PowerShell.
      archive.file(relative(source, file).split(sep).join('/'), readFileSync(file), { date: statSync(file).mtime });
    } else throw new Error(`Unsupported build entry: ${file}`);
  }
};
addDirectory(source);
if (!archive.file('index.html')) throw new Error('Web archive is missing index.html.');
const bytes = await archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, bytes);
console.log(`Created portable web archive: ${target}`);

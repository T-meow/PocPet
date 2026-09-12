import type { AlbumPosterData } from '../ui/albumData';

const xml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const colors: Record<string, [string, string]> = { rose: ['#ffe3ed', '#923f64'], gold: ['#fff0b8', '#7a5b22'], mint: ['#e0f3e7', '#3e7054'], sky: ['#e4f0ff', '#3d638b'], lilac: ['#eee5fb', '#6e568f'], peach: ['#ffe9d7', '#8f5939'] };
const textLine = (text: string, x: number, y: number, size: number, width: number, attributes = '') => {
  const units = Array.from(text).reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e7f ? 1 : .62), 0);
  const fitting = units * size > width ? ` textLength="${width}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text x="${x}" y="${y}" font-size="${size}"${fitting} ${attributes}>${xml(text)}</text>`;
};

export const albumPosterSvg = (data: AlbumPosterData, portrait: string) => {
  const metrics = data.metrics.map((entry, index) => {
    const [bg, ink] = colors[entry.tone] ?? colors.sky;
    const x = 55 + index % 2 * 402;
    const y = 558 + Math.floor(index / 2) * 155;
    return `<g transform="translate(${x} ${y})" fill="${ink}">
      <rect width="386" height="136" rx="18" fill="${bg}"/>
      ${textLine(entry.label, 24, 40, 19, 338)}
      ${textLine(entry.value, 24, 97, entry.value.length > 12 ? 22 : entry.value.length > 8 ? 27 : 35, 338, 'font-weight="700"')}
    </g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1260" viewBox="0 0 900 1260">
    <rect width="900" height="1260" rx="32" fill="#fff8ed"/>
    <circle cx="865" cy="55" r="175" fill="#f9e0e9"/><circle cx="50" cy="1200" r="190" fill="#e3eefb"/>
    <g font-family="Microsoft YaHei,PingFang SC,Arial,sans-serif" fill="#503f3d">
      <text x="58" y="65" font-size="17" letter-spacing="4">POCKET · OUR MEMORY BOOK</text>
      ${textLine(data.title, 58, 126, 32, 784, 'font-weight="700"')}
      ${textLine(data.name, 58, 172, 23, 784)}
      ${textLine(data.subtitle, 58, 215, 19, 784, 'fill="#685d68"')}
      <g transform="translate(305 248) rotate(-3 145 140)">
        <rect x="-15" y="-5" width="320" height="290" rx="12" fill="#dce9fb"/>
        <rect x="0" y="0" width="290" height="270" rx="8" fill="#fff" stroke="#e3d8cf"/>
        <image href="${xml(portrait)}" x="12" y="12" width="266" height="238" preserveAspectRatio="xMidYMid meet"/>
        <rect x="99" y="-11" width="92" height="25" fill="#ffe59b"/>
      </g>
      ${metrics}
      ${textLine(data.notes[0] ?? '', 55, 1069, 17, 790, 'fill="#665f6d"')}
      ${textLine(data.notes.slice(1).join(' · '), 55, 1120, 18, 790, 'fill="#536580"')}
      <text x="55" y="1206" font-size="16" letter-spacing="2" fill="#6c7584">A LITTLE LIFE, TOGETHER.</text>
      <text x="782" y="1206" font-size="39" fill="#ddb043">✿</text>
    </g>
  </svg>`;
};
const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Image unavailable')); image.src = url; });
export const createMemoryPoster = async (data: AlbumPosterData, portrait: string, qrCodeDataUrl?: string) => {
  const image = await loadImage(portrait);
  const cutout = document.createElement('canvas'); cutout.width = 420; cutout.height = 420;
  const ctx = cutout.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  const scale = Math.min(420 / image.naturalWidth, 420 / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  ctx.drawImage(image, (420 - w) / 2, (420 - h) / 2, w, h);
  const svg = albumPosterSvg(data, cutout.toDataURL('image/png')).replace('</svg>', qrCodeDataUrl ? `<rect x="752" y="1135" width="100" height="100" rx="7" fill="white"/><image href="${xml(qrCodeDataUrl)}" x="757" y="1140" width="90" height="90"/></svg>` : '</svg>');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const poster = await loadImage(url);
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1260;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
    context.drawImage(poster, 0, 0);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
};

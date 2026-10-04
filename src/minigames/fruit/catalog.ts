// Single-fruit silhouettes share the cream highlights and chocolate outlines of PocPet's item art.
const wrap = (body: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="#72594d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`)}`;
const shine = '<path d="M30 44q4-12 17-16" fill="none" stroke="#fff" stroke-width="7" opacity=".4"/><circle cx="25" cy="59" r="3" fill="#fff" stroke="none" opacity=".4"/>';
const leaf = '<path d="M65 21q4-12 16-15" fill="none" stroke="#8f7855"/><path d="M72 17q5-19 25-9-9 17-25 9Z" fill="#a5bd7c" stroke="#758c5b" stroke-width="2"/>';
export const fruits = [
  { name: '蓝莓', radius: 13, color: '#9198c5', image: wrap('<circle cx="64" cy="67" r="51" fill="#959cc6"/><path d="m64 22 7 9 12-2-5 12 8 8-14 2-8 12-8-12-14-2 8-8-5-12 12 2Z" fill="#737ead" stroke-width="2"/>'+shine) },
  { name: '樱桃', radius: 18, color: '#cf929c', image: wrap('<circle cx="64" cy="71" r="48" fill="#d59099"/><path d="M64 28q-2-18 14-24" fill="none" stroke="#82935e" stroke-width="5"/>'+shine) },
  { name: '草莓', radius: 24, color: '#de9395', image: wrap('<path d="M16 52q-1-33 48-31 49-2 48 31 1 34-48 66Q16 86 16 52Z" fill="#de9697"/><path d="m35 23 15 1L57 9l10 12L85 9l-2 16 17 9-24 2-12 15-12-14-25-2Z" fill="#a4b880" stroke="#7f9165" stroke-width="2"/><path d="m35 54 2 6m22-4 1 6m25-8-2 6M47 79l2 5m25-5-2 5m-10 12 1 4" stroke="#ffe9b0" stroke-width="4"/>'+shine) },
  { name: '柠檬', radius: 31, color: '#ead08a', image: wrap('<path d="M14 60q3-43 46-46 9-11 16-3 36 3 41 43 9 8-1 16-6 43-48 46-8 9-15 0-41-5-42-42-9-7 3-14Z" fill="#efd78d"/>'+shine) },
  { name: '橘子', radius: 39, color: '#e9b481', image: wrap('<circle cx="64" cy="70" r="49" fill="#eab785"/>'+leaf+shine+'<g fill="#d49b6b" stroke="none"><circle cx="91" cy="84" r="2"/><circle cx="84" cy="98" r="2"/><circle cx="100" cy="74" r="2"/></g>') },
  { name: '苹果', radius: 48, color: '#d88f87', image: wrap('<path d="M65 24C20 7 4 48 17 83q13 40 47 31 34 9 47-31C124 48 109 7 65 24Z" fill="#da9289"/>'+leaf+shine) },
  { name: '蜜瓜', radius: 59, color: '#bfce97', image: wrap('<circle cx="64" cy="66" r="52" fill="#c8d59e"/><path d="M31 24q55 23 66 83M18 44q58 19 64 71M47 16q53 27 64 66M97 24q-55 23-66 83m79-63q-58 19-64 71m35-99Q28 43 17 82" fill="none" stroke="#e6eac5" stroke-width="3"/><circle cx="64" cy="66" r="52" fill="none"/>'+shine) },
  { name: '西瓜', radius: 71, color: '#8faa79', image: wrap('<circle cx="64" cy="66" r="53" fill="#a0bb80"/><path d="M44 16q-24 50 0 101M64 13q-17 52 0 106M84 17q24 49 0 99" fill="none" stroke="#728f60" stroke-width="9"/><circle cx="64" cy="66" r="53" fill="none"/>'+shine) },
];
export const FRUIT_WIDTH = 320, FRUIT_HEIGHT = 430, DANGER_LINE = 66;

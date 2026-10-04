import type { NonogramPuzzle } from './levels';

interface RevealPaint { rows?: Record<number, string>; accents?: Record<string, string>; }
const artwork: Record<string, RevealPaint> = {
  heart: { accents: { '1,1': '#edbdc5', '1,2': '#edbdc5', '2,1': '#edbdc5' } },
  flower: { accents: { '1,2': '#dcc2e4', '2,1': '#dcc2e4', '2,2': '#e7c479', '2,3': '#dcc2e4', '3,2': '#dcc2e4' } },
  rice: { rows: { 0: '#e6d8b6', 1: '#e6d8b6', 2: '#e6d8b6', 3: '#e6d8b6', 4: '#e6d8b6' }, accents: { '3,1': '#879d78', '3,3': '#879d78', '4,1': '#879d78', '4,2': '#879d78', '4,3': '#879d78' } },
  cat: { accents: { '0,0': '#c99a84', '0,4': '#c99a84', '1,0': '#c99a84', '1,4': '#c99a84', '4,2': '#b78a76' } },
  cup: { rows: { 0: '#c9a97d', 4: '#87a6a7' }, accents: { '1,1': '#c7d7cc', '2,1': '#c7d7cc' } },
  house: { rows: { 0: '#ba9482', 1: '#ba9482', 2: '#ba9482' }, accents: { '3,1': '#a3bdba', '3,3': '#a3bdba' } },
  berry: { rows: { 0: '#91ac7d', 1: '#91ac7d' }, accents: { '3,2': '#edd6a2', '3,5': '#edd6a2', '5,1': '#edd6a2', '5,4': '#edd6a2', '6,3': '#edd6a2' } },
  tree: { rows: { 7: '#ba9c7b', 8: '#ba9c7b', 9: '#ba9c7b' }, accents: { '2,2': '#b3c898', '3,1': '#b3c898', '5,2': '#b3c898' } },
  fish: { rows: { 1: '#bdcfc9', 7: '#bdcfc9' }, accents: { '3,2': '#6d8384', '3,8': '#b6d0ce', '4,8': '#b6d0ce', '5,8': '#b6d0ce' } },
  rabbit: { accents: { '0,3': '#e3bab8', '1,3': '#e3bab8', '2,3': '#e3bab8', '0,6': '#e3bab8', '1,6': '#e3bab8', '2,6': '#e3bab8', '7,4': '#b88891', '7,5': '#b88891' } },
  umbrella: { rows: { 5: '#b5997a', 6: '#b5997a', 7: '#b5997a', 8: '#b5997a', 9: '#b5997a' }, accents: { '2,2': '#decadf', '3,1': '#decadf', '4,1': '#decadf' } },
  cake: { rows: { 0: '#dcbd78', 1: '#a7bcbd', 2: '#dbafb8', 3: '#ebd8c5', 4: '#ebd8c5', 6: '#dbafb8', 8: '#ebd8c5' } },
};
export function revealColor(puzzle: NonogramPuzzle, index: number) {
  const row = Math.floor(index / puzzle.size), col = index % puzzle.size, art = artwork[puzzle.id];
  return art?.accents?.[`${row},${col}`] || art?.rows?.[row] || puzzle.color;
}

import { useEffect, useState } from 'react';
import { appearancePalette, normalizeAppearance, persistAppearance, readAppearance, type Appearance } from '../appearance';

export const useAppearance = () => {
  const [appearance, setAppearance] = useState(readAppearance);
  useEffect(() => {
    Object.entries(appearancePalette(appearance)).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
    persistAppearance(appearance);
  }, [appearance]);
  return { appearance, setAppearance: (next: Appearance) => setAppearance(normalizeAppearance(next)) };
};

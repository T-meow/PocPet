import { useEffect, useState } from 'react';

// Resize events work in the older WebViews used by the native client as well.
export const useExplorationWideLayout = () => {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  useEffect(() => {
    const resize = () => setWide(window.innerWidth >= 1024);
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return wide;
};

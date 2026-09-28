type Layer = { id: string; key: symbol; close: () => void };
const layers: Layer[] = [];
const pendingRemovals = new Set<symbol>();
let serial = 0;
let traversing = false;
let listening = false;
const marker = 'pocpetDialog';
const stopListening = () => { if (!layers.length && !traversing && listening) { window.removeEventListener('popstate', onPop); listening = false; } };
const onPop = (event: PopStateEvent) => {
  if (traversing) { traversing = false; stopListening(); return; }
  const index = layers.findIndex(layer => layer.id === event.state?.[marker]);
  const removed = layers.splice(index + 1);
  for (const layer of removed.reverse()) layer.close();
  stopListening();
};
export const registerDialogBack = (key: symbol, close: () => void) => {
  if (!listening) { window.addEventListener('popstate', onPop); listening = true; }
  pendingRemovals.delete(key);
  const existing = layers.find(layer => layer.key === key);
  if (existing) existing.close = close;
  else {
    const id = `dialog:${Date.now()}:${++serial}`;
    layers.push({ id, key, close });
    window.history.pushState({ ...window.history.state, [marker]: id }, '');
  }
  return () => {
    pendingRemovals.add(key);
    void Promise.resolve().then(() => {
    if (!pendingRemovals.delete(key)) return;
    const index = layers.findIndex(layer => layer.key === key);
    if (index < 0) return;
    const removed = layers.splice(index);
    if (removed.some(layer => layer.id === window.history.state?.[marker])) {
      traversing = true;
      window.history.go(-removed.length);
    }
    stopListening();
    });
  };
};
export const hasDialogBackLayer = () => layers.length > 0;

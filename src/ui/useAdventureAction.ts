import { useEffect, useRef, useState } from 'react';
import { createAdventureActionGate, type AdventureActionState } from './adventureActionGate';

export const useAdventureAction = () => {
  const [state, setState] = useState<AdventureActionState>({ phase: 'idle', motion: 'sway' });
  const gate = useRef<ReturnType<typeof createAdventureActionGate>>();
  if (!gate.current) gate.current = createAdventureActionGate(setState);
  useEffect(() => () => gate.current?.cancel(), []);
  return { ...state, run: gate.current.run, isBusy: gate.current.isBusy, cancel: gate.current.cancel };
};

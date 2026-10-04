import { useEffect, useRef, useState } from 'react';
import type { GameProps } from '../types';
import { GameHeader, Stat, Tool } from '../shared/ui';
import { DANGER_LINE, fruits, FRUIT_HEIGHT, FRUIT_WIDTH } from './catalog';
import { createFruit, type FruitState } from './state';
import { FruitSimulation } from './simulation';

export function FruitGame({ state, onChange, active, paused, feedback, complete }: GameProps<'fruit'>) {
  const canvas = useRef<HTMLCanvasElement>(null), simulation = useRef<FruitSimulation | null>(null), images = useRef<HTMLImageElement[]>([]);
  const [canvasError, setCanvasError] = useState(false);
  const [message, setMessage] = useState('选个喜欢的落点，轻轻放下一颗。');
  function draw(snapshot: FruitState) {
    const context = canvas.current?.getContext('2d'); if (!context || !canvas.current) return;
    context.setTransform(canvas.current.width / FRUIT_WIDTH, 0, 0, canvas.current.height / FRUIT_HEIGHT, 0, 0);
    context.clearRect(0, 0, FRUIT_WIDTH, FRUIT_HEIGHT);
    context.fillStyle = '#fffaf0'; context.fillRect(0, 0, FRUIT_WIDTH, FRUIT_HEIGHT);
    context.fillStyle = '#eee9d7'; for (let y = 85; y < 415; y += 23) for (let x = 18; x < 315; x += 23) { context.beginPath(); context.arc(x, y, .9, 0, Math.PI * 2); context.fill(); }
    context.setLineDash([5, 5]); context.strokeStyle = snapshot.dangerMs > 0 ? '#c3897d' : '#c6bca2'; context.lineWidth = 1;
    context.beginPath(); context.moveTo(9, DANGER_LINE); context.lineTo(FRUIT_WIDTH - 9, DANGER_LINE); context.stroke(); context.setLineDash([]);
    context.font = '10px sans-serif'; context.fillStyle = '#b4a78c'; context.textAlign = 'right'; context.fillText('装满线', FRUIT_WIDTH - 15, DANGER_LINE - 7);
    function fruit(tier: number, x: number, y: number, angle: number, opacity = 1) {
      const data = fruits[tier], image = images.current[tier], r = data.radius;
      context!.save(); context!.translate(x, y); context!.rotate(angle); context!.globalAlpha = opacity;
      if (image?.complete && image.naturalWidth) context!.drawImage(image, -r * 1.11, -r * 1.11, r * 2.22, r * 2.22);
      else { context!.fillStyle = data.color; context!.strokeStyle = '#826e5a'; context!.lineWidth = 1.5; context!.beginPath(); context!.arc(0, 0, r, 0, Math.PI * 2); context!.fill(); context!.stroke(); }
      context!.restore();
    }
    snapshot.bodies.forEach(body => fruit(body.tier, body.x, body.y, body.angle));
    if (!snapshot.over) {
      context.strokeStyle = '#b7bda37d'; context.setLineDash([3, 5]); context.beginPath(); context.moveTo(snapshot.aim, 48); context.lineTo(snapshot.aim, FRUIT_HEIGHT - 12); context.stroke(); context.setLineDash([]);
      fruit(snapshot.current, snapshot.aim, 28, 0, snapshot.dropCooldownMs ? .32 : .8);
    }
    context.fillStyle = '#d4c5a1'; context.fillRect(0, FRUIT_HEIGHT - 7, FRUIT_WIDTH, 7);
  }
  const drawRef = useRef(draw); drawRef.current = draw;
  useEffect(() => {
    if (!canvas.current?.getContext('2d')) { setCanvasError(true); return; }
    const ratio = Math.min(2, window.devicePixelRatio || 1); canvas.current.width = FRUIT_WIDTH * ratio; canvas.current.height = FRUIT_HEIGHT * ratio;
    const sim = new FruitSimulation(state); simulation.current = sim;
    images.current = fruits.map(fruit => { const image = new Image(); image.onload = () => { if (simulation.current === sim) drawRef.current(sim.snapshot()); }; image.src = fruit.image; return image; });
    drawRef.current(sim.snapshot());
    const checkpoint = () => onChange(sim.snapshot());
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', checkpoint);
    return () => { window.removeEventListener('pagehide', checkpoint); document.removeEventListener('visibilitychange', checkpoint); checkpoint(); images.current.forEach(i => { i.onload = null; }); sim.destroy(); if (simulation.current === sim) simulation.current = null; };
  }, [state.id]);
  useEffect(() => {
    const sim = simulation.current; if (!sim || !active || paused || state.over) return;
    let frame = 0, previous = 0, accumulator = 0, sinceSave = 0;
    const run = (time: number) => {
      if (!previous) previous = time;
      const delta = Math.min(80, Math.max(0, time - previous)); previous = time; accumulator += delta; sinceSave += delta;
      let changed = false;
      while (accumulator >= 1000 / 60) {
        const events = sim.step(); accumulator -= 1000 / 60;
        if (events.merged) { changed = true; feedback(events.watermelon ? '一颗大西瓜！这是我们一起攒出来的小惊喜。' : '噗！两颗小水果，变成一颗大开心。', events.watermelon ? 'win' : 'clear'); }
        if (events.watermelon) setMessage('合成大西瓜啦！还可以继续挑战最高分。');
        if (events.ended) changed = true;
      }
      const snapshot = sim.snapshot(); drawRef.current(snapshot);
      if (changed || sinceSave >= 1000) { onChange(snapshot); sinceSave = 0; }
      if (!snapshot.over) frame = window.requestAnimationFrame(run);
    };
    frame = window.requestAnimationFrame(run);
    return () => { window.cancelAnimationFrame(frame); onChange(sim.snapshot()); };
  }, [active, paused, state.id, state.over]);
  useEffect(() => { if (state.over) complete({ game: 'fruit', sessionId: state.id, outcome: 'over', score: state.score }); }, [state.over, state.id, state.score, complete]);
  function aim(clientX: number) {
    const rect = canvas.current?.getBoundingClientRect(), sim = simulation.current; if (!rect || !sim || !active || paused || state.over) return;
    sim.aim((clientX - rect.left) / rect.width * FRUIT_WIDTH); drawRef.current(sim.snapshot());
  }
  function drop() {
    const sim = simulation.current; if (!sim || !active || paused) return;
    if (sim.drop()) { onChange(sim.snapshot()); feedback('落在哪里好呢？慢慢想。', 'place'); setMessage('相同的水果碰在一起，会变成更大的水果。'); }
  }
  return <div><GameHeader icon="fruit" title="小小水果，攒成大西瓜" subtitle="同级相碰就合成，留一点空间给惊喜。" label="经典挑战"/>
    <div className="score-strip"><Stat label="这一盘的分数" value={state.score}/><Stat label="最佳纪录" value={state.best} secondary/><div className="score-item secondary fruit-next"><small>下一颗</small><span><img src={fruits[state.next].image} alt=""/>{fruits[state.next].name}</span></div></div>
    <div className="fruit-table"><div className="fruit-bin"><div className="fruit-canvas-wrap"><canvas ref={canvas} tabIndex={0} aria-label="合成水果容器。左右方向键移动落点，空格投放。" onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; aim(event.clientX); if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => aim(event.clientX)} onPointerUp={event => { if (event.isPrimary && event.button === 0) { aim(event.clientX); drop(); } }} onPointerCancel={event => { if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onKeyDown={event => {
        const sim = simulation.current; if (!sim || !active || paused || state.over) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); sim.aim(sim.snapshot().aim + (event.key === 'ArrowLeft' ? -10 : 10)); drawRef.current(sim.snapshot()); }
        if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (!event.repeat) drop(); }
      }}>浏览器需要支持 Canvas 才能显示合成水果。</canvas></div>
      {canvasError && <div className="water-win"><div className="win-card"><h3>暂时画不出水果</h3><p>这个浏览器的画布不可用，可以先玩另外三款小游戏。</p></div></div>}
      {state.over && <div className="water-win"><div className="win-card"><div className="win-stars">✦ ✧ ✦</div><h3>装满一篮小开心</h3><p>这次得了 {state.score} 分，再试试不同的落点吧。</p><Tool icon="reset" primary testId="fruit-replay" onClick={() => { onChange(createFruit(state.best)); setMessage('新的一篮，慢慢放。'); }}>再来一盘</Tool></div></div>}
    </div><p className={`fruit-danger${state.dangerMs > 0 && !state.over ? ' visible' : ''}`} aria-live="polite">{state.dangerMs > 0 && !state.over ? `有水果越过装满线了 · 持续 ${Math.max(1, Math.ceil((3000 - state.dangerMs) / 1000))} 秒后结束` : '移动落点，点击或松手投放'}</p><p className="water-message" aria-live="polite">{message}</p></div>
    <div className="fruit-chain" aria-label="水果合成顺序">{fruits.map((fruit, tier) => <span key={fruit.name} title={fruit.name}><img src={fruit.image} alt={fruit.name}/>{tier < fruits.length - 1 && <i>›</i>}</span>)}</div>
    <div className="game-tools"><Tool icon="reset" testId="fruit-new" onClick={() => { onChange(createFruit(state.best)); setMessage('新的一篮，慢慢放。'); }}>换一盘</Tool></div>
  </div>;
}

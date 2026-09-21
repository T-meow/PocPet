import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement, Children, isValidElement, type ReactNode, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import postcss from 'postcss';
import { createCommunityTestPet } from './fixtures/community-pet';
import { communityDecorationIds, regionalTreasureIds, regionalTreasures } from '../src/core/regionalTreasures';
import { normalizeCommunityState } from '../src/core/communityState';
import type { OutpostRequest } from '../src/ui/outpostNavigation';

const T = new Date(2026, 8, 21, 10).getTime();
const originalNow = Date.now;
Date.now = () => T;
const noop = () => {};
const buttons = (node: ReactNode): ReactElement<any>[] => Children.toArray(node).flatMap(child => {
  if (!isValidElement<{ children?: ReactNode }>(child)) return [];
  return [...(child.type === 'button' ? [child] : []), ...buttons(child.props.children)];
});
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' });
try {
  const { TreasureDisplay, DecorationDetail, DecorationScene, DecorationCorner, DecorationSources } = await server.ssrLoadModule('/src/ui/community/TreasureDisplay.tsx');
  const pet = createCommunityTestPet('projects', T);
  pet.community.decorations = [];
  pet.community.decorationLevels = {};
  pet.inventory = {};
  const render = (component: any, props: any) => {
    const before = JSON.stringify(props.pet);
    const html = renderToStaticMarkup(createElement(component, props));
    assert(!/NaN|undefined|\[object Object\]/.test(html));
    assert.equal(JSON.stringify(props.pet), before, 'rendering must not spend, roll or mutate saved data');
    return html;
  };
  const base = { pet, update: noop, onClose: noop, onOpenOutpost: noop };
  let selected: string | undefined;
  for (const [index, button] of buttons(TreasureDisplay({ pet, onSelect: (id: string) => { selected = id; } })).entries()) {
    button.props.onClick(); assert.equal(selected, communityDecorationIds[index]);
  }
  const empty = render(TreasureDisplay, { pet, onSelect: noop });
  assert.equal((empty.match(/待制作/g) ?? []).length, 7);
  const missing = render(DecorationDetail, { ...base, id: 'creek_fountain' });
  assert(missing.includes('role="dialog"') && missing.includes('还差 1') && missing.includes('制作材料尚未备齐'));
  assert.match(missing, /disabled="">制作并陈列/);
  assert(missing.includes('decoration-detail-scroll') && missing.includes('decoration-action-bar'));

  pet.community = normalizeCommunityState({ ...pet.community, decorations: [...communityDecorationIds], decorationLevels: undefined });
  const old = render(TreasureDisplay, { pet, onSelect: noop });
  assert.equal((old.match(/Lv\.1</g) ?? []).length, 7, 'old crafted decorations render as level one');
  const upgrade = render(DecorationDetail, { ...base, id: 'amber_lantern' });
  assert(upgrade.includes('下一级') && upgrade.includes('6.3%') && upgrade.includes('还需选择 1 件'));
  assert(upgrade.includes('本次提交：300 金币') && upgrade.includes('升级消耗琥珀'));
  const frozen = render(DecorationDetail, { ...base, pet: { ...pet, timePause: { at: T } }, id: 'amber_lantern' });
  assert(frozen.includes('时间冻结中') && /disabled="">升级至 Lv\.2/.test(frozen));
  for (const id of communityDecorationIds) pet.community.decorationLevels[id] = 10;
  const complete = render(DecorationDetail, { ...base, id: 'star_dome' });
  assert(complete.includes('6个百分点') && complete.includes('Lv.10 · 已满级') && complete.includes('data-stage="complete"'));
  assert(!complete.includes('升级消耗') && !complete.includes('去收集材料'));
  pet.community.decorationLevels.star_dome = 5;
  assert(render(DecorationDetail, { ...base, id: 'star_dome' }).includes('data-stage="grown"'));

  const farm = buttons(DecorationScene({ pet, fishing: false, onSelect: (id: string) => { selected = id; } }));
  const pier = buttons(DecorationScene({ pet, fishing: true, onSelect: (id: string) => { selected = id; } }));
  const corner = buttons(DecorationCorner({ pet, onSelect: (id: string) => { selected = id; } }));
  assert.equal(farm.length, 5); assert.equal(pier.length, 1); assert.equal(corner.length, 1);
  for (const button of [...farm, ...pier, ...corner]) {
    button.props.onClick();
    assert(communityDecorationIds.includes(selected as typeof communityDecorationIds[number]));
    assert(button.props['aria-label'].includes('查看效果与升级'));
  }
  pet.community.facilities.fishing_hut.built = false;
  assert.equal(buttons(DecorationCorner({ pet, onSelect: noop })).length, 2, 'unopened host falls back to the travel corner');
  assert.equal(buttons(DecorationScene({ pet, fishing: true, onSelect: noop })).length, 0);

  for (const treasure of regionalTreasureIds) {
    const requests: OutpostRequest[] = [];
    const sources = buttons(DecorationSources({ treasure, onNavigate: (r: OutpostRequest) => requests.push(r) }));
    sources.forEach(button => button.props.onClick());
    assert.deepEqual(requests, [
      { view: 'route', region: regionalTreasures[treasure].region, ...(treasure === 'creek_aquamarine' ? { target: 'aquamarine' } : {}) },
      { view: 'idle', region: regionalTreasures[treasure].region },
      { view: 'route', region: 'valley', target: 'materials' },
    ]);
  }
  postcss.parse(readFileSync(new URL('../src/styles/decorations.css', import.meta.url), 'utf8'));
  console.log('Decoration UI passed: empty/legacy/max levels, deficits, frozen actions, scene/detail entry points, destination navigation, render purity and CSS parsing. Layout, touch and scroll acceptance remain manual.');
} finally { await server.close(); Date.now = originalNow; }

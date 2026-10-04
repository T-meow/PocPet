// Shared entry metadata is safe to import without React, artwork or physics.
export const miniGameCatalog = [
  { id: 'blocks', name: '方块消除', subtitle: '转一转，刚刚好', icon: 'blocks', glyph: '🧩', description: '旋转积木，填满整行或整列。慢慢摆，挑战自己的纪录。' },
  { id: 'water', name: '彩瓶分类', subtitle: '颜色也有自己的家', icon: 'bottle', glyph: '🧴', description: '把同色果汁倒在一起，整理出一瓶瓶整齐的颜色。' },
  { id: 'fruit', name: '合成水果', subtitle: '攒一篮小小的快乐', icon: 'fruit', glyph: '🍉', description: '相同水果碰一碰，合成更大的水果，试试攒出大西瓜。' },
  { id: 'match3', name: '花园三消', subtitle: '换一下，连起小开心', icon: 'grid', glyph: '🌸', description: '交换相邻图案，连成三个就消除。40 步，没有倒计时。' },
] as const;

export type HubGameId = typeof miniGameCatalog[number]['id'];
export const isHubGameId = (id: unknown): id is HubGameId => miniGameCatalog.some(game => game.id === id);

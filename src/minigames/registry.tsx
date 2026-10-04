import type { GameDefinition } from './types';
import { BlockGame } from './blocks/BlockGame';
import { WaterGame } from './water/WaterGame';
import { FruitGame } from './fruit/FruitGame';
import { Match3Game } from './match3/Match3Game';
import { miniGameCatalog } from './catalog';

export const miniGameRegistry: readonly GameDefinition[] = [
  {
    ...miniGameCatalog[0], welcome: '这一小会儿，我都陪着你。转一转，慢慢摆。',
    instructions: [{ title: '选一块，转个方向', body: '点积木后可按旋转按钮，或键盘 R。' }, { title: '填满一行或一列', body: '点棋盘左上角放置，也可以拖动。' }, { title: '三块用完，再来三块', body: '留一点余地，惊喜会接着来。' }],
    tip: '所有积木都能旋转。提示会一起考虑不同方向；随时可以撤回，换个摆法试试。',
    render: (props, games, change) => <BlockGame {...props} state={games.blocks} onChange={next => change('blocks', games.blocks.id, next)}/>,
  },
  {
    ...miniGameCatalog[1], welcome: '一瓶一瓶慢慢理，心情也会变得整整齐齐。',
    instructions: [{ title: '先选一瓶，再选另一瓶', body: '空瓶和顶部同色的瓶子可以接住。' }, { title: '相同颜色一起流动', body: '一次倒出顶端连续的同色果汁。' }, { title: '每种颜色住满一瓶', body: '整理完所有颜色，就能去下一关。' }],
    tip: '留一只空瓶，会更容易周转。颜色里的小图案，也能帮你分辨不同口味。',
    render: (props, games, change) => <WaterGame {...props} state={games.water} onChange={next => change('water', games.water.id, next)}/>,
  },
  {
    ...miniGameCatalog[2], welcome: '今天能攒出多大的水果呢？我想看一颗大西瓜。',
    instructions: [{ title: '选落点，放下水果', body: '移动后点击，或按住移动再松手。' }, { title: '相同的水果碰一碰', body: '合成更大一级，连锁时也会加分。' }, { title: '给下一颗留点空间', body: '落入容器后持续越线 3 秒，本局结束。' }],
    tip: '方向键也能移动，空格投放。经典挑战可以暂停和重开；切走时水果会停在原处。',
    render: (props, games, change) => <FruitGame {...props} state={games.fruit} onChange={next => change('fruit', games.fruit.id, next)}/>,
  },
  {
    ...miniGameCatalog[3], welcome: '小花、蘑菇和蝴蝶都来啦，一起凑出一串小惊喜。',
    instructions: [{ title: '交换相邻的两个图案', body: '点两格，也可以按住向旁边滑一格。' }, { title: '三个相同，排成一条线', body: '横着竖着都可以，补落后还能继续连锁。' }, { title: '40 步，慢慢想', body: '没有倒计时，无效交换和提示都不扣步数。' }],
    tip: '连锁越长，这一步得分越高。没有可消组合时会自动重排；每盘都是新的排列，试试刷新自己的纪录。',
    render: (props, games, change) => <Match3Game {...props} state={games.match3} onChange={next => change('match3', games.match3.id, next)}/>,
  },
];

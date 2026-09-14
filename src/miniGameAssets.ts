import { itemIcons } from './assets';
import matchingCardBack from './assets/play/matching_card_back.png';
import nightStar from './assets/play/night_star.png';
import nightMoon from './assets/play/night_moon.png';
import nightCloud from './assets/play/night_cloud.png';
import nightPlanet from './assets/play/night_planet.png';
import nightComet from './assets/play/night_comet.png';
import nightSparkle from './assets/play/night_sparkle.png';
import gardenSunflower from './assets/play/garden_sunflower.png';
import gardenTulip from './assets/play/garden_tulip.png';
import gardenClover from './assets/play/garden_clover.png';
import gardenMushroom from './assets/play/garden_mushroom.png';
import gardenLeaf from './assets/play/garden_leaf.png';
import gardenButterfly from './assets/play/garden_butterfly.png';

export { matchingCardBack };
export const matchingCardFaces: Record<'garden' | 'fruit' | 'night', readonly { image: string; name: string; en: string }[]> = {
  night: [
    { image: nightStar, name: '星星', en: 'Star' },
    { image: nightMoon, name: '月亮', en: 'Moon' },
    { image: nightCloud, name: '云朵', en: 'Cloud' },
    { image: nightPlanet, name: '行星', en: 'Planet' },
    { image: nightComet, name: '彗星', en: 'Comet' },
    { image: nightSparkle, name: '闪光', en: 'Sparkle' },
  ],
  garden: [
    { image: gardenSunflower, name: '向日葵', en: 'Sunflower' },
    { image: gardenTulip, name: '郁金香', en: 'Tulip' },
    { image: gardenClover, name: '三叶草', en: 'Clover' },
    { image: gardenMushroom, name: '蘑菇', en: 'Mushroom' },
    { image: gardenLeaf, name: '绿叶', en: 'Leaf' },
    { image: gardenButterfly, name: '蝴蝶', en: 'Butterfly' },
  ],
  fruit: [
    { image: itemIcons.apple, name: '苹果', en: 'Apple' },
    { image: itemIcons.banana, name: '香蕉', en: 'Banana' },
    { image: itemIcons.orange, name: '橘子', en: 'Orange' },
    { image: itemIcons.watermelon, name: '西瓜', en: 'Watermelon' },
    { image: itemIcons.carrot, name: '胡萝卜', en: 'Carrot' },
    { image: itemIcons.egg, name: '鸡蛋', en: 'Egg' },
  ],
};

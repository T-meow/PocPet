import type { CommunityDecorationId } from './core/regionalTreasures';
import amber_lantern from './assets/decoration/decoration_amber_lantern.webp';
import golden_sign from './assets/decoration/decoration_golden_sign.webp';
import creek_fountain from './assets/decoration/decoration_creek_fountain.webp';
import sun_weather_vane from './assets/decoration/decoration_sun_weather_vane.webp';
import emerald_pendant from './assets/decoration/decoration_emerald_pendant.webp';
import pearl_lamp from './assets/decoration/decoration_pearl_lamp.webp';
import star_dome from './assets/decoration/decoration_star_dome.webp';

export const decorationIcons = {
  amber_lantern,
  golden_sign,
  creek_fountain,
  sun_weather_vane,
  emerald_pendant,
  pearl_lamp,
  star_dome,
} satisfies Record<CommunityDecorationId, string>;

import { Star } from 'lucide-react';

export const FavoriteButton = ({ active, name, onToggle }: { active: boolean; name: string; onToggle: () => void }) => <button
  type="button" className={`favorite-button${active ? ' favorite-button--active' : ''}`}
  aria-pressed={active} aria-label={`${active ? '取消收藏' : '收藏'}：${name}`}
  title={active ? '点击取消收藏' : '收藏后在列表中优先显示'} onClick={onToggle}
><Star size={16} aria-hidden="true" /><span>{active ? '已收藏' : '收藏'}</span></button>;

export const FavoriteMark = () => <span className="favorite-mark" role="img" aria-label="已收藏" title="已收藏"><Star size={12} aria-hidden="true" /></span>;

import { useState } from 'react';
import { getMuseumAppearance, getMuseumOpenHalls, museumGuestMessages } from '../../core/pet';
import { museumHalls, museumThemes, museumScales } from '../../core/museumData';
import { dishName } from '../../core/kitchenRecipes';
import { museumImages } from '../../museumAssets';
import { resolvePetStatusImages } from '../../assets';
import { formatInteger } from '../numberFormat';
import { MuseumGuest, MuseumScene, museumRecordScene, type MuseumProps } from './MuseumShared';

export const MuseumAlbum = ({ pet, portrait, mods, actorId, icons }: MuseumProps) => {
  const [limit, setLimit] = useState(12), appearance = getMuseumAppearance(pet), badges = Math.floor(pet.museum.stars / 30);
  const actorImage = (id: string) => id === actorId ? portrait : id === 'official.furo' ? resolvePetStatusImages(null).content : mods.find(m => m.manifest.id === id)?.contentImageUrl ?? resolvePetStatusImages(null).content;
  return <section><div className="museum-card"><h2>我们的纪念册</h2><p>举办 {formatInteger(pet.museum.hosted)} 场 · 策展 {formatInteger(pet.museum.stars)} 星 · 每周纪念 {formatInteger(pet.museum.weeklyPages)} 页</p><p>建设与策展累计投入 {formatInteger(pet.museum.coinsSpent)} 金币、{formatInteger(pet.museum.applesSpent)} 个金苹果。</p><p>再积累 {30 - pet.museum.stars % 30} 星，就能获得下一枚编号徽章。</p><div className="museum-badges">{Array.from({ length: Math.min(12, badges) }, (_, i) => { const number = badges - Math.min(12, badges) + i + 1; return <figure key={number}><img src={museumImages[`curator-badge-${appearance.badge}`]} alt="策展纪念徽章" /><figcaption>No.{formatInteger(number)}</figcaption></figure>; })}</div>{badges > 12 && <small>永久拥有 {formatInteger(badges)} 枚编号徽章，这里展示最近十二枚。</small>}</div>
    <h3>展厅开馆纪念</h3><div className="museum-theme-grid">{getMuseumOpenHalls(pet.museum).map(region => <article className="museum-card" key={region}><MuseumScene scene={museumHalls[region].scene} icons={icons} framed={appearance.frame} caption={museumHalls[region].name} /><p>{pet.museum.halls[region].openedAt ? new Date(pet.museum.halls[region].openedAt!).toLocaleDateString('zh-CN') : '已永久开放'}</p></article>)}</div>
    <h3>展览与来访</h3>{!pet.museum.records.length && <p>第一场展览结束后，展品搭配、同行伙伴和邻居留言都会留在这里。</p>}
    <div className="museum-records">{[...pet.museum.records].reverse().slice(0, limit).map(record => <article key={record.id} className="museum-card"><div className="museum-section-heading"><h3>{museumThemes[record.theme].name}</h3><time>{new Date(record.at).toLocaleDateString('zh-CN')}</time></div><MuseumScene scene={museumRecordScene(record.exhibits)} icons={icons} exhibits={record.exhibits} portrait={actorImage(record.actorId)} guestPortrait={record.guestId ? actorImage(record.guestId) : undefined} framed={appearance.frame} /><p>{museumScales[record.scale].name} · 评分 {record.rating} 星 · 策展星 +{record.stars}{record.weekly ? ' · 当周纪念页' : ''}</p><p>与 {record.actorName} 一起布展，招待了{record.dishes.map(d => `${dishName(d)} ×${record.portions}`).join('、')}。</p><MuseumGuest id={record.guestId} name={record.guestName} mods={mods} /><blockquote>{museumGuestMessages[record.message]}</blockquote><small>本场投入 {formatInteger(record.coins)} 金币、{record.apples} 个金苹果。</small></article>)}</div>
    {limit < pet.museum.records.length && <button className="secondary-button" onClick={() => setLimit(limit + 12)}>翻看更早的展览</button>}{pet.museum.hosted > 200 && <p>保留最近 200 场详细记录，全部场次、策展星、编号徽章与累计投入永久保留。</p>}
  </section>;
};

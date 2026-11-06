import { useState } from 'react';
import { getMuseumAppearance, getMuseumOpenHalls, museumGuestMessages } from '../../core/pet';
import { museumHalls, museumThemes, museumScales, type MuseumRegion } from '../../core/museumData';
import type { MuseumRecord } from '../../core/museumTypes';
import { dishName } from '../../core/kitchenRecipes';
import { resolvePetStatusImages } from '../../assets';
import { formatInteger } from '../numberFormat';
import { MuseumGuest, MuseumScene, museumRecordScene, type MuseumProps } from './MuseumShared';

type MuseumMemory =
  | { kind: 'hall'; at: number; region: MuseumRegion }
  | { kind: 'exhibition'; at: number; record: MuseumRecord };

export const MuseumAlbum = ({ pet, portrait, mods, actorId, icons }: MuseumProps) => {
  const [limit, setLimit] = useState(12), appearance = getMuseumAppearance(pet);
  const memories: MuseumMemory[] = [
    ...getMuseumOpenHalls(pet.museum).map(region => ({ kind: 'hall' as const, region, at: pet.museum.halls[region].openedAt ?? 0 })),
    ...[...pet.museum.records].reverse().map(record => ({ kind: 'exhibition' as const, record, at: record.at || 0 })),
  ];
  const sortedMemories = memories.map((memory, index) => ({ ...memory, index }))
    .sort((a, b) => b.at - a.at || a.index - b.index);
  const actorImage = (id: string) => id === actorId ? portrait : id === 'official.furo' ? resolvePetStatusImages(null).content : mods.find(m => m.manifest.id === id)?.contentImageUrl ?? resolvePetStatusImages(null).content;
  return <section>
    <div className="museum-card">
      <h2>我们的纪念册</h2>
      <p>举办 {formatInteger(pet.museum.hosted)} 场 · 策展 {formatInteger(pet.museum.stars)} 星 · 每周纪念 {formatInteger(pet.museum.weeklyPages)} 页</p>
      <p>建设与策展累计投入 {formatInteger(pet.museum.coinsSpent)} 金币、{formatInteger(pet.museum.applesSpent)} 个金苹果。</p>
    </div>
    <h3>一起收藏的纪念</h3>
    {!memories.length && <p>展厅开馆和每场展览的纪念图都会留在这里，最近的纪念排在最上面。</p>}
    <div className="museum-records">{sortedMemories.slice(0, limit).map(memory => {
      if (memory.kind === 'hall') {
        const hall = museumHalls[memory.region];
        return <article className="museum-card" key={`hall:${memory.region}`}>
          <div className="museum-section-heading"><div><small>展厅开馆纪念</small><h3>{hall.name}</h3></div><time>{memory.at ? new Date(memory.at).toLocaleDateString('zh-CN') : '已永久开放'}</time></div>
          <MuseumScene scene={hall.scene} icons={icons} framed={appearance.frame} caption={hall.name} />
        </article>;
      }
      const { record } = memory;
      return <article key={`exhibition:${record.id}`} className="museum-card">
        <div className="museum-section-heading"><div><small>展览与来访</small><h3>{museumThemes[record.theme].name}</h3></div><time>{memory.at ? new Date(memory.at).toLocaleDateString('zh-CN') : '时间未记录'}</time></div>
        <MuseumScene scene={museumRecordScene(record.exhibits)} icons={icons} exhibits={record.exhibits} portrait={actorImage(record.actorId)} guestPortrait={record.guestId ? actorImage(record.guestId) : undefined} framed={appearance.frame} />
        <p>{museumScales[record.scale].name} · 评分 {record.rating} 星 · 策展星 +{record.stars}{record.weekly ? ' · 当周纪念页' : ''}</p>
        <p>与 {record.actorName} 一起布展，招待了{record.dishes.map(d => `${dishName(d)} ×${record.portions}`).join('、')}。</p>
        <MuseumGuest id={record.guestId} name={record.guestName} mods={mods} />
        <blockquote>{museumGuestMessages[record.message]}</blockquote>
        <small>本场投入 {formatInteger(record.coins)} 金币、{record.apples} 个金苹果。</small>
      </article>;
    })}</div>
    {limit < memories.length && <button className="secondary-button" onClick={() => setLimit(current => current + 12)}>翻看更早的纪念</button>}
    {pet.museum.hosted > 200 && <p>保留最近 200 场详细记录，全部场次、策展星与累计投入永久保留。</p>}
  </section>;
};

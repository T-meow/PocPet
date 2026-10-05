import { Check, ClipboardList, Gift, Heart, Users } from 'lucide-react';
import { resolvePetStatusImages } from '../assets';
import { claimCampaignTask, getCampaignClaimReason, startExplorationCampaign } from '../core/explorationCampaign';
import { campaignChapterIds, campaignChapters, campaignTasks, campaignTitle, campaignVisitIds, campaignVisits, getTaskVisitId, type CampaignVisitId } from '../core/explorationCampaignData';
import { campaignChapterReady, campaignText, campaignVisitComplete, campaignVisitStep, getCampaignVisitReason, type CampaignContact } from '../core/explorationCampaignState';
import { getInventoryItem } from '../core/items';
import { completedLandmark, landmarkNames, regionNames } from '../core/landmarkProgress';
import type { InstalledPetModSummary } from '../core/mod';
import { getNeighborIdentities } from '../core/neighbors';
import type { ItemId, PetState } from '../core/petTypes';
import { AdventureLandscape } from './AdventurePresentation';
import { formatInteger } from './numberFormat';

export const CampaignContactBadge = ({ contact, mods }: { contact?: CampaignContact; mods: readonly InstalledPetModSummary[] }) => {
  const id = contact?.reference.kind === 'mod' ? contact.reference.modId : undefined;
  const portrait = id === 'official.furo' ? resolvePetStatusImages(null).content : mods.find(mod => mod.manifest.id === id)?.contentImageUrl;
  return <span className="campaign-contact">{portrait ? <img src={portrait} alt="" /> : <Users size={22} aria-hidden="true" />}<span>{contact?.name ?? '社区伙伴'}</span></span>;
};
export const CampaignReward = ({ hearts, apples }: { hearts: number; apples: number }) => <span className="campaign-reward"><span><Heart size={16} aria-hidden="true" />{formatInteger(hearts)} 小心心</span><span>{apples} 个金苹果</span></span>;
const dateLabel = (at: number) => new Date(at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const ExplorationTasks = ({ pet, actorId, mods, update, onVisit, onMap, onResume, onReceipt, tab, onTab }: {
  pet: PetState; actorId: string; mods: readonly InstalledPetModSummary[]; update: (fn: (p: PetState) => PetState) => void;
  onVisit: (id: CampaignVisitId) => void; onMap: () => void; onResume: () => void; onReceipt: () => void;
  tab: 'current' | 'completed'; onTab: (tab: 'current' | 'completed') => void;
}) => {
  const state = pet.adventure.campaign;
  const completed = campaignTasks.filter(task => state.tasks[task.id]);
  const unclaimed = completed.filter(task => !state.tasks[task.id]?.claimedAt);
  const traveling = Boolean(pet.adventure.active || pet.community.expedition.active);
  const pending = Boolean(pet.adventure.pending || pet.community.expedition.pending);
  const claim = (id: number) => <div className="campaign-claim"><button className="primary-button" disabled={Boolean(getCampaignClaimReason(pet, id))} onClick={() => update(p => claimCampaignTask(p, id))}><Gift size={18} />收下这份心意</button>{getCampaignClaimReason(pet, id) && <small role="status">{getCampaignClaimReason(pet, id)}</small>}</div>;
  const start = () => update(p => startExplorationCampaign(p, getNeighborIdentities(mods, actorId), actorId));
  return <section className="campaign-page">
    <nav className="campaign-tabs" aria-label="探索任务分页"><button aria-pressed={tab === 'current'} onClick={() => onTab('current')}>当前任务{unclaimed.length > 0 && ` · ${unclaimed.length} 项待领`}</button><button aria-pressed={tab === 'completed'} onClick={() => onTab('completed')}>已完成 · {completed.length}</button></nav>
    <section className="exploration-panel campaign-intro"><span className="exploration-tag">社区聚餐 · {completed.length} / 30</span><h3>{campaignTitle}</h3><p>{state.tasks[30] ? '饭吃过了，借来的东西也收好了。翻翻任务册，还能想起大家忙前忙后的样子。' : '邻居们想找一天去观测站聚餐。饭菜各带一点，凳子、灯和桌布也得先找齐。你有空的话，就一起搭把手吧。'}</p><CampaignReward hearts={30000} apples={125} /><small>全程共 30 项，每完成一件就能领取一份心意。</small>
      {!state.startedAt && <><button className="primary-button" disabled={Boolean(pet.timePause) || !(pet.adventure.completed.tutorial ?? 0)} onClick={start}>好啊，一起准备</button>{!(pet.adventure.completed.tutorial ?? 0) && <p>先走完新手踩点，再来和邻居商量。</p>}</>}
      {state.startedAt && <CampaignContactBadge contact={state.contacts.valley} mods={mods} />}
    </section>
    {tab === 'current' ? <>
      {traveling && <div className="campaign-notice"><p>伙伴正在路上，可以继续当前行程。</p><button className="secondary-button" onClick={onResume}>回到旅途中</button></div>}
      {pending && <div className="campaign-notice"><p>先把上一趟带回来的东西收好。</p><button className="secondary-button" onClick={onReceipt}>收好返程行囊</button></div>}
      {unclaimed.length > 0 && <section className="campaign-unclaimed"><h3>已经办妥的事</h3>{unclaimed.map(task => <article className="exploration-panel campaign-task" key={task.id}><div><span className="exploration-tag">已完成 · 待领取</span><h4>{task.title}</h4><p>{campaignText(task.outcome, state, task.chapter)}</p><CampaignContactBadge contact={state.contacts[task.chapter]} mods={mods} /><CampaignReward hearts={task.hearts} apples={task.apples} /></div>{claim(task.id)}</article>)}</section>}
      {state.startedAt && campaignChapterIds.map((chapter, index) => {
        const chapterTasks = campaignTasks.filter(task => task.chapter === chapter), done = chapterTasks.filter(task => state.tasks[task.id]).length;
        if (done === chapterTasks.length) return null;
        const ready = campaignChapterReady(state, chapter);
        return <section className={`campaign-chapter${ready ? '' : ' campaign-chapter--locked'}`} key={chapter}><div className="campaign-chapter-heading"><div><small>第 {index + 1} 章 · {regionNames[chapter]}</small><h3>{campaignChapters[chapter].title}</h3></div><span>{done} / 6</span></div>
          {!ready ? <p>{chapter === 'observatory' ? '林地和海边的东西都准备好，就能一起上山了。' : chapter === 'forest' || chapter === 'coast' ? '先收拾好山丘那边的灯和蜂蜜。林地与海边可以先去任意一边。' : '先把溪谷的凳子准备好，再去山丘碰头。'}</p> : <>
            <CampaignContactBadge contact={state.contacts[chapter]} mods={mods} />
            {!state.contacts[chapter] && <button onClick={start}>和伙伴确认安排</button>}
            {campaignVisitIds.filter(id => campaignVisits[id].region === chapter && !campaignVisitComplete(state, id)).map(id => {
              const visit = campaignVisits[id], tasks = chapterTasks.filter(task => getTaskVisitId(task.id) === id && !state.tasks[task.id]), reason = getCampaignVisitReason(pet, id);
              const visited = completedLandmark(pet.adventure, chapter, visit.node), step = campaignVisitStep(state, id);
              return <article className="exploration-panel campaign-visit-card" key={id}><div className="campaign-chapter-heading"><h4>{landmarkNames[chapter][visit.node]}</h4><small>{visited ? `${visit.steps.length - step} 步准备` : '探索后和伙伴碰头'}</small></div><ol className="campaign-task-list">{tasks.map(task => <li key={task.id}><strong>{task.title}</strong><p>{task.goal}</p><CampaignReward hearts={task.hearts} apples={task.apples} /></li>)}</ol>
                <button className="primary-button" disabled={Boolean(pet.timePause) || traveling || pending || Boolean(reason)} onClick={() => onVisit(id)}>{step ? '接着办这几件事' : '整理行囊，去这里'}</button>{reason && <p className="campaign-hint">{reason}</p>}{reason && !visit.requires.some(task => !state.tasks[task]) && <button className="secondary-button" onClick={onMap}>去地图看看</button>}
              </article>;
            })}
          </>}
        </section>;
      })}
      {state.tasks[30] && <section className="exploration-panel campaign-ending"><AdventureLandscape region="observatory" node="story" label="这顿饭，大家一起准备" /><h3>下次还一起吃饭</h3><p>{campaignTasks[29].outcome}</p><button className="secondary-button" onClick={() => onTab('completed')}>翻翻这一路的记录</button></section>}
    </> : <section className="campaign-archive"><p>办过的事都会留在这里。领过的心意、当时的选择，也一起记着。</p>{!completed.length && <div className="exploration-panel campaign-empty"><ClipboardList size={30} /><p>还没有完成的聚餐任务。先去和伙伴碰个面吧。</p><button onClick={() => onTab('current')}>看看当前任务</button></div>}{[...completed].sort((a, b) => state.tasks[b.id]!.completedAt - state.tasks[a.id]!.completedAt || b.id - a.id).map(task => {
      const record = state.tasks[task.id]!, id = getTaskVisitId(task.id), visit = campaignVisits[id];
      const stepIndex = visit.steps.findIndex(step => step.task === task.id);
      let from = 0;
      for (let i = 0; i < stepIndex; i++) if (visit.steps[i].task) from = i + 1;
      const choices = (state.visits[id] ?? []).slice(from, stepIndex + 1).map((choice, index) => visit.steps[from + index].options.find(option => option.id === choice)).filter(Boolean);
      return <article className="exploration-panel campaign-task campaign-task--record" key={task.id}><div><div className="campaign-chapter-heading"><h4><Check size={17} />{task.title}</h4><time dateTime={new Date(record.completedAt).toISOString()}>{dateLabel(record.completedAt)}</time></div><CampaignContactBadge contact={state.contacts[task.chapter]} mods={mods} /><p>{campaignText(task.outcome, state, task.chapter)}</p><CampaignReward hearts={record.reward?.hearts ?? task.hearts} apples={record.reward?.apples ?? task.apples} /><small>{record.claimedAt ? `${dateLabel(record.claimedAt)} 已领取` : '心意还没领取'}</small><details><summary>当时的选择</summary>{choices.map((choice, index) => <p key={index}><strong>{choice!.label}</strong><br />{campaignText(choice!.result, state, task.chapter)}</p>)}{record.delivery && <p>交付：{Object.entries(record.delivery).map(([item, count]) => `${getInventoryItem(item as ItemId)?.name ?? item} ×${count}`).join('、')}</p>}</details></div>{!record.claimedAt && claim(task.id)}</article>;
    })}</section>}
  </section>;
};

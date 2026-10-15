import { useState } from 'react';
import { Check, ClipboardList, Gift, Heart, Ticket, Users } from 'lucide-react';
import { resolvePetStatusImages } from '../assets';
import { seasonalGatheringArtwork, springReunionArtwork } from '../communityProjectAssets';
import { claimCampaignTask, getCampaignClaimReason, getCampaignStartReason, startExplorationCampaign } from '../core/explorationCampaign';
import { campaignChapterIds, getCampaignChapters, getCampaignTasks, getCampaignVisit, getCampaignVisitIds, getTaskVisitId, getCampaignReward, type CampaignKind, type CampaignVisitId } from '../core/explorationCampaignData';
import { campaignChapterReady, campaignText, campaignVisitComplete, campaignVisitStep, getCampaignVisitReason, getCampaignState, getReunionWorkers, type CampaignContact, type CampaignRun } from '../core/explorationCampaignState';
import { getSpringReunionStartReason, isSpringReunionVisible, startSpringReunion } from '../core/springReunion';
import { springReunionTitle, springReunionOpening, springReunionEnding } from '../core/springReunionData';
import { getGatheringSeason, seasonalGatherings } from '../core/gatheringSeasons';
import { getEffectiveDailyDateKey } from '../core/gameClock';
import { getInventoryItem } from '../core/items';
import { completedLandmark, landmarkNames, regionNames } from '../core/landmarkProgress';
import type { InstalledPetModSummary } from '../core/mod';
import { getNeighborIdentities } from '../core/neighbors';
import type { ItemId, PetState } from '../core/petTypes';
import { formatInteger } from './numberFormat';

export const CampaignContactBadge = ({ contact, mods }: { contact?: CampaignContact; mods: readonly InstalledPetModSummary[] }) => {
  const id = contact?.reference.kind === 'mod' ? contact.reference.modId : undefined;
  const portrait = id === 'official.furo' ? resolvePetStatusImages(null).content : mods.find(mod => mod.manifest.id === id)?.contentImageUrl;
  return <span className="campaign-contact">{portrait ? <img src={portrait} alt="" /> : <Users size={22} aria-hidden="true" />}<span>{contact?.name ?? '社区伙伴'}</span></span>;
};
export const CampaignReward = ({ hearts, apples, tickets = 0 }: { hearts: number; apples: number; tickets?: number }) => hearts || apples || tickets ? <span className="campaign-reward">{hearts > 0 && <span><Heart size={16} aria-hidden="true" />{formatInteger(hearts)} 心心</span>}{apples > 0 && <span>{apples} 个金苹果</span>}{tickets > 0 && <span><Ticket size={16} />{tickets} 张抽奖券</span>}</span> : null;
const dateLabel = (at: number) => new Date(at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export const campaignRunTitle = (run: CampaignRun) => run.kind === 'spring-reunion' ? springReunionTitle : seasonalGatherings[run.theme ?? getGatheringSeason(run.startedAt)].name;
export const CampaignArtwork = ({ run, opening = false }: { run: CampaignRun; opening?: boolean }) => <img className="campaign-cg" width={1920} height={1080} src={run.kind === 'spring-reunion' ? opening ? springReunionArtwork.opening : springReunionArtwork.ending : seasonalGatheringArtwork[run.theme ?? getGatheringSeason(run.startedAt)]} alt={opening ? '团圆邀约的地图和邀请函' : campaignRunTitle(run)} loading="lazy" />;
export const CampaignEnding = ({ run }: { run: CampaignRun }) => <div className="campaign-ending"><CampaignArtwork run={run} /><h3>{run.kind === 'spring-reunion' ? '这一桌，大家都在' : seasonalGatherings[run.theme ?? getGatheringSeason(run.startedAt)].memory}</h3><p>{run.kind === 'spring-reunion' ? springReunionEnding : seasonalGatherings[run.theme ?? getGatheringSeason(run.startedAt)].ending}</p>{run.kind === 'spring-reunion' && <p className="campaign-roster-names">这一年的团圆伙伴：{run.participants?.map(p => p.name).join('、')}</p>}<small>{run.kind === 'spring-reunion' ? run.year + ' 年春节团圆' : run.quarter + ' · 季度聚餐'}</small></div>;
const Participants = ({ run, mods }: { run: CampaignRun; mods: readonly InstalledPetModSummary[] }) => <section className="campaign-roster"><h4>本期一起筹备的伙伴</h4><div className="campaign-participants">{run.participants?.map(p => {
  const worked = getCampaignTasks('spring-reunion').some(task => run.tasks[task.id] && getReunionWorkers(run, task.chapter, task.id).some(worker => worker.modId === p.modId));
  return <div key={p.modId}><CampaignContactBadge contact={{ reference: { kind: 'mod', modId: p.modId }, name: p.name }} mods={mods} /><small>{regionNames[p.chapter]} · {worked ? '已经搭过手' : '已约好一起准备'}</small></div>;
})}</div></section>;

export const ExplorationTasks = ({ pet, actorId, actorName, mods, update, onVisit, onMap, onResume, onReceipt, tab, onTab, kind: requestedKind = 'quarterly', onKind }: {
  pet: PetState; actorId: string; actorName: string; mods: readonly InstalledPetModSummary[]; update: (fn: (p: PetState) => PetState) => void;
  onVisit: (id: CampaignVisitId) => void; onMap: () => void; onResume: () => void; onReceipt: () => void;
  tab: 'current' | 'completed'; onTab: (tab: 'current' | 'completed') => void; kind?: CampaignKind; onKind?: (kind: CampaignKind) => void;
}) => {
  const springVisible = isSpringReunionVisible(pet);
  const kind = requestedKind === 'spring-reunion' && springVisible ? requestedKind : 'quarterly';
  const state = getCampaignState(pet, kind), special = kind === 'spring-reunion';
  const [archiveId, setArchiveId] = useState('');
  const archive = state.history.find(run => run.runId === archiveId) ?? state;
  const theme = state.theme ?? getGatheringSeason(getEffectiveDailyDateKey(pet));
  const definitions = getCampaignTasks(kind, theme), chapters = getCampaignChapters(kind), total = definitions.length;
  const archiveTasks = getCampaignTasks(kind, archive.theme).filter(task => archive.tasks[task.id]);
  const completed = definitions.filter(task => state.tasks[task.id]);
  const unclaimed = completed.filter(task => !state.tasks[task.id]?.claimedAt);
  const traveling = Boolean(pet.adventure.active || pet.community.expedition.active);
  const pending = Boolean(pet.adventure.pending || pet.community.expedition.pending);
  const claim = (id: number) => {
    const reason = getCampaignClaimReason(pet, id, state.runId, kind);
    return <div className="campaign-claim"><button className="primary-button" disabled={Boolean(reason)} onClick={() => update(p => claimCampaignTask(p, id, Date.now(), state.runId, kind))}><Gift size={18} />收下这份心意</button>{reason && <small role="status">{reason}</small>}</div>;
  };
  const start = () => update(p => special ? startSpringReunion(p, getNeighborIdentities(mods, actorId), actorId, actorName, Date.now(), state.runId) : startExplorationCampaign(p, getNeighborIdentities(mods, actorId), actorId, Date.now(), state.runId));
  const startReason = special ? getSpringReunionStartReason(pet) : getCampaignStartReason(pet);
  const title = special ? springReunionTitle : seasonalGatherings[theme].name;
  const summaryReward = special ? { hearts: 1000, apples: 30, tickets: 100 } : { hearts: state.rewardVersion === 1 ? 30000 : 10000, apples: state.rewardVersion === 1 ? 125 : 40 };
  return <section className="campaign-page">
    {springVisible && onKind && <nav className="campaign-tabs" aria-label="聚餐任务线"><button aria-pressed={!special} onClick={() => onKind('quarterly')}>季度聚餐</button><button aria-pressed={special} onClick={() => onKind('spring-reunion')}>春节团圆</button></nav>}
    <nav className="campaign-tabs" aria-label="探索任务分页"><button aria-pressed={tab === 'current'} onClick={() => onTab('current')}>当前任务{unclaimed.length > 0 && ' · ' + unclaimed.length + ' 项待领'}</button><button aria-pressed={tab === 'completed'} onClick={() => onTab('completed')}>已完成 · {completed.length}</button></nav>
    <section className="exploration-panel campaign-intro"><span className="exploration-tag">{special ? '春节团圆 · ' + (state.year ?? '今年') : '季度聚餐 · ' + (state.quarter || '本季度')} · {completed.length} / {total}</span><h3>{title}</h3>
      {special && !state.tasks[45] && <CampaignArtwork run={state} opening />}
      <p>{state.tasks[total] ? '这一顿饭已经吃过了，大家的帮忙和祝福都留在任务册里。' : special ? springReunionOpening : seasonalGatherings[theme].intro}</p><CampaignReward {...summaryReward} />
      <small>{special ? '五张地图，共45阶段。每章完成领取200心心、6金苹果，团圆后另领100张抽奖券。只在春节活动期间接取，每年一期，接下后可跨节继续。' : '全程共30项，每年1、4、7、10月首日凌晨5点开放一期。接取时按现实月份确定四季主题，进行中的准备可跨季继续。'}</small>
      {(!state.startedAt || state.tasks[total]) && <><button className="primary-button" disabled={Boolean(startReason)} onClick={start}>{state.startedAt ? special ? '归档这期，接下今年的团圆邀请' : '归档这期，准备本季度聚餐' : '好啊，一起准备'}</button>{startReason && <p>{startReason}</p>}</>}
      {state.startedAt && (special ? <Participants run={state} mods={mods} /> : <CampaignContactBadge contact={state.contacts.valley} mods={mods} />)}
    </section>
    {tab === 'current' ? <>
      {traveling && <div className="campaign-notice"><p>伙伴正在路上，可以继续当前行程。</p><button className="secondary-button" onClick={onResume}>回到旅途中</button></div>}
      {pending && <div className="campaign-notice"><p>先把上一趟带回来的东西收好。</p><button className="secondary-button" onClick={onReceipt}>收好返程行囊</button></div>}
      {unclaimed.length > 0 && <section className="campaign-unclaimed"><h3>已经办妥的事</h3>{unclaimed.map(task => <article className="exploration-panel campaign-task" key={task.id}><div><span className="exploration-tag">已完成 · 待领取</span><h4>{task.title}</h4><p>{campaignText(task.outcome, state, task.chapter, task.id)}</p><CampaignReward {...getCampaignReward(task.id, state.rewardVersion, kind)} /></div>{claim(task.id)}</article>)}</section>}
      {state.startedAt && campaignChapterIds.map((chapter, index) => {
        const tasks = definitions.filter(task => task.chapter === chapter), done = tasks.filter(task => state.tasks[task.id]).length;
        if (done === tasks.length) return null;
        const ready = campaignChapterReady(state, chapter);
        return <section className={'campaign-chapter' + (ready ? '' : ' campaign-chapter--locked')} key={chapter}>
          <div className="campaign-chapter-heading"><div><small>第 {index + 1} 章 · {regionNames[chapter]}</small><h3>{chapters[chapter].title}</h3></div><span>{done} / {tasks.length}</span></div>
          {!ready ? <p>先完成{chapters[chapter].requires.map(id => '「' + definitions.find(task => task.id === id)?.title + '」').join('、')}，再一起接着准备。</p> : <>
            <CampaignContactBadge contact={state.contacts[chapter]} mods={mods} />
            {!state.contacts[chapter] && !special && <button onClick={start}>和伙伴确认安排</button>}
            {getCampaignVisitIds(kind).filter(id => getCampaignVisit(id).region === chapter && !campaignVisitComplete(state, id)).map(id => {
              const visit = getCampaignVisit(id, state.theme), visitTasks = tasks.filter(task => getTaskVisitId(task.id, kind) === id && !state.tasks[task.id]), reason = getCampaignVisitReason(pet, id);
              const visited = completedLandmark(pet.adventure, chapter, visit.node), step = campaignVisitStep(state, id);
              return <article className="exploration-panel campaign-visit-card" key={id}><div className="campaign-chapter-heading"><h4>{landmarkNames[chapter][visit.node]}</h4><small>{visited ? (visit.steps.length - step) + ' 步准备' : '探索后和伙伴碰头'}</small></div><ol className="campaign-task-list">{visitTasks.map(task => <li key={task.id}><strong>{task.title}</strong><p>{task.goal}</p><CampaignReward {...getCampaignReward(task.id, state.rewardVersion, kind)} /></li>)}</ol>
                <button className="primary-button" disabled={Boolean(pet.timePause) || traveling || pending || Boolean(reason)} onClick={() => onVisit(id)}>{step ? '接着办这几件事' : '整理行囊，去这里'}</button>{reason && <p className="campaign-hint">{reason}</p>}{reason && !visit.requires.some(task => !state.tasks[task]) && <button className="secondary-button" onClick={onMap}>去地图看看</button>}
              </article>;
            })}
          </>}
        </section>;
      })}
      {state.tasks[total] && <section className="exploration-panel"><CampaignEnding run={state} /><button className="secondary-button" onClick={() => onTab('completed')}>翻翻这一路的记录</button></section>}
    </> : <section className="campaign-archive">
      <p>办过的事、当时的选择和参与的伙伴都会留在这里。</p><label>查看轮次 <select value={archiveId} onChange={event => setArchiveId(event.target.value)}><option value="">当前一期 · {special ? state.year ?? '尚未开始' : state.quarter || '尚未开始'}</option>{[...state.history].reverse().map(run => <option key={run.runId} value={run.runId}>{special ? run.year + ' 年春节' : run.quarter + ' · ' + campaignRunTitle(run)}</option>)}</select></label>
      {'archivedCount' in state && state.archivedCount > 0 && <p>更早的 {state.archivedCount} 期共收到 {formatInteger(state.archivedHearts)} 心心、{formatInteger(state.archivedApples)} 个金苹果。</p>}
      {archive.tasks[total] && <section className="exploration-panel"><CampaignEnding run={archive} />{special && <Participants run={archive} mods={mods} />}</section>}
      {!archiveTasks.length && <div className="exploration-panel campaign-empty"><ClipboardList size={30} /><p>还没有完成的聚餐任务。</p></div>}
      {[...archiveTasks].reverse().map(task => {
        const record = archive.tasks[task.id]!, visitId = getTaskVisitId(task.id, kind), visit = getCampaignVisit(visitId, archive.theme);
        const stepIndex = visit.steps.findIndex(step => step.task === task.id);
        let from = 0;
        for (let i = 0; i < stepIndex; i++) if (visit.steps[i].task) from = i + 1;
        const choices = (archive.visits[visitId] ?? []).slice(from, stepIndex + 1).map((choice, i) => visit.steps[from + i].options.find(option => option.id === choice)).filter(Boolean);
        return <article className="exploration-panel campaign-task campaign-task--record" key={task.id}><div><div className="campaign-chapter-heading"><h4><Check size={17} />{task.title}</h4><time dateTime={new Date(record.completedAt).toISOString()}>{dateLabel(record.completedAt)}</time></div><p>{campaignText(task.outcome, archive, task.chapter, task.id)}</p><CampaignReward {...(record.reward ?? getCampaignReward(task.id, archive.rewardVersion, kind))} /><details><summary>当时的选择与交付</summary>{choices.map((choice, i) => <p key={i}><strong>{choice!.label}</strong><br />{campaignText(choice!.result, archive, task.chapter, task.id)}</p>)}{special && <p>一起搭手：{getReunionWorkers(archive, task.chapter, task.id).map(p => p.name).join('、')}</p>}{record.delivery && <p>交付：{Object.entries(record.delivery).map(([item, count]) => (getInventoryItem(item as ItemId)?.name ?? item) + ' ×' + count).join('、')}</p>}</details></div>{!record.claimedAt && archive.runId === state.runId && claim(task.id)}</article>;
      })}
    </section>}
  </section>;
};

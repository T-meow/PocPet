import type { HelpContent } from './HelpButton';
import type { AdventureRegionId } from '../../core/adventureTypes';
import { landmarkFirstReward } from '../../core/landmarkData';
import { landmarkNames, landmarkRequires, parseLandmarkId, type LandmarkId, type LandmarkNode } from '../../core/landmarkProgress';
import { getInventoryItem } from '../../core/items';
import type { ItemId } from '../../core/petTypes';
import { explorationHelp } from './explorationHelp';

export const landmarkDescriptions: Record<AdventureRegionId, Record<LandmarkNode, string>> = {
  valley: {
    entrance: '沿溪水辨认路标，记下回家的方向。',
    gather: '疏通旧水渠，带回香草种子与暖粥配方。',
    ridge: '探访旧农舍，找回鸡舍与牛棚图纸。',
    crossing: '越过旧桥，寻找钓鱼小屋的建设线索。',
    lookout: '登上观景台，勘测溪流上游。',
    story: '整理守园手账，寻找配方与小摊图纸。',
    encounter: '清开拦路树枝，为迷路的小客人引路。',
    camp: '点亮温室休息间，整理溪谷见闻。',
  },
  windmill: {
    entrance: '辨认风中的路标，找到通往花田的小径。',
    gather: '沿采蜜道探访花田，寻找当地物产。',
    ridge: '对照风向旗，找出背风的上坡路。',
    crossing: '穿过木栈桥，记下通往风车的路。',
    lookout: '登台辨认方位，标出林地与海岸。',
    story: '检查旧风车，让停下的叶轮重新转动。',
    encounter: '解开风团里的丝带，寻找营地标记。',
    camp: '整理山丘记录，补全通往林地与海岸的路线。',
  },
  forest: {
    entrance: '循着叶形路标，穿过入口的薄雾。',
    gather: '辨认成熟林莓，寻找可以带回的种子。',
    ridge: '跟随松针间的足迹，寻找古树旁的小径。',
    crossing: '核对守林留言，沿古树栈道前行。',
    lookout: '借树梢间的视野，记录山顶的方位。',
    story: '找回守望册缺页，辨认林间水域线索。',
    encounter: '清开枯枝，陪苔石旁的小客人找到归途。',
    camp: '点亮守望小屋，汇总林地与水域记录。',
  },
  coast: {
    entrance: '查看潮线，记下安全的回程路。',
    gather: '趁退潮查看浅池，采集海岸物产。',
    ridge: '沿贝壳坡道登高，辨认通往栈桥的路。',
    crossing: '对照潮时留言，沿旧栈桥前行。',
    lookout: '清理石栏星刻，记录三颗星的方位。',
    story: '趁退潮探访洞穴，读出漂流信里的星图。',
    encounter: '移开漂流枝，为浅沟边的小客人引路。',
    camp: '在旧船屋拼合星图，登记海岸码头线索。',
  },
  observatory: {
    entrance: '对照林地与海岸记录，确认山顶入口。',
    gather: '核对仪器编号，整理散落的观测零件。',
    ridge: '辨认坡道符号，找出连桥与穹顶的方向。',
    crossing: '核对桥端坐标，沿护栏穿过连桥。',
    lookout: '对照两地记录，校准观景台的星盘。',
    story: '检查齿轮与镜架，为夜空重新打开穹顶。',
    encounter: '解开缠住的标记牌，确认最后一段归途。',
    camp: '在值班室整理五地地图，完成星空记录。',
  },
};

export const landmarkFirstRewardText = (id: LandmarkId) => {
  const reward = landmarkFirstReward(id);
  return [reward.coins && `${reward.coins} 金币`, reward.hearts && `${reward.hearts} 小心心`,
    ...Object.entries(reward.items).map(([item, count]) => `${getInventoryItem(item as ItemId)?.name ?? item} ×${count}`),
  ].filter(Boolean).join(' · ');
};

export const getLandmarkHelp = (id: LandmarkId): HelpContent => {
  const { region, node } = parseLandmarkId(id);
  const required = landmarkRequires[node].map(value => landmarkNames[region][value]);
  return {
    title: landmarkNames[region][node],
    overview: <><p>完成全部阶段后保存地标成果。可重访采集、调查和完成委托；首通奖励只领一次。</p><p>前置：{required.length ? required.join('、') : '本地区已开放'}。</p>{node === 'camp' && <p>完成本地区全部地标后，体力上限 +2，并可建设营地。{(region === 'forest' || region === 'coast') && '新水域需另行建设后使用。'}</p>}</>,
    details: <>{explorationHelp.details}<p>首通小心心按基础值展示，领取时叠加有效奖励加成。完整探索还可领取一份当地积存酬谢，与挂机共用额度。</p></>,
  };
};

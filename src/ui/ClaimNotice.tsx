import { activityText as L } from '../core/kitchenRecipes';

export const ClaimNotice = ({ show }: { show: boolean }) => show
  ? <i className="claim-notice-dot" role="img" aria-label={L('有奖励待领取', 'Rewards to collect')} />
  : null;

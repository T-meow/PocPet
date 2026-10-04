import type { SystemNotificationController } from './app/useSystemNotifications';

export const NotificationSettings = ({ controller: c }: { controller: SystemNotificationController }) => <section className="settings-section notification-settings" aria-label="计时完成提醒">
  <h3>计时完成提醒</h3>
  <button type="button" className="settings-toggle-row" role="switch" aria-checked={c.preferences.enabled} disabled={c.busy || !c.preferences.enabled && c.capabilities?.notifications === false} onClick={() => void c.toggle()}><span>系统通知</span><strong>{c.preferences.enabled ? '已开启' : '未开启'}</strong></button>
  <p>前台显示游戏内提示，切换到后台后发送系统通知。</p>
  {(['tasks', 'harvest', 'pomodoro'] as const).map(category => <label key={category} className="settings-toggle-row"><span>{{ tasks: '伙伴安排、探险和钓鱼挂机', harvest: '农场、花园和牧场收获', pomodoro: '番茄钟阶段结束' }[category]}</span><input type="checkbox" checked={c.preferences.categories[category]} disabled={!c.preferences.enabled || c.busy} onChange={event => c.setCategory(category, event.target.checked)} /></label>)}
  {c.capabilities?.platform === 'android' ? <p>{c.capabilities.exactAlarms ? '已允许准时提醒。系统省电设置仍可能影响提醒。' : '系统可能延迟提醒。需要更准时的提醒时，可允许“闹钟和提醒”权限。'}{!c.capabilities.exactAlarms && <button type="button" className="text-button" onClick={() => void c.requestExact()}>设置准时提醒</button>}</p>
    : <p>网页或桌面程序需要保持运行。网页休眠可能延迟提醒，关闭后不继续发送。</p>}
  {c.capabilities?.notifications === false && <p>此环境不支持系统通知，可以继续使用游戏内提示。</p>}
  {c.capabilities?.permission === 'denied' && <p>系统通知权限已关闭，请在系统或浏览器设置中允许。</p>}
  <button type="button" className="secondary-button" disabled={c.busy || !c.preferences.enabled} onClick={() => void c.test()}>发送测试通知</button>
  {c.error && <p role="status">{c.error}</p>}
</section>;

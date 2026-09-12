import { useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { getSeasonInfo, weatherInfo, type PetState } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
import { appearanceThemes, defaultAppearance, validAccent, type Appearance } from './appearance';

export const AppearancePanel = ({ appearance, onChange, pet }: { appearance: Appearance; onChange: (value: Appearance) => void; pet: PetState }) => {
  const [draft, setDraft] = useState(appearance.color);
  useEffect(() => setDraft(appearance.color), [appearance.color]);
  const editColor = (value: string) => { setDraft(value); if (validAccent(value)) onChange({ theme: 'custom', color: value }); };
  const season = getSeasonInfo(pet.lastUpdatedAt);
  return <div className="appearance-panel">
    <section className="v2-card"><div className="v2-card-heading"><div><h3>{L('小窝底色与点缀', 'Your backdrop & little accents')}</h3><p>{L('一点喜欢的颜色，装点每天的陪伴。', 'A little favorite color for your everyday company.')}</p></div><button className="secondary-button" onClick={() => onChange(defaultAppearance)}><RefreshCw size={16} />{L('恢复默认', 'Reset')}</button></div>
      <div className="theme-grid">{appearanceThemes.map((theme) => <button key={theme.id} aria-pressed={appearance.theme === theme.id} onClick={() => onChange({ theme: theme.id, color: theme.color })}><span className="theme-sample" style={{ background: theme.color }}><i /><i /><i /></span><strong>{L(theme.zh, theme.en)}</strong>{appearance.theme === theme.id && <Check size={17} />}</button>)}</div>
      <h3>{L('自选点缀色', 'Choose an accent color')}</h3><div className="appearance-color"><input type="color" value={appearance.color} aria-label={L('点缀色', 'Accent color')} onChange={(event) => editColor(event.target.value)} /><label className="field"><span>{L('十六进制颜色', 'Hex color')}</span><input value={draft} maxLength={7} onChange={(event) => editColor(event.target.value)} aria-invalid={!validAccent(draft)} aria-describedby="appearance-error" /></label></div>{!validAccent(draft) && <p className="error-text" id="appearance-error">{L('请输入 # 加 6 位十六进制字符。', 'Use # followed by six hexadecimal characters.')}</p>}
    </section><section className="v2-card"><h3>{L('窗外的天气与季节', 'Weather outside')}</h3><div className="environment-summary"><strong>{weatherInfo[pet.weather].label} · {season.label}</strong><span>{L('随游戏日期自然变化', 'Changes naturally with the game date')}</span></div><p>{weatherInfo[pet.weather].summary}</p><p>{season.summary}</p></section>
  </div>;
};

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Cloud, Download, Play, ShieldCheck, Snowflake, Upload, X } from 'lucide-react';
import type { PetState } from '../core/petTypes';
import { createSaveFileText, type PocPetSaveModSummary } from '../core/saveCodec';
import { createSaveFileName } from '../platform/saveTextFile';
import { features } from '../platform/edition';
import { saveTimePauseBackup, verifyTimePauseBackup } from '../platform/timePauseBackup';
import type { TimePauseBackupWriter } from './app/timePauseTransaction';
import { DialogShell } from './DialogShell';
import '../styles/time-pause.css';

export const TimePauseDialog = ({ freezeTime, uploadCloud, identity, onClose }: {
  freezeTime: (writer: TimePauseBackupWriter) => Promise<boolean>;
  uploadCloud?: (pet: PetState) => Promise<unknown>;
  identity?: PocPetSaveModSummary | null;
  onClose: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState('');
  const [verifyFileName, setVerifyFileName] = useState('');
  const verification = useRef<{ text: string; finish: (verified: boolean) => void }>();
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { verification.current?.finish(false); verification.current = undefined; }, []);
  const cancel = () => {
    if (busyRef.current && !verification.current) return;
    verification.current?.finish(false);
    verification.current = undefined;
    onClose();
  };
  const start = async (method: 'cloud' | 'file') => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      const frozen = await freezeTime(async (candidate) => {
        if (method === 'cloud') {
          if (!uploadCloud) throw new Error('云存档暂不可用，请稍后重试。');
          await uploadCloud(candidate);
          return true;
        }
        const text = createSaveFileText(candidate, identity);
        const fileName = createSaveFileName(candidate.name).replace('-pocpet-save', `-freeze-${candidate.timePause!.pausedAt}-pocpet-save`);
        const result = await saveTimePauseBackup(fileName, text);
        if (result === 'verified') return true;
        if (result === 'cancelled') return false;
        setVerifyFileName(fileName);
        return new Promise<boolean>((finish) => { verification.current = { text, finish }; });
      });
      if (frozen) onClose();
      else setMessage('未冻结。保存取消后，时间会照常继续。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '备份失败，未冻结。请重试。');
    } finally {
      busyRef.current = false;
      setBusy(false);
      setVerifyFileName('');
      verification.current = undefined;
    }
  };
  const verifyFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const pending = verification.current;
    if (!file || !pending) return;
    try {
      if (file.size > new Blob([pending.text]).size + 3) throw new Error('文件与本次备份不一致，请重新选择。');
      verifyTimePauseBackup(await file.text(), pending.text);
      if (verification.current === pending) pending.finish(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : '无法读取备份文件，请重试。'); }
  };

  return <DialogShell className="time-pause-dialog" labelId="time-pause-title" descriptionId="time-pause-description" onClose={cancel} closeOnEscape={!busy || Boolean(verifyFileName)}>
    <header className="time-pause-heading"><Snowflake size={24} /><h2 id="time-pause-title">备份后冻结时间</h2><button type="button" className="icon-button" aria-label="取消冻结" disabled={busy && !verifyFileName} onClick={cancel}><X /></button></header>
    <p id="time-pause-description">暂时没空照顾时，让小窝在这里等你。宠物属性、相伴时长、生产、工作和其他计时都会暂停，冻结期间没有损耗或离线收益。</p>
    <div className="time-pause-backup-note"><ShieldCheck size={22} /><p>先保存并验证一份包含冻结状态的备份，再冻结本机存档。下次打开或恢复备份后，仍需手动解冻。</p></div>
    {verifyFileName ? <div className="time-pause-verification">
      <strong>下载完成后，选回这份文件验证</strong>
      <p>浏览器无法确认下载是否成功。校验通过后才会冻结；取消则照常继续。</p>
      <code>{verifyFileName}</code>
      <button className="primary-button" type="button" onClick={() => fileInput.current?.click()}><Upload size={18} />选择刚保存的文件并冻结</button>
      <input ref={fileInput} className="file-input" type="file" accept=".pocpet,.txt,application/json,text/plain" onChange={(event) => void verifyFile(event)} />
    </div> : <div className="time-pause-actions">
      {features.saveFileDownload && <button className="primary-button" type="button" disabled={busy} onClick={() => void start('file')}><Download size={18} />保存本地备份并冻结</button>}
      {uploadCloud && <button className="primary-button" type="button" disabled={busy} onClick={() => void start('cloud')}><Cloud size={18} />上传云存档并冻结</button>}
      {!features.saveFileDownload && !uploadCloud && <p role="status">云存档暂不可用，连接成功后才能备份并冻结。</p>}
    </div>}
    {uploadCloud && !busy && <p className="time-pause-caption">上传会更新当前云存档，云端保留上一份可用备份。</p>}
    {busy && !verifyFileName && <p role="status">正在保存并校验备份，请保持应用打开…</p>}
    {message && <p className="time-pause-message" role="status">{message}</p>}
    <button type="button" className="text-button" disabled={busy && !verifyFileName} onClick={cancel}>暂不冻结</button>
  </DialogShell>;
};

export const TimePauseMask = ({ pet, portrait, onResume, persistenceError, onRetry }: {
  pet: PetState; portrait: string; onResume: () => void; persistenceError: string; onRetry: () => void;
}) => <DialogShell className="time-pause-mask" backdropClassName="time-pause-backdrop" labelId="time-frozen-title" descriptionId="time-frozen-description" onClose={() => {}} closeOnEscape={false} fullscreen>
  <div className="time-pause-mask__content">
    <div className="time-pause-portrait"><img src={portrait} alt={pet.name} /><Snowflake aria-hidden="true" /></div>
    <p className="eyebrow">小窝正在等你</p>
    <h1 id="time-frozen-title">时间已冻结</h1>
    <p id="time-frozen-description">{pet.name}和整个小窝都停在离开时的状态。<br />只有手动解冻后，属性和所有计时才会继续。</p>
    <p className="time-pause-caption">冻结于 {new Date(pet.timePause!.pausedAt).toLocaleString('zh-CN')}</p>
    <button className="primary-button time-pause-resume" type="button" disabled={Boolean(persistenceError)} onClick={onResume}><Play size={20} />解冻，继续陪伴</button>
    {persistenceError && <div className="time-pause-message" role="alert"><p>{persistenceError === 'conflict' ? '存档已在其他窗口更改。请重新打开应用读取最新存档。' : persistenceError === 'saveError' || persistenceError === 'nativeSave' ? '存档写入未完成，时间仍保持冻结。请重试保存。' : '存档安全检查尚未通过，时间保持冻结。请重新读取存档。'}</p>
      {persistenceError === 'saveError' || persistenceError === 'nativeSave' ? <button className="secondary-button" type="button" onClick={onRetry}>重试保存</button> : <button className="secondary-button" type="button" onClick={() => window.location.reload()}>重新读取存档</button>}
    </div>}
    <small>不会补算冻结期间的消耗或收益</small>
  </div>
</DialogShell>;

import type { PetState } from '../../core/petTypes';

export type TimePauseBackupWriter = (candidate: PetState) => Promise<boolean>;

export const commitTimePauseAfterBackup = async (
  candidate: PetState,
  writeBackup: TimePauseBackupWriter,
  isCurrent: () => boolean,
  commit: (pet: PetState) => PetState | undefined,
) => {
  if (!candidate.timePause) throw new Error('冻结快照无效，请重试。');
  if (!await writeBackup(candidate)) return false;
  if (!isCurrent()) throw new Error('存档在备份期间发生变化，未冻结。请重新备份。');
  if (!commit(candidate)) throw new Error('备份已保存，但本机存档写入失败，未冻结。请先处理存档错误。');
  return true;
};

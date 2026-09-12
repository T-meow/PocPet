import { decodeSaveSnapshot, loadStoredPetJson, parseSaveFileText, type PocPetImportedSave, type PocPetSaveModSummary } from '../core/saveCodec';
import { getImportBackup, getStoredRecoveryCopies } from '../core/storage';
import { readBackupSnapshots, readExternalBackup } from './automaticBackup';

export interface SaveRecoveryCandidate {
  id: string;
  text: string;
  format: 'stored' | 'file';
  savedAt: number;
  petName: string;
  level: number;
  activeMod?: PocPetSaveModSummary;
}
export const readRecoveryCandidate = (candidate: SaveRecoveryCandidate, fallbackName?: string): PocPetImportedSave => {
  if (candidate.format === 'file') return parseSaveFileText(candidate.text, Date.now(), fallbackName);
  const loaded = loadStoredPetJson(candidate.text, Date.now(), undefined, fallbackName ?? candidate.activeMod?.defaultPetName);
  if (loaded.status !== 'ok') throw new Error(`Recovery failed: ${loaded.status === 'corrupt' ? loaded.stage : loaded.status}`);
  const decoded = decodeSaveSnapshot(candidate.text, fallbackName);
  return { ...decoded, pet: loaded.pet, activeMod: candidate.activeMod ?? decoded.activeMod };
};
export const collectRecoveryCandidates = async (fallbackName?: string) => {
  const candidates: SaveRecoveryCandidate[] = [];
  const add = (id: string, text: string, format: 'stored' | 'file', timestamp?: number, activeMod?: PocPetSaveModSummary) => {
    if (candidates.some((candidate) => candidate.text === text)) return;
    try {
      const imported = format === 'file' ? parseSaveFileText(text, Date.now(), fallbackName) : undefined;
      const loaded = format === 'stored' ? loadStoredPetJson(text, Date.now(), undefined, activeMod?.defaultPetName) : undefined;
      const pet = imported?.pet ?? (loaded?.status === 'ok' ? loaded.pet : undefined);
      if (!pet) return;
      const snapshot = imported ?? decodeSaveSnapshot(text);
      const savedAt = timestamp ?? (snapshot.exportedAt ? Date.parse(snapshot.exportedAt) : snapshot.pet.lastUpdatedAt);
      candidates.push({ id, text, format, savedAt, petName: pet.name, level: pet.level, activeMod });
    } catch { /* Other recovery points remain usable. */ }
  };
  for (const copy of getStoredRecoveryCopies()) add(copy.key, copy.raw, 'stored', undefined, copy.activeMod);
  try { const text = getImportBackup(); if (text) add('pre-import', text, 'file'); } catch { /* Continue with independent stores. */ }
  const results = await Promise.allSettled([readBackupSnapshots(), readExternalBackup()]);
  const [snapshots, external] = results;
  if (snapshots.status === 'fulfilled') for (const snapshot of snapshots.value.snapshots) add(`daily-${snapshot.dateKey}`, snapshot.text, 'file', snapshot.savedAt);
  if (external.status === 'fulfilled' && external.value) add('file', external.value, 'file');
  return { candidates: candidates.sort((a, b) => b.savedAt - a.savedAt), warnings: snapshots.status === 'fulfilled' ? snapshots.value.warnings : [], unavailable: results.some((result) => result.status === 'rejected') };
};

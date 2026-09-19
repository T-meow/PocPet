import { createSaveFileText, decodeSaveSnapshot, loadStoredPetJson, parseSaveFileText, UnsupportedSaveVersionError, type PocPetImportedSave, type PocPetSaveModSummary } from '../core/saveCodec';
import { getImportBackup, getStoredRecoveryCopies } from '../core/storage';
import { readBackupSnapshots, readExternalBackup } from './automaticBackup';
import { readNativeSaves } from './nativeSave';

export interface SaveRecoveryCandidate {
  id: string;
  text: string;
  format: 'stored' | 'file';
  savedAt: number;
  petName: string;
  level: number;
  activeMod?: PocPetSaveModSummary;
}
// Compare the persisted time, before offline simulation advances lastUpdatedAt.
// A different save ID belongs to another playthrough; importing an old save writes
// a new exportedAt, so an intentional restore is not treated as a rollback.
export const findNewerRecovery = (primary: string, candidates: SaveRecoveryCandidate[]) => {
  const current = decodeSaveSnapshot(primary);
  const savedAt = current.exportedAt ? Date.parse(current.exportedAt) : current.pet.lastUpdatedAt;
  return candidates.filter((candidate) => {
    try {
      const snapshot = decodeSaveSnapshot(candidate.text);
      const at = snapshot.exportedAt ? Date.parse(snapshot.exportedAt) : snapshot.pet.lastUpdatedAt;
      if (snapshot.pet.saveMetadata.id !== current.pet.saveMetadata.id || at <= savedAt || snapshot.pet.lastUpdatedAt < current.pet.lastUpdatedAt) return false;
      // A manual/daily export of unchanged progress has a later envelope time.
      // Normalize both at the same time so that alone never raises a rollback alert.
      return createSaveFileText(snapshot.pet, snapshot.activeMod, at) !== createSaveFileText(current.pet, current.activeMod, at);
    } catch { return false; }
  });
};
export const readRecoveryCandidate = (candidate: SaveRecoveryCandidate, fallbackName?: string): PocPetImportedSave => {
  if (candidate.format === 'file') return parseSaveFileText(candidate.text, Date.now(), fallbackName);
  const loaded = loadStoredPetJson(candidate.text, Date.now(), undefined, fallbackName ?? candidate.activeMod?.defaultPetName);
  if (loaded.status !== 'ok') throw new Error(`Recovery failed: ${loaded.status === 'corrupt' ? loaded.stage : loaded.status}`);
  const decoded = decodeSaveSnapshot(candidate.text, fallbackName);
  return { ...decoded, pet: loaded.pet, activeMod: candidate.activeMod ?? decoded.activeMod };
};
export const collectRecoveryCandidates = async (fallbackName?: string) => {
  const candidates: SaveRecoveryCandidate[] = [];
  const warnings: string[] = [];
  let unsupported = false;
  const add = (id: string, text: string, format: 'stored' | 'file', timestamp?: number, activeMod?: PocPetSaveModSummary) => {
    if (candidates.some((candidate) => candidate.text === text)) return;
    try {
      const imported = format === 'file' ? parseSaveFileText(text, Date.now(), fallbackName) : undefined;
      const loaded = format === 'stored' ? loadStoredPetJson(text, Date.now(), undefined, activeMod?.defaultPetName) : undefined;
      const pet = imported?.pet ?? (loaded?.status === 'ok' ? loaded.pet : undefined);
      if (!pet) {
        if (loaded?.status === 'corrupt' && loaded.stage === 'version') unsupported = true;
        warnings.push(`Invalid recovery point: ${id}`);
        return;
      }
      const snapshot = imported ?? decodeSaveSnapshot(text);
      const savedAt = timestamp ?? (snapshot.exportedAt ? Date.parse(snapshot.exportedAt) : snapshot.pet.lastUpdatedAt);
      candidates.push({ id, text, format, savedAt, petName: pet.name, level: pet.level, activeMod: activeMod ?? snapshot.activeMod });
    } catch (error) {
      if (error instanceof UnsupportedSaveVersionError) unsupported = true;
      warnings.push(`Invalid recovery point: ${id}`);
    }
  };
  for (const copy of getStoredRecoveryCopies()) add(copy.key, copy.raw, 'stored', undefined, copy.activeMod);
  try { const text = getImportBackup(); if (text) add('pre-import', text, 'file'); } catch { /* Continue with independent stores. */ }
  const results = await Promise.allSettled([readBackupSnapshots(), readExternalBackup(), readNativeSaves()]);
  const [snapshots, external, recent] = results;
  if (snapshots.status === 'fulfilled') for (const snapshot of snapshots.value.snapshots) add(`daily-${snapshot.dateKey}`, snapshot.text, 'file', snapshot.savedAt);
  if (external.status === 'fulfilled' && external.value) add('file', external.value, 'file');
  if (recent.status === 'fulfilled') recent.value.files.forEach((text, index) => add(`recent-${index}`, text, 'stored'));
  warnings.push(...(snapshots.status === 'fulfilled' ? snapshots.value.warnings : []), ...(recent.status === 'fulfilled' ? recent.value.warnings : []));
  // Daily stores reject unsupported formats before filtering/retention can discard them.
  unsupported ||= results.some((result) => result.status === 'rejected' && result.reason instanceof UnsupportedSaveVersionError);
  return { candidates: candidates.sort((a, b) => b.savedAt - a.savedAt), warnings, unsupported, unavailable: unsupported || results.some((result) => result.status === 'rejected') };
};

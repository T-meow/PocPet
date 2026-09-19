import { features, isNativeApp } from './edition';
import { saveTextFile } from './saveTextFile';

export const verifyTimePauseBackup = (actual: string, expected: string) => {
  if (actual.replace(/^\uFEFF/, '') !== expected) throw new Error('这个文件与本次冻结备份不一致。请选择刚刚保存的文件。');
};

interface FreezeFileHandle {
  createWritable(): Promise<{ write(text: string): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
  getFile(): Promise<File>;
}

// A browser download cannot prove that a file reached storage. Callers must
// request the downloaded file back before accepting a `verify-file` result.
export const saveTimePauseBackup = async (fileName: string, text: string): Promise<'verified' | 'cancelled' | 'verify-file'> => {
  if (!features.saveFileDownload) throw new Error('当前版本请使用云存档备份后冻结。');
  try {
    if (isNativeApp()) {
      const [{ save }, { writeTextFile, readTextFile }] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs')]);
      const destination = await save({ defaultPath: fileName, filters: [{ name: 'PocPet Save', extensions: ['pocpet'] }] });
      if (!destination) return 'cancelled';
      await writeTextFile(destination, text);
      verifyTimePauseBackup(await readTextFile(destination), text);
      return 'verified';
    }
    const pickerWindow = window as Window & { showSaveFilePicker?: (options: unknown) => Promise<FreezeFileHandle> };
    if (pickerWindow.showSaveFilePicker) {
      const handle = await pickerWindow.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'PocPet Save', accept: { 'text/plain': ['.pocpet'] } }] });
      const writable = await handle.createWritable();
      try { await writable.write(text); await writable.close(); }
      catch (error) { try { await writable.abort(); } catch { /* Keep the original write failure. */ } throw error; }
      verifyTimePauseBackup(await (await handle.getFile()).text(), text);
      return 'verified';
    }
    await saveTextFile(fileName, text);
    return 'verify-file';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
};

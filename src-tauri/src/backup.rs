use std::{fs, io::Write, path::{Path, PathBuf}};
use tauri::Manager;

fn directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_local_data_dir().map(|path| path.join("backups")).map_err(|e| e.to_string())
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temporary = path.with_extension("tmp");
    let mut file = fs::File::create(&temporary).map_err(|e| e.to_string())?;
    file.write_all(bytes).and_then(|_| file.sync_all()).map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(temporary, path).map_err(|e| e.to_string())
}

fn history_files(dir: &Path) -> Result<Vec<PathBuf>, String> {
    if !dir.exists() { return Ok(Vec::new()); }
    let mut files = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with("daily-") && name.ends_with(".json") && name.len() == 21
            && name.as_bytes()[6..16].iter().all(|b| b.is_ascii_digit() || *b == b'-') {
            files.push(entry.path());
        }
    }
    files.sort();
    Ok(files)
}

#[derive(serde::Serialize)]
pub struct BackupFiles {
    files: Vec<String>,
    warnings: Vec<String>,
}

fn read_backup_in(dir: &Path) -> Result<BackupFiles, String> {
    let mut result = BackupFiles { files: Vec::new(), warnings: Vec::new() };
    for path in history_files(dir)? {
        match fs::read_to_string(&path) {
            Ok(text) => result.files.push(text),
            Err(error) => result.warnings.push(format!("{}: {error}", path.display())),
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn read_backup_files(app: tauri::AppHandle) -> Result<BackupFiles, String> {
    read_backup_in(&directory(&app)?)
}

#[tauri::command]
pub fn read_backup_latest(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = directory(&app)?.join("pocpet-auto-backup.pocpet");
    if !path.exists() { return Ok(None); }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_backup_files(app: tauri::AppHandle, snapshot: String) -> Result<(), String> {
    write_backup_in(&directory(&app)?, &snapshot)
}

fn write_backup_in(dir: &Path, snapshot: &str) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(&snapshot).map_err(|e| e.to_string())?;
    let date = value["dateKey"].as_str().ok_or("Missing backup date")?;
    if date.len() != 10 || !date.bytes().all(|b| b.is_ascii_digit() || b == b'-') { return Err("Invalid backup date".into()); }
    let text = value["text"].as_str().ok_or("Missing backup text")?;
    if !text.starts_with("POCPET-SAVE-v2:") { return Err("Invalid backup text".into()); }
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    atomic_write(&dir.join(format!("daily-{date}.json")), snapshot.as_bytes())?;
    atomic_write(&dir.join("pocpet-auto-backup.pocpet"), text.as_bytes())?;
    let files = history_files(dir)?;
    for path in files.iter().take(files.len().saturating_sub(7)) {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retains_seven_dates_and_preserves_file_when_write_fails() {
        let unique = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("pocpet-backup-test-{unique}"));
        for day in 1..=9 {
            let snapshot = serde_json::json!({"dateKey": format!("2026-09-{day:02}"), "text": format!("POCPET-SAVE-v2:{day}")});
            write_backup_in(&dir, &snapshot.to_string()).unwrap();
        }
        assert_eq!(history_files(&dir).unwrap().len(), 7);
        let latest = dir.join("pocpet-auto-backup.pocpet");
        assert_eq!(fs::read_to_string(&latest).unwrap(), "POCPET-SAVE-v2:9");
        assert!(write_backup_in(&dir, r#"{"dateKey":"../invalid","text":"bad"}"#).is_err());
        fs::create_dir(latest.with_extension("tmp")).unwrap();
        assert!(atomic_write(&latest, b"replacement").is_err());
        assert_eq!(fs::read_to_string(&latest).unwrap(), "POCPET-SAVE-v2:9");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn unreadable_history_does_not_hide_other_files_or_block_next_backup() {
        let unique = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("pocpet-backup-read-test-{unique}"));
        let snapshot = serde_json::json!({"dateKey": "2026-09-01", "text": "POCPET-SAVE-v2:first"});
        write_backup_in(&dir, &snapshot.to_string()).unwrap();
        let bad_file = dir.join("daily-2026-09-02.json");
        fs::write(&bad_file, [0xff, 0xfe]).unwrap();
        let result = read_backup_in(&dir).unwrap();
        assert_eq!(result.files, vec![snapshot.to_string()]);
        assert_eq!(result.warnings.len(), 1);
        assert!(result.warnings[0].contains("daily-2026-09-02.json"));
        let next = serde_json::json!({"dateKey": "2026-09-03", "text": "POCPET-SAVE-v2:next"});
        write_backup_in(&dir, &next.to_string()).unwrap();
        assert_eq!(read_backup_in(&dir).unwrap().files.len(), 2);
        assert_eq!(fs::read_to_string(dir.join("pocpet-auto-backup.pocpet")).unwrap(), "POCPET-SAVE-v2:next");
        assert_eq!(fs::read(bad_file).unwrap(), [0xff, 0xfe]);
        fs::remove_dir_all(&dir).unwrap();
    }
}

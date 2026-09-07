mod backup;
mod updates;

#[tauri::command]
fn get_client_update_target() -> serde_json::Value {
  serde_json::json!({ "platform": std::env::consts::OS, "arch": std::env::consts::ARCH })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![backup::read_backup_files, backup::read_backup_latest, backup::write_backup_files, get_client_update_target, updates::read_client_update_json])
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

use serde_json::{json, Value};
use tauri::{plugin::TauriPlugin, AppHandle, Runtime};
#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
struct AndroidBackground<R: Runtime>(tauri::plugin::PluginHandle<R>);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("pocpet-background")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle = _api.register_android_plugin("com.frostforge.pocpet.background", "BackgroundPlugin")?;
                _app.manage(AndroidBackground(handle));
            }
            Ok(())
        })
        .build()
}

#[tauri::command]
pub async fn background_command(app: AppHandle, action: String, payload: Value) -> Result<Value, String> {
    #[cfg(target_os = "android")]
    {
        let handle = app.state::<AndroidBackground<tauri::Wry>>().0.clone();
        return tauri::async_runtime::spawn_blocking(move || {
            handle.run_mobile_plugin::<Value>("dispatch", json!({ "action": action, "payload": payload })).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "android"))]
    match action.as_str() {
        "capabilities" | "requestNotificationPermission" => Ok(json!({
            "platform": std::env::consts::OS, "nativeMusic": false,
            "notifications": cfg!(any(windows, target_os = "linux", target_os = "macos")),
            "permission": "granted", "exactAlarms": false
        })),
        "showNotification" => {
            let title = payload["title"].as_str().unwrap_or("PocPet").chars().take(120).collect::<String>();
            let body = payload["body"].as_str().unwrap_or("").chars().take(500).collect::<String>();
            #[cfg(windows)]
            super::windows_notifications::show(&app, title, body,
                payload["owner"].as_str().unwrap_or("").to_owned(), payload["target"].as_str().unwrap_or("").to_owned())?;
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            {
            #[cfg(target_os = "macos")]
            let _ = notify_rust::set_application(if tauri::is_dev() { "com.apple.Terminal" } else { &app.config().identifier });
            tauri::async_runtime::spawn_blocking(move || {
                notify_rust::Notification::new().summary(&title).body(&body).appname("PocPet").show().map(|_| ()).map_err(|e| e.to_string())
            }).await.map_err(|e| e.to_string())??;
            }
            Ok(json!({}))
        }
        _ => Err("This background capability is unavailable on this platform".into()),
    }
}

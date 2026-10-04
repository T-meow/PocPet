// Shell notifications work for the portable executable without installing an AUMID.
use std::{collections::VecDeque, ptr::null_mut, sync::{mpsc, OnceLock}};
use tauri::{AppHandle, Emitter, Manager};
use windows_sys::Win32::{Foundation::*, System::LibraryLoader::GetModuleHandleW, UI::{Shell::*, WindowsAndMessaging::*}};

struct Message { title: String, body: String, owner: String, target: String }
struct Context { app: AppHandle, message: Option<Message>, pending: VecDeque<Message>, showing: bool }
static WINDOW: OnceLock<Result<isize, String>> = OnceLock::new();
const SHOW: u32 = WM_APP + 31;
const CALLBACK: u32 = WM_APP + 32;
fn wide(value: &str) -> Vec<u16> { value.encode_utf16().chain(Some(0)).collect() }
fn copy_wide<const N: usize>(to: &mut [u16; N], from: &str) {
    for (index, unit) in from.encode_utf16().take(N - 1).enumerate() { to[index] = unit; }
}
unsafe fn icon(window: HWND) -> NOTIFYICONDATAW {
    let mut data: NOTIFYICONDATAW = std::mem::zeroed();
    data.cbSize = std::mem::size_of::<NOTIFYICONDATAW>() as u32;
    data.hWnd = window; data.uID = 1;
    data
}
unsafe fn show_next(window: HWND, context: &mut Context) -> bool {
    if context.showing { return true; }
    let Some(payload) = context.pending.pop_front() else { return true; };
    let mut data = icon(window);
    data.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    data.uCallbackMessage = CALLBACK;
    data.hIcon = LoadIconW(GetModuleHandleW(std::ptr::null()), 32512usize as *const u16);
    if data.hIcon.is_null() { data.hIcon = LoadIconW(null_mut(), IDI_APPLICATION); }
    copy_wide(&mut data.szTip, "PocPet");
    Shell_NotifyIconW(NIM_ADD, &data);
    data.uFlags = NIF_INFO;
    data.dwInfoFlags = NIIF_INFO | NIIF_RESPECT_QUIET_TIME;
    copy_wide(&mut data.szInfoTitle, &payload.title);
    copy_wide(&mut data.szInfo, &payload.body);
    context.message = Some(payload);
    context.showing = Shell_NotifyIconW(NIM_MODIFY, &data) != 0;
    context.showing
}
unsafe extern "system" fn procedure(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if message == WM_NCCREATE {
        let create = &*(lparam as *const CREATESTRUCTW);
        SetWindowLongPtrW(window, GWLP_USERDATA, create.lpCreateParams as isize);
    }
    let context = GetWindowLongPtrW(window, GWLP_USERDATA) as *mut Context;
    if message == SHOW && !context.is_null() {
        let payload = Box::from_raw(lparam as *mut Message);
        if (*context).pending.len() >= 64 { (*context).pending.pop_front(); }
        (*context).pending.push_back(*payload);
        // Keep the click target with the currently displayed balloon, even if
        // several timers expire together. The next balloon waits for dismissal.
        return show_next(window, &mut *context) as LRESULT;
    }
    if message == CALLBACK && !context.is_null() && (lparam as u32 == NIN_BALLOONUSERCLICK || lparam as u32 == WM_LBUTTONUP) {
        if let Some(window) = (*context).app.get_webview_window("main") {
            let _ = window.unminimize(); let _ = window.show(); let _ = window.set_focus();
        }
        if let Some(payload) = &(*context).message {
            let _ = (*context).app.emit("pocpet-notification", serde_json::json!({ "owner": payload.owner, "target": payload.target }));
        }
        if lparam as u32 == NIN_BALLOONUSERCLICK { (*context).showing = false; show_next(window, &mut *context); }
        return 0;
    }
    if message == CALLBACK && !context.is_null() && (lparam as u32 == NIN_BALLOONHIDE || lparam as u32 == NIN_BALLOONTIMEOUT) {
        (*context).showing = false; show_next(window, &mut *context);
        return 0;
    }
    if message == WM_CLOSE { DestroyWindow(window); return 0; }
    if message == WM_DESTROY {
        Shell_NotifyIconW(NIM_DELETE, &icon(window));
        if !context.is_null() { drop(Box::from_raw(context)); SetWindowLongPtrW(window, GWLP_USERDATA, 0); }
        PostQuitMessage(0); return 0;
    }
    DefWindowProcW(window, message, wparam, lparam)
}

pub fn show(app: &AppHandle, title: String, body: String, owner: String, target: String) -> Result<(), String> {
    let handle = WINDOW.get_or_init(|| {
        let (sender, receiver) = mpsc::sync_channel(1);
        let app = app.clone();
        std::thread::spawn(move || unsafe {
            let name = wide("PocPetPortableNotifications");
            let instance = GetModuleHandleW(std::ptr::null());
            let mut class: WNDCLASSW = std::mem::zeroed();
            class.lpfnWndProc = Some(procedure); class.hInstance = instance; class.lpszClassName = name.as_ptr();
            RegisterClassW(&class);
            let context = Box::into_raw(Box::new(Context { app, message: None, pending: VecDeque::new(), showing: false }));
            let window = CreateWindowExW(0, name.as_ptr(), name.as_ptr(), 0, 0, 0, 0, 0, HWND_MESSAGE, null_mut(), instance, context as _);
            if window.is_null() {
                drop(Box::from_raw(context)); let _ = sender.send(Err("无法创建 Windows 通知窗口".to_owned())); return;
            }
            let _ = sender.send(Ok(window as isize));
            let mut message: MSG = std::mem::zeroed();
            while GetMessageW(&mut message, null_mut(), 0, 0) > 0 { TranslateMessage(&message); DispatchMessageW(&message); }
        });
        receiver.recv().unwrap_or_else(|_| Err("Windows 通知服务未启动".into()))
    });
    let window = *handle.as_ref().map_err(Clone::clone)? as HWND;
    let payload = Box::into_raw(Box::new(Message { title, body, owner, target }));
    if unsafe { SendMessageW(window, SHOW, 0, payload as isize) } == 0 { return Err("Windows 未能显示通知，请检查系统通知设置".into()); }
    Ok(())
}
pub fn shutdown() {
    if let Some(Ok(window)) = WINDOW.get() { unsafe { PostMessageW(*window as HWND, WM_CLOSE, 0, 0); } }
}

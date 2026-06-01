// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    AppHandle, CustomMenuItem, Manager, PhysicalPosition, PhysicalSize,
    SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
};
use std::sync::Mutex;

mod sidecar;
mod notifications;
mod logger;

struct AppState {
    log_buffer: Mutex<logger::RingBuffer>,
}

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Show/Hide ExoCore"))
        .add_item(CustomMenuItem::new("council", "Open Council Workspace"))
        .add_item(CustomMenuItem::new("chronicle", "Toggle Chronicle Panel"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("restart", "Restart Backends"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("exit", "Exit ExoCore"));

    let tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(tray)
        .manage(AppState {
            log_buffer: Mutex::new(logger::RingBuffer::new(5000)),
        })
        .setup(|app| {
            // Spawn sidecars silently
            let app_handle = app.handle();
            sidecar::spawn_django(&app_handle);
            sidecar::spawn_wez_bridge(&app_handle);

            // Start log streaming
            logger::start_log_stream(&app_handle);

            Ok(())
        })
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("chat-core").unwrap();
                if window.is_visible().unwrap_or(false) {
                    window.hide().unwrap();
                } else {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => {
                handle_tray_event(app, &id);
            }
            _ => {}
        })
        .on_window_event(|event| {
            // Close -> hide instead of exit
            if event.event() == tauri::WindowEvent::CloseRequested {
                if event.window().label() == "chat-core" {
                    event.window().hide().unwrap();
                    let _ = event.window().emit("window-hidden", ());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            notifications::send_notification,
            logger::get_recent_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ExoCore");
}

fn handle_tray_event(app: &AppHandle, id: &str) {
    match id {
        "show" => {
            let window = app.get_window("chat-core").unwrap();
            if window.is_visible().unwrap_or(false) {
                window.hide().unwrap();
            } else {
                window.show().unwrap();
                window.set_focus().unwrap();
            }
        }
        "council" => {
            use tauri::WindowBuilder;
            if let Some(window) = app.get_window("council") {
                window.show().unwrap();
                window.set_focus().unwrap();
            } else {
                let _ = WindowBuilder::new(
                    app,
                    "council",
                    tauri::WindowUrl::External("http://localhost:5175".parse().unwrap()),
                )
                .title("ExoCore // Council")
                .inner_size(1000.0, 700.0)
                .resizable(true)
                .build();
            }
        }
        "chronicle" => {
            use tauri::WindowBuilder;
            if let Some(window) = app.get_window("chronicle") {
                if window.is_visible().unwrap_or(false) {
                    window.hide().unwrap();
                } else {
                    window.show().unwrap();
                }
            } else {
                let _ = WindowBuilder::new(
                    app,
                    "chronicle",
                    tauri::WindowUrl::External("http://localhost:5174".parse().unwrap()),
                )
                .title("ExoCore // Chronicle")
                .inner_size(380.0, 600.0)
                .resizable(true)
                .skip_taskbar(true)
                .decorations(true)
                .build();
            }
        }
        "restart" => {
            sidecar::restart_all(app);
        }
        "exit" => {
            sidecar::graceful_shutdown(app);
            std::process::exit(0);
        }
        _ => {}
    }
}

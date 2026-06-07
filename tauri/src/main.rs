// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
use std::sync::Mutex;

mod sidecar;
mod notifications;
mod logger;

struct AppState {
    log_buffer: Mutex<logger::RingBuffer>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            log_buffer: Mutex::new(logger::RingBuffer::new(5000)),
        })
        .setup(|app| {
            // Build tray menu items
            let show_item = MenuItemBuilder::with_id("show", "Show/Hide ExoCore").build(app)?;
            let council_item = MenuItemBuilder::with_id("council", "Open Council Workspace").build(app)?;
            let chronicle_item = MenuItemBuilder::with_id("chronicle", "Toggle Chronicle Panel").build(app)?;
            let restart_item = MenuItemBuilder::with_id("restart", "Restart Backends").build(app)?;
            let exit_item = MenuItemBuilder::with_id("exit", "Exit ExoCore").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&council_item)
                .item(&chronicle_item)
                .separator()
                .item(&restart_item)
                .separator()
                .item(&exit_item)
                .build()?;

            // Build tray icon
            let handle = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    handle_menu_event(app, event.id().as_ref());
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("chat-core") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Spawn sidecars silently
            let app_handle = app.handle().clone();
            sidecar::spawn_django(&app_handle);
            sidecar::spawn_wez_bridge(&app_handle);
            logger::start_log_stream(&app_handle);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "chat-core" {
                    let _ = window.hide();
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

fn handle_menu_event(app: &AppHandle, id: &str) {
    match id {
        "show" => {
            if let Some(window) = app.get_webview_window("chat-core") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        "council" => {
            if let Some(window) = app.get_webview_window("council") {
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                let _ = tauri::WebviewWindowBuilder::new(
                    app,
                    "council",
                    tauri::WebviewUrl::External("http://localhost:5175".parse().unwrap()),
                )
                .title("Council")
                .inner_size(1000.0, 700.0)
                .resizable(true)
                .build();
            }
        }
        "chronicle" => {
            if let Some(window) = app.get_webview_window("chronicle") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                }
            } else {
                let _ = tauri::WebviewWindowBuilder::new(
                    app,
                    "chronicle",
                    tauri::WebviewUrl::External("http://localhost:5174".parse().unwrap()),
                )
                .title("Chronicle")
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

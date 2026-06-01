use tauri::AppHandle;

/// Send an OS-native notification. Called from web views via Tauri invoke.
#[tauri::command]
pub fn send_notification(
    app: AppHandle,
    title: String,
    body: String,
    module: Option<String>,
) -> Result<(), String> {
    let module_tag = module.unwrap_or_else(|| "exocore".to_string());

    // Use tauri's built-in notification (wraps notify-rust on desktop)
    app.notification()
        .builder()
        .title(&title)
        .body(&format!("[{}] {}", module_tag, body))
        .show()
        .map_err(|e| format!("Notification failed: {}", e))?;

    Ok(())
}

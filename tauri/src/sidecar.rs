use tauri::AppHandle;
use std::process::{Child, Command};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::sync::Mutex;

// Store child process handles for graceful shutdown
static DJANGO_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static WEZ_BRIDGE_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Spawn a process with no visible window on Windows.
fn spawn_silent(command: &str, args: &[&str]) -> std::io::Result<Child> {
    let mut cmd = Command::new(command);
    cmd.args(args);

    #[cfg(target_os = "windows")]
    {
        // CREATE_NO_WINDOW = 0x08000000 — prevents cmd window flash
        cmd.creation_flags(0x08000000);
    }

    // Redirect stdout/stderr to pipe for log capture
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    cmd.spawn()
}

pub fn spawn_django(app: &AppHandle) {
    // Django is started externally or by a launch script.
    // In the sidecar model, Django would be bundled as a PyInstaller binary.
    // For now, assume Django is running on port 8000 and we just health-check.
    let app_handle = app.clone();
    std::thread::spawn(move || {
        // Health check loop
        let max_attempts = 30; // 15 seconds at 500ms intervals
        for _ in 0..max_attempts {
            if let Ok(resp) = reqwest::blocking::get("http://127.0.0.1:8000/api/health/") {
                if resp.status().is_success() {
                    let _ = app_handle.emit("backend-ready", "Django is ready");
                    return;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
        let _ = app_handle.emit("backend-error", "Django health check timed out");
    });
}

pub fn spawn_wez_bridge(app: &AppHandle) {
    let app_handle = app.clone();
    std::thread::spawn(move || {
        match spawn_silent("python", &["wez_bridge.py"]) {
            Ok(_child) => {
                let _ = app_handle.emit("sidecar-ready", "wez_bridge started");
            }
            Err(e) => {
                let _ = app_handle.emit("sidecar-error", format!("wez_bridge failed: {}", e));
            }
        }
    });
}

pub fn restart_all(app: &AppHandle) {
    // Kill existing processes
    if let Some(ref mut child) = *DJANGO_PROCESS.lock().unwrap() {
        let _ = child.kill();
    }
    if let Some(ref mut child) = *WEZ_BRIDGE_PROCESS.lock().unwrap() {
        let _ = child.kill();
    }
    // Respawn
    spawn_django(app);
    spawn_wez_bridge(app);
}

pub fn graceful_shutdown(app: &AppHandle) {
    let _ = app.emit("shutting-down", "ExoCore is shutting down...");

    // SIGTERM to all managed processes
    if let Some(ref mut child) = *DJANGO_PROCESS.lock().unwrap() {
        let _ = child.kill();
    }
    if let Some(ref mut child) = *WEZ_BRIDGE_PROCESS.lock().unwrap() {
        let _ = child.kill();
    }
}

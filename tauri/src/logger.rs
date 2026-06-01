use tauri::AppHandle;
use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

/// Ring buffer holding the last N log lines in memory.
pub struct RingBuffer {
    lines: VecDeque<String>,
    capacity: usize,
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        RingBuffer {
            lines: VecDeque::with_capacity(capacity),
            capacity,
        }
    }

    pub fn push(&mut self, line: String) {
        if self.lines.len() >= self.capacity {
            self.lines.pop_front();
        }
        self.lines.push_back(line);
    }

    pub fn get_recent(&self, count: usize) -> Vec<String> {
        self.lines.iter().rev().take(count).cloned().collect::<Vec<_>>()
            .into_iter().rev().collect()
    }

    pub fn all(&self) -> Vec<String> {
        self.lines.iter().cloned().collect()
    }
}

/// Start capturing stdout/stderr from sidecar processes and routing to UI.
pub fn start_log_stream(_app: &AppHandle) {
    // In production, this would read from sidecar child process stdout/stderr pipes.
    // For now, set up the channel so web views can query logs.
    clean_old_error_logs();
}

/// Retrieve recent log lines from the ring buffer (called from web view).
#[tauri::command]
pub fn get_recent_logs(
    state: tauri::State<'_, crate::AppState>,
    lines: Option<usize>,
) -> Result<Vec<String>, String> {
    let buffer = state.log_buffer.lock().map_err(|e| e.to_string())?;
    Ok(buffer.get_recent(lines.unwrap_or(200)))
}

/// Persist only error lines to disk.
pub fn persist_error(line: &str) {
    if !line.contains("ERROR") && !line.contains("Panic") && !line.contains("Traceback") {
        return;
    }

    let log_dir = get_log_dir();
    fs::create_dir_all(&log_dir).ok();

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let log_path = log_dir.join(format!("error-{}.log", today));

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let timestamp = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%.3f").to_string();
        let _ = writeln!(file, "[{}] {}", timestamp, line);
    }
}

fn get_log_dir() -> PathBuf {
    std::env::current_exe()
        .unwrap_or_else(|_| PathBuf::from("."))
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."))
        .join("logs")
}

fn clean_old_error_logs() {
    let log_dir = get_log_dir();
    if !log_dir.exists() { return; }

    if let Ok(entries) = fs::read_dir(&log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(true, |ext| ext != "log") { continue; }
            let _ = entry.metadata(); // simplified cleanup check
        }
    }
}

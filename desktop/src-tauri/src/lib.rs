pub mod commands;
pub mod db;
pub mod models;
pub mod queue;
pub mod scraper;

use queue::QueueManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = std::fs::write("tauri_status.log", "Initializing QueueManager...\n");
    let queue_manager = QueueManager::new();

    let _ = std::fs::write("tauri_status.log", "Building Tauri context...\n");
    let res = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(queue_manager)
        .setup(|app| {
            let _ = std::fs::write("tauri_status.log", "Inside Tauri setup hook...\n");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let hwnd = window.hwnd().map(|h| format!("{:?}", h)).unwrap_or_else(|e| format!("err: {:?}", e));
                let _ = std::fs::write("tauri_status.log", format!("Main window ready! HWND={}\n", hwnd));
            } else {
                let _ = std::fs::write("tauri_status.log", "Warning: main window not found in setup!\n");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::add_to_queue,
            commands::get_queue,
            commands::toggle_pause_task,
            commands::remove_task,
            commands::get_hardware_id,
            commands::fetch_url_html
        ])
        .run(tauri::generate_context!());

    if let Err(e) = res {
        let _ = std::fs::write("tauri_error.log", format!("Fatal error while running Tauri: {:?}", e));
    }
}

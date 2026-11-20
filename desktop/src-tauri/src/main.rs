#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("PANIC: {}\n", info);
        let _ = std::fs::write("D:\\Project\\Novel Scraper\\tauri_panic.log", &msg);
        let _ = std::fs::write(std::env::temp_dir().join("novel_scraper_panic.log"), &msg);
    }));
    novel_scraper_desktop_lib::run();
}

use crate::models::DownloadTask;
use crate::queue::QueueManager;
use tauri::State;

#[tauri::command]
pub async fn add_to_queue(url: String, queue: State<'_, QueueManager>) -> Result<DownloadTask, String> {
    let url_clone = url.clone();
    let domain = url_clone
        .split("//")
        .nth(1)
        .and_then(|s| s.split('/').next())
        .unwrap_or("unknown-domain")
        .to_string();

    let task = DownloadTask {
        id: format!("task-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()),
        novel_id: None,
        url: url.clone(),
        title: format!("Đang phân tích: {}", url),
        cover_url: None,
        source_domain: domain,
        downloaded_chapters: 0,
        total_chapters: 0,
        speed: "0 ch/giây".to_string(),
        progress_percent: 0,
        status: "queued".to_string(),
        error_message: None,
        created_at: chrono_millis(),
    };

    queue.add_task(task.clone()).await;
    Ok(task)
}

#[tauri::command]
pub async fn get_queue(queue: State<'_, QueueManager>) -> Result<Vec<DownloadTask>, String> {
    Ok(queue.get_tasks().await)
}

#[tauri::command]
pub async fn toggle_pause_task(task_id: String, queue: State<'_, QueueManager>) -> Result<bool, String> {
    let tasks = queue.get_tasks().await;
    if let Some(task) = tasks.iter().find(|t| t.id == task_id) {
        let new_status = if task.status == "downloading" { "paused" } else { "downloading" };
        Ok(queue.set_task_status(&task_id, new_status).await)
    } else {
        Err("Task not found".to_string())
    }
}

#[tauri::command]
pub async fn remove_task(task_id: String, queue: State<'_, QueueManager>) -> Result<bool, String> {
    Ok(queue.remove_task(&task_id).await)
}

#[tauri::command]
pub fn get_hardware_id() -> String {
    // Phase 4: Hardware ID generation
    "HWID-NS-7F89-B42A-9901-WINDOWS-X64".to_string()
}

#[tauri::command]
pub async fn fetch_url_html(url: String) -> Result<String, String> {
    let scraper = crate::scraper::WebScraper::new(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );
    scraper.fetch_html(&url).await.map_err(|e| e.to_string())
}

fn chrono_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

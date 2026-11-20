use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Novel {
    pub id: String,
    pub title: String,
    pub author: String,
    pub source_url: String,
    pub source_domain: String,
    pub cover_url: Option<String>,
    pub description: Option<String>,
    pub total_chapters: i32,
    pub downloaded_chapters: i32,
    pub status: String, // "reading", "favorite", "completed", "needs_update"
    pub reading_progress: i32,
    pub last_read_chapter_title: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub id: String,
    pub novel_id: String,
    pub chapter_index: i32,
    pub title: String,
    pub url: String,
    pub content: Option<String>,
    pub word_count: Option<i32>,
    pub status: String, // "pending", "downloaded", "failed"
    pub downloaded_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub id: String,
    pub novel_id: Option<String>,
    pub url: String,
    pub title: String,
    pub cover_url: Option<String>,
    pub source_domain: String,
    pub downloaded_chapters: i32,
    pub total_chapters: i32,
    pub speed: String,
    pub progress_percent: i32,
    pub status: String, // "downloading", "paused", "queued", "error", "completed"
    pub error_message: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScraperRule {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub version: String,
    pub title_selector: String,
    pub author_selector: Option<String>,
    pub description_selector: Option<String>,
    pub cover_selector: Option<String>,
    pub chapter_list_selector: String,
    pub chapter_item_selector: String,
    pub chapter_content_selector: String,
    pub exclude_selectors: Vec<String>,
    pub is_custom: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub storage_path: String,
    pub concurrency: i32,
    pub request_delay_ms: i32,
    pub jitter_delay_ms: i32,
    pub user_agent: String,
    pub proxy_url: Option<String>,
    pub accent_color: String,
    pub theme: String,
    pub cloud_sync_enabled: bool,
    pub license_key: Option<String>,
    pub is_premium: bool,
}

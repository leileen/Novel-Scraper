use crate::models::DownloadTask;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct QueueManager {
    tasks: Arc<RwLock<HashMap<String, DownloadTask>>>,
}

impl QueueManager {
    pub fn new() -> Self {
        QueueManager {
            tasks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_task(&self, task: DownloadTask) {
        let mut tasks = self.tasks.write().await;
        tasks.insert(task.id.clone(), task);
    }

    pub async fn get_tasks(&self) -> Vec<DownloadTask> {
        let tasks = self.tasks.read().await;
        let mut list: Vec<DownloadTask> = tasks.values().cloned().collect();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }

    pub async fn set_task_status(&self, id: &str, status: &str) -> bool {
        let mut tasks = self.tasks.write().await;
        if let Some(task) = tasks.get_mut(id) {
            task.status = status.to_string();
            if status == "paused" {
                task.speed = "0 ch/giây".to_string();
            }
            true
        } else {
            false
        }
    }

    pub async fn remove_task(&self, id: &str) -> bool {
        let mut tasks = self.tasks.write().await;
        tasks.remove(id).is_some()
    }
}

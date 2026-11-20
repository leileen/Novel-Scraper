use rusqlite::{Connection, Result};
use std::path::Path;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    pub fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS novels (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                source_url TEXT NOT NULL,
                source_domain TEXT NOT NULL,
                cover_url TEXT,
                description TEXT,
                total_chapters INTEGER DEFAULT 0,
                downloaded_chapters INTEGER DEFAULT 0,
                status TEXT DEFAULT 'reading',
                reading_progress INTEGER DEFAULT 0,
                last_read_chapter_title TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chapters (
                id TEXT PRIMARY KEY,
                novel_id TEXT NOT NULL,
                chapter_index INTEGER NOT NULL,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                content TEXT,
                word_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                downloaded_at INTEGER,
                FOREIGN KEY (novel_id) REFERENCES novels (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_chapters_novel_index ON chapters (novel_id, chapter_index);

            CREATE TABLE IF NOT EXISTS downloads_queue (
                id TEXT PRIMARY KEY,
                novel_id TEXT,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                cover_url TEXT,
                source_domain TEXT NOT NULL,
                downloaded_chapters INTEGER DEFAULT 0,
                total_chapters INTEGER DEFAULT 0,
                speed TEXT DEFAULT '0 ch/giây',
                progress_percent INTEGER DEFAULT 0,
                status TEXT DEFAULT 'queued',
                error_message TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rules (
                id TEXT PRIMARY KEY,
                domain TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                data_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL
            );
            "#,
        )?;

        Ok(())
    }
}

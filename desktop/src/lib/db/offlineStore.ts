/**
 * High-Performance Offline Storage backed by IndexedDB.
 * Stores 100% of chapter contents and comic images locally on disk with no 5MB limit.
 */

import type { Chapter } from '../types';

const DB_NAME = 'novel_scraper_offline_db';
const DB_VERSION = 1;
const CHAPTERS_STORE = 'chapters';
const COMIC_STORE = 'comic_pages';

export interface StoredChapterRecord {
  key: string; // `${novelId}_${index}`
  novelId: string;
  index: number;
  chapterNumber?: number;
  title: string;
  url?: string;
  content: string;
  wordCount?: number;
  downloadedAt: number;
}

export interface StoredComicPageRecord {
  key: string; // `${novelId}_${pageIndex}`
  novelId: string;
  pageIndex: number;
  title?: string;
  dataUrl: string;
  width?: number;
  height?: number;
}

class OfflineStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.reject(new Error('IndexedDB is not supported in this environment.'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Chapters Store
        if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
          const chapStore = db.createObjectStore(CHAPTERS_STORE, { keyPath: 'key' });
          chapStore.createIndex('novelId', 'novelId', { unique: false });
          chapStore.createIndex('novelId_index', ['novelId', 'index'], { unique: true });
        }

        // Comic Pages Store
        if (!db.objectStoreNames.contains(COMIC_STORE)) {
          const comicStore = db.createObjectStore(COMIC_STORE, { keyPath: 'key' });
          comicStore.createIndex('novelId', 'novelId', { unique: false });
          comicStore.createIndex('novelId_pageIndex', ['novelId', 'pageIndex'], { unique: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Save a single chapter content
   */
  async saveChapter(record: {
    novelId: string;
    index: number;
    title: string;
    content: string;
    chapterNumber?: number;
    url?: string;
    wordCount?: number;
    downloadedAt?: number;
  }): Promise<void> {
    const db = await this.getDB();
    const key = `${record.novelId}_${record.index}`;
    const entry: StoredChapterRecord = {
      key,
      novelId: record.novelId,
      index: record.index,
      chapterNumber: record.chapterNumber,
      title: record.title,
      url: record.url,
      content: record.content,
      wordCount: record.wordCount || record.content.split(/\s+/).filter(Boolean).length,
      downloadedAt: record.downloadedAt || Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHAPTERS_STORE, 'readwrite');
      const store = tx.objectStore(CHAPTERS_STORE);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Batch save multiple chapters in a single transaction for maximum speed
   */
  async saveChaptersBatch(
    records: Array<{
      novelId: string;
      index: number;
      title: string;
      content: string;
      chapterNumber?: number;
      url?: string;
      wordCount?: number;
      downloadedAt?: number;
    }>
  ): Promise<void> {
    if (records.length === 0) return;
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHAPTERS_STORE, 'readwrite');
      const store = tx.objectStore(CHAPTERS_STORE);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);

      for (const r of records) {
        const key = `${r.novelId}_${r.index}`;
        const entry: StoredChapterRecord = {
          key,
          novelId: r.novelId,
          index: r.index,
          chapterNumber: r.chapterNumber,
          title: r.title,
          url: r.url,
          content: r.content,
          wordCount: r.wordCount || r.content.split(/\s+/).filter(Boolean).length,
          downloadedAt: r.downloadedAt || Date.now()
        };
        store.put(entry);
      }
    });
  }

  /**
   * Retrieve chapter content directly by novelId and index
   */
  async getChapterContent(novelId: string, index: number): Promise<string | null> {
    const db = await this.getDB();
    const key = `${novelId}_${index}`;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHAPTERS_STORE, 'readonly');
      const store = tx.objectStore(CHAPTERS_STORE);
      const req = store.get(key);

      req.onsuccess = () => {
        const result = req.result as StoredChapterRecord | undefined;
        resolve(result && result.content ? result.content : null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieve full chapter record by novelId and index
   */
  async getChapter(novelId: string, index: number): Promise<StoredChapterRecord | null> {
    const db = await this.getDB();
    const key = `${novelId}_${index}`;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHAPTERS_STORE, 'readonly');
      const store = tx.objectStore(CHAPTERS_STORE);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve((req.result as StoredChapterRecord) || null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Check if a chapter's content is already downloaded offline
   */
  async hasChapterContent(novelId: string, index: number): Promise<boolean> {
    const content = await this.getChapterContent(novelId, index);
    return Boolean(content && content.trim().length > 30);
  }

  /**
   * Get all downloaded chapter indices for a given novel
   */
  async getDownloadedChapterIndices(novelId: string): Promise<Set<number>> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHAPTERS_STORE, 'readonly');
      const store = tx.objectStore(CHAPTERS_STORE);
      const index = store.index('novelId');
      const req = index.getAll(IDBKeyRange.only(novelId));

      req.onsuccess = () => {
        const set = new Set<number>();
        const list = (req.result as StoredChapterRecord[]) || [];
        for (const item of list) {
          if (item.content && item.content.trim().length > 20) {
            set.add(item.index);
          }
        }
        resolve(set);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Delete all chapters for a given novel (used when removing novel from library)
   */
  async deleteNovelChapters(novelId: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CHAPTERS_STORE, 'readwrite');
      const store = tx.objectStore(CHAPTERS_STORE);
      const index = store.index('novelId');
      const req = index.openKeyCursor(IDBKeyRange.only(novelId));

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ==================== COMIC / MANGA STORE ====================

  /**
   * Save a single comic page
   */
  async saveComicPage(record: {
    novelId: string;
    pageIndex: number;
    title?: string;
    dataUrl: string;
    width?: number;
    height?: number;
  }): Promise<void> {
    const db = await this.getDB();
    const key = `${record.novelId}_${record.pageIndex}`;
    const entry: StoredComicPageRecord = {
      key,
      novelId: record.novelId,
      pageIndex: record.pageIndex,
      title: record.title,
      dataUrl: record.dataUrl,
      width: record.width,
      height: record.height
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMIC_STORE, 'readwrite');
      const store = tx.objectStore(COMIC_STORE);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Batch save comic pages
   */
  async saveComicPagesBatch(
    pages: Array<{
      novelId: string;
      pageIndex: number;
      title?: string;
      dataUrl: string;
      width?: number;
      height?: number;
    }>
  ): Promise<void> {
    if (pages.length === 0) return;
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMIC_STORE, 'readwrite');
      const store = tx.objectStore(COMIC_STORE);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);

      for (const p of pages) {
        const key = `${p.novelId}_${p.pageIndex}`;
        const entry: StoredComicPageRecord = {
          key,
          novelId: p.novelId,
          pageIndex: p.pageIndex,
          title: p.title,
          dataUrl: p.dataUrl,
          width: p.width,
          height: p.height
        };
        store.put(entry);
      }
    });
  }

  /**
   * Get a comic page by pageIndex
   */
  async getComicPage(
    novelId: string,
    pageIndex: number
  ): Promise<StoredComicPageRecord | null> {
    const db = await this.getDB();
    const key = `${novelId}_${pageIndex}`;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMIC_STORE, 'readonly');
      const store = tx.objectStore(COMIC_STORE);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve((req.result as StoredComicPageRecord) || null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get all comic pages for a novel, sorted by pageIndex
   */
  async getComicPages(novelId: string): Promise<StoredComicPageRecord[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMIC_STORE, 'readonly');
      const store = tx.objectStore(COMIC_STORE);
      const index = store.index('novelId');
      const req = index.getAll(IDBKeyRange.only(novelId));

      req.onsuccess = () => {
        const list = (req.result as StoredComicPageRecord[]) || [];
        list.sort((a, b) => a.pageIndex - b.pageIndex);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Delete all comic pages for a novel
   */
  async deleteComicPages(novelId: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMIC_STORE, 'readwrite');
      const store = tx.objectStore(COMIC_STORE);
      const index = store.index('novelId');
      const req = index.openKeyCursor(IDBKeyRange.only(novelId));

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get overall offline storage metrics
   */
  async getStorageStats(): Promise<{ totalChapters: number; totalComicPages: number }> {
    try {
      const db = await this.getDB();

      const getCount = (storeName: string): Promise<number> =>
        new Promise((resolve) => {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const req = store.count();
          req.onsuccess = () => resolve(req.result || 0);
          req.onerror = () => resolve(0);
        });

      const totalChapters = await getCount(CHAPTERS_STORE);
      const totalComicPages = await getCount(COMIC_STORE);
      return { totalChapters, totalComicPages };
    } catch {
      return { totalChapters: 0, totalComicPages: 0 };
    }
  }
}

export const offlineStore = new OfflineStore();

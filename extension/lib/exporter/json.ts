import type { Novel, Chapter } from '../types';
import { naturalSortChapters, deduplicateChapters } from './sorter';
import { triggerBlobDownload, sanitizeFilename } from './txt';

/**
 * Structured Export Format Schema for Novel and Chapters.
 */
export interface NovelJsonExport {
  schemaVersion: '1.0.0';
  generator: 'Novel Scraper Extension';
  exportedAt: string;
  novel: {
    id?: number;
    title: string;
    author?: string;
    sourceUrl: string;
    coverUrl?: string;
    description?: string;
    status: string;
    totalChapters: number;
    downloadedChapters: number;
    createdAt?: number;
    updatedAt?: number;
  };
  chapters: Array<{
    chapterNumber: number;
    title: string;
    url: string;
    content: string;
    wordCount: number;
    status: 'pending' | 'crawling' | 'completed' | 'failed' | 'locked';
    fetchedAt?: number;
  }>;
}

/**
 * Generates the structured novel JSON export object with sorted and deduplicated chapters.
 */
export function generateJsonData(novel: Novel, chapters: Chapter[]): NovelJsonExport {
  const sorted = deduplicateChapters(naturalSortChapters(chapters));

  return {
    schemaVersion: '1.0.0',
    generator: 'Novel Scraper Extension',
    exportedAt: new Date().toISOString(),
    novel: {
      id: novel.id,
      title: novel.title,
      author: novel.author?.trim() || undefined,
      sourceUrl: novel.sourceUrl,
      coverUrl: novel.coverUrl?.trim() || undefined,
      description: novel.description?.trim() || undefined,
      status: novel.status,
      totalChapters: sorted.length,
      downloadedChapters: sorted.filter((c) => c.status === 'completed').length,
      createdAt: novel.createdAt,
      updatedAt: novel.updatedAt
    },
    chapters: sorted.map((chap, idx) => ({
      chapterNumber: chap.chapterNumber || idx + 1,
      title: chap.title,
      url: chap.url,
      content: chap.content || '',
      wordCount: chap.wordCount || (chap.content ? chap.content.trim().split(/\s+/).length : 0),
      status: chap.status,
      fetchedAt: chap.fetchedAt
    }))
  };
}

/**
 * Builds a JSON Blob formatted with 2-space indentation.
 */
export function buildJsonBlob(novel: Novel, chapters: Chapter[]): Blob {
  const data = generateJsonData(novel, chapters);
  const jsonString = JSON.stringify(data, null, 2);
  return new Blob([jsonString], { type: 'application/json;charset=utf-8' });
}

/**
 * Exports novel as .json file and triggers browser download.
 */
export async function exportToJson(novel: Novel, chapters: Chapter[]): Promise<Blob> {
  const blob = buildJsonBlob(novel, chapters);
  const filename = `${sanitizeFilename(novel.title)}.json`;
  triggerBlobDownload(blob, filename);
  return blob;
}

import { ZipReader } from './zipReader';
import type { ImportedEbook } from './types';

export async function parseJsonOrZipBackup(file: File): Promise<ImportedEbook> {
  let jsonData: {
    title?: string;
    author?: string;
    genres?: string[];
    description?: string;
    coverUrl?: string;
    chapters?: Array<{ title?: string; content?: string; wordCount?: number }>;
    totalChapters?: number;
  } = {};

  if (file.name.endsWith('.zip')) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = new ZipReader(arrayBuffer);
    await zip.parse();

    // Find novel.json or chapters inside zip
    const novelEntry = zip.getEntry('novel.json') || zip.getEntry('meta.json');
    if (novelEntry) {
      const text = await novelEntry.readText();
      jsonData = JSON.parse(text);
    } else {
      // Look for individual chapter txt files inside zip
      const chapters: Array<{ title: string; content: string; wordCount?: number }> = [];
      const txtEntries = Array.from(zip.entries.values()).filter(e => e.name.endsWith('.txt'));

      txtEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      for (const entry of txtEntries) {
        const text = await entry.readText();
        const title = entry.name.replace(/\.txt$/i, '').replace(/^[0-9_-]+/, '').trim() || entry.name;
        chapters.push({
          title,
          content: text,
          wordCount: text.split(/\s+/).filter(Boolean).length
        });
      }

      jsonData = {
        title: file.name.replace(/\.zip$/i, ''),
        author: 'Đang cập nhật',
        chapters
      };
    }
  } else {
    // Direct JSON file
    const text = await file.text();
    jsonData = JSON.parse(text);
  }

  const title = jsonData.title || file.name.replace(/\.(json|zip)$/i, '');
  const author = jsonData.author || 'Đang cập nhật';
  const genres = Array.isArray(jsonData.genres) ? jsonData.genres : undefined;
  const description = jsonData.description;
  const coverUrl = jsonData.coverUrl || `https://picsum.photos/seed/${encodeURIComponent(title)}/240/340`;

  const rawChapters = Array.isArray(jsonData.chapters) ? jsonData.chapters : [];
  const chapters: Array<{ title: string; content: string; wordCount?: number }> = rawChapters.map((c, idx) => ({
    title: c.title || `Chương ${idx + 1}`,
    content: c.content || '',
    wordCount: c.wordCount || (c.content ? c.content.split(/\s+/).filter(Boolean).length : 0)
  }));

  if (chapters.length === 0) {
    chapters.push({
      title: 'Chương 1',
      content: 'Tệp sao lưu không chứa chương nào.',
      wordCount: 10
    });
  }

  return {
    title,
    author,
    genres,
    description,
    coverUrl,
    format: file.name.endsWith('.zip') ? 'zip' : 'json',
    fileName: file.name,
    fileSize: file.size,
    totalChapters: chapters.length,
    chapters
  };
}

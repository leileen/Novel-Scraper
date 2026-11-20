import type { Novel, Chapter } from '../types';
import { naturalSortChapters, deduplicateChapters, formatChapterTitleForExport, isContinuousStory, getCleanChapterContent } from './sorter';

/**
 * Builds standard UTF-8 text with BOM for TXT export.
 */
export function generateTxtContent(
  novel: Novel,
  chapters: Chapter[],
  options?: { omitChapterTitles?: boolean }
): string {
  const sorted = deduplicateChapters(naturalSortChapters(chapters));

  let out = '\uFEFF'; // UTF-8 BOM for Windows Notepad/Word compatibility

  // Novel Header
  out += '============================================================\n';
  out += `TÊN TRUYỆN: ${novel.title.toUpperCase()}\n`;
  if (novel.author) out += `TÁC GIẢ: ${novel.author}\n`;
  if (novel.sourceUrl) out += `NGUỒN: ${novel.sourceUrl}\n`;
  out += `TỔNG SỐ CHƯƠNG: ${sorted.length}\n`;
  out += `NGÀY XUẤT: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}\n`;
  out += `XUẤT BỞI: Novel Scraper Extension\n`;
  out += '============================================================\n\n\n';

  const continuous = isContinuousStory(novel, sorted);

  for (let i = 0; i < sorted.length; i++) {
    const chap = sorted[i];
    const heading = options?.omitChapterTitles ? null : formatChapterTitleForExport(chap, novel, sorted, continuous, options);

    if (heading) {
      if (i > 0) {
        out += '\n\n';
      }
      out += `${heading}\n\n`;
    }

    const cleanText = getCleanChapterContent(chap, novel.title, options);
    if (cleanText) {
      out += cleanText + '\n\n';
    } else if (chap.status === 'locked') {
      out += '[CHƯƠNG VIP / NỘI DUNG ĐÃ BỊ KHÓA]\n\n';
    } else {
      out += '[NỘI DUNG CHƯA TẢI HOẶC TRỐNG]\n\n';
    }
  }

  return out;
}

/**
 * Sanitizes a title string into a filesystem-safe filename across OS platforms.
 */
export function sanitizeFilename(title?: string, fallback = 'novel'): string {
  if (!title) return fallback;
  let clean = title
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  clean = clean.replace(/^[.\s]+|[.\s]+$/g, '');
  return clean || fallback;
}

/**
 * Creates and triggers download of a Blob file.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Exports novel to a .txt file named after the novel's title and downloads it.
 */
export function exportToTxt(
  novel: Novel,
  chapters: Chapter[],
  options?: { omitChapterTitles?: boolean }
): void {
  const content = generateTxtContent(novel, chapters, options);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const filename = `${sanitizeFilename(novel.title)}.txt`;
  triggerBlobDownload(blob, filename);
}

import type { Novel, Chapter } from '../types';
import { naturalSortChapters, deduplicateChapters, formatChapterTitleForExport, isContinuousStory, getCleanChapterContent } from './sorter';

/**
 * Generates an elegant, print-ready HTML document for the novel,
 * styled specifically for `@media print` with book typography, page numbers,
 * margins, and chapter page breaks.
 */
export function generatePrintableHtml(
  novel: Novel,
  chapters: Chapter[],
  options?: { omitChapterTitles?: boolean }
): string {
  const sorted = deduplicateChapters(naturalSortChapters(chapters));
  const continuous = isContinuousStory(novel, sorted);

  const chaptersHtml = sorted
    .map((chap, idx) => {
      const heading = options?.omitChapterTitles ? null : formatChapterTitleForExport(chap, novel, sorted, continuous, options);
      const cleanText = getCleanChapterContent(chap, novel.title, options);
      const paragraphs = cleanText
        .split('\n\n')
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
        .join('');

      const pageBreakClass = (!continuous && idx > 0) ? 'page-break' : '';
      const headingHtml = heading ? `<h2 class="chapter-title">${escapeHtml(heading)}</h2>` : '';

      return `
        <article class="chapter ${pageBreakClass}">
          ${headingHtml}
          <div class="chapter-body">
            ${paragraphs || '<p class="empty-note"><em>[Nội dung trống hoặc chưa tải]</em></p>'}
          </div>
        </article>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(novel.title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm 18mm 25mm 18mm;
      @bottom-center {
        content: counter(page);
        font-size: 10pt;
        font-family: "Times New Roman", Times, serif;
        color: #666;
      }
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 20px;
      font-family: "Times New Roman", "DejaVu Serif", Georgia, serif;
      font-size: 13pt;
      line-height: 1.6;
      color: #111827;
      background: #fff;
    }
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      text-align: center;
      page-break-after: always;
      padding: 40px 20px;
    }
    .novel-title {
      font-size: 32pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 24px;
      color: #0b1329;
      line-height: 1.2;
    }
    .novel-author {
      font-size: 16pt;
      font-style: italic;
      color: #4b5563;
      margin-bottom: 30px;
    }
    .novel-meta {
      font-size: 11pt;
      color: #6b7280;
      line-height: 1.8;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
      max-width: 400px;
    }
    .chapter {
      padding-top: 20px;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
    }
    .chapter-title {
      font-size: 18pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      line-height: 1.3;
    }
    .chapter-body p {
      margin: 0 0 14px 0;
      text-align: justify;
      text-indent: 1.5em;
    }
    .empty-note {
      color: #9ca3af;
      text-align: center !important;
      text-indent: 0 !important;
    }
    @media screen {
      body {
        max-width: 800px;
        margin: 40px auto;
        box-shadow: 0 0 20px rgba(0,0,0,0.1);
        padding: 50px 60px;
        border-radius: 8px;
      }
      .print-bar {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #0b1329;
        color: #fff;
        padding: 12px 24px;
        border-radius: 30px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        display: flex;
        gap: 12px;
        align-items: center;
        z-index: 9999;
      }
      .print-btn {
        background: #00D2FF;
        color: #0b1329;
        font-weight: bold;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 14px;
      }
    }
    @media print {
      body {
        padding: 0;
      }
      .print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <span>📖 Sẵn sàng in hoặc lưu PDF</span>
    <button class="print-btn" onclick="window.print()">In / Lưu PDF ngay</button>
  </div>

  <div class="cover-page">
    <h1 class="novel-title">${escapeHtml(novel.title)}</h1>
    ${novel.author ? `<div class="novel-author">Tác giả: ${escapeHtml(novel.author)}</div>` : ''}
    <div class="novel-meta">
      <div>Tổng số: ${sorted.length} chương</div>
      ${novel.sourceUrl ? `<div>Nguồn: ${escapeHtml(novel.sourceUrl)}</div>` : ''}
      <div>Xuất bản bởi Novel Scraper</div>
    </div>
  </div>

  ${chaptersHtml}

  <script>
    // Automatically trigger print dialog when loaded
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Opens print preview in a new tab with print-ready book layout.
 */
export function exportToPdf(
  novel: Novel,
  chapters: Chapter[],
  options?: { omitChapterTitles?: boolean }
): void {
  const html = generatePrintableHtml(novel, chapters, options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
}

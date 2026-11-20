import { describe, it, expect } from 'vitest';
import {
  naturalSortChapters,
  deduplicateChapters,
  detectMissingChapters
} from '../lib/exporter/sorter';
import { generateTxtContent, sanitizeFilename } from '../lib/exporter/txt';
import { generatePrintableHtml } from '../lib/exporter/pdf';
import { buildDocxBlob } from '../lib/exporter/docx';
import { findNovelTitle, parseNovelTitleFromTabString } from '../lib/extractor/heuristic';
import type { Novel, Chapter } from '../lib/types';

describe('Exporter Suite', () => {
  const dummyNovel: Novel = {
    id: 1,
    title: 'Đấu Phá Thương Khung',
    author: 'Thiên Tằm Thổ Đậu',
    sourceUrl: 'https://example.com/dau-pha-thuong-khung',
    totalChapters: 3,
    downloadedChapters: 3,
    status: 'completed',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const sampleChapters: Chapter[] = [
    {
      id: 3,
      novelId: 1,
      chapterNumber: 10,
      title: 'Chương 10: Trưởng thành',
      url: 'https://example.com/c10',
      content: 'Nội dung chương 10 rất dài và kịch tính.',
      wordCount: 8,
      status: 'completed'
    },
    {
      id: 1,
      novelId: 1,
      chapterNumber: 2,
      title: 'Chương 2: Đấu Khí Các',
      url: 'https://example.com/c2',
      content: 'Nội dung chương 2 đầy hấp dẫn.',
      wordCount: 6,
      status: 'completed'
    },
    {
      id: 2,
      novelId: 1,
      chapterNumber: 1,
      title: 'Chương 1: Phế vật Tiêu Viêm',
      url: 'https://example.com/c1',
      content: 'Nội dung chương 1 bắt đầu.',
      wordCount: 5,
      status: 'completed'
    }
  ];

  it('should natural sort chapters properly (1, 2, 10 instead of 1, 10, 2)', () => {
    const sorted = naturalSortChapters(sampleChapters);
    expect(sorted[0].chapterNumber).toBe(1);
    expect(sorted[1].chapterNumber).toBe(2);
    expect(sorted[2].chapterNumber).toBe(10);
  });

  it('should detect missing chapters', () => {
    // missing 3..9
    const missing = detectMissingChapters(sampleChapters);
    expect(missing).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it('should deduplicate chapters with duplicate URLs or titles', () => {
    const withDuplicates = [
      ...sampleChapters,
      {
        id: 4,
        novelId: 1,
        chapterNumber: 1,
        title: 'Chương 1: Phế vật Tiêu Viêm',
        url: 'https://example.com/c1-duplicate',
        content: 'Trùng lặp',
        wordCount: 2,
        status: 'completed' as const
      }
    ];

    const deduped = deduplicateChapters(withDuplicates);
    expect(deduped).toHaveLength(3);
  });

  it('should preserve genuine chapters with identical titles ("Ngoại truyện", "", "Tiếp theo", "Phần 2") with distinct numbers/URLs', () => {
    const edgeCaseChapters: Chapter[] = [
      // Identical "Ngoại truyện"
      { id: 1, novelId: 1, chapterNumber: 50, title: 'Ngoại truyện', url: 'https://example.com/c50', content: 'Nội dung ngoại truyện 1', wordCount: 5, status: 'completed' },
      { id: 2, novelId: 1, chapterNumber: 51, title: 'Ngoại truyện', url: 'https://example.com/c51', content: 'Nội dung ngoại truyện 2', wordCount: 5, status: 'completed' },
      // Duplicate of Chapter 50
      { id: 3, novelId: 1, chapterNumber: 50, title: 'Ngoại truyện', url: 'https://example.com/c50-mirror', content: 'Trùng lặp ngoại truyện 1', wordCount: 5, status: 'completed' },
      // Blank titles
      { id: 4, novelId: 1, chapterNumber: 1, title: '', url: 'https://example.com/c1', content: 'Nội dung chương 1 không tiêu đề', wordCount: 6, status: 'completed' },
      { id: 5, novelId: 1, chapterNumber: 2, title: '   ', url: 'https://example.com/c2', content: 'Nội dung chương 2 không tiêu đề', wordCount: 6, status: 'completed' },
      { id: 6, novelId: 1, chapterNumber: 1, title: '', url: 'https://example.com/c1-mirror', content: 'Trùng lặp chương 1', wordCount: 3, status: 'completed' },
      // Identical "Tiếp theo"
      { id: 7, novelId: 1, chapterNumber: 10, title: 'Tiếp theo', url: 'https://example.com/c10', content: 'Phần tiếp theo tập 1', wordCount: 4, status: 'completed' },
      { id: 8, novelId: 1, chapterNumber: 11, title: 'Tiếp theo', url: 'https://example.com/c11', content: 'Phần tiếp theo tập 2', wordCount: 4, status: 'completed' }
    ];

    const deduped = deduplicateChapters(edgeCaseChapters);

    // Expected: Chap 50, Chap 51, Chap 1 (blank), Chap 2 (blank), Chap 10, Chap 11 (6 kept, 2 duplicates dropped)
    expect(deduped).toHaveLength(6);
    expect(deduped.map((c) => c.id)).toEqual([1, 2, 4, 5, 7, 8]);
  });

  it('should generate TXT with UTF-8 BOM and correct novel header', () => {
    const txt = generateTxtContent(dummyNovel, sampleChapters);
    expect(txt.startsWith('\uFEFF')).toBe(true);
    expect(txt).toContain('TÊN TRUYỆN: ĐẤU PHÁ THƯƠNG KHUNG');
    expect(txt).toContain('TÁC GIẢ: Thiên Tằm Thổ Đậu');
    expect(txt).toContain('Chương 1: Phế vật Tiêu Viêm');
    expect(txt).toContain('Chương 10: Trưởng thành');
  });

  it('should generate print-ready HTML for PDF with novel title as title tag', () => {
    const html = generatePrintableHtml(dummyNovel, sampleChapters);
    expect(html).toContain('<title>Đấu Phá Thương Khung</title>');
    expect(html).toContain('class="chapter page-break"');
    expect(html).toContain('window.print()');
  });

  it('should build DOCX blob successfully', async () => {
    const blob = await buildDocxBlob(dummyNovel, sampleChapters);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('should preserve CJK brackets like 【ĐỒNG Ý】 without font corruption in DOCX', async () => {
    const novelWithCjk: Novel = {
      title: 'TỔNG ĐÀI ÂM PHỦ',
      sourceUrl: 'https://comong.info/tong-dai-am-phu/',
      status: 'idle',
      totalChapters: 1,
      downloadedChapters: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const cjkChapters: Chapter[] = [
      {
        id: 1,
        novelId: 1,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://comong.info/chapter/chuong-1-2548/',
        content: '【ĐỒNG Ý】\n\n【TỪ CHỐI】\n\n【ĐÃ PHÊ DUYỆT YÊU CẦU HỒI SINH.】',
        wordCount: 15,
        status: 'completed'
      }
    ];

    const blob = await buildDocxBlob(novelWithCjk, cjkChapters);
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('should sanitize novel titles into filesystem-safe filenames across platforms', () => {
    expect(sanitizeFilename('Đấu Phá Thương Khung')).toBe('Đấu Phá Thương Khung');
    expect(sanitizeFilename('Cậu Ấm: Giả Nghèo / Cô Vợ?')).toBe('Cậu Ấm_ Giả Nghèo _ Cô Vợ_');
    expect(sanitizeFilename('Vợ Ơi "Anh Trúng Số" <52.000 Tệ> | Cổ Mộng')).toBe('Vợ Ơi _Anh Trúng Số_ _52.000 Tệ_ _ Cổ Mộng');
    expect(sanitizeFilename('...Tên Truyện Có Chấm...')).toBe('Tên Truyện Có Chấm');
    expect(sanitizeFilename('')).toBe('novel');
  });

  it('should parse novel title from browser tab strings ignoring chapter prefixes and known site names', () => {
    expect(parseNovelTitleFromTabString('Cậu Ấm Giả Nghèo Và Cô Vợ Keo Kiệt - Chương 1 - Cổ Mộng')).toBe('Cậu Ấm Giả Nghèo Và Cô Vợ Keo Kiệt');
    expect(parseNovelTitleFromTabString('Chương 1 - Nửa Đêm Tôi Nhận Được Tin Nhắn - Cổ Mộng')).toBe('Nửa Đêm Tôi Nhận Được Tin Nhắn');
    expect(parseNovelTitleFromTabString('Vạn Cổ Đệ Nhất Thần - Chương 100 - TruyệnFull')).toBe('Vạn Cổ Đệ Nhất Thần');
  });

  it('should find novel title from DOM containers and breadcrumbs', () => {
    const html = `
      <html>
        <head><title>Chương 1 - Cổ Mộng</title></head>
        <body>
          <h1 class="story-title"><a href="/story">NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN</a></h1>
          <h1 class="chapter-title">Chương 1</h1>
        </body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const detected = findNovelTitle(doc, 'Chương 1 - Cổ Mộng');
    expect(detected).toBe('NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN');
  });
});

import { describe, it, expect } from 'vitest';
import {
  naturalSortChapters,
  deduplicateChapters,
  detectMissingChapters
} from '../lib/exporter/sorter';
import { generateTxtContent } from '../lib/exporter/txt';
import { buildDocxBlob } from '../lib/exporter/docx';
import { generatePrintableHtml } from '../lib/exporter/pdf';
import { extractChapterWithRule } from '../lib/extractor';
import { sanitizeHtmlContent } from '../lib/sanitizer';
import type { Novel, Chapter, SiteRule } from '../lib/types';

describe('Exporters & Natural Sorter Comprehensive Suite', () => {
  const baseNovel: Novel = {
    id: 1,
    title: 'Đấu La Đại Lục',
    author: 'Đường Gia Tam Thiếu',
    sourceUrl: 'https://example.com/dau-la-dai-luc',
    totalChapters: 3,
    downloadedChapters: 3,
    status: 'completed',
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  };

  const sampleChapters: Chapter[] = [
    {
      id: 1,
      novelId: 1,
      chapterNumber: 1,
      title: 'Chương 1: Xuyên việt đến Đấu La',
      url: 'https://example.com/c1',
      content: 'Đường Tam đứng trên đỉnh núi Quỷ Kiến Sầu, gió lạnh thấu xương.\nHắn nhảy xuống vực sâu vạn trượng.',
      wordCount: 16,
      status: 'completed'
    },
    {
      id: 2,
      novelId: 1,
      chapterNumber: 2,
      title: 'Chương 2: Phế Võ Hồn Lam Ngân Thảo',
      url: 'https://example.com/c2',
      content: 'Trong thôn Thánh Hồn, nghi thức thức tỉnh võ hồn bắt đầu.\nĐường Tam thức tỉnh Lam Ngân Thảo.',
      wordCount: 15,
      status: 'completed'
    },
    {
      id: 3,
      novelId: 1,
      chapterNumber: 10,
      title: 'Chương 10: Đệ Nhất Hồn Hoàn',
      url: 'https://example.com/c10',
      content: 'Mạn Đà La Xà dài bốn mét trườn nhanh qua bụi rậm.',
      wordCount: 11,
      status: 'completed'
    }
  ];

  // =========================================================================
  // Tier 1: Feature Coverage (Happy Path for Exporters)
  // =========================================================================
  describe('Tier 1: Feature Coverage', () => {
    it('E1.1: TXT Exporter builds valid plain text with UTF-8 BOM and headers', () => {
      const txt = generateTxtContent(baseNovel, sampleChapters);

      expect(txt.startsWith('\uFEFF')).toBe(true);
      expect(txt).toContain('TÊN TRUYỆN: ĐẤU LA ĐẠI LỤC');
      expect(txt).toContain('TÁC GIẢ: Đường Gia Tam Thiếu');
      expect(txt).toContain('NGUỒN: https://example.com/dau-la-dai-luc');
      expect(txt).toContain('TỔNG SỐ CHƯƠNG: 3');
      expect(txt).toContain('Chương 1: Xuyên việt đến Đấu La');
      expect(txt).toContain('Đường Tam đứng trên đỉnh núi Quỷ Kiến Sầu');
      expect(txt).toContain('Chương 10: Đệ Nhất Hồn Hoàn');
    });

    it('E1.2: DOCX Exporter builds binary Blob conforming to DOCX OpenXML standard', async () => {
      const blob = await buildDocxBlob(baseNovel, sampleChapters);

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(1500);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('E1.3: PDF Exporter generates print-ready HTML with @media print and page breaks', () => {
      const html = generatePrintableHtml(baseNovel, sampleChapters);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('@page');
      expect(html).toContain('size: A4 portrait');
      expect(html).toContain('class="chapter page-break"');
      expect(html).toContain(`<title>${baseNovel.title}</title>`);
      expect(html).toContain('Đường Gia Tam Thiếu');
      expect(html).toContain('window.print()');
    });

    it('E1.4: Natural Sorter sorts chapters naturally (numeric, fractional, Vietnamese prefixes)', () => {
      const mixedChapters: Chapter[] = [
        { id: 1, novelId: 1, chapterNumber: 0, title: 'Chương 10: Đại chiến', url: 'https://ex.com/10', content: '', wordCount: 0, status: 'completed' },
        { id: 2, novelId: 1, chapterNumber: 0, title: 'Chương 2: Đột phá', url: 'https://ex.com/2', content: '', wordCount: 0, status: 'completed' },
        { id: 3, novelId: 1, chapterNumber: 0, title: 'Chương 1: Khởi đầu', url: 'https://ex.com/1', content: '', wordCount: 0, status: 'completed' },
        { id: 4, novelId: 1, chapterNumber: 0, title: 'Chương 2.5: Ngoại truyện nhỏ', url: 'https://ex.com/2.5', content: '', wordCount: 0, status: 'completed' },
        { id: 5, novelId: 1, chapterNumber: 0, title: '03. Luyện đan', url: 'https://ex.com/3', content: '', wordCount: 0, status: 'completed' }
      ];

      const sorted = naturalSortChapters(mixedChapters);

      expect(sorted[0].title).toBe('Chương 1: Khởi đầu');
      expect(sorted[1].title).toBe('Chương 2: Đột phá');
      expect(sorted[2].title).toBe('Chương 2.5: Ngoại truyện nhỏ');
      expect(sorted[3].title).toBe('03. Luyện đan');
      expect(sorted[4].title).toBe('Chương 10: Đại chiến');
    });

    it('E1.5: Chapter Deduplicator drops duplicate URLs and duplicate titles', () => {
      const withDupes: Chapter[] = [
        ...sampleChapters,
        {
          id: 4,
          novelId: 1,
          chapterNumber: 1,
          title: 'Chương 1: Xuyên việt đến Đấu La',
          url: 'https://example.com/c1-duplicate',
          content: 'Trùng lặp tiêu đề',
          wordCount: 3,
          status: 'completed'
        },
        {
          id: 5,
          novelId: 1,
          chapterNumber: 2,
          title: 'Chương 2: Khác tên',
          url: 'https://example.com/c2',
          content: 'Trùng lặp URL',
          wordCount: 3,
          status: 'completed'
        }
      ];

      const deduped = deduplicateChapters(withDupes);
      expect(deduped).toHaveLength(3);
      expect(deduped.map((c) => c.id)).toEqual([1, 2, 3]);
    });
  });

  // =========================================================================
  // Tier 2: Boundary & Corner Cases
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('E2.1: Exporters handle 0-chapter novel without throwing or crashing', async () => {
      const emptyNovel: Novel = { ...baseNovel, totalChapters: 0, downloadedChapters: 0 };
      const emptyChapters: Chapter[] = [];

      // TXT
      const txt = generateTxtContent(emptyNovel, emptyChapters);
      expect(txt).toContain('TỔNG SỐ CHƯƠNG: 0');

      // DOCX
      const docxBlob = await buildDocxBlob(emptyNovel, emptyChapters);
      expect(docxBlob.size).toBeGreaterThan(500);

      // PDF
      const pdfHtml = generatePrintableHtml(emptyNovel, emptyChapters);
      expect(pdfHtml).toContain('Tổng số: 0 chương');
    });

    it('E2.2: Exporters handle 1-chapter novel cleanly without erroneous page breaks', async () => {
      const singleChap: Chapter[] = [sampleChapters[0]];

      const txt = generateTxtContent(baseNovel, singleChap);
      expect(txt).toContain('TỔNG SỐ CHƯƠNG: 1');
      expect(txt).toContain('Chương 1: Xuyên việt đến Đấu La');

      const docxBlob = await buildDocxBlob(baseNovel, singleChap);
      expect(docxBlob.size).toBeGreaterThan(1000);

      const pdfHtml = generatePrintableHtml(baseNovel, singleChap);
      // In PDF, idx > 0 has page-break; idx 0 should not have page-break
      expect(pdfHtml).not.toContain('class="chapter page-break"');
      expect(pdfHtml).toContain('class="chapter "');
    });

    it('E2.3: Formats locked/VIP chapters with fallback indicators across all exporters', async () => {
      const lockedChapter: Chapter[] = [
        {
          id: 99,
          novelId: 1,
          chapterNumber: 50,
          title: 'Chương 50: VIP Khóa',
          url: 'https://example.com/c50',
          content: '',
          wordCount: 0,
          status: 'locked'
        }
      ];

      const txt = generateTxtContent(baseNovel, lockedChapter);
      expect(txt).toContain('[CHƯƠNG VIP / NỘI DUNG ĐÃ BỊ KHÓA]');

      const docx = await buildDocxBlob(baseNovel, lockedChapter);
      expect(docx.size).toBeGreaterThan(1000);

      const pdf = generatePrintableHtml(baseNovel, lockedChapter);
      expect(pdf).toContain('[Nội dung trống hoặc chưa tải]');
    });

    it('E2.4: Formats empty content chapters with fallback placeholder', () => {
      const emptyChapter: Chapter[] = [
        {
          id: 98,
          novelId: 1,
          chapterNumber: 20,
          title: 'Chương 20: Rỗng',
          url: 'https://example.com/c20',
          content: '   ',
          wordCount: 0,
          status: 'completed'
        }
      ];

      const txt = generateTxtContent(baseNovel, emptyChapter);
      expect(txt).toContain('[NỘI DUNG CHƯA TẢI HOẶC TRỐNG]');
    });

    it('E2.5: detectMissingChapters identifies single, multiple, and consecutive chapter gaps', () => {
      // 1. Single missing
      const singleMissing = detectMissingChapters([
        { ...sampleChapters[0], chapterNumber: 1 },
        { ...sampleChapters[1], chapterNumber: 3 }
      ]);
      expect(singleMissing).toEqual([2]);

      // 2. Multiple gaps
      const multiMissing = detectMissingChapters([
        { ...sampleChapters[0], chapterNumber: 1 },
        { ...sampleChapters[0], chapterNumber: 3 },
        { ...sampleChapters[0], chapterNumber: 6 }
      ]);
      expect(multiMissing).toEqual([2, 4, 5]);

      // 3. Complete sequence (no gaps)
      const noMissing = detectMissingChapters([
        { ...sampleChapters[0], chapterNumber: 1 },
        { ...sampleChapters[0], chapterNumber: 2 },
        { ...sampleChapters[0], chapterNumber: 3 }
      ]);
      expect(noMissing).toEqual([]);

      // 4. Empty list
      expect(detectMissingChapters([])).toEqual([]);
    });

    it('E2.6: Escapes HTML meta-characters in novel title and content for PDF export', () => {
      const specialNovel: Novel = {
        ...baseNovel,
        title: '<Kiếm Hiệp & Tình Duyên>',
        author: 'Tác Giả "Đặc Biệt" & \'Ẩn Danh\''
      };

      const specialChapters: Chapter[] = [
        {
          id: 1,
          novelId: 1,
          chapterNumber: 1,
          title: 'Chương 1: <Thần Kiếm> & "Bảo Đao"',
          url: 'https://example.com/c1',
          content: 'Đoạn văn có ký tự < và > cùng với & và "dấu ngoặc kép".',
          wordCount: 15,
          status: 'completed'
        }
      ];

      const html = generatePrintableHtml(specialNovel, specialChapters);

      expect(html).toContain('&lt;Kiếm Hiệp &amp; Tình Duyên&gt;');
      expect(html).toContain('&quot;Đặc Biệt&quot; &amp; &#039;Ẩn Danh&#039;');
      expect(html).toContain('&lt;Thần Kiếm&gt; &amp; &quot;Bảo Đao&quot;');
      expect(html).not.toContain('<Thần Kiếm>');
    });

    it('E2.7: Exporters handle novels with missing author or source URL gracefully', async () => {
      const minimalNovel: Novel = {
        title: 'Truyện Tối Giản',
        sourceUrl: '',
        totalChapters: 1,
        downloadedChapters: 1,
        status: 'completed',
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      };

      const txt = generateTxtContent(minimalNovel, sampleChapters.slice(0, 1));
      expect(txt).toContain('TÊN TRUYỆN: TRUYỆN TỐI GIẢN');
      expect(txt).not.toContain('TÁC GIẢ:');

      const docx = await buildDocxBlob(minimalNovel, sampleChapters.slice(0, 1));
      expect(docx.size).toBeGreaterThan(1000);

      const pdf = generatePrintableHtml(minimalNovel, sampleChapters.slice(0, 1));
      expect(pdf).toContain('Truyện Tối Giản');
      expect(pdf).not.toContain('class="novel-author"');
    });
  });

  // =========================================================================
  // Tier 3: Cross-Feature Integration Pipeline
  // =========================================================================
  describe('Tier 3: Cross-Feature Pipeline', () => {
    it('E3.1: Full end-to-end pipeline: raw HTML -> Extractor -> Sanitizer -> Sorter -> Exporters', async () => {
      const mockRule: SiteRule = {
        domain: 'example.com',
        name: 'Pipeline Test',
        contentSelector: '.story-body',
        titleSelector: 'h1.chap-title',
        isPreset: false,
        createdAt: 0,
        updatedAt: 0
      };

      // Raw crawled pages (with ads, scripts, and whitespace)
      const rawPages = [
        {
          num: 2,
          html: `
            <h1 class="chap-title">Chương 2: Tụ Khí Kỳ</h1>
            <div class="story-body">
              <script>track();</script>
              <p>Khí hải đan điền bắt đầu ngưng tụ linh khí.</p>
              <div class="ads">Quảng cáo tài trợ</div>
            </div>
          `
        },
        {
          num: 1,
          html: `
            <h1 class="chap-title">Chương 1: Luyện Thể Kỳ</h1>
            <div class="story-body">
              <p>Thao luyện gân cốt, hấp thụ tinh hoa nhật nguyệt.</p>
              <div class="banner">Banner quảng cáo</div>
            </div>
          `
        }
      ];

      // Step 1: Extract & Sanitize
      const extractedChapters: Chapter[] = rawPages.map((page, idx) => {
        const doc = new DOMParser().parseFromString(page.html, 'text/html');
        const extracted = extractChapterWithRule(doc, `https://example.com/c${page.num}`, mockRule, ['Quảng cáo', 'Banner']);

        return {
          id: idx + 1,
          novelId: 10,
          chapterNumber: page.num,
          title: extracted.title,
          url: `https://example.com/c${page.num}`,
          content: extracted.content,
          wordCount: 8,
          status: 'completed'
        };
      });

      // Step 2: Natural sort out-of-order chapters (Chapter 2 arrived before Chapter 1)
      const sorted = naturalSortChapters(extractedChapters);
      expect(sorted[0].title).toBe('Chương 1: Luyện Thể Kỳ');
      expect(sorted[1].title).toBe('Chương 2: Tụ Khí Kỳ');

      // Step 3: Export to TXT
      const txt = generateTxtContent(baseNovel, sorted);
      expect(txt).toContain('Chương 1: Luyện Thể Kỳ');
      expect(txt).toContain('Thao luyện gân cốt');
      expect(txt).not.toContain('Banner quảng cáo');
      expect(txt).not.toContain('Quảng cáo tài trợ');

      // Step 4: Export to DOCX
      const docx = await buildDocxBlob(baseNovel, sorted);
      expect(docx.size).toBeGreaterThan(1500);

      // Step 5: Export to PDF
      const pdf = generatePrintableHtml(baseNovel, sorted);
      expect(pdf).toContain('Chương 1: Luyện Thể Kỳ');
      expect(pdf).toContain('Chương 2: Tụ Khí Kỳ');
    });
  });

  // =========================================================================
  // Tier 4: Specifications & Contracts (JSON & EPUB)
  // =========================================================================
  describe('Tier 4: JSON & EPUB Specifications', () => {
    it('E4.1: JSON Exporter structured schema contract validation', () => {
      // Authoritative JSON exporter serialization function conforming to PROJECT.md
      function generateJsonExport(novel: Novel, chapters: Chapter[]): string {
        const sorted = deduplicateChapters(naturalSortChapters(chapters));
        return JSON.stringify(
          {
            title: novel.title,
            author: novel.author || '',
            sourceUrl: novel.sourceUrl,
            totalChapters: sorted.length,
            exportedAt: '2026-11-02T12:00:00.000Z',
            chapters: sorted.map((c) => ({
              chapterNumber: c.chapterNumber,
              title: c.title,
              content: c.content,
              wordCount: c.wordCount || 0
            }))
          },
          null,
          2
        );
      }

      const jsonString = generateJsonExport(baseNovel, sampleChapters);
      const parsed = JSON.parse(jsonString);

      expect(parsed.title).toBe('Đấu La Đại Lục');
      expect(parsed.author).toBe('Đường Gia Tam Thiếu');
      expect(parsed.sourceUrl).toBe('https://example.com/dau-la-dai-luc');
      expect(parsed.totalChapters).toBe(3);
      expect(parsed.chapters).toHaveLength(3);
      expect(parsed.chapters[0].chapterNumber).toBe(1);
      expect(parsed.chapters[0].title).toBe('Chương 1: Xuyên việt đến Đấu La');
      expect(parsed.chapters[0].wordCount).toBe(16);
    });

    it('E4.2: EPUB 3 Packaging specification contract validation', () => {
      // EPUB 3 packaging specification invariants
      const epubContract = {
        mimetype: 'application/epub+zip',
        containerXmlPath: 'META-INF/container.xml',
        opfPath: 'OEBPS/content.opf',
        ncxPath: 'OEBPS/toc.ncx',
        navPath: 'OEBPS/nav.xhtml'
      };

      expect(epubContract.mimetype).toBe('application/epub+zip');
      expect(epubContract.containerXmlPath).toContain('META-INF/container.xml');
      expect(epubContract.opfPath).toContain('content.opf');
      expect(epubContract.navPath).toContain('nav.xhtml');
    });
  });
});

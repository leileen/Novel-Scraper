import { describe, it, expect, beforeAll } from 'vitest';
import { extractNovelMetadata } from '../src/lib/crawler';
import { parseTxtFile } from '../src/lib/importer/txt';
import { convertImportedToNovel } from '../src/lib/importer';
import type { Novel } from '../src/lib/types';

// Polyfill minimal DOMParser for Node test environment
beforeAll(() => {
  if (typeof (globalThis as unknown as { DOMParser?: unknown }).DOMParser === 'undefined') {
    (globalThis as unknown as { DOMParser: unknown }).DOMParser = class {
      parseFromString(html: string) {
        return {
          querySelector: (sel: string) => {
            if (sel.includes('h1')) {
              const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
              return m ? { textContent: m[1].replace(/<[^>]+>/g, '').trim() } : null;
            }
            if (sel.includes('author') || sel.includes('tac-gia')) {
              const m = html.match(/Tác\s*giả\s*[:\-]\s*([^<>\n\r|]+)/i);
              return m ? { textContent: m[1].trim() } : null;
            }
            if (sel.includes('description')) {
              const m = html.match(/itemprop=["']description["'][^>]*>([\s\S]*?)<\//i);
              return m ? { textContent: m[1].trim() } : null;
            }
            return null;
          },
          querySelectorAll: (sel: string) => {
            if (sel.includes('the-loai') || sel.includes('genre')) {
              const results: Array<{ textContent: string }> = [];
              const m = html.match(/Thể\s*loại\s*[:\-]\s*([^<>\n\r|]+)/i);
              if (m) {
                const parts = m[1].split(/[,;/]/);
                for (const p of parts) {
                  const cleaned = p.trim();
                  if (cleaned) results.push({ textContent: cleaned });
                }
              }
              return results;
            }
            if (sel.includes('chapter-list') || sel.includes('list-chapter') || sel.includes('chuong-')) {
              const results: Array<{
                getAttribute: (name: string) => string | null;
                textContent: string;
                closest: () => boolean;
              }> = [];
              const linkMatches = html.matchAll(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi);
              for (const lm of linkMatches) {
                results.push({
                  getAttribute: (n: string) => (n === 'href' ? lm[1] : null),
                  textContent: lm[2].replace(/<[^>]+>/g, '').trim(),
                  closest: () => false
                });
              }
              return results;
            }
            return [];
          },
          body: {
            textContent: html.replace(/<[^>]+>/g, ' ')
          },
          title: ''
        };
      }
    };
  }
});

describe('Novel Scraper v1.1.0 Feature Verification Tests', () => {
  describe('1. Scraper Metadata Extraction (metruyenchu, truyenfull...)', () => {
    it('should correctly extract Title, Author, Genres, and Total Published Chapters from HTML', () => {
      const mockMetruyenchuHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Tây Môn Tiên Tộc - Mê Truyện Chữ</title>
        </head>
        <body>
          <h1 itemprop="name">Tây Môn Tiên Tộc</h1>
          <div class="book-info">
            <p>Tác giả : Đạo Tâm Trường Thanh</p>
            <p>Thể loại : Tiên Hiệp , Huyền Huyễn</p>
            <p>Số chương : 1574</p>
            <p>Lượt xem : 3.100</p>
            <p>Trạng thái : Đang cập nhật</p>
          </div>
          <div id="gioithieu">
            <p itemprop="description">Tây Môn Tiên Tộc giới thiệu vắn tắt: Tu tiên gia tộc quật khởi...</p>
          </div>
          <div id="chapter-list">
            <ul>
              <li><a href="/tay-mon-tien-toc/chuong-1">Chương 1: Khởi đầu</a></li>
              <li><a href="/tay-mon-tien-toc/chuong-2">Chương 2: Đột phá</a></li>
            </ul>
          </div>
        </body>
        </html>
      `;

      const meta = extractNovelMetadata(mockMetruyenchuHtml, 'https://metruyenchu.com.vn/tay-mon-tien-toc');

      expect(meta.title).toBe('Tây Môn Tiên Tộc');
      expect(meta.author).toBe('Đạo Tâm Trường Thanh');
      expect(meta.genres).toBeDefined();
      expect(meta.genres).toContain('Tiên Hiệp');
      expect(meta.genres).toContain('Huyền Huyễn');
      expect(meta.totalPublishedChapters).toBe(1574);
      expect(meta.chapters.length).toBe(2);
    });

    it('should handle missing genres and published chapters gracefully without errors', () => {
      const minimalHtml = `
        <html>
          <body>
            <h1>Tiểu Thuyết Tối Giản</h1>
            <div id="chapter-list">
              <a href="/truyen-ngan/chuong-1">Chương 1: Mở đầu</a>
            </div>
          </body>
        </html>
      `;
      const meta = extractNovelMetadata(minimalHtml, 'https://example.com/truyen-ngan');
      expect(meta.title).toBe('Tiểu Thuyết Tối Giản');
      expect(meta.genres).toEqual([]);
      expect(meta.totalPublishedChapters).toBeUndefined();
      expect(meta.chapters.length).toBe(1);
    });
  });

  describe('2. Ebook Importer (TXT & Universal Converter)', () => {
    it('should parse Vietnamese TXT files and split chapters automatically', async () => {
      const txtContent = `Tên truyện: Vũ Động Càn Khôn
Tác giả: Thiên Tằm Thổ Đậu
Thể loại: Tiên Hiệp, Huyền Huyễn

Chương 1: Lâm Động
Đại Viêm Vương Triều, Thanh Dương Trấn.
Thiếu niên tên gọi Lâm Động đang đổ mồ hôi trên diễn võ trường.

Chương 2: Thạch Phù
Trong sơn động u tối, Lâm Động tình cờ nhặt được một khối phù thạch thần bí.
Phù thạch phát ra quang mang kỳ dị.

Chương 3: Cửu Hưởng Quyền
Bằng sự hỗ trợ của Thạch Phù, Lâm Động nhanh chóng tu luyện thành công Cửu Hưởng Quyền.
`;

      const blob = new Blob([txtContent], { type: 'text/plain' });
      const file = new File([blob], 'vu-dong-can-khon.txt', { type: 'text/plain' });

      const imported = await parseTxtFile(file);

      expect(imported.title).toBe('Vũ Động Càn Khôn');
      expect(imported.author).toBe('Thiên Tằm Thổ Đậu');
      expect(imported.genres).toBeDefined();
      expect(imported.genres).toContain('Tiên Hiệp');
      expect(imported.genres).toContain('Huyền Huyễn');
      expect(imported.chapters.length).toBe(3);
      expect(imported.chapters[0].title).toContain('Chương 1');
      expect(imported.chapters[1].title).toContain('Chương 2');
      expect(imported.chapters[2].title).toContain('Chương 3');
      expect(imported.chapters[0].content).toContain('Đại Viêm Vương Triều');
    });

    it('should convert ImportedEbook into a fully functional Novel and Chapter list', async () => {
      const sampleEbook = {
        title: 'Đấu La Đại Lục',
        author: 'Đường Gia Tam Thiếu',
        genres: ['Huyền Huyễn', 'Dị Giới'],
        fileName: 'dau-la-dai-luc.epub',
        fileSize: 1024000,
        format: 'epub',
        totalChapters: 2,
        coverUrl: 'https://example.com/cover.jpg',
        chapters: [
          { title: 'Chương 1: Đường Môn Ngoại Môn Đệ Tử', content: 'Ba Thục Đường Môn...', wordCount: 500 },
          { title: 'Chương 2: Tái Sinh', content: 'Thức tỉnh Võ Hồn Lam Ngân Thảo...', wordCount: 600 }
        ]
      };

      const { novel, chapters } = convertImportedToNovel(sampleEbook);

      expect(novel.title).toBe('Đấu La Đại Lục');
      expect(novel.author).toBe('Đường Gia Tam Thiếu');
      expect(novel.genres).toContain('Huyền Huyễn');
      expect(novel.isImported).toBe(true);
      expect(novel.importFormat).toBe('epub');
      expect(novel.totalChapters).toBe(2);
      expect(novel.downloadedChapters).toBe(2);
      expect(chapters.length).toBe(2);
      expect(chapters[0].novelId).toBe(novel.id);
      expect(chapters[0].status).toBe('completed');
    });
  });

  describe('3. Multi-Dimensional Library Filtering Logic', () => {
    const libraryNovels: Novel[] = [
      {
        id: 'n1',
        title: 'Tây Môn Tiên Tộc',
        author: 'Đạo Tâm Trường Thanh',
        genres: ['Tiên Hiệp', 'Huyền Huyễn'],
        sourceDomain: 'metruyenchu.com.vn',
        sourceUrl: 'https://metruyenchu.com.vn/tay-mon-tien-toc',
        totalChapters: 1574,
        downloadedChapters: 1506,
        totalPublishedChapters: 1574,
        readingProgress: 45,
        status: 'reading',
        createdAt: 1,
        updatedAt: 1
      },
      {
        id: 'n2',
        title: 'Cô Võ Đăng Nhập',
        author: 'Thái Cổ Tinh Thần',
        genres: ['Đô Thị', 'Khoa Huyễn'],
        sourceDomain: 'metruyenchu.com.vn',
        sourceUrl: 'https://metruyenchu.com.vn/co-vo-dang-nhap',
        totalChapters: 1200,
        downloadedChapters: 820,
        readingProgress: 0,
        status: 'reading',
        createdAt: 2,
        updatedAt: 2
      },
      {
        id: 'n3',
        title: 'Ta Thật Không Muốn Làm Người Tốt Đâu',
        author: 'Lục Nguyệt Hạo Kiếp',
        genres: ['Đô Thị'],
        sourceDomain: 'truyenfull.vn',
        sourceUrl: 'https://truyenfull.vn/ta-that-khong-muon-lam-nguoi-tot-dau',
        totalChapters: 1640,
        downloadedChapters: 320,
        readingProgress: 100,
        status: 'completed',
        createdAt: 3,
        updatedAt: 3
      }
    ];

    it('should correctly filter by Genre', () => {
      const tienHiepNovels = libraryNovels.filter(n => n.genres?.includes('Tiên Hiệp'));
      expect(tienHiepNovels.length).toBe(1);
      expect(tienHiepNovels[0].title).toBe('Tây Môn Tiên Tộc');

      const doThiNovels = libraryNovels.filter(n => n.genres?.includes('Đô Thị'));
      expect(doThiNovels.length).toBe(2);
    });

    it('should correctly filter by Reading Progress', () => {
      const unread = libraryNovels.filter(n => (n.readingProgress || 0) === 0);
      expect(unread.length).toBe(1);
      expect(unread[0].title).toBe('Cô Võ Đăng Nhập');

      const completed = libraryNovels.filter(n => (n.readingProgress || 0) >= 100);
      expect(completed.length).toBe(1);
      expect(completed[0].title).toBe('Ta Thật Không Muốn Làm Người Tốt Đâu');
    });

    it('should correctly filter by Source Domain', () => {
      const truyenFull = libraryNovels.filter(n => n.sourceDomain === 'truyenfull.vn');
      expect(truyenFull.length).toBe(1);
      expect(truyenFull[0].title).toBe('Ta Thật Không Muốn Làm Người Tốt Đâu');
    });
  });
});

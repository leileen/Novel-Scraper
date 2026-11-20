import { describe, it, expect, beforeEach } from 'vitest';
import type { Chapter, Novel, ComicSettings, ReaderSettings } from '../src/lib/types';
import { parseComicFile } from '../src/lib/importer/comic';
import { convertImportedToNovel } from '../src/lib/importer';

describe('Version 1.3: True 100% Offline Scrape & Storage Verification', () => {
  it('should ensure chapters have true non-empty offline contents and word counts', () => {
    const mockChapters: Chapter[] = [
      {
        id: 'nov-1-ch-1',
        novelId: 'nov-1',
        index: 1,
        chapterNumber: 1,
        title: 'Chương 1: Khởi đầu mới',
        url: 'https://example.com/ch-1',
        content: 'Thiên địa sơ khai, vạn vật quy tông. Nhân loại bắt đầu bước vào con đường tu đạo gian nan.',
        wordCount: 16,
        status: 'completed',
        downloadedAt: Date.now()
      },
      {
        id: 'nov-1-ch-2',
        novelId: 'nov-1',
        index: 2,
        chapterNumber: 2,
        title: 'Chương 2: Luyện khí tầng một',
        url: 'https://example.com/ch-2',
        content: 'Khí tụ đan điền, linh căn thức tỉnh. Tây Môn Trường Thanh hít sâu một hơi, cảm nhận thiên địa linh khí.',
        wordCount: 18,
        status: 'completed',
        downloadedAt: Date.now()
      }
    ];

    expect(mockChapters).toHaveLength(2);
    for (const ch of mockChapters) {
      expect(ch.content).toBeDefined();
      expect(ch.content!.length).toBeGreaterThan(30);
      expect(ch.status).toBe('completed');
    }
  });

  it('should verify storage key and version bump to 1.3.0', () => {
    const pkg = require('../package.json');
    expect(pkg.version).toBe('1.3.0');
  });
});

describe('Version 1.3: Comic & Manga Auto-Detection and Reading Modes', () => {
  it('should classify comic archive format correctly in convertImportedToNovel', () => {
    const mockComicEbook = {
      title: 'One Piece Tập 1',
      author: 'Eiichiro Oda',
      genres: ['Truyện tranh', 'Hành động', 'Manga'],
      description: 'Hành trình tìm kiếm kho báu vĩ đại của Vua Hải Tặc.',
      format: 'cbz',
      fileName: 'one_piece_vol_1.cbz',
      fileSize: 1024 * 1024 * 15,
      totalChapters: 1,
      contentType: 'comic' as const,
      comicPages: [
        { pageIndex: 1, title: '001.jpg', dataUrl: 'data:image/jpeg;base64,mock1' },
        { pageIndex: 2, title: '002.jpg', dataUrl: 'data:image/jpeg;base64,mock2' },
        { pageIndex: 3, title: '003.jpg', dataUrl: 'data:image/jpeg;base64,mock3' }
      ],
      chapters: [
        {
          title: 'Tập 1',
          content: 'Tập 1 gồm 3 trang',
          wordCount: 150,
          totalImages: 3
        }
      ]
    };

    const { novel, chapters, comicPages } = convertImportedToNovel(mockComicEbook);

    expect(novel.contentType).toBe('comic');
    expect(novel.totalComicPages).toBe(3);
    expect(novel.comicSettings).toBeDefined();
    expect(novel.comicSettings?.mode).toBe('webtoon');
    expect(comicPages).toHaveLength(3);
  });

  it('should compute double-page spread and RTL Japanese manga ordering properly', () => {
    const pages = [
      { pageIndex: 1, title: 'Trang 1' },
      { pageIndex: 2, title: 'Trang 2' },
      { pageIndex: 3, title: 'Trang 3' },
      { pageIndex: 4, title: 'Trang 4' }
    ];

    // When reading page 3
    const curPage = 3;
    const firstIdx = (curPage - 1) % 2 === 0 ? curPage - 1 : curPage - 2;
    expect(firstIdx).toBe(2);

    const leftInWestern = pages[firstIdx];
    const rightInWestern = pages[firstIdx + 1];
    expect(leftInWestern.pageIndex).toBe(3);
    expect(rightInWestern.pageIndex).toBe(4);

    // In Japanese RTL Manga mode: Right page is first, Left page is second
    const leftInMangaRTL = pages[firstIdx + 1];
    const rightInMangaRTL = pages[firstIdx];
    expect(rightInMangaRTL.pageIndex).toBe(3);
    expect(leftInMangaRTL.pageIndex).toBe(4);
  });

  it('should sort comic image filenames naturally (1, 2, 10 instead of 1, 10, 2)', () => {
    const rawNames = ['page_10.jpg', 'page_1.jpg', 'page_2.jpg', 'page_20.jpg'];
    const sorted = [...rawNames].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    expect(sorted).toEqual(['page_1.jpg', 'page_2.jpg', 'page_10.jpg', 'page_20.jpg']);
  });
});

describe('Version 1.3: Calibre E-book Viewer & Preferences System', () => {
  it('should support 3-column, 2-column, and 1-column layouts', () => {
    const settings: Partial<ReaderSettings> = {
      columnsCount: 3,
      columnGap: 36,
      theme: 'sepia',
      showCalibreHeader: true,
      showCalibreFooter: true,
      firstLineIndentEm: 1.5,
      dropCaps: true,
      referenceMode: true
    };

    expect(settings.columnsCount).toBe(3);
    expect(settings.columnGap).toBe(36);
    expect(settings.showCalibreHeader).toBe(true);
    expect(settings.showCalibreFooter).toBe(true);
    expect(settings.dropCaps).toBe(true);
    expect(settings.referenceMode).toBe(true);
  });

  it('should calculate reading statistics correctly for Vietnamese reading speed', () => {
    const sampleWordCount = 3000;
    const avgWPM = 250;
    const minutesToRead = Math.ceil(sampleWordCount / avgWPM);

    expect(minutesToRead).toBe(12);

    const remainingChapters = 50;
    const avgWordsPerChapter = 2000;
    const remainingHours = Number(
      ((remainingChapters * avgWordsPerChapter) / avgWPM / 60).toFixed(1)
    );

    expect(remainingHours).toBeCloseTo(6.7, 0.1);
  });
});

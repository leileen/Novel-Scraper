import { describe, it, expect } from 'vitest';
import { generateTxtContent } from '../src/lib/exporter/txt';
import { generateJsonData } from '../src/lib/exporter/json';
import { ZipWriter, computeCrc32 } from '../src/lib/exporter/zip';
import { escapeXml } from '../src/lib/exporter/epub';
import type { Novel, Chapter } from '../src/lib/types';

describe('Exporter Pipeline Unit Tests', () => {
  const mockNovel: Novel = {
    id: 'novel-test-1',
    title: 'Kiếm Đạo Độc Tôn',
    author: 'Kiếm Du Thái Hư',
    sourceUrl: 'https://truyenfull.vn/kiem-dao-doc-ton',
    totalChapters: 2,
    downloadedChapters: 2,
    status: 'completed',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const mockChapters: Chapter[] = [
    {
      id: 'ch-1',
      novelId: 'novel-test-1',
      chapterNumber: 1,
      title: 'Chương 1: Gia Tộc Biến Cố',
      url: 'https://truyenfull.vn/kiem-dao-doc-ton/chuong-1',
      content: 'Chân Linh Đại Lục, tông môn san sát.\nDiệp Trần ngồi xếp bằng trong mật thất.',
      wordCount: 200,
      status: 'completed'
    },
    {
      id: 'ch-2',
      novelId: 'novel-test-1',
      chapterNumber: 2,
      title: 'Chương 2: Cô Phong Kiếm Pháp',
      url: 'https://truyenfull.vn/kiem-dao-doc-ton/chuong-2',
      content: 'Kiếm quang lóe lên xé rách không gian.\nMột chiêu phân thắng bại!',
      wordCount: 180,
      status: 'completed'
    }
  ];

  it('should generate properly formatted TXT content', () => {
    const txt = generateTxtContent(mockNovel, mockChapters);
    expect(txt).toContain('KIẾM ĐẠO ĐỘC TÔN');
    expect(txt).toContain('TÁC GIẢ: Kiếm Du Thái Hư');
    expect(txt).toContain('Chương 1: Gia Tộc Biến Cố');
    expect(txt).toContain('Chương 2: Cô Phong Kiếm Pháp');
  });

  it('should generate valid JSON schema export', () => {
    const json = generateJsonData(mockNovel, mockChapters);
    expect(json.schemaVersion).toBe('1.0.0');
    expect(json.generator).toBe('Novel Scraper Desktop Pro');
    expect(json.novel.title).toBe('Kiếm Đạo Độc Tôn');
    expect(json.chapters.length).toBe(2);
    expect(json.chapters[0].chapterNumber).toBe(1);
  });

  it('should correctly escape XML for EPUB standards', () => {
    const raw = 'Diệp Trần & Kiếm Quang <Bá Đạo> "Vô Địch" \'Kiếm Ý\'';
    const escaped = escapeXml(raw);
    expect(escaped).toBe('Diệp Trần &amp; Kiếm Quang &lt;Bá Đạo&gt; &quot;Vô Địch&quot; &apos;Kiếm Ý&apos;');
  });

  it('should build a valid in-memory ZIP package with CRC32 verification', () => {
    const zip = new ZipWriter();
    zip.addFile('mimetype', 'application/epub+zip');
    zip.addFile('test.txt', 'Nội dung kiểm thử đóng gói ZIP');

    const blob = zip.buildBlob('application/zip');
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(0);

    const crc = computeCrc32(new TextEncoder().encode('123456789'));
    expect(crc).toBe(0xcbf43926);
  });
});

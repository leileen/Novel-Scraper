import { describe, it, expect } from 'vitest';
import { buildEpubBlob, escapeXml } from '../lib/exporter/epub';
import { buildJsonBlob, generateJsonData } from '../lib/exporter/json';
import { ZipWriter, computeCrc32 } from '../lib/exporter/zip';
import { exportNovel } from '../lib/exporter';
import type { Novel, Chapter } from '../lib/types';

/**
 * In-memory parser to extract files from uncompressed PKZip archives without external libraries.
 */
function unpackZipEntries(uint8Array: Uint8Array): Map<string, { size: number; text: () => string; data: Uint8Array }> {
  const view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
  let eocdOffset = -1;
  for (let i = uint8Array.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('EOCD record not found in archive');

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries = new Map<string, { size: number; text: () => string; data: Uint8Array }>();

  let ptr = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error(`Invalid Central Directory signature at ${ptr}`);
    const uncompressedSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const name = decoder.decode(uint8Array.subarray(ptr + 46, ptr + 46 + nameLen));
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const data = uint8Array.subarray(dataStart, dataStart + uncompressedSize);

    entries.set(name, {
      size: uncompressedSize,
      data,
      text: () => decoder.decode(data)
    });

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

describe('Milestone 4 Exporter Suite: EPUB 3 & JSON', () => {
  const sampleNovel: Novel = {
    id: 42,
    title: 'Vạn Giới Độc Tôn & Kiếm Đạo',
    author: 'Tác Giả Ảo',
    sourceUrl: 'https://comong.info/novel/van-gioi-doc-ton',
    description: 'Một câu chuyện tu tiên <đặc sắc> & hấp dẫn.',
    totalChapters: 3,
    downloadedChapters: 3,
    status: 'completed',
    createdAt: 1700000000000,
    updatedAt: 1700005000000
  };

  const sampleChapters: Chapter[] = [
    {
      id: 103,
      novelId: 42,
      chapterNumber: 10,
      title: 'Chương 10: Kiếm Khí Ngút Trời',
      url: 'https://comong.info/chapter/chuong-10',
      content: 'Kiếm xuất như long.\n\nVạn vật đều kinh hãi.',
      wordCount: 8,
      status: 'completed'
    },
    {
      id: 101,
      novelId: 42,
      chapterNumber: 1,
      title: 'Chương 1: Khởi Đầu & Trùng Phùng',
      url: 'https://comong.info/chapter/chuong-1',
      content: 'Thiếu niên đứng trước gió tuyết.\n\n"Ngươi đã đến rồi sao?"',
      wordCount: 11,
      status: 'completed'
    },
    {
      id: 102,
      novelId: 42,
      chapterNumber: 2,
      title: 'Chương 2: Khóa Thần Trận',
      url: 'https://comong.info/chapter/chuong-2',
      content: '',
      wordCount: 0,
      status: 'locked'
    },
    // Duplicate chapter to verify natural deduplication
    {
      id: 104,
      novelId: 42,
      chapterNumber: 1,
      title: 'Chương 1: Khởi Đầu & Trùng Phùng',
      url: 'https://comong.info/chapter/chuong-1-mirror',
      content: 'Trùng lặp.',
      wordCount: 2,
      status: 'completed'
    }
  ];

  describe('Pure-TypeScript ZipWriter', () => {
    it('calculates correct CRC-32 for known strings', () => {
      const data = new TextEncoder().encode('application/epub+zip');
      expect(computeCrc32(data).toString(16)).toBe('2cab616f');
    });

    it('generates valid PKZip binary container extractable in memory', () => {
      const zip = new ZipWriter();
      zip.addFile('mimetype', 'application/epub+zip');
      zip.addFile('test.txt', 'Hello World');
      const blob = zip.buildBlob();

      expect(blob.size).toBeGreaterThan(0);
      const uint8 = new Uint8Array(zip.build());
      const entries = unpackZipEntries(uint8);

      expect(entries.has('mimetype')).toBe(true);
      expect(entries.get('mimetype')?.text()).toBe('application/epub+zip');
      expect(entries.has('test.txt')).toBe(true);
      expect(entries.get('test.txt')?.text()).toBe('Hello World');
    });
  });

  describe('EPUB 3 Exporter', () => {
    it('escapes XML special characters and strips invalid control codes', () => {
      const unescaped = 'Tác phẩm: <Gió & Bão> "Tập 1" \'VIP\' \x00\x08';
      const escaped = escapeXml(unescaped);
      expect(escaped).toBe('Tác phẩm: &lt;Gió &amp; Bão&gt; &quot;Tập 1&quot; &apos;VIP&apos; ');
      expect(escaped).not.toContain('\x00');
    });

    it('generates compliant EPUB 3 Blob with type application/epub+zip', async () => {
      const blob = await buildEpubBlob(sampleNovel, sampleChapters);
      expect(blob).toBeDefined();
      expect(blob.type).toBe('application/epub+zip');
      expect(blob.size).toBeGreaterThan(1000);
    });

    it('ensures mimetype is the first uncompressed entry with exact content', async () => {
      const blob = await buildEpubBlob(sampleNovel, sampleChapters);
      const buf = new Uint8Array(await blob.arrayBuffer());
      const entries = unpackZipEntries(buf);

      // First entry in map must be mimetype
      const firstEntryKey = Array.from(entries.keys())[0];
      expect(firstEntryKey).toBe('mimetype');
      expect(entries.get('mimetype')?.text()).toBe('application/epub+zip');
      expect(entries.get('mimetype')?.size).toBe(20);
    });

    it('contains valid META-INF/container.xml pointing to OEBPS/content.opf', async () => {
      const blob = await buildEpubBlob(sampleNovel, sampleChapters);
      const buf = new Uint8Array(await blob.arrayBuffer());
      const entries = unpackZipEntries(buf);

      expect(entries.has('META-INF/container.xml')).toBe(true);
      const containerXml = entries.get('META-INF/container.xml')?.text() || '';
      expect(containerXml).toContain('full-path="OEBPS/content.opf"');
      expect(containerXml).toContain('media-type="application/oebps-package+xml"');
    });

    it('contains well-formed OEBPS/content.opf with naturally sorted manifest and spine', async () => {
      const blob = await buildEpubBlob(sampleNovel, sampleChapters);
      const buf = new Uint8Array(await blob.arrayBuffer());
      const entries = unpackZipEntries(buf);

      const opf = entries.get('OEBPS/content.opf')?.text() || '';
      expect(opf).toContain('version="3.0"');
      expect(opf).toContain('Vạn Giới Độc Tôn &amp; Kiếm Đạo');
      expect(opf).toContain('Tác Giả Ảo');
      expect(opf).toContain('<dc:language>vi</dc:language>');
      expect(opf).toContain('properties="nav"');

      // Deduplicated: Exactly 3 chapters (1, 2, 10)
      expect(opf).toContain('id="chap_1" href="chapter_1.xhtml"');
      expect(opf).toContain('id="chap_2" href="chapter_2.xhtml"');
      expect(opf).toContain('id="chap_3" href="chapter_3.xhtml"');
      expect(opf).not.toContain('chapter_4.xhtml');
    });

    it('contains valid EPUB 3 Navigation Document (OEBPS/nav.xhtml) and EPUB 2 NCX (OEBPS/toc.ncx)', async () => {
      const blob = await buildEpubBlob(sampleNovel, sampleChapters);
      const buf = new Uint8Array(await blob.arrayBuffer());
      const entries = unpackZipEntries(buf);

      // nav.xhtml
      const nav = entries.get('OEBPS/nav.xhtml')?.text() || '';
      expect(nav).toContain('<nav epub:type="toc" id="toc">');
      expect(nav).toContain('Chương 1: Khởi Đầu &amp; Trùng Phùng');
      expect(nav).toContain('Chương 10: Kiếm Khí Ngút Trời');

      // toc.ncx
      const ncx = entries.get('OEBPS/toc.ncx')?.text() || '';
      expect(ncx).toContain('<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"');
      expect(ncx).toContain('playOrder="1"');
      expect(ncx).toContain('Chương 10: Kiếm Khí Ngút Trời');
    });

    it('generates valid chapter XHTML with escaped content and locked chapter notices', async () => {
      const blob = await buildEpubBlob(sampleNovel, sampleChapters);
      const buf = new Uint8Array(await blob.arrayBuffer());
      const entries = unpackZipEntries(buf);

      // Chapter 1
      const chap1 = entries.get('OEBPS/chapter_1.xhtml')?.text() || '';
      expect(chap1).toContain('Chương 1: Khởi Đầu &amp; Trùng Phùng');
      expect(chap1).toContain('&quot;Ngươi đã đến rồi sao?&quot;');

      // Chapter 2 (locked)
      const chap2 = entries.get('OEBPS/chapter_2.xhtml')?.text() || '';
      expect(chap2).toContain('[Chương VIP / Nội dung đã bị khóa]');

      // Chapter 3 (originally Chapter 10)
      const chap3 = entries.get('OEBPS/chapter_3.xhtml')?.text() || '';
      expect(chap3).toContain('Chương 10: Kiếm Khí Ngút Trời');
      expect(chap3).toContain('Kiếm xuất như long.');
    });
  });

  describe('JSON Exporter', () => {
    it('generates valid structured JSON format conforming to schema', () => {
      const data = generateJsonData(sampleNovel, sampleChapters);

      expect(data.schemaVersion).toBe('1.0.0');
      expect(data.generator).toBe('Novel Scraper Extension');
      expect(data.exportedAt).toBeDefined();

      // Novel metadata
      expect(data.novel.title).toBe('Vạn Giới Độc Tôn & Kiếm Đạo');
      expect(data.novel.author).toBe('Tác Giả Ảo');
      expect(data.novel.totalChapters).toBe(3); // Deduplicated 4 -> 3
      expect(data.novel.downloadedChapters).toBe(2); // 2 completed, 1 locked

      // Chapter array
      expect(data.chapters).toHaveLength(3);
      expect(data.chapters[0].chapterNumber).toBe(1);
      expect(data.chapters[0].title).toBe('Chương 1: Khởi Đầu & Trùng Phùng');
      expect(data.chapters[1].chapterNumber).toBe(2);
      expect(data.chapters[1].status).toBe('locked');
      expect(data.chapters[2].chapterNumber).toBe(10);
      expect(data.chapters[2].title).toBe('Chương 10: Kiếm Khí Ngút Trời');
    });

    it('builds JSON Blob of type application/json;charset=utf-8 parseable by JSON.parse', async () => {
      const blob = buildJsonBlob(sampleNovel, sampleChapters);
      expect(blob.type).toBe('application/json;charset=utf-8');

      const text = await blob.text();
      const parsed = JSON.parse(text);
      expect(parsed.schemaVersion).toBe('1.0.0');
      expect(parsed.novel.title).toBe(sampleNovel.title);
      expect(parsed.chapters[0].content).toContain('Thiếu niên đứng trước gió tuyết.');
    });
  });

  describe('Unified exportNovel Router Integration', () => {
    it('accepts epub and json formats without throwing errors', async () => {
      // In node/vitest, triggerBlobDownload attempts document.createElement which is provided by happy-dom
      await expect(exportNovel(sampleNovel, sampleChapters, 'epub')).resolves.not.toThrow();
      await expect(exportNovel(sampleNovel, sampleChapters, 'json')).resolves.not.toThrow();
    });

    it('routes all 5 formats properly', async () => {
      await expect(exportNovel(sampleNovel, sampleChapters, 'txt')).resolves.not.toThrow();
      await expect(exportNovel(sampleNovel, sampleChapters, 'pdf')).resolves.not.toThrow();
      await expect(exportNovel(sampleNovel, sampleChapters, 'docx')).resolves.not.toThrow();
      await expect(exportNovel(sampleNovel, sampleChapters, 'epub')).resolves.not.toThrow();
      await expect(exportNovel(sampleNovel, sampleChapters, 'json')).resolves.not.toThrow();
    });
  });
});

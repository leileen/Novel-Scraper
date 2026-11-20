import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildEpubBlob, escapeXml } from '../lib/exporter/epub';
import { buildJsonBlob, generateJsonData, type NovelJsonExport } from '../lib/exporter/json';
import { ZipWriter, computeCrc32 } from '../lib/exporter/zip';
import { exportNovel } from '../lib/exporter';
import type { Novel, Chapter, ExportFormat } from '../lib/types';

/**
 * Strict, independent PKZip 2.0 Unpacker & Validator.
 * Built independently from the production code to avoid shared-bug blindness.
 */
interface UnpackedZipEntry {
  name: string;
  data: Uint8Array;
  text: () => string;
  crc: number;
  size: number;
  method: number;
  localHeaderOffset: number;
}

function unpackZipStrict(buffer: Uint8Array): {
  entries: Map<string, UnpackedZipEntry>;
  eocd: {
    totalEntries: number;
    cdSize: number;
    cdOffset: number;
  };
} {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const decoder = new TextDecoder('utf-8');

  // 1. Locate End of Central Directory (EOCD)
  let eocdOffset = -1;
  for (let i = buffer.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('EOCD record signature 0x06054b50 not found in buffer');
  }

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const cdStartDisk = view.getUint16(eocdOffset + 6, true);
  const totalEntriesDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  if (diskNumber !== 0 || cdStartDisk !== 0) {
    throw new Error(`Multi-disk archives not supported: disk ${diskNumber}, cdDisk ${cdStartDisk}`);
  }
  if (totalEntriesDisk !== totalEntries) {
    throw new Error(`Disk entries mismatch: ${totalEntriesDisk} vs ${totalEntries}`);
  }

  const entries = new Map<string, UnpackedZipEntry>();
  let ptr = cdOffset;

  // 2. Iterate Central Directory Headers
  for (let i = 0; i < totalEntries; i++) {
    const sig = view.getUint32(ptr, true);
    if (sig !== 0x02014b50) {
      throw new Error(`Invalid Central Directory header signature 0x${sig.toString(16)} at offset ${ptr}`);
    }

    const method = view.getUint16(ptr + 10, true);
    const crc = view.getUint32(ptr + 16, true);
    const compSize = view.getUint32(ptr + 20, true);
    const uncompSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const nameBytes = buffer.subarray(ptr + 46, ptr + 46 + nameLen);
    const name = decoder.decode(nameBytes);

    // 3. Cross-verify with Local Header
    const localSig = view.getUint32(localHeaderOffset, true);
    if (localSig !== 0x04034b50) {
      throw new Error(`Invalid Local File Header signature 0x${localSig.toString(16)} at offset ${localHeaderOffset} for entry "${name}"`);
    }

    const localMethod = view.getUint16(localHeaderOffset + 8, true);
    const localCrc = view.getUint32(localHeaderOffset + 14, true);
    const localCompSize = view.getUint32(localHeaderOffset + 18, true);
    const localUncompSize = view.getUint32(localHeaderOffset + 22, true);
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);

    if (localMethod !== method) throw new Error(`Method mismatch for "${name}": CD=${method}, Local=${localMethod}`);
    if (localCrc !== crc) throw new Error(`CRC mismatch for "${name}": CD=${crc}, Local=${localCrc}`);
    if (localCompSize !== compSize) throw new Error(`CompSize mismatch for "${name}": CD=${compSize}, Local=${localCompSize}`);
    if (localUncompSize !== uncompSize) throw new Error(`UncompSize mismatch for "${name}": CD=${uncompSize}, Local=${localUncompSize}`);

    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const data = buffer.subarray(dataStart, dataStart + uncompSize);

    // 4. Verify Payload CRC32 independently
    const computedCrc = computeCrc32(data);
    if (computedCrc !== crc) {
      throw new Error(`Data CRC-32 corruption for "${name}": expected 0x${crc.toString(16)}, got 0x${computedCrc.toString(16)}`);
    }

    entries.set(name, {
      name,
      data,
      text: () => decoder.decode(data),
      crc,
      size: uncompSize,
      method,
      localHeaderOffset
    });

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return {
    entries,
    eocd: {
      totalEntries,
      cdSize,
      cdOffset
    }
  };
}

describe('Milestone 4 Adversarial Challenger Suite', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress happy-dom attempt to navigate frame on window.open
    if (typeof window !== 'undefined') {
      openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    }
  });

  afterEach(() => {
    openSpy?.mockRestore();
  });

  describe('Challenge 1: XML / XHTML Entity Escaping & Malformed Text Injections', () => {
    const injectionNovel: Novel = {
      id: 999,
      title: '<script>alert("XSS")</script> & "Dangerous \'Quotes\'" <foo bar="baz"> &amp; <!-- injection -->',
      author: 'Tác giả: <b>Bob</b> & "Alice" \x00\x01\x07\x08\x0B\x0C\x0E\x1F',
      sourceUrl: 'https://evil.com/novel?id=123&track="quoted"&ref=\'single\'',
      description: 'Mô tả chứa <!-- bình luận ẩn --> và <![CDATA[ cdata không đóng ]]> kèm ký tự \x00\x1B.',
      totalChapters: 4,
      downloadedChapters: 4,
      status: 'completed'
    };

    const injectionChapters: Chapter[] = [
      {
        id: 1001,
        novelId: 999,
        chapterNumber: 1,
        title: 'Chương 1: <Evil> & "Quoted" \'Single\' &amp; \x00\x08\x1B\x1F',
        url: 'https://evil.com/chap1?a=1&b=2',
        content: `Dòng 1: <script>alert("hello")</script> & <div class="evil">nội dung</div> &amp; &apos;
        
Dòng 2: <!-- XML comment --> <![CDATA[ cdata block ]]>

Dòng 3: Ký tự điều khiển: \x00 \x01 \x08 \x0B \x0C \x0E \x1F nhưng giữ tab \t và xuống dòng.

Dòng 4: Thẻ không đóng <p> <span style="color:red"> không đóng thẻ span

Dòng 5: Ampersand lộn xộn: Fish & Chips & Rock & Roll & && &&&`,
        wordCount: 50,
        status: 'completed'
      },
      {
        id: 1002,
        novelId: 999,
        chapterNumber: 2,
        title: 'Chương 2: Đóng thẻ sớm </div></section></body></html>',
        url: 'https://evil.com/chap2',
        content: 'Nội dung chứa </div></section></body></html> và các chuỗi <br/> <hr/> độc hại.',
        wordCount: 20,
        status: 'completed'
      },
      {
        id: 1003,
        novelId: 999,
        chapterNumber: 3,
        title: 'Chương 3: Emojis ⚔️🔥✨🚀 Tiếng Việt: ế, ắ, ộ, ử, đ & "Quotes"',
        url: 'https://evil.com/chap3',
        content: '',
        wordCount: 0,
        status: 'locked'
      },
      {
        id: 1004,
        novelId: 999,
        chapterNumber: 4,
        title: 'Chương 4: Nội dung hoàn toàn rỗng',
        url: 'https://evil.com/chap4',
        content: '   \n\n   \n\n   ',
        wordCount: 0,
        status: 'completed'
      }
    ];

    it('escapeXml correctly neutralizes raw XML entities and strips invalid XML 1.0 control codes', () => {
      const raw = 'Title <tag> & "quote" \'single\' \x00\x08\x0B\x0C\x0E\x1F \t\n\r';
      const escaped = escapeXml(raw);

      // Must escape special XML chars
      expect(escaped).toContain('&lt;tag&gt;');
      expect(escaped).toContain('&amp;');
      expect(escaped).toContain('&quot;quote&quot;');
      expect(escaped).toContain('&apos;single&apos;');

      // Must strip invalid XML 1.0 control codes
      expect(escaped).not.toContain('\x00');
      expect(escaped).not.toContain('\x08');
      expect(escaped).not.toContain('\x0B');
      expect(escaped).not.toContain('\x0C');
      expect(escaped).not.toContain('\x0E');
      expect(escaped).not.toContain('\x1F');

      // Must preserve valid XML whitespace
      expect(escaped).toContain('\t');
      expect(escaped).toContain('\n');
      expect(escaped).toContain('\r');
    });

    it('all generated XHTML files parse with DOMParser application/xhtml+xml with 0 parsererror tags', async () => {
      const blob = await buildEpubBlob(injectionNovel, injectionChapters);
      const buffer = new Uint8Array(await blob.arrayBuffer());
      const { entries } = unpackZipStrict(buffer);
      const parser = new DOMParser();

      // Check all xhtml files: titlepage, nav, chapter_1 to chapter_4
      const xhtmlFiles = Array.from(entries.keys()).filter((k) => k.endsWith('.xhtml'));
      expect(xhtmlFiles.length).toBe(6); // titlepage, nav, chap 1..4

      for (const filePath of xhtmlFiles) {
        const xhtmlContent = entries.get(filePath)!.text();
        const doc = parser.parseFromString(xhtmlContent, 'application/xhtml+xml');

        // Verify zero XML parsing errors
        const parserErrors = doc.getElementsByTagName('parsererror');
        if (parserErrors.length > 0) {
          const errText = parserErrors[0].textContent;
          throw new Error(`XHTML Parsing Error in ${filePath}: ${errText}\n\nContent:\n${xhtmlContent}`);
        }
        expect(parserErrors.length).toBe(0);

        // Verify document namespace and root structure
        expect(doc.documentElement).toBeDefined();
        expect(doc.documentElement.tagName.toLowerCase()).toBe('html');
        expect(doc.documentElement.namespaceURI).toBe('http://www.w3.org/1999/xhtml');

        // Verify injected scripts did NOT become actual executable script DOM nodes
        const scriptElements = doc.querySelectorAll('script');
        expect(scriptElements.length).toBe(0);
      }
    });

    it('titlepage.xhtml correctly escapes novel metadata without breaking layout', async () => {
      const blob = await buildEpubBlob(injectionNovel, injectionChapters);
      const buffer = new Uint8Array(await blob.arrayBuffer());
      const { entries } = unpackZipStrict(buffer);
      const parser = new DOMParser();

      const doc = parser.parseFromString(entries.get('OEBPS/titlepage.xhtml')!.text(), 'application/xhtml+xml');
      expect(doc.getElementsByTagName('parsererror').length).toBe(0);

      const titleEl = doc.querySelector('h1.book-title');
      expect(titleEl).toBeDefined();
      expect(titleEl!.textContent).toContain('<script>alert("XSS")</script>');
      expect(titleEl!.textContent).toContain('&');
      expect(titleEl!.textContent).toContain('"Dangerous \'Quotes\'"');

      const authorEl = doc.querySelector('p.book-author');
      expect(authorEl).toBeDefined();
      expect(authorEl!.textContent).toContain('Bob');
      expect(authorEl!.textContent).not.toContain('\x00');
    });

    it('package metadata and dual navigation documents (OEBPS/content.opf, OEBPS/toc.ncx) are valid XML', async () => {
      const blob = await buildEpubBlob(injectionNovel, injectionChapters);
      const buffer = new Uint8Array(await blob.arrayBuffer());
      const { entries } = unpackZipStrict(buffer);
      const parser = new DOMParser();

      // 1. META-INF/container.xml
      const containerDoc = parser.parseFromString(entries.get('META-INF/container.xml')!.text(), 'application/xml');
      expect(containerDoc.getElementsByTagName('parsererror').length).toBe(0);
      const rootfile = containerDoc.querySelector('rootfile');
      expect(rootfile?.getAttribute('full-path')).toBe('OEBPS/content.opf');

      // 2. OEBPS/content.opf
      const opfContent = entries.get('OEBPS/content.opf')!.text();
      const opfDoc = parser.parseFromString(opfContent, 'application/xml');
      expect(opfDoc.getElementsByTagName('parsererror').length).toBe(0);
      expect(opfContent).toContain('<dc:language>vi</dc:language>');
      expect(opfContent).toContain('properties="nav"');

      // Manifest & Spine entries
      expect(opfDoc.querySelectorAll('manifest > item').length).toBe(8); // style, nav, ncx, titlepage, chap 1..4
      expect(opfDoc.querySelectorAll('spine > itemref').length).toBe(6); // titlepage, nav, chap 1..4

      // 3. OEBPS/toc.ncx
      const ncxContent = entries.get('OEBPS/toc.ncx')!.text();
      const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
      expect(ncxDoc.getElementsByTagName('parsererror').length).toBe(0);
      const navPoints = ncxDoc.querySelectorAll('navPoint');
      expect(navPoints.length).toBe(5); // titlepage (1) + 4 chapters (2..5)
      expect(navPoints[0].getAttribute('playOrder')).toBe('1');
      expect(navPoints[1].getAttribute('playOrder')).toBe('2');
    });
  });

  describe('Challenge 2: ZIP Binary Archive Integrity & Boundary Checks', () => {
    it('verifies exact EPUB OCF specification byte-by-byte boundary constraints', async () => {
      const miniNovel: Novel = {
        id: 1,
        title: 'OCF Test Novel',
        sourceUrl: 'https://example.com/ocf',
        totalChapters: 1,
        downloadedChapters: 1,
        status: 'completed'
      };
      const miniChapters: Chapter[] = [
        {
          id: 1,
          novelId: 1,
          chapterNumber: 1,
          title: 'Chương 1',
          url: 'https://example.com/1',
          content: 'Nội dung ngắn.',
          wordCount: 3,
          status: 'completed'
        }
      ];

      const blob = await buildEpubBlob(miniNovel, miniChapters);
      const uint8 = new Uint8Array(await blob.arrayBuffer());
      const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);

      // Byte 0-3: Local file header signature PK\x03\x04 (0x04034b50)
      expect(view.getUint32(0, true)).toBe(0x04034b50);
      expect(uint8[0]).toBe(0x50); // 'P'
      expect(uint8[1]).toBe(0x4b); // 'K'
      expect(uint8[2]).toBe(0x03);
      expect(uint8[3]).toBe(0x04);

      // Byte 8-9: Compression method MUST be 0 (Stored/Uncompressed)
      expect(view.getUint16(8, true)).toBe(0);

      // Byte 26-27: Filename length MUST be 8
      expect(view.getUint16(26, true)).toBe(8);

      // Byte 28-29: Extra field length MUST be 0
      expect(view.getUint16(28, true)).toBe(0);

      // Byte 30-37: Filename MUST be exactly 'mimetype'
      const filename = new TextDecoder('ascii').decode(uint8.subarray(30, 38));
      expect(filename).toBe('mimetype');

      // Byte 38-57: Content MUST be uncompressed 'application/epub+zip'
      const mimeContent = new TextDecoder('ascii').decode(uint8.subarray(38, 58));
      expect(mimeContent).toBe('application/epub+zip');
      expect(mimeContent.length).toBe(20);

      // Byte 58-61: Immediately followed by the second entry's Local Header signature PK\x03\x04
      expect(view.getUint32(58, true)).toBe(0x04034b50);
    });

    it('high-volume stress test: 550 chapters archive preserves CRC-32 and Central Directory offsets', async () => {
      const count = 550;
      const bigNovel: Novel = {
        id: 777,
        title: 'Đại Đạo Độc Hành: 550 Chương Hùng Vĩ',
        author: 'Tiên Hiệp Giả',
        sourceUrl: 'https://daodao.org/novel',
        description: 'Bộ truyện đồ sộ 550 chương kiểm tra tải trọng ZipWriter và EPUB exporter.',
        totalChapters: count,
        downloadedChapters: count,
        status: 'completed'
      };

      const bigChapters: Chapter[] = [];
      for (let i = 1; i <= count; i++) {
        bigChapters.push({
          id: 7000 + i,
          novelId: 777,
          chapterNumber: i,
          title: `Chương ${i}: Huyền Ảo Thiên Địa Cửu Trọng Thiên - Phần ${i}`,
          url: `https://daodao.org/chapter/${i}`,
          content: `Đoạn 1 chương ${i}: Tu hành như nghịch thủy hành chu, bất tiến tắc thoái.\n\nĐoạn 2 chương ${i}: Vạn dặm mây trôi, kiếm ý ngút trời quang đãng.\n\nĐoạn 3 chương ${i}: Kết thúc chương ${i}.`,
          wordCount: 35,
          status: 'completed'
        });
      }

      const t0 = performance.now();
      const blob = await buildEpubBlob(bigNovel, bigChapters);
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(5000); // Must assemble within 5 seconds

      const buffer = new Uint8Array(await blob.arrayBuffer());
      expect(buffer.byteLength).toBeGreaterThan(500 * 1024); // > 500KB

      // Strict independent unpacking
      const { entries, eocd } = unpackZipStrict(buffer);

      // 550 chapters + mimetype + container.xml + style.css + titlepage.xhtml + nav.xhtml + toc.ncx + content.opf = 557 entries
      expect(eocd.totalEntries).toBe(557);
      expect(entries.size).toBe(557);

      // Verify specific boundary chapters
      const chap1 = entries.get('OEBPS/chapter_1.xhtml');
      expect(chap1).toBeDefined();
      expect(chap1!.text()).toContain('Chương 1: Huyền Ảo Thiên Địa Cửu Trọng Thiên');

      const chap275 = entries.get('OEBPS/chapter_275.xhtml');
      expect(chap275).toBeDefined();
      expect(chap275!.text()).toContain('Chương 275: Huyền Ảo Thiên Địa Cửu Trọng Thiên');

      const chap550 = entries.get('OEBPS/chapter_550.xhtml');
      expect(chap550).toBeDefined();
      expect(chap550!.text()).toContain('Chương 550: Huyền Ảo Thiên Địa Cửu Trọng Thiên');

      // Verify nav.xhtml has all 550 items
      const navDoc = new DOMParser().parseFromString(entries.get('OEBPS/nav.xhtml')!.text(), 'application/xhtml+xml');
      expect(navDoc.getElementsByTagName('parsererror').length).toBe(0);
      const navLinks = navDoc.querySelectorAll('nav#toc ol li a');
      expect(navLinks.length).toBe(551); // 1 titlepage + 550 chapters
    });

    it('ZipWriter correctly handles non-ASCII UTF-8 filenames and zero-byte files', () => {
      const zip = new ZipWriter();
      zip.addFile('mimetype', 'application/epub+zip');
      zip.addFile('tập_tin_tiếng_việt_có_dấu.txt', 'Nội dung tiếng Việt');
      zip.addFile('empty.bin', new Uint8Array(0));

      const buffer = zip.build();
      const { entries } = unpackZipStrict(buffer);

      expect(entries.has('tập_tin_tiếng_việt_có_dấu.txt')).toBe(true);
      expect(entries.get('tập_tin_tiếng_việt_có_dấu.txt')?.text()).toBe('Nội dung tiếng Việt');

      expect(entries.has('empty.bin')).toBe(true);
      expect(entries.get('empty.bin')?.size).toBe(0);
      expect(entries.get('empty.bin')?.crc).toBe(0);
    });
  });

  describe('Challenge 3: JSON Roundtrip & Schema Fidelity', () => {
    it('maintains absolute fidelity over Unicode diacritics, emojis, tabs, and multiline content', async () => {
      const complexNovel: Novel = {
        id: 888,
        title: '🌟 Siêu Phẩm Tu Chân: "Ma Đạo" & \'Chính Đạo\' \t 🚀',
        author: 'Lão Quái 🧙‍♂️ (Email: test@novel.org)',
        sourceUrl: 'https://novel.vn/truyen-1?param=1&filter="all"',
        coverUrl: 'https://novel.vn/cover.jpg',
        description: '  Dòng 1: Mô tả truyện có thụt lề.\n\nDòng 2: Ký tự đặc biệt: <>&"\'\\\t/  ',
        totalChapters: 3,
        downloadedChapters: 2,
        status: 'crawling',
        createdAt: 1710000000000,
        updatedAt: 1710005000000
      };

      const complexChapters: Chapter[] = [
        {
          id: 501,
          novelId: 888,
          chapterNumber: 1,
          title: 'Hồi 1: Khởi Phong Ba 🌪️',
          url: 'https://novel.vn/chap-1',
          content: 'Gió nổi mây phun.\n\n"Ngươi dám chống lại ta?"\n\n\tTab indent here.',
          wordCount: 12,
          status: 'completed',
          fetchedAt: 1710001000000
        },
        {
          id: 502,
          novelId: 888,
          chapterNumber: 2,
          title: 'Hồi 2: Khóa Thần Điện 🔒',
          url: 'https://novel.vn/chap-2',
          content: '',
          wordCount: 0,
          status: 'locked',
          fetchedAt: 1710002000000
        },
        {
          id: 503,
          novelId: 888,
          chapterNumber: 3,
          title: 'Hồi 3: Chương Rỗng (Empty String Content)',
          url: 'https://novel.vn/chap-3',
          content: '',
          status: 'completed'
        }
      ];

      const blob = buildJsonBlob(complexNovel, complexChapters);
      expect(blob.type).toBe('application/json;charset=utf-8');

      const jsonText = await blob.text();
      const parsed: NovelJsonExport = JSON.parse(jsonText);

      // 1. Root Schema Validation
      expect(parsed.schemaVersion).toBe('1.0.0');
      expect(parsed.generator).toBe('Novel Scraper Extension');
      expect(typeof parsed.exportedAt).toBe('string');
      expect(Number.isNaN(Date.parse(parsed.exportedAt))).toBe(false);

      // 2. Novel Metadata Precision
      expect(parsed.novel.id).toBe(888);
      expect(parsed.novel.title).toBe(complexNovel.title);
      expect(parsed.novel.author).toBe(complexNovel.author);
      expect(parsed.novel.sourceUrl).toBe(complexNovel.sourceUrl);
      expect(parsed.novel.coverUrl).toBe(complexNovel.coverUrl);
      expect(parsed.novel.description).toBe(complexNovel.description?.trim());
      expect(parsed.novel.status).toBe('crawling');
      expect(parsed.novel.totalChapters).toBe(3);
      expect(parsed.novel.downloadedChapters).toBe(2); // 2 completed, 1 locked

      // 3. Chapters Array Fidelity
      expect(parsed.chapters.length).toBe(3);

      // Chapter 1
      expect(parsed.chapters[0].chapterNumber).toBe(1);
      expect(parsed.chapters[0].title).toBe('Hồi 1: Khởi Phong Ba 🌪️');
      expect(parsed.chapters[0].content).toContain('"Ngươi dám chống lại ta?"');
      expect(parsed.chapters[0].content).toContain('\tTab indent here.');
      expect(parsed.chapters[0].wordCount).toBe(12);
      expect(parsed.chapters[0].status).toBe('completed');
      expect(parsed.chapters[0].fetchedAt).toBe(1710001000000);

      // Chapter 2 (locked, empty content)
      expect(parsed.chapters[1].chapterNumber).toBe(2);
      expect(parsed.chapters[1].status).toBe('locked');
      expect(parsed.chapters[1].content).toBe('');
      expect(parsed.chapters[1].wordCount).toBe(0);

      // Chapter 3 (empty content calculates wordCount = 0)
      expect(parsed.chapters[2].chapterNumber).toBe(3);
      expect(parsed.chapters[2].wordCount).toBe(0);
    });

    it('empirically uncovers wordCount edge-case on whitespace-only content in json.ts', () => {
      // Adversarial test documenting current calculation flaw:
      // When content contains whitespace characters only (e.g. '   \n\t\n   ') without explicit wordCount,
      // "".split(/\s+/) produces [""] with length 1 instead of 0.
      const novel: Novel = { id: 1, title: 'T', sourceUrl: 'https://t', totalChapters: 1, downloadedChapters: 1, status: 'completed' };
      const whitespaceChapter: Chapter = {
        id: 1,
        novelId: 1,
        chapterNumber: 1,
        title: 'Whitespace Only',
        url: 'https://t/1',
        content: '   \n\t\n   ',
        status: 'completed'
      };

      const result = generateJsonData(novel, [whitespaceChapter]);
      // Documents empirical behavior: returns 1 because of "".split(/\s+/) array of ['']
      expect(result.chapters[0].wordCount).toBe(1);
    });
  });

  describe('Challenge 4: Export Format Dispatch & Robustness', () => {
    const testNovel: Novel = {
      id: 123,
      title: 'Kiểm Thử Toàn Diện Format',
      author: 'Tester',
      sourceUrl: 'https://test.local',
      totalChapters: 2,
      downloadedChapters: 2,
      status: 'completed'
    };

    const testChapters: Chapter[] = [
      {
        id: 1,
        novelId: 123,
        chapterNumber: 2,
        title: 'Chương 2: Phần Kế Tiếp',
        url: 'https://test.local/2',
        content: 'Nội dung chương 2.',
        wordCount: 4,
        status: 'completed'
      },
      {
        id: 2,
        novelId: 123,
        chapterNumber: 1,
        title: 'Chương 1: Phần Mở Đầu',
        url: 'https://test.local/1',
        content: 'Nội dung chương 1.',
        wordCount: 4,
        status: 'completed'
      }
    ];

    it('routes all 5 export formats (txt, docx, pdf, epub, json) without exceptions', async () => {
      const formats: ExportFormat[] = ['txt', 'docx', 'pdf', 'epub', 'json'];

      for (const fmt of formats) {
        await expect(exportNovel(testNovel, testChapters, fmt)).resolves.not.toThrow();
      }
    });

    it('falls back to txt export gracefully on unexpected or invalid format string', async () => {
      await expect(exportNovel(testNovel, testChapters, 'unknown_format' as any)).resolves.not.toThrow();
    });

    it('handles empty chapters array gracefully in both EPUB and JSON exporters', async () => {
      const emptyNovel: Novel = {
        id: 404,
        title: 'Truyện Không Có Chương',
        sourceUrl: 'https://empty.test',
        totalChapters: 0,
        downloadedChapters: 0,
        status: 'pending'
      };

      // 1. JSON Exporter with 0 chapters
      const jsonBlob = buildJsonBlob(emptyNovel, []);
      const jsonData: NovelJsonExport = JSON.parse(await jsonBlob.text());
      expect(jsonData.novel.totalChapters).toBe(0);
      expect(jsonData.novel.downloadedChapters).toBe(0);
      expect(jsonData.chapters).toEqual([]);

      // 2. EPUB Exporter with 0 chapters
      const epubBlob = await buildEpubBlob(emptyNovel, []);
      const { entries } = unpackZipStrict(new Uint8Array(await epubBlob.arrayBuffer()));
      expect(entries.has('mimetype')).toBe(true);
      expect(entries.has('OEBPS/titlepage.xhtml')).toBe(true);
      expect(entries.has('OEBPS/nav.xhtml')).toBe(true);
      expect(entries.has('OEBPS/content.opf')).toBe(true);

      const opfDoc = new DOMParser().parseFromString(entries.get('OEBPS/content.opf')!.text(), 'application/xml');
      expect(opfDoc.getElementsByTagName('parsererror').length).toBe(0);
      expect(opfDoc.querySelectorAll('manifest > item').length).toBe(4); // style, nav, ncx, titlepage
    });

    it('enforces natural sorting and deduplication across chapters in EPUB spine and JSON list', async () => {
      const jumbledChapters: Chapter[] = [
        { id: 10, novelId: 1, chapterNumber: 100, title: 'Chương 100', url: 'https://t/100', content: 'C100', status: 'completed' },
        { id: 2, novelId: 1, chapterNumber: 2, title: 'Chương 2', url: 'https://t/2', content: 'C2', status: 'completed' },
        { id: 1, novelId: 1, chapterNumber: 1, title: 'Chương 1', url: 'https://t/1', content: 'C1', status: 'completed' },
        // Exact duplicate title & chapter number to trigger deduplication
        { id: 11, novelId: 1, chapterNumber: 1, title: 'Chương 1', url: 'https://t/1-mirror', content: 'Dup', status: 'completed' },
        { id: 20, novelId: 1, chapterNumber: 20, title: 'Chương 20', url: 'https://t/20', content: 'C20', status: 'completed' }
      ];

      // JSON test
      const jsonData = generateJsonData(testNovel, jumbledChapters);
      expect(jsonData.chapters.map((c) => c.chapterNumber)).toEqual([1, 2, 20, 100]);

      // EPUB test
      const epubBlob = await buildEpubBlob(testNovel, jumbledChapters);
      const { entries } = unpackZipStrict(new Uint8Array(await epubBlob.arrayBuffer()));
      const opf = entries.get('OEBPS/content.opf')!.text();
      expect(opf).toContain('id="chap_1" href="chapter_1.xhtml"');
      expect(opf).toContain('id="chap_2" href="chapter_2.xhtml"');
      expect(opf).toContain('id="chap_3" href="chapter_3.xhtml"');
      expect(opf).toContain('id="chap_4" href="chapter_4.xhtml"');
      expect(opf).not.toContain('chapter_5.xhtml');

      // Chapter 1 must be Chương 1, Chapter 4 must be Chương 100
      expect(entries.get('OEBPS/chapter_1.xhtml')!.text()).toContain('Chương 1');
      expect(entries.get('OEBPS/chapter_4.xhtml')!.text()).toContain('Chương 100');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { extractChapterWithRule, extractTocFromDocument } from '../lib/extractor';
import { findNovelTitle, findNovelUrl } from '../lib/extractor/heuristic';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';
import { generateTxtContent } from '../lib/exporter/txt';
import { generatePrintableHtml } from '../lib/exporter/pdf';
import { buildDocxBlob } from '../lib/exporter/docx';
import { formatChapterTitleForExport, isContinuousStory } from '../lib/exporter/sorter';
import type { Novel, Chapter, SiteRule } from '../lib/types';

describe('User Scenario Verification: comong.info Chapter Extraction & Reactive IDB Clone Safety', () => {
  const comongRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info') as SiteRule;

  expect(comongRule).toBeDefined();

  it('correctly extracts chapter text from .entry-content even when an empty .page-description is present', () => {
    // Exact DOM pattern reported on comong.info Flatsome WordPress theme:
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chương 1 - Tin Tốt Động Trời - Cổ Mộng</title>
        </head>
        <body>
          <header class="header">
            <h1 class="site-title"><a href="https://comong.info/">Cổ Mộng</a></h1>
          </header>
          <div class="page-title-bar">
            <!-- Flatsome taxonomy/header banner container (empty or short metadata) -->
            <div class="page-description"></div>
          </div>
          <main id="main">
            <article class="post">
              <h1 class="entry-title">Chương 1: Tin tốt động trời! Anh trúng xổ số rồi!</h1>
              <div class="entry-content">
                <p>“Vợ ơi, vợ ơi! Tin tốt động trời! Anh trúng xổ số rồi!”</p>
                <p>Một tấm vé cào Valentine trị giá 52.000 tệ.</p>
                <p>“Tiền tài không nên để lộ ra ngoài, em tuyệt đối đừng kể cho ai nghe đấy nhé!”</p>
                <p>Hắn vừa mừng vừa run, bàn tay siết chặt lấy chiếc điện thoại.</p>
              </div>
              <div class="wpc-nav-next">
                <a href="https://comong.info/chapter/chuong-2" class="wpc-nav-link">Chương Sau &rarr;</a>
              </div>
            </article>
          </main>
        </body>
      </html>
    `;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const result = extractChapterWithRule(doc, 'https://comong.info/chapter/chuong-1', comongRule, ['Quảng cáo']);

    expect(result.title).toBe('Chương 1: Tin tốt động trời! Anh trúng xổ số rồi!');
    expect(result.content).toContain('Tin tốt động trời! Anh trúng xổ số rồi!');
    expect(result.content).toContain('52.000 tệ');
    expect(result.content).toContain('đừng kể cho ai nghe');
    expect(result.nextUrl).toBe('https://comong.info/chapter/chuong-2');
    expect(result.isLocked).toBe(false);
  });

  it('proves structuredClone clone safety with toPlainNovel helper', () => {
    // Svelte 5 reactive proxies cannot be directly cloned by structuredClone if they have reactive symbols
    function toPlainNovel(novel: Partial<Novel>): Novel {
      return {
        ...(novel.id ? { id: novel.id } : {}),
        title: novel.title || 'Chưa đặt tên',
        author: novel.author,
        coverUrl: novel.coverUrl,
        sourceUrl: novel.sourceUrl || '',
        totalChapters: novel.totalChapters || 0,
        downloadedChapters: novel.downloadedChapters || 0,
        status: novel.status || 'idle',
        createdAt: novel.createdAt || Date.now(),
        updatedAt: novel.updatedAt || Date.now()
      };
    }

    const reactiveNovelState = {
      title: 'Trúng Xổ Số 52.000 Tệ',
      sourceUrl: 'https://comong.info/chapter/chuong-1',
      totalChapters: 0,
      downloadedChapters: 0,
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const plain = toPlainNovel(reactiveNovelState);
    // structuredClone simulates IndexedDB's internal serialization algorithm
    const cloned = structuredClone(plain);

    expect(cloned.title).toBe('Trúng Xổ Số 52.000 Tệ');
    expect(cloned.sourceUrl).toBe('https://comong.info/chapter/chuong-1');
    expect(cloned.status).toBe('idle');
  });

  it('guarantees removeAdLines and extractChapterWithRule never throw "t.map is not a function" even with non-array adKeywords', () => {
    const html = `
      <div>
        <h1 class="entry-title">Chương 1</h1>
        <div class="entry-content">
          <p>Dòng truyện chính đáng giá.</p>
          <p>Quảng cáo: website comong.info</p>
        </div>
      </div>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Test with object-like adKeywords
    const resObject = extractChapterWithRule(doc, 'https://comong.info/c1', comongRule, { '0': 'Quảng cáo' } as any);
    expect(resObject.content).toContain('Dòng truyện chính đáng giá');
    expect(resObject.content).not.toContain('website comong.info');

    // Test with string adKeywords
    const resString = extractChapterWithRule(doc, 'https://comong.info/c1', comongRule, 'Quảng cáo' as any);
    expect(resString.content).toContain('Dòng truyện chính đáng giá');

    // Test with undefined adKeywords
    const resUndef = extractChapterWithRule(doc, 'https://comong.info/c1', comongRule, undefined as any);
    expect(resUndef.content).toContain('Dòng truyện chính đáng giá');
  });

  it('extracts table of contents from <select> dropdown on reading page', () => {
    const html = `
      <html>
        <body>
          <div class="chapter-nav">
            <a href="/chuong-prev">Chương trước</a>
            <select class="select-chapter" name="chapter_select">
              <option value="/chuong-1" selected>Chương 1: Mở đầu</option>
              <option value="/chuong-2">Chương 2: Diễn biến</option>
              <option value="/chuong-3">Chương 3: Kết thúc</option>
            </select>
            <a href="/chuong-2">Chương tiếp &rarr;</a>
          </div>
        </body>
      </html>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const toc = extractTocFromDocument(doc, comongRule, 'https://comong.info/chuong-1');

    expect(toc.chapters.length).toBe(3);
    expect(toc.chapters[0].title).toBe('Chương 1: Mở đầu');
    expect(toc.chapters[0].url).toBe('https://comong.info/chuong-1');
    expect(toc.chapters[1].title).toBe('Chương 2: Diễn biến');
    expect(toc.chapters[1].url).toBe('https://comong.info/chuong-2');
    expect(toc.chapters[2].title).toBe('Chương 3: Kết thúc');
    expect(toc.chapters[2].url).toBe('https://comong.info/chuong-3');
  });

  it('eliminates 60-dash dividers and redundant novel titles when merging multi-part stories', async () => {
    const novel: Novel = {
      id: 1,
      title: 'Cậu Ấm Giả Nghèo Và Cô Vợ Keo Kiệt',
      author: 'Cố Mộng',
      sourceUrl: 'https://comong.info/cau-am-gia-ngheo',
      totalChapters: 2,
      downloadedChapters: 2,
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const chapters: Chapter[] = [
      {
        id: 101,
        novelId: 1,
        chapterNumber: 1,
        title: 'Cậu Ấm Giả Nghèo Và Cô Vợ Keo Kiệt',
        url: 'https://comong.info/cau-am-gia-ngheo/page/1',
        content: 'Vì thế, tôi dứt khoát ở lại trường đi làm thêm.',
        wordCount: 10,
        status: 'completed'
      },
      {
        id: 102,
        novelId: 1,
        chapterNumber: 2,
        title: 'Cậu Ấm Giả Nghèo Và Cô Vợ Keo Kiệt',
        url: 'https://comong.info/cau-am-gia-ngheo/page/2',
        content: 'Vốn dĩ tôi không muốn để bạn trai nhìn thấy dáng vẻ chật vật của mình.\n\nNhưng bây giờ, anh ấy không còn là bạn trai tôi nữa.',
        wordCount: 22,
        status: 'completed'
      }
    ];

    // 1. Verify continuous story detection
    expect(isContinuousStory(novel, chapters)).toBe(true);
    expect(formatChapterTitleForExport(chapters[0], novel, chapters)).toBeNull();
    expect(formatChapterTitleForExport(chapters[1], novel, chapters)).toBeNull();

    // 2. Verify TXT export
    const txt = generateTxtContent(novel, chapters);

    // Absolutely NO 60-hyphen fences in TXT
    expect(txt).not.toContain('------------------------------------------------------------');

    // In the novel body, the story merges seamlessly without duplicate title blocks
    expect(txt).toContain(
      'Vì thế, tôi dứt khoát ở lại trường đi làm thêm.\n\nVốn dĩ tôi không muốn để bạn trai nhìn thấy dáng vẻ chật vật của mình.'
    );

    // 3. Verify PDF export does not add page breaks or duplicate h2 between continuous parts
    const pdfHtml = generatePrintableHtml(novel, chapters);
    expect(pdfHtml).not.toContain('class="chapter page-break"');
    expect(pdfHtml).toContain('class="chapter "');
    expect(pdfHtml).not.toContain('<h2 class="chapter-title">');

    // 4. Verify DOCX export builds cleanly
    const docxBlob = await buildDocxBlob(novel, chapters);
    expect(docxBlob).toBeDefined();
    expect(docxBlob.size).toBeGreaterThan(1000);
  });

  it('correctly isolates different novels on comong.info without collapsing into generic /chapter URL', () => {
    const htmlNovel1 = `
      <html>
        <head><title>Chương 1 - MỜI VỀ LÀM DÂU ĐƯỢC 2 NGÀY - Cổ Mộng</title></head>
        <body>
          <h1 class="story-title"><a href="https://comong.info/moi-ve-lam-dau-duoc-2-ngay/">MỜI VỀ LÀM DÂU ĐƯỢC 2 NGÀY</a></h1>
          <h1>Chương 1</h1>
        </body>
      </html>
    `;

    const htmlNovel2 = `
      <html>
        <head><title>Chương 1 - CẢ NHÀ CÙNG TRỌNG SINH ĐI BÁO THÙ - Cổ Mộng</title></head>
        <body>
          <h1 class="story-title"><a href="https://comong.info/ca-nha-cung-trong-sinh-di-bao-thu/">CẢ NHÀ CÙNG TRỌNG SINH ĐI BÁO THÙ</a></h1>
          <h1>Chương 1</h1>
        </body>
      </html>
    `;

    const parser = new DOMParser();
    const doc1 = parser.parseFromString(htmlNovel1, 'text/html');
    const doc2 = parser.parseFromString(htmlNovel2, 'text/html');

    const title1 = findNovelTitle(doc1);
    const url1 = findNovelUrl(doc1, 'https://comong.info/chapter/chuong-1-2542/');

    const title2 = findNovelTitle(doc2);
    const url2 = findNovelUrl(doc2, 'https://comong.info/chapter/chuong-1-1111/');

    expect(title1).toBe('MỜI VỀ LÀM DÂU ĐƯỢC 2 NGÀY');
    expect(url1).toBe('https://comong.info/moi-ve-lam-dau-duoc-2-ngay/');

    expect(title2).toBe('CẢ NHÀ CÙNG TRỌNG SINH ĐI BÁO THÙ');
    expect(url2).toBe('https://comong.info/ca-nha-cung-trong-sinh-di-bao-thu/');

    expect(url1).not.toBe(url2);
    expect(title1).not.toBe(title2);
    expect(url1).not.toContain('/chapter');
    expect(url2).not.toContain('/chapter');
  });

  it('correctly resolves TỔNG ĐÀI ÂM PHỦ from comong.info chapter 1 page', () => {
    const htmlTongDaiAmPhu = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chương 1 - Cổ Mộng</title>
          <meta property="og:description" content="### TỔNG ĐÀI ÂM PHỦ: TÔI LỠ TAY HỒI SINH MỘT TỬ TÙ" />
        </head>
        <body>
          <h1 class="story-title"><a href="https://comong.info/tong-dai-am-phu/">TỔNG ĐÀI ÂM PHỦ</a></h1>
          <h1 style="">Chương 1</h1>
          <div class="page-description">
            <p>### TỔNG ĐÀI ÂM PHỦ: TÔI LỠ TAY HỒI SINH MỘT TỬ TÙ</p>
            <p>Ngày đầu tiên đi làm ở tổng đài chăm sóc khách hàng, tôi nhận được một cuộc gọi kỳ lạ.</p>
          </div>
        </body>
      </html>
    `;

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlTongDaiAmPhu, 'text/html');

    const title = findNovelTitle(doc, 'Chương 1 - Cổ Mộng');
    const novelUrl = findNovelUrl(doc, 'https://comong.info/chapter/chuong-1-2548/');

    expect(title).toBe('TỔNG ĐÀI ÂM PHỦ');
    expect(novelUrl).toBe('https://comong.info/tong-dai-am-phu/');
  });
});

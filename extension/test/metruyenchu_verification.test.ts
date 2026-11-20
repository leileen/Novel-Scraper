import { describe, it, expect } from 'vitest';
import { extractChapterWithRule, extractTocFromDocument } from '../lib/extractor';
import { findNovelTitle, findChapterTitle, findNextChapterUrl } from '../lib/extractor/heuristic';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';
import { CrawlManager } from '../lib/crawler';
import type { SiteRule } from '../lib/types';

describe('Mê Truyện Chữ (metruyenchu.com.vn) Full Extraction & TOC Verification', () => {
  const mtcRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'metruyenchu.com.vn') as SiteRule;
  const parser = new DOMParser();

  // Mock Chapter Reading Page HTML (with breadcrumb, current-book, content, next chapter, and sidebar recommendations)
  const mockChapterReadingHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Chương 1: Ác mộng - Cao Võ: Đăng Nhập Tương Lai Một Vạn Năm</title></head>
      <body>
        <ul class="breadcrumb breadcrumbs">
          <li><a href="https://metruyenchu.com.vn">Mê Truyện Chữ</a></li>
          <li><a href="https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam">Cao Võ: Đăng Nhập Tương Lai Một Vạn Năm</a></li>
          <li><a href="https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-1-Qi5SkRKFdtcU">Chương 1: Ác mộng</a></li>
        </ul>
        <div class="chapter_wrap">
          <div class="chapter-title">
            <h1 class="current-book"><a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam">Cao Võ: Đăng Nhập Tương Lai Một Vạn Năm</a></h1>
            <h2 class="current-chapter"><a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-1-Qi5SkRKFdtcU">Chương 1: Ác mộng</a></h2>
          </div>
          <div class="chapter_control" id="gotochap">
            <a href="#" class="back disabled">《 Chương trước</a>
            <a href="javascript:void(0);" class="btn-dschuong"></a>
            <a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-2-w0mfCKmklGMH" class="next">Chương tiếp 》</a>
          </div>
          <div id="vungdoc">
            <div class="truyen">
              <p>Phó Sàn Dương đứng trước cổng Võ Lâm Minh, ngẩng đầu nhìn lên bầu trời âm u dày đặc mây đen.</p>
              <p>Đêm nay, sẽ là một đêm không bình yên.</p>
              <p>Hắn siết chặt thanh trường kiếm trong tay, từng bước tiến vào đại điện.</p>
            </div>
          </div>
          <div class="chapter_control">
            <a href="#" class="back disabled">《 Chương trước</a>
            <a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-2-w0mfCKmklGMH" class="next">Chương tiếp 》</a>
          </div>
        </div>
        <!-- Sidebar recommendations that previously tricked heuristic TOC scraper -->
        <div class="book-relate">
          <div class="item">
            <a href="/phong-than-chau">Phong Thần Châu</a>
            <div class="ichapter"><a href="/phong-than-chau/chuong-11017-ADuZ9v2d0CZp">11017 chương</a></div>
          </div>
          <div class="item">
            <a href="/tren-nguoi-ta-co-mot-con-rong">Trên Người Ta Có Một Con Rồng</a>
            <div class="ichapter"><a href="/tren-nguoi-ta-co-mot-con-rong/chuong-1381-4GLHgEDDKWlC">1381 chương</a></div>
          </div>
          <div class="item">
            <a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam">Cao Võ</a>
            <div class="ichapter"><a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-659-qHUF0p8Zv9no">659 chương</a></div>
          </div>
        </div>
      </body>
    </html>
  `;

  // Generate mock story page with 100 chapters and AJAX pagination controls
  const chaptersListHtml = Array.from({ length: 100 }, (_, i) => {
    const num = i + 1;
    return `<li><a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-${num}-hash${num}">Chương ${num}: Tiêu đề ${num}</a></li>`;
  }).join('\n');

  const mockStoryHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Cao Võ: Đăng Nhập Tương Lai Một Vạn Năm</title></head>
      <body>
        <h1 class="story-title">Cao Võ: Đăng Nhập Tương Lai Một Vạn Năm</h1>
        <div id="chapter-list">
          <div class="clearfix">
            <ul>${chaptersListHtml}</ul>
          </div>
          <div class="paging">
            <a class="active" href="javascript:void(0)">1</a>
            <a href="javascript:void(0)" onclick="page(33509,2);">2</a>
            <a href="javascript:void(0)" onclick="page(33509,3);">3</a>
            <a href="javascript:void(0)" onclick="page(33509,7);">Cuối»</a>
          </div>
        </div>
      </body>
    </html>
  `;

  const chapterDoc = parser.parseFromString(mockChapterReadingHtml, 'text/html');
  const storyDoc = parser.parseFromString(mockStoryHtml, 'text/html');

  it('correctly extracts chapter content, title, novel title, and next URL from chapter reading page', () => {
    const extracted = extractChapterWithRule(
      chapterDoc,
      'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-1-Qi5SkRKFdtcU',
      mtcRule,
      [],
      { deobfuscate: true }
    );

    expect(extracted.title).toBe('Chương 1: Ác mộng');
    expect(extracted.novelTitle).toBe('Cao Võ: Đăng Nhập Tương Lai Một Vạn Năm');
    expect(extracted.nextUrl).toBe('https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-2-w0mfCKmklGMH');
    expect(extracted.content).toContain('Phó Sàn Dương đứng trước cổng Võ Lâm Minh');
  });

  it('filters out sidebar recommendations and navigation buttons on reading page (0 TOC chapters returned so crawler redirects to story page)', () => {
    const toc = extractTocFromDocument(
      chapterDoc,
      mtcRule,
      'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-1-Qi5SkRKFdtcU'
    );

    // Reading page should NOT return the 11 sidebar recommendation chapters or "11017 chương"
    expect(toc.chapters.length).toBe(0);
  });

  it('extracts table of contents and AJAX pagination from novel story page', () => {
    const toc = extractTocFromDocument(
      storyDoc,
      mtcRule,
      'https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam'
    );

    expect(toc.chapters.length).toBe(100);
    expect(toc.chapters[0].title).toBe('Chương 1: Tiêu đề 1');
    expect(toc.chapters[0].url).toBe('https://metruyenchu.com.vn/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-1-hash1');
    expect(toc.chapters[99].title).toBe('Chương 100: Tiêu đề 100');

    // Verifies AJAX pagination endpoint is detected for page 2
    expect(toc.nextPaginationUrl).toBe('https://metruyenchu.com.vn/get/listchap/33509?page=2');
  });

  it('detects next AJAX pagination page when querying /get/listchap endpoint with full 100 chapters', () => {
    const mock100Chapters = Array.from({ length: 100 }, (_, i) => {
      const num = 101 + i;
      return `<li><a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-${num}-hash">Chương ${num}: ABC</a></li>`;
    }).join('\n');

    const mockAjaxDoc = parser.parseFromString(`
      <div class="clearfix">
        <ul>${mock100Chapters}</ul>
      </div>
    `, 'text/html');

    const toc = extractTocFromDocument(
      mockAjaxDoc,
      mtcRule,
      'https://metruyenchu.com.vn/get/listchap/33509?page=2'
    );

    expect(toc.chapters.length).toBe(100);
    expect(toc.chapters[0].title).toBe('Chương 101: ABC');
    expect(toc.nextPaginationUrl).toBe('https://metruyenchu.com.vn/get/listchap/33509?page=3');
  });

  it('stops pagination on the final /get/listchap page when chapter count is less than 100', () => {
    const mockFinalChapters = Array.from({ length: 59 }, (_, i) => {
      const num = 601 + i;
      return `<li><a href="/cao-vo-dang-nhap-tuong-lai-mot-van-nam/chuong-${num}-hash">Chương ${num}: End</a></li>`;
    }).join('\n');

    const mockFinalDoc = parser.parseFromString(`
      <div class="clearfix">
        <ul>${mockFinalChapters}</ul>
      </div>
    `, 'text/html');

    const toc = extractTocFromDocument(
      mockFinalDoc,
      mtcRule,
      'https://metruyenchu.com.vn/get/listchap/33509?page=7'
    );

    expect(toc.chapters.length).toBe(59);
    // Page 7 has 59 (< 100) chapters, so it must not generate a nextPaginationUrl
    expect(toc.nextPaginationUrl).toBeUndefined();
  });

  it('verifies preset domain aliases exist for Mê Truyện Chữ variants', () => {
    const domains = DEFAULT_SITE_RULES.map((r) => r.domain);
    expect(domains).toContain('metruyenchu.com.vn');
    expect(domains).toContain('metruyenchuvn.com');
    expect(domains).toContain('metruyencv.com');
    expect(domains).toContain('metruyencv.us');
  });
});

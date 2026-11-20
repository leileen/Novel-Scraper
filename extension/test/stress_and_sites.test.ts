import { describe, it, expect } from 'vitest';
import { naturalSortChapters, detectMissingChapters } from '../lib/exporter/sorter';
import { generateTxtContent } from '../lib/exporter/txt';
import { extractChapterWithRule, extractTocFromDocument } from '../lib/extractor';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';
import { sanitizeHtmlContent } from '../lib/sanitizer';
import type { Novel, Chapter, SiteRule } from '../lib/types';

describe('Giai đoạn 7: Multi-site Extraction & 1,500 Chapters Stress Test', () => {
  // 1. Multi-site extraction tests
  describe('Multi-site Extraction Coverage', () => {
    it('Site 1: Should extract cleanly from Cổ Mộng (comong.info) structure', () => {
      const comongRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info') as SiteRule;
      const html = `
        <html>
          <head><title>Chương 1: Gặp lại cố nhân - Cổ Mộng</title></head>
          <body>
            <div id="content">
              <h1 class="story-title"><a href="https://comong.info/muoi-muoi-chon-chong-ta-chon-hoa-ly/">Muội Muội Chọn Chồng, Ta Chọn Hòa Ly</a></h1>
              <h1 style="">Chương 1: Gặp lại cố nhân</h1>
              <div class="page-description">
                <div class="ads">Quảng cáo độc quyền comong.info</div>
                <p>Mưa rơi rả rích trên mái hiên trà quán bên hồ Tây.</p>
                <p>Cố Khinh Chu ngồi bên cửa sổ, tay mân mê chén trà bích loa xuân còn bốc khói.</p>
                <div class="w2w_read_more readmore_close_button"><a href="#"><span>Thu gọn nội dung</span></a></div>
                <div class="w2w_read_more readmore_open_button"><a href="#"><span>Xem thêm nội dung</span></a></div>
                <div class="post-ad">Banner liên hệ tài trợ</div>
              </div>
              <div class="wpc-chapter-nav-simple">
                <div class="wpc-nav-next">
                  <a href="/chuong-2" class="wpc-nav-link">Chương tiếp →</a>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://comong.info/chuong-1', comongRule, ['Quảng cáo']);

      expect(result.title).toBe('Chương 1: Gặp lại cố nhân');
      expect(result.content).toContain('Mưa rơi rả rích trên mái hiên');
      expect(result.content).toContain('Cố Khinh Chu ngồi bên cửa sổ');
      expect(result.content).not.toContain('Quảng cáo độc quyền');
      expect(result.content).not.toContain('Banner liên hệ');
      expect(result.content).not.toContain('Thu gọn nội dung');
      expect(result.content).not.toContain('Xem thêm nội dung');
      expect(result.nextUrl).toBe('https://comong.info/chuong-2');
    });

    it('Site 1b: Should extract comong.info TOC and resolve relative chapter URLs', () => {
      const comongRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info') as SiteRule;
      const tocHtml = `
        <html>
          <body>
            <div class="chapter-list-container">
              <div class="chapter-list-grid">
                <div class="chapter-item"><a href="/chapter/chuong-1-2526/">Chương 1</a></div>
                <div class="chapter-item"><a href="/chapter/chuong-2-2523/">Chương 2</a></div>
              </div>
            </div>
          </body>
        </html>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const { chapters } = extractTocFromDocument(doc, comongRule, 'https://comong.info/novel-slug/');

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('Chương 1');
      expect(chapters[0].url).toBe('https://comong.info/chapter/chuong-1-2526/');
      expect(chapters[1].title).toBe('Chương 2');
      expect(chapters[1].url).toBe('https://comong.info/chapter/chuong-2-2523/');
    });

    it('Site 2: Should extract cleanly from TruyệnFull (truyenfull.vn) structure', () => {
      const truyenfullRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'truyenfull.vn') as SiteRule;
      const html = `
        <html>
          <body>
            <h2 class="chapter-title">Chương 100: Đại chiến Hắc Phong Lĩnh</h2>
            <div id="chapter-c" class="chapter-c">
              <div class="adsbygoogle">Google AdSense</div>
              <p>Tiếng hò reo vang trời dậy đất, cát bụi mù mịt.</p>
              <p>Lý Mục rút thanh trường kiếm bên hông ra, kiếm khí tung hoành ba ngàn trượng.</p>
            </div>
            <a id="next_chap" href="https://truyenfull.vn/chuong-101">Chương sau</a>
          </body>
        </html>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://truyenfull.vn/chuong-100', truyenfullRule);

      expect(result.title).toBe('Chương 100: Đại chiến Hắc Phong Lĩnh');
      expect(result.content).toContain('Tiếng hò reo vang trời dậy đất');
      expect(result.content).not.toContain('Google AdSense');
      expect(result.nextUrl).toBe('https://truyenfull.vn/chuong-101');
    });

    it('Site 3: Should extract cleanly from Tàng Thư Viện (truyen.tangthuvien.vn) structure', () => {
      const ttvRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'truyen.tangthuvien.vn') as SiteRule;
      const html = `
        <html>
          <body>
            <h1 class="truyen-title">Chương 50: Thu phục linh thú</h1>
            <div class="box-chap">
              <div class="box-ads">Banner quảng cáo</div>
              <p>Con Hỏa Kỳ Lân gầm lên một tiếng chấn động núi rừng.</p>
              <p>Nó từ từ cúi đầu thần phục trước luồng uy áp chí tôn.</p>
            </div>
            <a class="btn-next" href="https://truyen.tangthuvien.vn/chap-51">Chương tiếp</a>
          </body>
        </html>
      `;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const result = extractChapterWithRule(doc, 'https://truyen.tangthuvien.vn/chap-50', ttvRule);

      expect(result.title).toBe('Chương 50: Thu phục linh thú');
      expect(result.content).toContain('Con Hỏa Kỳ Lân gầm lên một tiếng');
      expect(result.content).not.toContain('Banner quảng cáo');
      expect(result.nextUrl).toBe('https://truyen.tangthuvien.vn/chap-51');
    });

    it('Site 4: Should bypass anti-copy tricks (invisible zero-width traps & injected spans)', () => {
      const antiCopyHtml = `
        <div id="content">
          <p>Hôm\u200B nay \u200Cchúng \u200Dta cùng \uFEFFnhau đọc truyện.</p>
          <p>Đoạn văn này có <span style="display:none">anti-scraper trap text</span>nội dung hoàn toàn sạch sẽ.</p>
        </div>
      `;
      const sanitized = sanitizeHtmlContent(antiCopyHtml);
      expect(sanitized).toBe('Hôm nay chúng ta cùng nhau đọc truyện.\n\nĐoạn văn này có nội dung hoàn toàn sạch sẽ.');
      expect(sanitized).not.toContain('\u200B');
      expect(sanitized).not.toContain('\u200C');
      expect(sanitized).not.toContain('\u200D');
      expect(sanitized).not.toContain('\uFEFF');
    });

    it('Site 5: Should parse paginated TOC and extract links correctly', () => {
      const tocHtml = `
        <div>
          <ul class="list-chapter">
            <li><a href="https://site5.com/c1">Quyển 1 - Chương 1: Thiếu niên áo trắng</a></li>
            <li><a href="https://site5.com/c2">Quyển 1 - Chương 2: Bước chân vào giang hồ</a></li>
          </ul>
          <div class="pagination">
            <a class="next" href="https://site5.com/toc?page=2">Trang 2</a>
          </div>
        </div>
      `;
      const doc = new DOMParser().parseFromString(tocHtml, 'text/html');
      const { chapters, nextPaginationUrl } = extractTocFromDocument(doc);
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toContain('Chương 1');
      expect(nextPaginationUrl).toBe('https://site5.com/toc?page=2');
    });
  });

  // 2. High-volume Stress Test (1,500 chapters)
  describe('High-volume 1,500 Chapters Stress Test', () => {
    const novel1500: Novel = {
      id: 99,
      title: 'Phàm Nhân Tu Tiên Chi Giới Ngoại Biến',
      author: 'Vong Ngữ',
      sourceUrl: 'https://example.com/pham-nhan-1500',
      totalChapters: 1500,
      downloadedChapters: 1500,
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    it('should generate, naturally sort, and detect missing chapters in 1,500 chapters efficiently', () => {
      const generatedChapters: Chapter[] = [];
      const startTime = performance.now();

      // Create 1500 chapters with random shuffling and deliberately miss chapter 555 and 1024
      for (let i = 1; i <= 1500; i++) {
        if (i === 555 || i === 1024) continue; // intentional missing

        generatedChapters.push({
          id: i,
          novelId: 99,
          chapterNumber: i,
          title: `Chương ${i}: Tu đạo ngàn năm chương số ${i}`,
          url: `https://example.com/chap-${i}`,
          content: `Hàn Lập ngẩng đầu nhìn lên bầu trời, mây mù cuồn cuộn không dứt. Lôi kiếp thứ ${i} đang ầm ầm giáng xuống. Tâm niệm hắn vừa động, Thanh Trúc Phong Vân Kiếm lập tức hóa thành kiếm trận vây kín hư không.`,
          wordCount: 35,
          status: 'completed'
        });
      }

      // Shuffle array to simulate out-of-order download arrivals
      generatedChapters.sort(() => Math.random() - 0.5);

      // Sort naturally
      const sorted = naturalSortChapters(generatedChapters);
      expect(sorted[0].chapterNumber).toBe(1);
      expect(sorted[sorted.length - 1].chapterNumber).toBe(1500);

      // Detect missing chapters
      const missing = detectMissingChapters(sorted);
      expect(missing).toEqual([555, 1024]);

      // Generate TXT stream string for all 1,498 chapters
      const txtOutput = generateTxtContent(novel1500, sorted);
      expect(txtOutput.startsWith('\uFEFF')).toBe(true);
      expect(txtOutput).toContain('TỔNG SỐ CHƯƠNG: 1498');
      expect(txtOutput).toContain('Chương 1500: Tu đạo ngàn năm');

      const endTime = performance.now();
      const elapsedMs = endTime - startTime;

      // Ensure 1,500 chapters process within a few hundred milliseconds without choking
      expect(elapsedMs).toBeLessThan(1500);
      console.log(`[Stress Test] 1,500 chapters sorted, verified, and formatted in ${elapsedMs.toFixed(1)}ms`);
    });
  });
});

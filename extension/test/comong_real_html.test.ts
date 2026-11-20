import { describe, it, expect } from 'vitest';
import { extractChapterWithRule, extractTocFromDocument } from '../lib/extractor';
import { findNovelTitle } from '../lib/extractor/heuristic';
import { DEFAULT_SITE_RULES } from '../lib/db/presets';
import type { SiteRule } from '../lib/types';

describe('Real comong.info DOM Verification & Novel Title File Naming Engine', () => {
  const comongRule = DEFAULT_SITE_RULES.find((r) => r.domain === 'comong.info') as SiteRule;

  // Build exact DOM layout of comong.info WordPress Flatsome theme
  const comongHtml = `
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <title>Chương 1 - Cổ Mộng</title>
      </head>
      <body>
        <section class="section story-content">
          <h1 class="story-title"><a href="https://comong.info/story/nua-dem-toi-nhan-duoc-tin-nhan/">NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN</a></h1>
          <h1 class="chapter-title">Chương 1</h1>
          <div class="wpc-chapter-nav-simple">
            <div class="wpc-nav-prev"><span class="wpc-nav-disabled">&larr; Chương trước</span></div>
            <div class="wpc-chapter-select">
              <select name="select_chapter">
                ${Array.from({ length: 20 }, (_, i) => `<option value="https://comong.info/chapter/chuong-${i + 1}-2540/">Chương ${i + 1}</option>`).join('\n')}
              </select>
            </div>
            <div class="wpc-nav-next">
              <a href="https://comong.info/chapter/chuong-2-2537/" class="wpc-nav-link">Chương tiếp &rarr;</a>
            </div>
          </div>
          <div class="page-description" style="font-size: 26px;">
            <p>NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN LY H/Ô/N TỪ CHỒNG. NHƯNG KHI NGOẢNH LẠI, HẮN VẪN ĐANG NGỦ SAY, ĐIỆN THOẠI CHƯA TỪNG ĐƯỢC CHẠM VÀO.</p>
            <p>Giữa đêm khuya tĩnh mịch, màn hình chiếc điện thoại của Lục Thành Hạo bất ngờ phát sáng trên giá sạc đặt tại phòng khách.</p>
            <p>Một tin nhắn WeChat vừa được gửi đi, nội dung vỏn vẹn: “Chúng ta ly h/ô/n đi. Sáng mai đến cục dân chính.”</p>
            ${Array.from({ length: 94 }, (_, i) => `<p>Đoạn văn tự sự số ${i + 4}: Tình tiết câu chuyện diễn biến bất ngờ và sâu sắc hơn.</p>`).join('\n')}
            <p>Bàn tay đang cầm điện thoại vô thức siết lại.</p>
          </div>
        </section>
      </body>
    </html>
  `;

  const parser = new DOMParser();
  const doc = parser.parseFromString(comongHtml, 'text/html');

  it('verifies that full story content (all paragraphs) and novelTitle are extracted from comong.info with preset rule', () => {
    const result = extractChapterWithRule(
      doc,
      'https://comong.info/chapter/chuong-1-2540/',
      comongRule,
      [],
      { deobfuscate: true }
    );

    expect(result.title).toBe('Chương 1');
    expect(result.novelTitle).toBe('NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN');
    expect(result.nextUrl).toBe('https://comong.info/chapter/chuong-2-2537/');
    expect(result.content.length).toBeGreaterThan(3000);
    // Verifies deobfuscator handled "LY H/Ô/N" -> "LY HÔN"
    expect(result.content).toContain('LY HÔN TỪ CHỒNG');
    expect(result.content).toContain('Chúng ta ly hôn đi');
    expect(result.content).toContain('Một tin nhắn WeChat vừa được gửi đi');
  });

  it('guarantees that even if user mouse-picked or configured contentSelector as "p", ALL paragraphs are extracted instead of just the first sentence', () => {
    const userPickedRule: SiteRule = {
      ...comongRule,
      contentSelector: 'p'
    };

    const result = extractChapterWithRule(
      doc,
      'https://comong.info/chapter/chuong-1-2540/',
      userPickedRule,
      [],
      { deobfuscate: true }
    );

    // Multi-element combiner combines all 97+ <p> elements!
    expect(result.content.length).toBeGreaterThan(3000);
    expect(result.content).toContain('Một tin nhắn WeChat vừa được gửi đi');
    expect(result.content).toContain('Bàn tay đang cầm điện thoại vô thức siết lại');
  });

  it('verifies TOC extraction captures all 20 chapters from dropdown <select> on comong.info reading page', () => {
    const toc = extractTocFromDocument(doc, comongRule, 'https://comong.info/chapter/chuong-1-2540/');

    expect(toc.chapters.length).toBe(20);
    expect(toc.chapters[0].title).toBe('Chương 1');
    expect(toc.chapters[0].url).toBe('https://comong.info/chapter/chuong-1-2540/');
    expect(toc.chapters[1].title).toBe('Chương 2');
    expect(toc.chapters[19].title).toBe('Chương 20');
  });

  it('verifies findNovelTitle extracts novel name from .story-title instead of "Chương 1"', () => {
    const detected = findNovelTitle(doc, 'Chương 1 - Cổ Mộng');
    expect(detected).toBe('NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN');
  });
});

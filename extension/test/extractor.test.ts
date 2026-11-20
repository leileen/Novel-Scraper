import { describe, it, expect } from 'vitest';
import { extractChapterHeuristically } from '../lib/extractor/heuristic';
import { extractChapterWithRule, extractTocFromDocument } from '../lib/extractor';
import type { SiteRule } from '../lib/types';

describe('Heuristic and Rule Extractor', () => {
  it('should heuristically extract title, content, and next URL from an arbitrary HTML page', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chương 10: Trùng Phùng - Đại Phụng Đả Canh Nhân</title>
        </head>
        <body>
          <header><div class="nav">Trang chủ > Truyện</div></header>
          <div class="content-wrapper">
            <h1 class="chapter-title">Chương 10: Trùng Phùng</h1>
            <div class="reading-content">
              <p>Gió đêm thổi qua nhè nhẹ, làm lay động vạt áo xanh của Hứa Thất An.</p>
              <p>Hắn nhìn bóng người đối diện, ánh mắt lóe lên một tia thâm trầm và suy tư.</p>
              <p>Không ai ngờ rằng sau ba năm xa cách, bọn họ lại gặp nhau trong tình cảnh như thế này.</p>
            </div>
            <div class="nav-next">
              <a href="https://example.com/chuong-11" class="next-chapter">Chương Sau »</a>
            </div>
          </div>
          <footer>Footer text</footer>
        </body>
      </html>
    `;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const result = extractChapterHeuristically(doc, 'https://example.com/chuong-10');

    expect(result.title).toContain('Chương 10: Trùng Phùng');
    expect(result.content).toContain('Gió đêm thổi qua nhè nhẹ');
    expect(result.content).toContain('Không ai ngờ rằng sau ba năm xa cách');
    expect(result.nextUrl).toBe('https://example.com/chuong-11');
    expect(result.isLocked).toBe(false);
  });

  it('should extract using a specific SiteRule', () => {
    const rule: SiteRule = {
      domain: 'comong.info',
      name: 'Cổ Mộng',
      contentSelector: '#custom-box',
      titleSelector: '.my-title',
      nextSelector: '#my-next',
      isPreset: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const html = `
      <html>
        <body>
          <div class="my-title">Chương 5: Bắt Đầu</div>
          <div id="custom-box">
            <p>Nội dung chương 5 đặc biệt cào qua luật riêng.</p>
          </div>
          <a id="my-next" href="https://comong.info/chap-6">Tiếp</a>
        </body>
      </html>
    `;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const result = extractChapterWithRule(doc, 'https://comong.info/chap-5', rule);

    expect(result.title).toBe('Chương 5: Bắt Đầu');
    expect(result.content).toBe('Nội dung chương 5 đặc biệt cào qua luật riêng.');
    expect(result.nextUrl).toBe('https://comong.info/chap-6');
  });

  it('should extract Table of Contents and pagination link correctly', () => {
    const html = `
      <html>
        <body>
          <ul class="list-chapter">
            <li><a href="https://example.com/c1">Chương 1: Khởi đầu</a></li>
            <li><a href="https://example.com/c2">Chương 2: Bước ngoặt</a></li>
            <li><a href="https://example.com/c3">Chương 3: Tiến triển</a></li>
          </ul>
          <div class="pagination">
            <a class="next" href="https://example.com/page-2">Trang sau</a>
          </div>
        </body>
      </html>
    `;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const { chapters, nextPaginationUrl } = extractTocFromDocument(doc);

    expect(chapters).toHaveLength(3);
    expect(chapters[0].title).toBe('Chương 1: Khởi đầu');
    expect(chapters[0].url).toBe('https://example.com/c1');
    expect(chapters[2].chapterNumber).toBe(3);
    expect(nextPaginationUrl).toBe('https://example.com/page-2');
  });
});

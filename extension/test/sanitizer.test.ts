import { describe, it, expect } from 'vitest';
import {
  normalizeUnicodeAndCleanChars,
  removeAdLines,
  formatParagraphs,
  countWords,
  sanitizeHtmlContent,
  sanitizeHtmlString,
  parseSafeHtmlDocument
} from '../lib/sanitizer';

describe('Sanitizer Pipeline', () => {
  it('should normalize Unicode to NFC and strip invisible zero-width characters', () => {
    // String with zero-width space (\u200B) and zero-width joiner (\u200D)
    const messy = 'Ch\u200Bương 1: \u200DLời mở đầu\uFEFF';
    const cleaned = normalizeUnicodeAndCleanChars(messy);
    expect(cleaned).toBe('Chương 1: Lời mở đầu');
  });

  it('should remove lines containing ad keywords', () => {
    const raw = `Đoạn văn đầu tiên của câu chuyện.
Truyện được đăng tại website abc.xyz xin vui lòng đọc ủng hộ.
Đoạn văn tiếp theo rất hấp dẫn.
Nguồn: truyenfull.vn
Kết thúc chương.`;

    const cleaned = removeAdLines(raw, ['Truyện được đăng tại', 'Nguồn:']);
    expect(cleaned).toContain('Đoạn văn đầu tiên của câu chuyện.');
    expect(cleaned).toContain('Đoạn văn tiếp theo rất hấp dẫn.');
    expect(cleaned).toContain('Kết thúc chương.');
    expect(cleaned).not.toContain('Truyện được đăng tại');
    expect(cleaned).not.toContain('Nguồn:');
  });

  it('should properly format paragraphs and collapse multiple empty lines', () => {
    const raw = `  Đoạn một   

       
  Đoạn hai     


  Đoạn ba   `;

    const formatted = formatParagraphs(raw);
    expect(formatted).toBe('Đoạn một\n\nĐoạn hai\n\nĐoạn ba');
  });

  it('should accurately count Vietnamese words', () => {
    const text = 'Hôm nay trời rất đẹp, tôi đi dạo công viên.';
    expect(countWords(text)).toBe(10);
  });

  it('should strip inline event handlers and scripts from raw HTML before parsing to prevent CSP violations', () => {
    const rawMaliciousHtml = `
      <html>
        <body onload="alert('pwned')" onpageshow="track()">
          <h1 onclick="doSomething()">Tiêu Đề Chương 1</h1>
          <select onchange="window.location.href=this.value">
            <option value="/1">Chương 1</option>
          </select>
          <div class="reading-content" oncopy="preventCopy()">
            <p>Nội dung đoạn 1 có chữ on trong text nhưng không phải event.</p>
            <img src="x" onerror="evil()" />
            <script>console.log('malicious script');</script>
            <noscript><img src="track.png" /></noscript>
            <a href="javascript:void(0)" onclick="clickMe()">Bấm vào đây</a>
          </div>
        </body>
      </html>
    `;

    const cleanedHtml = sanitizeHtmlString(rawMaliciousHtml);
    expect(cleanedHtml).not.toMatch(/\sonload\s*=/i);
    expect(cleanedHtml).not.toMatch(/\sonpageshow\s*=/i);
    expect(cleanedHtml).not.toMatch(/\sonclick\s*=/i);
    expect(cleanedHtml).not.toMatch(/\sonchange\s*=/i);
    expect(cleanedHtml).not.toMatch(/\soncopy\s*=/i);
    expect(cleanedHtml).not.toMatch(/\sonerror\s*=/i);
    expect(cleanedHtml).toContain('data-onclick=');
    expect(cleanedHtml).toContain('data-onload=');
    expect(cleanedHtml).not.toContain('<script');
    expect(cleanedHtml).not.toContain('<noscript');
    expect(cleanedHtml).not.toContain('javascript:');
    // Content should remain intact
    expect(cleanedHtml).toContain('Nội dung đoạn 1 có chữ on trong text');

    // Test parseSafeHtmlDocument produces a clean document without any inline on* attributes
    const doc = parseSafeHtmlDocument(rawMaliciousHtml);
    const allElements = Array.from(doc.querySelectorAll('*'));
    for (const el of allElements) {
      for (const attr of el.getAttributeNames()) {
        expect(attr.toLowerCase().startsWith('on')).toBe(false);
      }
    }
    expect(doc.querySelector('h1')?.textContent).toBe('Tiêu Đề Chương 1');
  });
});

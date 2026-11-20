import { describe, it, expect } from 'vitest';
import { deobfuscateWordSlashes, applyCustomReplacements, sanitizeHtmlContent } from '../lib/sanitizer';

describe('Smart Anti-Censorship De-obfuscator (Mục 9.1)', () => {
  it('correctly deobfuscates user requested example: "g/h/e/n t/u/ô/n/g" -> "ghen tuông"', () => {
    const raw = 'Hắn ta g/h/e/n t/u/ô/n/g đến phát điên.';
    const result = deobfuscateWordSlashes(raw);
    expect(result).toBe('Hắn ta ghen tuông đến phát điên.');
  });

  it('correctly deobfuscates multiple sensitive words separated by slashes and preserves diacritics', () => {
    const raw = 'Hắn có hành vi c/ư/ỡ/n/g b/ứ/c và k/h/ỏ/a t/h/â/n, vô cùng b/ạ/o l/ự/c.';
    const result = deobfuscateWordSlashes(raw);
    expect(result).toBe('Hắn có hành vi cưỡng bức và khỏa thân, vô cùng bạo lực.');
  });

  it('handles punctuation, quotation marks, and brackets wrapping obfuscated words', () => {
    const raw = 'Nàng kêu lên: “Anh đừng có g/h/e/n t/u/ô/n/g vớ vẩn!” (k/h/ố/n n/ạ/n!)';
    const result = deobfuscateWordSlashes(raw);
    expect(result).toBe('Nàng kêu lên: “Anh đừng có ghen tuông vớ vẩn!” (khốn nạn!)');
  });

  it('preserves casing accurately for Title Case and ALL CAPS', () => {
    expect(deobfuscateWordSlashes('G/h/e/n t/u/ô/n/g')).toBe('Ghen tuông');
    expect(deobfuscateWordSlashes('G/H/E/N T/U/Ô/N/G')).toBe('GHEN TUÔNG');
    expect(deobfuscateWordSlashes('g/h/e/n')).toBe('ghen');
  });

  it('handles optional whitespace around slashes and backslashes', () => {
    expect(deobfuscateWordSlashes('g / h / e / n')).toBe('ghen');
    expect(deobfuscateWordSlashes('t  /  u  /  ô  /  n  /  g')).toBe('tuông');
    expect(deobfuscateWordSlashes('g\\h\\e\\n')).toBe('ghen');
  });

  it('deobfuscates dot and dash separated words with 3 or more letters', () => {
    expect(deobfuscateWordSlashes('tên g.h.e.n t.u.ô.n.g này')).toBe('tên ghen tuông này');
    expect(deobfuscateWordSlashes('hành vi c-h-ế-t tiệt')).toBe('hành vi chết tiệt');
  });

  it('correctly deobfuscates 2-letter Vietnamese words when obfuscated', () => {
    expect(deobfuscateWordSlashes('hắn bảo đ/ụ m/ẹ')).toBe('hắn bảo đụ mẹ');
    expect(deobfuscateWordSlashes('người v/ợ hiền')).toBe('người vợ hiền');
  });

  describe('Zero False-Positive Guard (Bảo vệ tuyệt đối các từ ngữ và cú pháp thật)', () => {
    it('does NOT alter dates or numbers with slashes', () => {
      const dates = 'Ngày 12/04/2026 và 1/2/2025, tỷ lệ 1/2 hoặc 3/4.';
      expect(deobfuscateWordSlashes(dates)).toBe(dates);
    });

    it('does NOT alter URLs or web paths', () => {
      const urls = 'Xem tại https://comong.info/page/2 hoặc /chapter/1/part/2.';
      expect(deobfuscateWordSlashes(urls)).toBe(urls);
    });

    it('does NOT alter legitimate multi-letter word pairs with slashes', () => {
      const pairs = [
        'và/hoặc',
        'anh/chị',
        'ông/bà',
        'nam/nữ',
        'đúng/sai',
        'có/không',
        'trước/sau',
        'thắng/thua'
      ];
      for (const pair of pairs) {
        expect(deobfuscateWordSlashes(`Lựa chọn ${pair} cho hợp lý.`)).toBe(`Lựa chọn ${pair} cho hợp lý.`);
      }
    });

    it('does NOT alter physical units or scientific measurements', () => {
      const units = 'Vận tốc đạt 100 km/h và 10 m/s với điện thế 220 V/m.';
      expect(deobfuscateWordSlashes(units)).toBe(units);
    });

    it('does NOT alter acronyms like U.S.A', () => {
      const acronym = 'Đến từ U.S.A.';
      expect(deobfuscateWordSlashes(acronym)).toBe(acronym);
    });
  });

  describe('Pipeline Integration with sanitizeHtmlContent & applyCustomReplacements', () => {
    it('automatically deobfuscates text during HTML sanitization', () => {
      const html = `
        <div class="content">
          <p>Hắn ta g/h/e/n t/u/ô/n/g đến mức không kiềm chế được.</p>
          <p>Ngày 15/08/2026, anh/chị cần chú ý vận tốc 60 km/h.</p>
        </div>
      `;
      const cleaned = sanitizeHtmlContent(html);
      expect(cleaned).toContain('Hắn ta ghen tuông đến mức không kiềm chế được.');
      expect(cleaned).toContain('Ngày 15/08/2026, anh/chị cần chú ý vận tốc 60 km/h.');
    });

    it('applies custom find & replace rules effectively', () => {
      const text = 'Truyện convert bởi truyencv, nhân vật Tiêu Viêm xuất hiện.';
      const replacements = [
        { from: 'truyencv', to: '' },
        { from: 'Tiêu Viêm', to: 'Tiêu Viêm Ca' }
      ];
      const replaced = applyCustomReplacements(text, replacements);
      expect(replaced).toBe('Truyện convert bởi , nhân vật Tiêu Viêm Ca xuất hiện.');
    });
  });
});

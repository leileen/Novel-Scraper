import { describe, it, expect } from 'vitest';
import { removeAdLines, sanitizeHtmlContent } from '../lib/sanitizer';

describe('Milestone 2 Iteration 3 Adversarial Challenge: Remediated Content Sanitizer', () => {
  const defaultAdKeywords = ['nguồn', 'website', 'truyện', 'link'];

  // =========================================================================
  // Suite 1: Pathological Whitespace & Formatting Variations
  // =========================================================================
  describe('Suite 1: Pathological Whitespace & Formatting Variations', () => {
    it('1.1: Purges attribution ad lines with leading tabs, spaces, and mixed whitespace', () => {
      const adLinesWithWhitespace = [
        '\t\t   Nguồn gốc: convert từ qidian',
        '   \t Nguồn cội: TruyenFull',
        ' \t Nguồn gốc： TruyenYY \t  ',
        '\tNguồn gốc - Bàn Long Hội\t',
        'Nguồn gốc  \t  :  \t  convert từ qidian',
        '   Nguồn: truyenfull.vn   ',
        '\t\tNguồn - tangthuvien\t\t'
      ];

      for (const line of adLinesWithWhitespace) {
        const filtered = removeAdLines(line, defaultAdKeywords);
        expect(filtered.trim(), `Expected "${line.replace(/\t/g, '\\t')}" to be purged`).toBe('');
      }
    });

    it('1.2: Preserves genuine narrative prose with leading tabs, spaces, and indentation', () => {
      const narrativeWithWhitespace = [
        '\t\t   Nguồn gốc của hắn rất bí ẩn.',
        '   \t Nguồn nước trong suối rất ngọt ngào.',
        '\tNguồn năng lượng này cực kỳ to lớn và hung bạo.',
        '    Truyện kể rằng ngày xửa ngày xưa trên đỉnh núi cao.',
        '  \t  Hai người cùng chia sẻ khó khăn gian khổ.'
      ];

      for (const line of narrativeWithWhitespace) {
        const filtered = removeAdLines(line, defaultAdKeywords);
        expect(filtered, `Expected "${line.replace(/\t/g, '\\t')}" to be preserved`).toContain(line.trim());
      }
    });
  });

  // =========================================================================
  // Suite 2: Brackets & Enclosing Punctuation
  // =========================================================================
  describe('Suite 2: Brackets & Enclosing Punctuation', () => {
    it('2.1: Purges compound attribution lines enclosed in square brackets', () => {
      const squareBracketAds = [
        '[Nguồn gốc: convert từ qidian]',
        '[ Nguồn gốc : TruyenYY ]',
        '[Nguồn gốc：convert từ qidian]',
        '[Nguồn cội: TruyenFull]',
        '[Nguồn gốc - Bàn Long Hội]',
        '[[Nguồn gốc: convert từ qidian]]',
        ' [Nguồn: truyenfull] '
      ];

      for (const line of squareBracketAds) {
        const filtered = removeAdLines(line, defaultAdKeywords);
        expect(filtered.trim(), `Expected square-bracket ad "${line}" to be purged`).toBe('');
      }
    });

    it('2.2: Purges compound attribution lines enclosed in parentheses', () => {
      const parenAds = [
        '(Nguồn gốc: convert từ qidian)',
        '( Nguồn gốc : TruyenYY )',
        '(Nguồn gốc：convert từ qidian)',
        '(Nguồn cội: TruyenFull)',
        '(Nguồn gốc - Bàn Long Hội)',
        '((Nguồn gốc: convert từ qidian))',
        ' (Nguồn: truyenfull) '
      ];

      for (const line of parenAds) {
        const filtered = removeAdLines(line, defaultAdKeywords);
        expect(filtered.trim(), `Expected paren ad "${line}" to be purged`).toBe('');
      }
    });

    it('2.3: Preserves genuine prose within square brackets and parentheses', () => {
      const bracketProse = [
        '(Nguồn gốc của hắn rất bí ẩn theo truyền thuyết xưa kia)',
        '[Nguồn nước trong vắt này bắt nguồn từ đỉnh núi Thiên Sơn]',
        '(Nguồn năng lượng bùng nổ làm rung chuyển cả không gian)'
      ];

      for (const line of bracketProse) {
        const filtered = removeAdLines(line, defaultAdKeywords);
        expect(filtered, `Expected bracketed prose "${line}" to be preserved`).toContain(line);
      }
    });
  });

  // =========================================================================
  // Suite 3: Mixed Delimiters (ASCII Colon, Full-Width Colon, Hyphen-Minus)
  // =========================================================================
  describe('Suite 3: Mixed Delimiters (ASCII Colon, Full-Width Colon, Hyphen-Minus)', () => {
    it('3.1: Decisively purges lines with full-width colon (：)', () => {
      const fullWidthAds = [
        'Nguồn gốc：convert từ qidian',
        'Nguồn cội：TruyenFull',
        'Nguồn：truyenfull',
        'Dịch：Nhóm Dịch Tiên Hiệp',
        'Tác giả：Mực Thích Lặn Nước'
      ];

      for (const line of fullWidthAds) {
        const filtered = removeAdLines(line, ['nguồn', 'dịch', 'tác giả']);
        expect(filtered.trim(), `Expected full-width colon ad "${line}" to be purged`).toBe('');
      }
    });

    it('3.2: Decisively purges lines with ASCII colon (:)', () => {
      const asciiColonAds = [
        'Nguồn gốc: convert từ qidian',
        'Nguồn cội: TruyenFull',
        'Nguồn: truyenfull',
        'Dịch: Nhóm Dịch Tiên Hiệp',
        'Tác giả: Mực Thích Lặn Nước'
      ];

      for (const line of asciiColonAds) {
        const filtered = removeAdLines(line, ['nguồn', 'dịch', 'tác giả']);
        expect(filtered.trim(), `Expected ASCII colon ad "${line}" to be purged`).toBe('');
      }
    });

    it('3.3: Decisively purges lines with hyphen-minus (-)', () => {
      const hyphenAds = [
        'Nguồn gốc - Bàn Long Hội',
        'Nguồn cội - Nhóm Dịch ABC',
        'Nguồn - tangthuvien',
        'Dịch - Nhóm Tiên Hiệp',
        'Tác giả - Lão Trư'
      ];

      for (const line of hyphenAds) {
        const filtered = removeAdLines(line, ['nguồn', 'dịch', 'tác giả']);
        expect(filtered.trim(), `Expected hyphen ad "${line}" to be purged`).toBe('');
      }
    });
  });

  // =========================================================================
  // Suite 4: Uppercase & Mixed Case Attribution Headers
  // =========================================================================
  describe('Suite 4: Uppercase & Mixed Case Attribution Headers', () => {
    it('4.1: Purges uppercase NGUỒN GỐC:, NGUỒN CỘI:, and variations', () => {
      const upperAds = [
        'NGUỒN GỐC: CONVERT TỪ QIDIAN',
        'NGUỒN CỘI: TRUYENFULL',
        'NGUỒN: TRUYENFULL',
        '[NGUỒN GỐC: SƯU TẦM]',
        '(NGUỒN GỐC：TRUYENYY)',
        'NGUỒN GỐC - BÀN LONG HỘI',
        'DỊCH: NHÓM DỊCH VIP'
      ];

      for (const line of upperAds) {
        const filtered = removeAdLines(line, ['nguồn', 'dịch']);
        expect(filtered.trim(), `Expected uppercase ad "${line}" to be purged`).toBe('');
      }
    });

    it('4.2: Purges mixed-case attribution lines', () => {
      const mixedCaseAds = [
        'NgUồN gỐc: Convert Từ Qidian',
        'nGuỒn CộI：TruyenFull',
        'nGuỒn - BaN lOnG hOi'
      ];

      for (const line of mixedCaseAds) {
        const filtered = removeAdLines(line, ['nguồn']);
        expect(filtered.trim(), `Expected mixed-case ad "${line}" to be purged`).toBe('');
      }
    });

    it('4.3: Preserves uppercase genuine prose', () => {
      const upperProse = [
        'NGUỒN GỐC CỦA HẮN RẤT BÍ ẨN.',
        'NGUỒN NƯỚC Ở ĐÂY RẤT TRONG MÁT.',
        'NGUỒN NĂNG LƯỢNG NÀY CỰC KỲ TO LỚN!'
      ];

      for (const line of upperProse) {
        const filtered = removeAdLines(line, ['nguồn']);
        expect(filtered, `Expected uppercase prose "${line}" to be preserved`).toContain(line);
      }
    });
  });

  // =========================================================================
  // Suite 5: Long Strings (> 60 Characters) with Attribution Keywords
  // =========================================================================
  describe('Suite 5: Long Strings (> 60 Characters) with Attribution Keywords', () => {
    it('5.1: Purges long attribution ad lines (> 60 chars) with compound keywords and delimiters', () => {
      const longAdLines = [
        'Nguồn gốc: Được convert tự động từ nguyên tác bản tiếng Trung trên website mạng Qidian bởi dịch giả vô danh.', // 108 chars
        '[Nguồn cội: Bản dịch phi thương mại được thực hiện bởi nhóm đam mê tiên hiệp nhằm mục đích chia sẻ cùng bạn đọc]', // 112 chars
        'Nguồn gốc: TruyenYY - Diễn đàn đọc truyện online miễn phí với hàng ngàn đầu truyện chữ phong phú cập nhật liên tục.', // 115 chars
        'Nguồn gốc - Bàn Long Hội - Nơi giao lưu đàm đạo của các đạo hữu yêu thích truyện tiên hiệp và huyền huyễn dị giới.' // 114 chars
      ];

      for (const line of longAdLines) {
        expect(line.length).toBeGreaterThan(60);
        const filtered = removeAdLines(line, ['nguồn']);
        expect(filtered.trim(), `Expected long ad line (${line.length} chars) to be purged`).toBe('');
      }
    });

    it('5.2: Preserves long narrative prose (> 60 chars) containing compound keywords', () => {
      const longProseLines = [
        'Theo các truyền thuyết cổ xưa được ghi chép lại trong tông môn, nguồn gốc của loại công pháp này đã thất truyền hơn mười vạn năm.', // 131 chars
        'Tiêu Viêm cẩn thận lội qua khe suối sâu thẳm, cuối cùng cũng tìm ra nguồn nước ngầm đang chảy róc rách dưới chân vách đá tuyết.', // 128 chars
        'Nguồn năng lượng hung bạo từ sâu trong đan điền đột ngột bộc phát dữ dội, khiến cho toàn bộ kinh mạch của hắn như muốn vỡ tung.' // 128 chars
      ];

      for (const line of longProseLines) {
        expect(line.length).toBeGreaterThan(60);
        const filtered = removeAdLines(line, ['nguồn']);
        expect(filtered, `Expected long prose line (${line.length} chars) to be preserved`).toContain(line);
      }
    });

    it('5.3: Boundary length tests at exactly 59, 60, and 61 characters', () => {
      // Construct narrative prose of exact lengths starting with compound noun
      const prefix = 'Nguồn gốc của hắn rất bí ẩn khó đoán vô cùng '; // 45 chars
      const p59 = prefix + '12345678901234'; // 59 chars
      const p60 = prefix + '123456789012345'; // 60 chars
      const p61 = prefix + '1234567890123456'; // 61 chars

      expect(p59.length).toBe(59);
      expect(p60.length).toBe(60);
      expect(p61.length).toBe(61);

      const proseText = [p59, p60, p61].join('\n');
      const filteredProse = removeAdLines(proseText, ['nguồn']);

      expect(filteredProse).toContain(p59);
      expect(filteredProse).toContain(p60);
      expect(filteredProse).toContain(p61);

      // Construct ad lines of exact lengths starting with compound noun + colon
      const adPrefix = 'Nguồn gốc: convert từ qidian '; // 29 chars
      const a59 = adPrefix + '123456789012345678901234567890'; // 59 chars
      const a60 = adPrefix + '1234567890123456789012345678901'; // 60 chars
      const a61 = adPrefix + '12345678901234567890123456789012'; // 61 chars

      expect(a59.length).toBe(59);
      expect(a60.length).toBe(60);
      expect(a61.length).toBe(61);

      const adText = [a59, a60, a61].join('\n');
      const filteredAd = removeAdLines(adText, ['nguồn']);

      expect(filteredAd).not.toContain(a59);
      expect(filteredAd).not.toContain(a60);
      expect(filteredAd).not.toContain(a61);
    });
  });

  // =========================================================================
  // Suite 6: ReDoS & Catastrophic Backtracking Stress Tests
  // =========================================================================
  describe('Suite 6: ReDoS & Catastrophic Backtracking Stress Tests', () => {
    it('6.1: Unclosed opening bracket with 50,000 characters executes in < 50ms', () => {
      const unclosed = '[' + 'nguồn gốc '.repeat(5000); // 50,001 chars
      expect(unclosed.length).toBeGreaterThan(50000);

      const start = performance.now();
      const result = removeAdLines(unclosed, ['nguồn']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result).toBeDefined();
    });

    it('6.2: 25,000 nested opening brackets with attribution line executes in < 50ms', () => {
      const nested = '['.repeat(25000) + 'nguồn gốc: test'; // 25,015 chars
      const start = performance.now();
      const result = removeAdLines(nested, ['nguồn']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result.trim()).toBe('');
    });

    it('6.3: 50,000 non-matching characters executes in < 50ms', () => {
      const nonMatch = 'a'.repeat(50000);
      const start = performance.now();
      const result = removeAdLines(nonMatch, ['nguồn']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result).toBe(nonMatch);
    });

    it('6.4: 50,000 characters with repeated keyword fragments executes in < 50ms', () => {
      const repeated = 'nguồn '.repeat(8000) + 'gốc'; // 48,003 chars
      const start = performance.now();
      const result = removeAdLines(repeated, ['nguồn']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result).toBeDefined();
    });

    it('6.5: 40,000 spaces between keyword and colon executes in < 50ms', () => {
      const spaced = 'Nguồn gốc' + ' '.repeat(40000) + ': test';
      const start = performance.now();
      const result = removeAdLines(spaced, ['nguồn']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result.trim()).toBe('');
    });

    it('6.6: 50,000 colons executes in < 50ms', () => {
      const colons = ':'.repeat(50000);
      const start = performance.now();
      const result = removeAdLines(colons, ['nguồn']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result).toBe(colons);
    });
  });

  // =========================================================================
  // Suite 7: Full HTML End-to-End Pipeline Verification
  // =========================================================================
  describe('Suite 7: Full HTML End-to-End Pipeline Verification', () => {
    it('7.1: Comprehensive HTML document containing all pathological ad variations and narrative prose', () => {
      const html = `
        <div class="novel-content">
          <!-- Honeypots -->
          <div style="display: none !important;">Honeypot Hidden 1</div>
          <span style="visibility:hidden">Honeypot Hidden 2</span>
          <p hidden>Honeypot Hidden 3</p>

          <!-- Pathological Ads -->
          <p>\t\t   Nguồn gốc: convert từ qidian</p>
          <p>[Nguồn cội: TruyenFull]</p>
          <p>( Nguồn gốc : TruyenYY )</p>
          <p>NGUỒN GỐC: SƯU TẦM TRÊN MẠNG INTERNET BỞI NHÓM DỊCH TIÊN HIỆP VỚI ĐỘ DÀI VƯỢT QUÁ SÁU MƯƠI KÝ TỰ</p>
          <p>Nguồn gốc：convert từ qidian</p>
          <p>Nguồn gốc - Bàn Long Hội</p>
          <div class="w2w_read_more"><button>Đọc thêm</button></div>

          <!-- Legitimate Dialogue & Narrative -->
          <p>“Nguồn gốc của bảo kiếm này rốt cuộc từ đâu mà có?” Tiêu Viêm ngạc nhiên hỏi.</p>
          <p>- Nguồn nước ở con suối này độc tính cực mạnh, ngàn vạn lần chớ uống!</p>
          <p>\t\t   Nguồn gốc của hắn rất bí ẩn trong thiên hạ.</p>
          <p>(Nguồn nước trong vắt này bắt nguồn từ đỉnh núi Thiên Sơn)</p>
          <p>Theo các truyền thuyết cổ xưa được ghi chép lại trong tông môn, nguồn gốc của loại công pháp này đã thất truyền hơn mười vạn năm.</p>
          <p>NGUỒN NĂNG LƯỢNG NÀY CỰC KỲ TO LỚN VÀ HUNG BẠO!</p>
        </div>
      `;

      const cleaned = sanitizeHtmlContent(html, ['nguồn']);

      // 1. Verify all ads and honeypots are 100% purged
      expect(cleaned).not.toContain('Honeypot');
      expect(cleaned).not.toContain('convert từ qidian');
      expect(cleaned).not.toContain('TruyenFull');
      expect(cleaned).not.toContain('TruyenYY');
      expect(cleaned).not.toContain('SƯU TẦM TRÊN MẠNG');
      expect(cleaned).not.toContain('Bàn Long Hội');
      expect(cleaned).not.toContain('Đọc thêm');

      // 2. Verify all legitimate dialogue and narrative lines are 100% preserved
      expect(cleaned).toContain('“Nguồn gốc của bảo kiếm này rốt cuộc từ đâu mà có?” Tiêu Viêm ngạc nhiên hỏi.');
      expect(cleaned).toContain('- Nguồn nước ở con suối này độc tính cực mạnh, ngàn vạn lần chớ uống!');
      expect(cleaned).toContain('Nguồn gốc của hắn rất bí ẩn trong thiên hạ.');
      expect(cleaned).toContain('(Nguồn nước trong vắt này bắt nguồn từ đỉnh núi Thiên Sơn)');
      expect(cleaned).toContain('Theo các truyền thuyết cổ xưa được ghi chép lại trong tông môn, nguồn gốc của loại công pháp này đã thất truyền hơn mười vạn năm.');
      expect(cleaned).toContain('NGUỒN NĂNG LƯỢNG NÀY CỰC KỲ TO LỚN VÀ HUNG BẠO!');
    });
  });
});

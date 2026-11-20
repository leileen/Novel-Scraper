import { describe, it, expect } from 'vitest';
import { deobfuscateWordSlashes } from '../src/lib/sanitizer';

describe('Sanitizer Pipeline Unit Tests', () => {
  it('should remove obfuscated slashes from Vietnamese words', () => {
    const input = 'Hắn cảm thấy g/h/e/n t/u/ô/n/g với tên tiểu tử kia.';
    const output = deobfuscateWordSlashes(input);
    expect(output).toContain('ghen');
    expect(output).toContain('tuông');
  });

  it('should preserve legitimate dates and fractions without false positives', () => {
    const input = 'Hôm nay là ngày 12/04/2026, tỉ lệ thắng là 1/2.';
    const output = deobfuscateWordSlashes(input);
    expect(output).toBe(input);
  });

  it('should preserve metric units like km/h and m/s', () => {
    const input = 'Tốc độ phi hành đạt 100 km/h và gia tốc 10 m/s.';
    const output = deobfuscateWordSlashes(input);
    expect(output).toContain('km/h');
    expect(output).toContain('m/s');
  });

  it('should preserve URL paths', () => {
    const input = 'Xem chi tiết tại comong.info/truyen/co-vo-dang-nhap.';
    const output = deobfuscateWordSlashes(input);
    expect(output).toBe(input);
  });
});

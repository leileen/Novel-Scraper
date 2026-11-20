import { describe, it, expect, beforeEach } from 'vitest';
import { generateSelector } from '../lib/picker/selector';
import { extractDomainFromUrl } from '../lib/rules';

describe('Selector Generator & Domain Extraction', () => {
  it('should extract domain correctly from various URLs', () => {
    expect(extractDomainFromUrl('https://comong.info/truyen-123/chuong-1')).toBe('comong.info');
    expect(extractDomainFromUrl('https://truyen.tangthuvien.vn/doc-truyen/1')).toBe('truyen.tangthuvien.vn');
    expect(extractDomainFromUrl('invalid-url')).toBe('');
  });

  it('should generate an ID selector when element has a static ID', () => {
    const el = document.createElement('div');
    el.id = 'chapter-content';
    document.body.appendChild(el);

    const selector = generateSelector(el);
    expect(selector).toBe('#chapter-content');

    el.remove();
  });

  it('should generate class selector when element has a meaningful class', () => {
    const el = document.createElement('div');
    el.className = 'reading-content';
    document.body.appendChild(el);

    const selector = generateSelector(el);
    expect(selector).toBe('.reading-content');

    el.remove();
  });
});

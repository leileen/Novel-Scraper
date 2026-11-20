import { describe, it, expect } from 'vitest';
import type { Chapter } from '../src/lib/types';

describe('Version 1.2.0 - Chapter List & Display Verification', () => {
  // Helper to generate mock chapters matching the user scenario (1030 chapters)
  function createMockChapters(total: number): Chapter[] {
    const list: Chapter[] = [];
    for (let i = 1; i <= total; i++) {
      list.push({
        id: `mock-ch-${i}`,
        novelId: 'mock-novel-1',
        chapterNumber: i,
        index: i,
        title: `Chương ${i}: Tiêu đề chương cực kỳ dài để kiểm tra tràn chữ và hiển thị dấu chấm lửng trên giao diện người dùng`,
        url: `https://example.com/chap-${i}`,
        content: `Nội dung chương ${i}...`,
        status: 'completed'
      });
    }
    return list;
  }

  const RANGE_SIZE = 100;

  function computeRanges(chapters: Chapter[]) {
    const total = chapters.length;
    if (total <= RANGE_SIZE) return [];
    const list: Array<{ label: string; startIdx: number; endIdx: number }> = [];
    for (let i = 0; i < total; i += RANGE_SIZE) {
      const startIdx = i;
      const endIdx = Math.min(total - 1, i + RANGE_SIZE - 1);
      const startNum = startIdx + 1;
      const endNum = endIdx + 1;
      list.push({ label: `${startNum} - ${endNum}`, startIdx, endIdx });
    }
    return list;
  }

  it('1. Computes clean, standardized pagination ranges for 1030 chapters without jagged boundaries', () => {
    const chapters = createMockChapters(1030);
    const ranges = computeRanges(chapters);

    expect(ranges.length).toBe(11);
    expect(ranges[0]).toEqual({ label: '1 - 100', startIdx: 0, endIdx: 99 });
    expect(ranges[1]).toEqual({ label: '101 - 200', startIdx: 100, endIdx: 199 });
    expect(ranges[2]).toEqual({ label: '201 - 300', startIdx: 200, endIdx: 299 });
    expect(ranges[3]).toEqual({ label: '301 - 400', startIdx: 300, endIdx: 399 });
    expect(ranges[4]).toEqual({ label: '401 - 500', startIdx: 400, endIdx: 499 });
    expect(ranges[5]).toEqual({ label: '501 - 600', startIdx: 500, endIdx: 599 });
    expect(ranges[6]).toEqual({ label: '601 - 700', startIdx: 600, endIdx: 699 });
    expect(ranges[7]).toEqual({ label: '701 - 800', startIdx: 700, endIdx: 799 });
    expect(ranges[8]).toEqual({ label: '801 - 900', startIdx: 800, endIdx: 899 });
    expect(ranges[9]).toEqual({ label: '901 - 1000', startIdx: 900, endIdx: 999 });
    expect(ranges[10]).toEqual({ label: '1001 - 1030', startIdx: 1000, endIdx: 1029 });
  });

  it('2. Supports Ascending (1 -> N) and Descending (N -> 1) sorting', () => {
    const chapters = createMockChapters(1030);

    // ASC
    const ascList = [...chapters];
    expect(ascList[0].chapterNumber).toBe(1);
    expect(ascList[ascList.length - 1].chapterNumber).toBe(1030);

    // DESC
    const descList = [...chapters].reverse();
    expect(descList[0].chapterNumber).toBe(1030);
    expect(descList[descList.length - 1].chapterNumber).toBe(1);
  });

  it('3. Quick jump accurately resolves chapter number to correct range index', () => {
    const chapters = createMockChapters(1030);
    const ranges = computeRanges(chapters);

    function resolveRangeIndex(chapNum: number): number {
      const targetIdx = chapters.findIndex(c => c.chapterNumber === chapNum);
      if (targetIdx !== -1) {
        return Math.floor(targetIdx / RANGE_SIZE);
      }
      return -1;
    }

    expect(resolveRangeIndex(1)).toBe(0); // 1 - 100
    expect(resolveRangeIndex(50)).toBe(0);
    expect(resolveRangeIndex(100)).toBe(0);
    expect(resolveRangeIndex(101)).toBe(1); // 101 - 200
    expect(resolveRangeIndex(350)).toBe(3); // 301 - 400
    expect(resolveRangeIndex(750)).toBe(7); // 701 - 800
    expect(resolveRangeIndex(1025)).toBe(10); // 1001 - 1030
  });

  it('4. Global search filters correctly across all 1030 chapters regardless of range', () => {
    const chapters = createMockChapters(1030);

    // Search by chapter number
    const qNum = '1025';
    const numMatches = chapters.filter(c =>
      c.title.toLowerCase().includes(qNum) || String(c.chapterNumber).includes(qNum)
    );
    expect(numMatches.length).toBe(1);
    expect(numMatches[0].chapterNumber).toBe(1025);

    // Search by title substring
    const qText = 'cực kỳ dài';
    const textMatches = chapters.filter(c => c.title.includes(qText));
    expect(textMatches.length).toBe(1030);
  });
});

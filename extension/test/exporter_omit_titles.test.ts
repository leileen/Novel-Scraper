import { describe, it, expect } from 'vitest';
import type { Novel, Chapter } from '../lib/types';
import {
  formatChapterTitleForExport,
  getCleanChapterContent
} from '../lib/exporter/sorter';
import { generateTxtContent } from '../lib/exporter/txt';
import { generatePrintableHtml } from '../lib/exporter/pdf';
import { buildDocxBlob } from '../lib/exporter/docx';
import { buildEpubBlob } from '../lib/exporter/epub';

describe('Exporter Omit Chapter Titles Option', () => {
  const sampleNovel: Novel = {
    id: 1,
    title: 'Người Tôi Thầm Thích Năm Năm',
    sourceUrl: 'https://comong.info/truyen/nguoi-toi-tham-thich',
    status: 'completed',
    totalChapters: 2,
    downloadedChapters: 2,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const sampleChapters: Chapter[] = [
    {
      id: 1,
      novelId: 1,
      chapterNumber: 1,
      title: 'Chương 1',
      url: 'https://comong.info/truyen/nguoi-toi-tham-thich/chuong-1',
      content: 'Chương 1\n\nPhản ứng đầu tiên của tôi là:\nSao chị ấy biết được?',
      wordCount: 15,
      status: 'completed'
    },
    {
      id: 2,
      novelId: 1,
      chapterNumber: 2,
      title: 'Chương 2',
      url: 'https://comong.info/truyen/nguoi-toi-tham-thich/chuong-2',
      content: 'Chương 2\n\n“Chu tổng!”\n“Cổ phiếu ngừng giảm rồi!”',
      wordCount: 10,
      status: 'completed'
    }
  ];

  it('formatChapterTitleForExport returns null when omitChapterTitles is true', () => {
    const heading = formatChapterTitleForExport(
      sampleChapters[0],
      sampleNovel,
      sampleChapters,
      false,
      { omitChapterTitles: true }
    );
    expect(heading).toBeNull();
  });

  it('getCleanChapterContent removes embedded chapter number lines when omitChapterTitles is true', () => {
    const rawContent = 'Chương 3\n\n“Chu tổng!”\n\n“Cổ phiếu ngừng giảm rồi!”';
    const cleaned = getCleanChapterContent(
      { ...sampleChapters[1], content: rawContent, title: 'Chương 3' },
      sampleNovel.title,
      { omitChapterTitles: true }
    );

    expect(cleaned).not.toContain('Chương 3');
    expect(cleaned).toContain('“Chu tổng!”');
    expect(cleaned).toContain('“Cổ phiếu ngừng giảm rồi!”');
  });

  it('generateTxtContent does not output chapter heading blocks when omitChapterTitles is true', () => {
    const txtWithTitles = generateTxtContent(sampleNovel, sampleChapters, { omitChapterTitles: false });
    expect(txtWithTitles).toContain('Chương 1\n\n');
    expect(txtWithTitles).toContain('Chương 2\n\n');

    const txtWithoutTitles = generateTxtContent(sampleNovel, sampleChapters, { omitChapterTitles: true });
    expect(txtWithoutTitles).not.toContain('Chương 1\n\n');
    expect(txtWithoutTitles).not.toContain('Chương 2\n\n');
    expect(txtWithoutTitles).toContain('Phản ứng đầu tiên của tôi là:');
    expect(txtWithoutTitles).toContain('“Chu tổng!”');
  });

  it('generatePrintableHtml does not output chapter-title headings when omitChapterTitles is true', () => {
    const htmlWithoutTitles = generatePrintableHtml(sampleNovel, sampleChapters, { omitChapterTitles: true });
    expect(htmlWithoutTitles).not.toContain('<h2 class="chapter-title">');
    expect(htmlWithoutTitles).toContain('“Chu tổng!”');
  });

  it('buildDocxBlob builds a valid blob without error when omitChapterTitles is true', async () => {
    const blob = await buildDocxBlob(sampleNovel, sampleChapters, { omitChapterTitles: true });
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(100);
  });

  it('buildEpubBlob builds a valid epub blob without chapter-title headings when omitChapterTitles is true', async () => {
    const blob = await buildEpubBlob(sampleNovel, sampleChapters, { omitChapterTitles: true });
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(100);
  });
});

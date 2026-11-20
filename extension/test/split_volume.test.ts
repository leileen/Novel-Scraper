import { describe, it, expect, vi } from 'vitest';
import type { Novel, Chapter } from '../lib/types';
import { exportNovel } from '../lib/exporter';
import * as txtModule from '../lib/exporter/txt';

describe('Smart Volume Splitting (Mục 9.5)', () => {
  it('splits 25 chapters into 3 volumes when splitVolumeSize is 10 and downloads as ZIP', async () => {
    const triggerDownloadSpy = vi.spyOn(txtModule, 'triggerBlobDownload').mockImplementation(() => {});

    const novel: Novel = {
      id: 1,
      title: 'Võ Luyện Đỉnh Phong',
      sourceUrl: 'https://example.com/novel',
      totalChapters: 25,
      downloadedChapters: 25,
      status: 'completed',
      createdAt: 1,
      updatedAt: 1
    };

    const chapters: Chapter[] = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      novelId: 1,
      chapterNumber: i + 1,
      title: `Chương ${i + 1}: Diễn biến ${i + 1}`,
      url: `https://example.com/c${i + 1}`,
      content: `Nội dung của chương số ${i + 1}`,
      wordCount: 10,
      status: 'completed'
    }));

    await exportNovel(novel, chapters, 'txt', 10);

    expect(triggerDownloadSpy).toHaveBeenCalledTimes(1);
    const [blob, filename] = triggerDownloadSpy.mock.calls[0];

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/zip');
    expect(filename).toContain('TronBo_3Tap.zip');

    triggerDownloadSpy.mockRestore();
  });

  it('exports single file normally when total chapters is within splitVolumeSize', async () => {
    const exportTxtSpy = vi.spyOn(txtModule, 'exportToTxt').mockImplementation(() => {});

    const novel: Novel = {
      id: 2,
      title: 'Truyện Ngắn',
      sourceUrl: 'https://example.com/short',
      totalChapters: 5,
      downloadedChapters: 5,
      status: 'completed',
      createdAt: 1,
      updatedAt: 1
    };

    const chapters: Chapter[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      novelId: 2,
      chapterNumber: i + 1,
      title: `Chương ${i + 1}`,
      url: `https://example.com/c${i + 1}`,
      content: `Nội dung chương ${i + 1}`,
      wordCount: 5,
      status: 'completed'
    }));

    await exportNovel(novel, chapters, 'txt', 10);

    expect(exportTxtSpy).toHaveBeenCalledTimes(1);
    expect(exportTxtSpy).toHaveBeenCalledWith(novel, chapters);

    exportTxtSpy.mockRestore();
  });
});

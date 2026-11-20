import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Novel, Chapter } from '../lib/types';
import { resolveActiveTabNovel } from '../lib/extractor/tabInfo';

describe('Tab Info Resolver & Database Decontamination Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Resolves novel info on comong.info via content script message', async () => {
    // Mock chrome.tabs.sendMessage
    (globalThis as any).chrome = {
      tabs: {
        sendMessage: vi.fn().mockResolvedValue({
          success: true,
          novelTitle: 'Người Tôi Thầm Thích Năm Năm, Hóa Ra Chỉ Muốn Dùng Tôi Để Trả Thù',
          novelUrl: 'https://comong.info/nguoi-toi-tham-thich-nam-nam-hoa-ra-chi-muon-dung-toi-de-tra-thu/',
          chapterTitle: 'Chương 1'
        })
      }
    };

    const mockTab: any = {
      id: 123,
      url: 'https://comong.info/chapter/chuong-1-2550/',
      title: 'Chương 1 - Cổ Mộng'
    };

    const info = await resolveActiveTabNovel(mockTab);

    expect(info.title).toBe('Người Tôi Thầm Thích Năm Năm, Hóa Ra Chỉ Muốn Dùng Tôi Để Trả Thù');
    expect(info.canonicalUrl).toBe('https://comong.info/nguoi-toi-tham-thich-nam-nam-hoa-ra-chi-muon-dung-toi-de-tra-thu/');
    expect(info.chapterTitle).toBe('Chương 1');
    expect(info.isReadingPage).toBe(true);
    expect(info.domain).toBe('comong.info');
  });

  it('2. Resiliently falls back to chrome.scripting.executeScript when content script is disconnected', async () => {
    // Simulate content script failure (e.g. extension reload: "Could not establish connection")
    (globalThis as any).chrome = {
      tabs: {
        sendMessage: vi.fn().mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist.'))
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              nTitle: 'Người Tôi Thầm Thích Năm Năm, Hóa Ra Chỉ Muốn Dùng Tôi Để Trả Thù',
              nUrl: 'https://comong.info/nguoi-toi-tham-thich-nam-nam-hoa-ra-chi-muon-dung-toi-de-tra-thu/',
              cTitle: 'Chương 1'
            }
          }
        ])
      }
    };

    const mockTab: any = {
      id: 456,
      url: 'https://comong.info/chapter/chuong-1-2550/',
      title: 'Chương 1 - Cổ Mộng'
    };

    const info = await resolveActiveTabNovel(mockTab);

    expect(info.title).toBe('Người Tôi Thầm Thích Năm Năm, Hóa Ra Chỉ Muốn Dùng Tôi Để Trả Thù');
    expect(info.canonicalUrl).toBe('https://comong.info/nguoi-toi-tham-thich-nam-nam-hoa-ra-chi-muon-dung-toi-de-tra-thu/');
    expect(info.chapterTitle).toBe('Chương 1');
  });

  it('3. Falls back to direct fetch + DOMParser when tab scripting is unavailable', async () => {
    (globalThis as any).chrome = {
      tabs: {
        sendMessage: vi.fn().mockRejectedValue(new Error('No response'))
      }
    };

    const htmlMock = `
      <html>
        <head><title>Chương 1 - Cổ Mộng</title></head>
        <body>
          <h1 class="story-title"><a href="https://comong.info/nguoi-toi-tham-thich-nam-nam-hoa-ra-chi-muon-dung-toi-de-tra-thu/">Người Tôi Thầm Thích Năm Năm, Hóa Ra Chỉ Muốn Dùng Tôi Để Trả Thù</a></h1>
          <h1 style="">Chương 1</h1>
        </body>
      </html>
    `;

    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => htmlMock
    } as any);

    const mockTab: any = {
      id: 789,
      url: 'https://comong.info/chapter/chuong-1-2550/',
      title: 'Chương 1 - Cổ Mộng'
    };

    const info = await resolveActiveTabNovel(mockTab);

    expect(info.title).toBe('Người Tôi Thầm Thích Năm Năm, Hóa Ra Chỉ Muốn Dùng Tôi Để Trả Thù');
    expect(info.canonicalUrl).toBe('https://comong.info/nguoi-toi-tham-thich-nam-nam-hoa-ra-chi-muon-dung-toi-de-tra-thu/');
  });

  it('4. Correctly deduplicates chapters with the same chapterNumber, favoring completed ones', () => {
    const chapters: Chapter[] = [
      {
        id: 1,
        novelId: 1,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://comong.info/chapter/chuong-1-2542/',
        content: 'Nội dung truyện cũ chương 1',
        wordCount: 1406,
        status: 'completed'
      },
      {
        id: 2,
        novelId: 1,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://comong.info/chapter/chuong-1-2550/',
        content: '',
        wordCount: 0,
        status: 'pending'
      },
      {
        id: 3,
        novelId: 1,
        chapterNumber: 2,
        title: 'Chương 2',
        url: 'https://comong.info/chapter/chuong-2-2539/',
        content: 'Nội dung truyện cũ chương 2',
        wordCount: 1404,
        status: 'completed'
      },
      {
        id: 4,
        novelId: 1,
        chapterNumber: 2,
        title: 'Chương 2',
        url: 'https://comong.info/chapter/chuong-2-2547/',
        content: '',
        wordCount: 0,
        status: 'pending'
      }
    ];

    // Group by chapterNumber and deduplicate
    const byNum = new Map<number, Chapter[]>();
    for (const ch of chapters) {
      if (!byNum.has(ch.chapterNumber)) byNum.set(ch.chapterNumber, []);
      byNum.get(ch.chapterNumber)!.push(ch);
    }

    const toDeleteIds: number[] = [];
    const keptChapters: Chapter[] = [];

    for (const [, chaps] of byNum.entries()) {
      if (chaps.length > 1) {
        chaps.sort((a, b) => {
          if (a.status === 'completed' && b.status !== 'completed') return -1;
          if (b.status === 'completed' && a.status !== 'completed') return 1;
          return (b.content?.length || 0) - (a.content?.length || 0);
        });
        keptChapters.push(chaps[0]);
        for (let i = 1; i < chaps.length; i++) {
          toDeleteIds.push(chaps[i].id!);
        }
      } else {
        keptChapters.push(chaps[0]);
      }
    }

    expect(toDeleteIds).toEqual([2, 4]); // The two pending duplicate chapters are removed
    expect(keptChapters).toHaveLength(2);
    expect(keptChapters[0].id).toBe(1);
    expect(keptChapters[0].wordCount).toBe(1406);
    expect(keptChapters[1].id).toBe(3);
    expect(keptChapters[1].wordCount).toBe(1404);
  });
});

import { db } from '../db';
import type { Novel, Chapter, SiteRule, AppSettings, TocChapterItem } from '../types';
import { extractChapterWithRule, extractTocFromDocument } from '../extractor';
import { getRuleForDomain } from '../rules';
import { countWords, parseSafeHtmlDocument } from '../sanitizer';

export interface CrawlProgressEvent {
  novelId: number;
  currentChapter: number;
  totalChapters: number;
  percent: number;
  status: 'idle' | 'crawling' | 'paused' | 'completed' | 'error';
  currentTitle?: string;
  errorMessage?: string;
  downloadedChapters?: number;
}

export interface CrawlSession {
  novelId: number;
  novelTitle: string;
  sourceUrl: string;
  status: 'crawling' | 'paused';
  isPaused: boolean;
  isCancelled: boolean;
  abortController: AbortController;
  currentChapter: number;
  totalChapters: number;
  downloadedChapters: number;
  percent: number;
  currentTitle: string;
}

export type CrawlListener = (event: CrawlProgressEvent) => void;

class CrawlManager {
  private sessions = new Map<number, CrawlSession>();
  private scanAbortControllers = new Set<AbortController>();
  private listeners = new Set<CrawlListener>();

  public subscribe(listener: CrawlListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(event: CrawlProgressEvent): void {
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (err) {
        console.error('[CrawlManager] Error in listener callback:', err);
      }
    });
  }

  public getSession(novelId?: number | null): CrawlSession | undefined {
    if (!novelId) return undefined;
    return this.sessions.get(novelId);
  }

  public getActiveSessions(): CrawlSession[] {
    return Array.from(this.sessions.values());
  }

  public isNovelCrawling(novelId?: number | null): boolean {
    if (!novelId) return false;
    return this.sessions.has(novelId);
  }

  public isNovelPaused(novelId?: number | null): boolean {
    if (!novelId) return false;
    return Boolean(this.sessions.get(novelId)?.isPaused);
  }

  public getActiveNovelId(): number | null {
    const first = this.sessions.keys().next();
    return first.done ? null : first.value;
  }

  public get isRunning(): boolean {
    return this.sessions.size > 0;
  }

  public pause(novelId?: number): void {
    const targets = novelId !== undefined
      ? (this.sessions.has(novelId) ? [this.sessions.get(novelId)!] : [])
      : Array.from(this.sessions.values());

    for (const session of targets) {
      session.isPaused = true;
      session.status = 'paused';
      db.novels.update(session.novelId, { status: 'paused', updatedAt: Date.now() }).catch(() => {});
      this.notify({
        novelId: session.novelId,
        currentChapter: session.currentChapter,
        totalChapters: session.totalChapters,
        downloadedChapters: session.downloadedChapters,
        percent: session.percent,
        status: 'paused',
        currentTitle: session.currentTitle
      });
    }
  }

  public resume(novelId?: number): void {
    const targets = novelId !== undefined
      ? (this.sessions.has(novelId) ? [this.sessions.get(novelId)!] : [])
      : Array.from(this.sessions.values());

    for (const session of targets) {
      session.isPaused = false;
      session.status = 'crawling';
      db.novels.update(session.novelId, { status: 'crawling', updatedAt: Date.now() }).catch(() => {});
      this.notify({
        novelId: session.novelId,
        currentChapter: session.currentChapter,
        totalChapters: session.totalChapters,
        downloadedChapters: session.downloadedChapters,
        percent: session.percent,
        status: 'crawling',
        currentTitle: session.currentTitle
      });
    }
  }

  public abortCrawl(novelId?: number): void {
    this.cancel(novelId);
  }

  public cancel(novelId?: number): void {
    if (novelId === undefined) {
      for (const ctrl of this.scanAbortControllers) {
        try {
          ctrl.abort();
        } catch {}
      }
      this.scanAbortControllers.clear();
    }

    const targets = novelId !== undefined
      ? (this.sessions.has(novelId) ? [this.sessions.get(novelId)!] : [])
      : Array.from(this.sessions.values());

    for (const session of targets) {
      session.isCancelled = true;
      session.isPaused = false;
      try {
        session.abortController.abort();
      } catch {}
      this.sessions.delete(session.novelId);
      db.novels.update(session.novelId, { status: 'idle', updatedAt: Date.now() }).catch(() => {});
      this.notify({
        novelId: session.novelId,
        currentChapter: session.currentChapter,
        totalChapters: session.totalChapters,
        downloadedChapters: session.downloadedChapters,
        percent: session.percent,
        status: 'idle',
        currentTitle: session.currentTitle
      });
    }
  }

  /**
   * Scans all TOC pages recursively (handling pagination) using its own isolated AbortController
   * so scanning TOC on another tab never interrupts active background crawls.
   */
  public async scanFullToc(
    startUrl: string,
    rule?: SiteRule | null,
    maxPages = 200,
    onPageScanned?: (page: number, foundSoFar: number) => void
  ): Promise<TocChapterItem[]> {
    const scanAbort = new AbortController();
    this.scanAbortControllers.add(scanAbort);
    const allChapters: TocChapterItem[] = [];
    const seenChapterUrls = new Set<string>();
    const seenPaginationUrls = new Set<string>();

    const normalizeUrl = (url: string, base?: string): string => {
      try {
        const u = base ? new URL(url, base) : new URL(url);
        u.hash = '';
        return u.href;
      } catch {
        return url.split('#')[0].trim();
      }
    };

    let currentUrl: string | undefined = normalizeUrl(startUrl);
    seenPaginationUrls.add(currentUrl);
    let pageCount = 0;
    const pageLimit = Math.max(1, maxPages || 200);

    // If startUrl is a chapter URL, determine parent story URL upfront
    let initialParentStoryUrl: string | undefined;
    try {
      const targetUrl = new URL(currentUrl);
      const parts = targetUrl.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && /(?:chuong|chapter|c)[-_]\d+/i.test(parts[parts.length - 1])) {
        parts.pop();
        initialParentStoryUrl = targetUrl.origin + '/' + parts.join('/');
      }
    } catch {}

    // Check if matching or active browser tab is on this page and has a dropdown <select> TOC (e.g. comong.info)
    if (typeof chrome !== 'undefined' && /(?:chuong|chapter|c)[-_]\d+/i.test(currentUrl)) {
      try {
        const tab = await this.findTabForUrl(currentUrl);
        if (tab?.id && tab?.url && tab.url.split('#')[0] === currentUrl.split('#')[0]) {
          const tabToc = await chrome.tabs.sendMessage(tab.id, { action: 'SCAN_TOC', rule });
          if (tabToc?.success && Array.isArray(tabToc.data?.chapters) && tabToc.data.chapters.length > 5) {
            this.scanAbortControllers.delete(scanAbort);
            return tabToc.data.chapters;
          }
        }
      } catch {}
    }

    // If reading page has no dropdown TOC, jump straight to the parent story URL
    if (initialParentStoryUrl && initialParentStoryUrl !== currentUrl) {
      currentUrl = initialParentStoryUrl;
      seenPaginationUrls.add(currentUrl);
    }

    try {
      while (currentUrl && pageCount < pageLimit && !scanAbort.signal.aborted) {
        pageCount++;
        try {
          const fetchRes = await this.fetchHtml(currentUrl, scanAbort.signal);
          if (!fetchRes.ok || !fetchRes.text) {
            console.warn(`[CrawlManager] Error fetching TOC page ${pageCount}:`, fetchRes.error || `HTTP ${fetchRes.status}`);
            break;
          }
          const text = fetchRes.text;
          let html = text;
          try {
            const json = JSON.parse(text);
            if (json && typeof json.data === 'string') {
              // Wrap AJAX HTML fragment in #chapter-list if not already wrapped so rule.tocSelector matches 100% of chapters
              html = json.data.includes('id="chapter-list"')
                ? json.data
                : `<div id="chapter-list">${json.data}</div>`;
            }
          } catch {}
          const doc = parseSafeHtmlDocument(html);

          const { chapters, nextPaginationUrl } = extractTocFromDocument(doc, rule, currentUrl);

          // If on page 1, check if this is a chapter reading page without a select TOC or if no chapters found:
          const isReadingPage = /(?:chuong|chapter|c)[-_]\d+/i.test(currentUrl);
          const hasSelectToc = doc.querySelector('select option:nth-child(2)') !== null;

          if (pageCount === 1 && (!hasSelectToc && (chapters.length === 0 || isReadingPage))) {
            let parentStoryUrl: string | undefined;

            // 1. Direct novel link elements on reading page
            const directStoryLink = doc.querySelector(
              'h1.current-book a, a.current-book, h1.story-title a, .story-title a, .truyen-title a'
            );
            if (directStoryLink) {
              const href = directStoryLink.getAttribute('href');
              if (href && href !== '#' && !href.toLowerCase().startsWith('javascript:')) {
                parentStoryUrl = normalizeUrl(href, currentUrl);
              }
            }

            // 2. Safe breadcrumbs inspection: take the last breadcrumb link that is not home or chapter
            if (!parentStoryUrl) {
              const breadcrumbLinks = Array.from(doc.querySelectorAll('ol.breadcrumb li a, ul.breadcrumbs li a, .breadcrumbs li a'));
              for (let b = breadcrumbLinks.length - 1; b >= 0; b--) {
                const bHref = breadcrumbLinks[b].getAttribute('href');
                if (bHref && bHref !== '/' && bHref !== '#' && !bHref.toLowerCase().startsWith('javascript:') && !/(?:chuong|chapter|c)[-_]\d+/i.test(bHref)) {
                  parentStoryUrl = normalizeUrl(bHref, currentUrl);
                  break;
                }
              }
            }

            // 3. Fallback to path segment resolution
            if (!parentStoryUrl && currentUrl) {
              try {
                const targetUrl: globalThis.URL = new globalThis.URL(currentUrl);
                const parts = targetUrl.pathname.split('/').filter(Boolean);
                if (parts.length >= 2 && /(?:chuong|chapter|c)[-_]\d+/i.test(parts[parts.length - 1])) {
                  parts.pop();
                  parentStoryUrl = targetUrl.origin + '/' + parts.join('/');
                }
              } catch {}
            }

            if (parentStoryUrl && parentStoryUrl !== currentUrl && !seenPaginationUrls.has(parentStoryUrl)) {
              seenPaginationUrls.add(parentStoryUrl);
              currentUrl = parentStoryUrl;
              pageCount = 0; // Reset page count so the story page becomes page 1
              continue;
            }
          }

          let newChaptersCount = 0;
          for (const chap of chapters) {
            if (!seenChapterUrls.has(chap.url)) {
              seenChapterUrls.add(chap.url);
              chap.chapterNumber = allChapters.length + 1;
              allChapters.push(chap);
              newChaptersCount++;
            }
          }

          if (onPageScanned) {
            onPageScanned(pageCount, allChapters.length);
          }

          // Stop if all chapters on this page were already seen (prevents wrap-around loops)
          if (newChaptersCount === 0 && chapters.length > 0) {
            break;
          }

          // If no next page link found, stop pagination
          if (!nextPaginationUrl) {
            break;
          }

          // Resolve next pagination URL relative to currentUrl and normalize
          const resolvedNextUrl = normalizeUrl(nextPaginationUrl, currentUrl);

          // Circular pagination detection: stop if URL already visited or self-referencing
          if (seenPaginationUrls.has(resolvedNextUrl) || resolvedNextUrl === currentUrl) {
            break;
          }

          seenPaginationUrls.add(resolvedNextUrl);
          currentUrl = resolvedNextUrl;
        } catch (err) {
          if (scanAbort.signal.aborted || (err as any)?.name === 'AbortError') {
            break;
          }
          console.warn(`[CrawlManager] Error fetching TOC page ${pageCount}:`, err);
          break;
        }
      }
    } finally {
      this.scanAbortControllers.delete(scanAbort);
    }

    return allChapters;
  }

  /**
   * Starts or resumes batch crawling for a novel.
   * Supports concurrent multi-novel / multi-tab crawling when `range.allowConcurrent === true`.
   */
  public async startCrawl(
    novelId: number,
    settings: AppSettings,
    range?: { fromChapter?: number; toChapter?: number; allowConcurrent?: boolean }
  ): Promise<void> {
    if (this.sessions.has(novelId)) {
      throw new Error(
        `Crawl already in progress (active novel #${novelId}). Concurrent crawls are not permitted.`
      );
    }
    if (!range?.allowConcurrent && this.sessions.size > 0) {
      const existingId = this.getActiveNovelId();
      throw new Error(
        `Crawl already in progress (active novel #${existingId}). Concurrent crawls are not permitted.`
      );
    }

    const session: CrawlSession = {
      novelId,
      novelTitle: `Novel #${novelId}`,
      sourceUrl: '',
      status: 'crawling',
      isPaused: false,
      isCancelled: false,
      abortController: new AbortController(),
      currentChapter: 0,
      totalChapters: 0,
      downloadedChapters: 0,
      percent: 0,
      currentTitle: ''
    };
    this.sessions.set(novelId, session);

    try {
      const novel = await db.novels.get(novelId);
      if (!novel) throw new Error(`Novel #${novelId} not found`);

      session.novelTitle = novel.title || `Novel #${novelId}`;
      session.sourceUrl = novel.sourceUrl || '';
      session.totalChapters = novel.totalChapters || 0;
      session.downloadedChapters = novel.downloadedChapters || 0;

      await db.novels.update(novelId, { status: 'crawling', updatedAt: Date.now() });

      const rule = await getRuleForDomain(novel.sourceUrl);

      // Get all pending or failed chapters within requested range
      const chaptersToCrawl = await db.chapters
        .where('novelId')
        .equals(novelId)
        .and((c) => {
          const isPending = c.status === 'pending' || c.status === 'failed';
          if (!isPending) return false;
          if (range?.fromChapter && c.chapterNumber < range.fromChapter) return false;
          if (range?.toChapter && c.chapterNumber > range.toChapter) return false;
          return true;
        })
        .sortBy('chapterNumber');

      let totalChapters = await db.chapters.where('novelId').equals(novelId).count();
      session.totalChapters = totalChapters;

      for (let i = 0; i < chaptersToCrawl.length; i++) {
        if (session.isCancelled) {
          await db.novels.update(novelId, { status: 'idle', updatedAt: Date.now() });
          this.notify({
            novelId,
            currentChapter: i,
            totalChapters,
            percent: Math.round((i / (totalChapters || 1)) * 100),
            status: 'idle'
          });
          break;
        }

        // Check pause loop
        if (session.isPaused && !session.isCancelled) {
          this.notify({
            novelId,
            currentChapter: i,
            totalChapters,
            percent: Math.round((i / (totalChapters || 1)) * 100),
            status: 'paused'
          });
        }
        while (session.isPaused && !session.isCancelled) {
          await new Promise((r) => setTimeout(r, 600));
        }

        if (session.isCancelled) {
          await db.novels.update(novelId, { status: 'idle', updatedAt: Date.now() });
          this.notify({
            novelId,
            currentChapter: i,
            totalChapters,
            percent: Math.round((i / (totalChapters || 1)) * 100),
            status: 'idle'
          });
          break;
        }

        const chapter = chaptersToCrawl[i];
        if (!chapter.id) continue;

        try {
          // Update chapter status to crawling
          await db.chapters.update(chapter.id, { status: 'crawling' });

          session.currentChapter = chapter.chapterNumber;
          session.currentTitle = chapter.title;
          session.percent = Math.round((chapter.chapterNumber / (totalChapters || 1)) * 100);

          this.notify({
            novelId,
            currentChapter: chapter.chapterNumber,
            totalChapters,
            percent: session.percent,
            status: 'crawling',
            currentTitle: chapter.title
          });

          let cleanKeywords: string[] = [];
          if (Array.isArray(settings?.adKeywords)) {
            cleanKeywords = settings.adKeywords;
          } else if (typeof settings?.adKeywords === 'string') {
            cleanKeywords = (settings.adKeywords as string).split('\n').map((s) => s.trim()).filter(Boolean);
          } else if (settings?.adKeywords && typeof settings.adKeywords === 'object') {
            cleanKeywords = Object.values(settings.adKeywords);
          }

          // Fetch chapter content with retry and backoff
          const result = await this.fetchChapterWithRetry(
            chapter.url,
            rule,
            cleanKeywords,
            session.abortController.signal,
            {
              deobfuscate: settings?.deobfuscateText !== false,
              replacements: settings?.customReplacements
            },
            session
          );

          if (result.success && result.data) {
            const words = countWords(result.data.content);
            await db.chapters.update(chapter.id, {
              title: result.data.title || chapter.title,
              content: result.data.content,
              wordCount: words,
              status: result.data.isLocked ? 'locked' : 'completed',
              fetchedAt: Date.now()
            });

            // If novel title was generic/default or chapter-named (e.g. "Chương 1"), update with real novel title
            if (result.data.novelTitle && novel) {
              const currentTitle = (novel.title || '').trim();
              if (
                !currentTitle ||
                currentTitle === 'Chưa đặt tên' ||
                /^(?:chương|chapter|hồi|tiết)\s*\d+/i.test(currentTitle)
              ) {
                novel.title = result.data.novelTitle;
                session.novelTitle = result.data.novelTitle;
                await db.novels.update(novelId, { title: result.data.novelTitle, updatedAt: Date.now() });
              }
            }

            // Sequential crawling support: if nextUrl is detected and we are at the end of the queue, dynamically discover next chapter
            if (result.data.nextUrl && i === chaptersToCrawl.length - 1) {
              const nextUrl = result.data.nextUrl;
              const alreadyExists = await db.chapters
                .where('novelId')
                .equals(novelId)
                .and((c) => c.url === nextUrl)
                .first();

              if (!alreadyExists) {
                const nextNum = chapter.chapterNumber + 1;
                const newChapterId = await db.chapters.add(JSON.parse(JSON.stringify({
                  novelId,
                  chapterNumber: nextNum,
                  title: `Chương ${nextNum}`,
                  url: nextUrl,
                  content: '',
                  wordCount: 0,
                  status: 'pending'
                })));
                chaptersToCrawl.push({
                  id: newChapterId as number,
                  novelId,
                  chapterNumber: nextNum,
                  title: `Chương ${nextNum}`,
                  url: nextUrl,
                  content: '',
                  wordCount: 0,
                  status: 'pending'
                });
                totalChapters = chaptersToCrawl.length;
                session.totalChapters = totalChapters;
                await db.novels.update(novelId, { totalChapters, updatedAt: Date.now() });
              }
            }
          } else {
            await db.chapters.update(chapter.id, {
              status: 'failed',
              errorMessage: result.error || 'Lỗi tải chương'
            });
          }

          // Update novel downloaded count
          const downloadedCount = await db.chapters
            .where('novelId')
            .equals(novelId)
            .and((c) => c.status === 'completed' || c.status === 'locked')
            .count();

          session.downloadedChapters = downloadedCount;
          session.totalChapters = totalChapters;
          session.percent = Math.round((downloadedCount / (totalChapters || 1)) * 100);

          await db.novels.update(novelId, {
            downloadedChapters: downloadedCount,
            updatedAt: Date.now()
          });

          // Emit realtime progress event with updated storage count
          this.notify({
            novelId,
            currentChapter: chapter.chapterNumber,
            totalChapters,
            percent: session.percent,
            status: session.isPaused ? 'paused' : 'crawling',
            currentTitle: chapter.title,
            downloadedChapters: downloadedCount
          });
        } catch (chapterErr) {
          console.warn(`[CrawlManager] Error processing chapter ${chapter.id}:`, chapterErr);
          await db.chapters.update(chapter.id, {
            status: 'failed',
            errorMessage: (chapterErr as Error).message || 'Lỗi xử lý chương'
          }).catch(() => {});
        }

        // Polite crawling delay with adaptive jitter
        if (i < chaptersToCrawl.length - 1 && !session.isCancelled && !session.isPaused) {
          const minMs = settings.politeDelayMin * 1000;
          const maxMs = settings.politeDelayMax * 1000;
          const jitter = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
          await new Promise<void>((resolve) => {
            if (session.abortController.signal.aborted || session.isCancelled) {
              return resolve();
            }
            const timer = setTimeout(resolve, jitter);
            session.abortController.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true }
            );
          });
        }
      }

      if (!session.isCancelled) {
        await db.novels.update(novelId, { status: 'completed', updatedAt: Date.now() });
        this.notify({
          novelId,
          currentChapter: totalChapters,
          totalChapters,
          percent: 100,
          status: 'completed'
        });
      }
    } catch (err) {
      if (!session.isCancelled) {
        await db.novels.update(novelId, { status: 'error', updatedAt: Date.now() }).catch(() => {});
        this.notify({
          novelId,
          currentChapter: 0,
          totalChapters: 0,
          percent: 0,
          status: 'error',
          errorMessage: (err as Error).message || 'Lỗi tiến trình cào'
        });
      }
      throw err;
    } finally {
      this.sessions.delete(novelId);
    }
  }

  /**
   * Helper to retrieve active browser tab across sidepanel and windows.
   */
  public async getActiveBrowserTab(): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
    const isWebUrl = (u?: string) =>
      Boolean(
        u &&
          /^https?:\/\//i.test(u) &&
          !/^https?:\/\/(?:chromewebstore\.google\.com|chrome\.google\.com\/webstore|microsoftedge\.microsoft\.com\/addons|addons\.mozilla\.org)/i.test(u)
      );
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs[0]?.id && isWebUrl(tabs[0].url)) {
        return tabs[0];
      }
    } catch {}
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id && isWebUrl(tabs[0].url)) {
        return tabs[0];
      }
    } catch {}
    try {
      const tabs = await chrome.tabs.query({ active: true });
      const normalTab = tabs.find((t) => t.id && isWebUrl(t.url));
      if (normalTab) return normalTab;
    } catch {}
    return null;
  }

  /**
   * Finds a browser tab matching the target URL or domain so background crawls continue
   * seamlessly even when the user switches to a different browser tab.
   */
  public async findTabForUrl(targetUrl: string): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
    const cleanTarget = targetUrl.split('#')[0];
    let targetHost = '';
    try {
      targetHost = new URL(targetUrl).hostname.toLowerCase();
    } catch {}

    // 1. Check active tab first
    const activeTab = await this.getActiveBrowserTab();
    if (activeTab?.url) {
      if (activeTab.url.split('#')[0] === cleanTarget) {
        return activeTab;
      }
      try {
        if (targetHost && new URL(activeTab.url).hostname.toLowerCase() === targetHost) {
          return activeTab;
        }
      } catch {}
    }

    // 2. Search across all open tabs for exact URL match or same hostname match
    try {
      const allTabs = await chrome.tabs.query({});
      if (Array.isArray(allTabs)) {
        const exactMatch = allTabs.find((t) => t.id && t.url && t.url.split('#')[0] === cleanTarget);
        if (exactMatch) return exactMatch;

        if (targetHost) {
          const sameHostMatch = allTabs.find((t) => {
            if (!t.id || !t.url) return false;
            try {
              return new URL(t.url).hostname.toLowerCase() === targetHost;
            } catch {
              return false;
            }
          });
          if (sameHostMatch) return sameHostMatch;
        }
      }
    } catch {}

    return activeTab;
  }

  /**
   * Robust HTML fetcher for extension environments:
   * 1. Attempts direct fetch WITHOUT credentials: 'include' (avoids CORS credential block in MV3).
   * 2. If direct fetch fails (Cloudflare, CORS, or TypeError: Failed to fetch), delegates to matching domain tab's content script.
   */
  public async fetchHtml(
    url: string,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; text?: string; status?: number; error?: string }> {
    let lastError: string | undefined;

    // 1. Try direct fetch without credentials: 'include'
    try {
      const res = await fetch(url, {
        signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8'
        }
      });
      if (res.ok) {
        const text = await res.text();
        return { ok: true, text, status: res.status };
      }
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${res.statusText || 'Error'}` };
    } catch (directErr) {
      if (signal?.aborted || (directErr as any)?.name === 'AbortError') {
        throw directErr;
      }
      lastError = (directErr as Error).message;
    }

    // 2. Fallback to matching domain tab content script (works even when user switched to another tab)
    try {
      const tab = await this.findTabForUrl(url);
      if (tab?.id) {
        const tabRes = await chrome.tabs.sendMessage(tab.id, { action: 'FETCH_URL', url });
        if (tabRes?.success && typeof tabRes.text === 'string') {
          return { ok: true, text: tabRes.text, status: tabRes.status || 200 };
        }
        if (tabRes?.error) {
          lastError = tabRes.error;
        }
      }
    } catch (tabErr) {
      // Tab message failed or tab closed
    }

    return { ok: false, error: lastError || 'Không thể kết nối đến trang web (Failed to fetch)' };
  }

  /**
   * Fetches single chapter HTML with polite retry and backoff on rate-limits.
   */
  private async fetchChapterWithRetry(
    url: string,
    rule?: SiteRule | null,
    adKeywords: string[] = [],
    signal?: AbortSignal,
    options?: { deobfuscate?: boolean; replacements?: Array<{ from: string; to: string }> },
    session?: CrawlSession
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Fast path: if this chapter URL matches an open tab in browser, extract directly from rendered DOM
    try {
      const tab = await this.findTabForUrl(url);
      if (tab?.id && tab?.url && tab.url.split('#')[0] === url.split('#')[0]) {
        const tabRes = await chrome.tabs.sendMessage(tab.id, {
          action: 'EXTRACT_CURRENT_PAGE',
          rule: rule ? JSON.parse(JSON.stringify(rule)) : undefined,
          adKeywords: Array.isArray(adKeywords) ? adKeywords : []
        });
        if (tabRes?.success && tabRes.data && tabRes.data.content && tabRes.data.content.trim().length > 0) {
          return { success: true, data: tabRes.data };
        }
      }
    } catch {}

    let retries = 0;
    const maxRetries = 3;

    while (retries <= maxRetries) {
      if (signal?.aborted || session?.isCancelled) {
        return { success: false, error: 'Tiến trình đã bị hủy' };
      }

      try {
        const fetchRes = await this.fetchHtml(url, signal);

        if (signal?.aborted || session?.isCancelled) {
          return { success: false, error: 'Tiến trình đã bị hủy' };
        }

        if (!fetchRes.ok || !fetchRes.text) {
          // If 404 Not Found or 410 Gone, fail immediately without retrying
          if (fetchRes.status === 404 || fetchRes.status === 410) {
            return { success: false, error: `HTTP ${fetchRes.status}: Not Found` };
          }

          if (fetchRes.status === 429 || fetchRes.status === 503) {
            // Rate limited: polite backoff
            retries++;
            if (retries > maxRetries) {
              return { success: false, error: `Bị chặn IP / Quá tải server (Mã lỗi ${fetchRes.status})` };
            }
            const backoffDelay = retries * 5000 + 3000;
            console.warn(`[CrawlManager] HTTP ${fetchRes.status} encountered. Backing off for ${backoffDelay}ms...`);
            await new Promise((r) => setTimeout(r, backoffDelay));
            continue;
          }

          retries++;
          if (retries > maxRetries) {
            return { success: false, error: fetchRes.error || 'Lỗi tải chương' };
          }
          await new Promise((r) => setTimeout(r, 2000 * retries));
          continue;
        }

        const html = fetchRes.text;
        const doc = parseSafeHtmlDocument(html);

        const extracted = extractChapterWithRule(doc, url, rule, adKeywords, options);
        return { success: true, data: extracted };
      } catch (err) {
        if (session?.isCancelled || (err as any)?.name === 'AbortError' || signal?.aborted) {
          return { success: false, error: 'Tiến trình đã bị hủy' };
        }
        retries++;
        if (retries > maxRetries) {
          return { success: false, error: (err as Error).message };
        }
        await new Promise((r) => setTimeout(r, 2000 * retries));
      }
    }

    return { success: false, error: 'Vượt quá số lần thử lại' };
  }
}

export const crawler = new CrawlManager();

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '../lib/i18n';
  import { db, decontaminateDatabase } from '../lib/db';
  import { crawler, type CrawlProgressEvent, type CrawlSession } from '../lib/crawler';
  import { getRuleForDomain, saveSiteRule } from '../lib/rules';
  import { exportNovel, detectMissingChapters } from '../lib/exporter';
  import { saveSettings } from '../lib/storage/settings';
  import { parseNovelTitleFromTabString, cleanNovelTitleText } from '../lib/extractor/heuristic';
  import { resolveActiveTabNovel, isInspectableWebUrl } from '../lib/extractor/tabInfo';
  import type { Novel, Chapter, SiteRule, AppSettings, ExportFormat } from '../lib/types';
  import { 
    MousePointer, 
    Zap, 
    ListOrdered, 
    Play, 
    Pause, 
    Square, 
    Download, 
    CheckCircle2, 
    Loader2, 
    Lock, 
    AlertCircle, 
    RefreshCw,
    PlusCircle,
    Search,
    SlidersHorizontal,
    Check
  } from '@lucide/svelte';

  let { settings } = $props<{ settings: AppSettings }>();

  // State
  let activeTabUrl = $state('');
  let activeTabTitle = $state('');
  let currentDomain = $state('');
  let matchedRule = $state<SiteRule | undefined>(undefined);

  let currentNovel = $state<Novel | null>(null);
  let chapters = $state<Chapter[]>([]);
  let selectedFormat = $state<ExportFormat>('docx');
  let omitChapterTitles = $state<boolean>(false);
  let searchQuery = $state('');

  let isCrawling = $state(false);
  let isPaused = $state(false);
  let isExporting = $state(false);
  let crawlProgress = $state({ current: 0, total: 0, percent: 0, currentTitle: '' });
  let activeSessions = $state<CrawlSession[]>([]);
  let isScanningToc = $state(false);
  let isRefreshing = $state(false);
  let tocStatusText = $state('');
  let missingChapters = $state<number[]>([]);
  let toastMessage = $state('');
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  // Chapter Range Downloader state
  let showRangeDrawer = $state(false);
  let useRange = $state(false);
  let rangeFrom = $state<number>(1);
  let rangeTo = $state<number>(100);

  function showToast(msg: string) {
    toastMessage = msg;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastMessage = '';
    }, 3500);
  }

  let unsubscribeCrawler: (() => void) | null = null;
  let tabUpdatedListener: ((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void) | null = null;
  let tabActivatedListener: ((activeInfo: any) => void) | null = null;

  function syncSessionsState() {
    activeSessions = crawler.getActiveSessions().map((s) => ({ ...s }));
    const currentSess = currentNovel?.id ? crawler.getSession(currentNovel.id) : undefined;
    if (currentSess) {
      isCrawling = true;
      isPaused = currentSess.isPaused;
      crawlProgress = {
        current: currentSess.currentChapter,
        total: currentSess.totalChapters,
        percent: currentSess.percent,
        currentTitle: currentSess.currentTitle || ''
      };
    } else {
      isCrawling = false;
      isPaused = false;
    }
  }

  async function switchToBackgroundNovel(novelId: number) {
    const nov = await db.novels.get(novelId);
    if (!nov) return;
    currentNovel = nov;
    try {
      currentDomain = new URL(nov.sourceUrl).hostname;
      matchedRule = await getRuleForDomain(currentDomain);
    } catch {}
    await reloadChapters();
    syncSessionsState();
  }

  onMount(async () => {
    selectedFormat = settings.defaultFormat || 'docx';
    omitChapterTitles = settings.omitChapterTitles ?? false;
    await detectCurrentTab();
    syncSessionsState();
    
    // Subscribe to crawler progress events (supports multiple concurrent novels)
    unsubscribeCrawler = crawler.subscribe(async (event: CrawlProgressEvent) => {
      syncSessionsState();
      if (!currentNovel || event.novelId === currentNovel.id) {
        if (!currentNovel && event.novelId) {
          const nov = await db.novels.get(event.novelId);
          if (nov) currentNovel = nov;
        }
        isCrawling = event.status === 'crawling' || event.status === 'paused';
        isPaused = event.status === 'paused';
        crawlProgress = {
          current: event.currentChapter,
          total: event.totalChapters,
          percent: event.percent,
          currentTitle: event.currentTitle || ''
        };
        if (currentNovel) {
          if (event.downloadedChapters !== undefined) {
            currentNovel.downloadedChapters = event.downloadedChapters;
          }
          if (event.totalChapters) {
            currentNovel.totalChapters = event.totalChapters;
          }
        }
        // Realtime reload on every chapter progress event
        await reloadChapters();
      }
    });

    if (crawler.isRunning) {
      syncSessionsState();
      const activeId = currentNovel?.id && crawler.isNovelCrawling(currentNovel.id)
        ? currentNovel.id
        : crawler.getActiveNovelId();
      if (activeId && (!currentNovel || currentNovel.id === activeId)) {
        if (!currentNovel) {
          const nov = await db.novels.get(activeId);
          if (nov) currentNovel = nov;
        }
        await reloadChapters();
        syncSessionsState();
      }
    }

    // Listen for picker results
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleExtensionMessages);
    }

    // Automatically reload and sync state when user refreshes (F5) or navigates in active tab
    tabUpdatedListener = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (tab.active && isInspectableWebUrl(tab.url) && (changeInfo.status === 'complete' || changeInfo.url)) {
        detectCurrentTab(tab);
      }
    };
    tabActivatedListener = async (activeInfo: any) => {
      if (activeInfo?.tabId && typeof chrome !== 'undefined' && chrome.tabs?.get) {
        try {
          const tab = await chrome.tabs.get(activeInfo.tabId);
          if (tab && isInspectableWebUrl(tab.url)) {
            detectCurrentTab(tab);
            return;
          }
          // Ignore non-web tabs (e.g. chrome://extensions, edge://extensions, about:blank)
          return;
        } catch {}
      }
      detectCurrentTab();
    };

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.onUpdated?.addListener(tabUpdatedListener);
      chrome.tabs.onActivated?.addListener(tabActivatedListener);
    }
  });

  onDestroy(() => {
    if (unsubscribeCrawler) unsubscribeCrawler();
    if (toastTimeout) clearTimeout(toastTimeout);
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.removeListener(handleExtensionMessages);
    }
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      if (tabUpdatedListener) chrome.tabs.onUpdated?.removeListener(tabUpdatedListener);
      if (tabActivatedListener) chrome.tabs.onActivated?.removeListener(tabActivatedListener);
    }
  });

  async function handleExtensionMessages(message: any) {
    if (message.action === 'PICKER_RESULT') {
      const { targetType, selector } = message;
      if (!selector) return;

      if (!matchedRule) {
        matchedRule = {
          domain: currentDomain || 'custom',
          name: currentDomain || 'Custom Site',
          contentSelector: '',
          titleSelector: '',
          nextSelector: '',
          tocSelector: '',
          isPreset: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }

      if (targetType === 'content') {
        matchedRule.contentSelector = selector;
      } else if (targetType === 'title') {
        matchedRule.titleSelector = selector;
      } else if (targetType === 'next') {
        matchedRule.nextSelector = selector;
      } else if (targetType === 'toc') {
        matchedRule.tocSelector = selector;
      }

      matchedRule.updatedAt = Date.now();
      try {
        const savedId = await saveSiteRule(matchedRule);
        if (savedId) matchedRule.id = savedId;
      } catch (err) {
        console.warn('[ScraperTab] Failed to save updated rule to DB:', err);
      }

      const typeLabels: Record<string, string> = {
        content: 'Khung nội dung',
        title: 'Tiêu đề chương',
        next: 'Nút chương sau',
        toc: 'Mục lục'
      };
      const label = typeLabels[targetType] || targetType;
      showToast(`Đã áp dụng selector cho [${label}]: ${selector}`);
    }
  }

  async function detectCurrentTab(targetTab?: chrome.tabs.Tab, forceRefresh = false) {
    try {
      let tab: chrome.tabs.Tab | null = targetTab || null;
      if (!tab) {
        tab = await crawler.getActiveBrowserTab();
      }

      if (!tab || !isInspectableWebUrl(tab.url)) {
        return;
      }

      activeTabUrl = tab.url;
      activeTabTitle = tab.title || '';

      currentDomain = '';
      try {
        currentDomain = new URL(tab.url).hostname;
        matchedRule = await getRuleForDomain(currentDomain);
      } catch {}

      // Resilient 4-tier tab novel resolver
      const resolved = await resolveActiveTabNovel(tab);
      const tabNovelTitle = (resolved.title || '').trim();
      const canonicalUrl = (resolved.canonicalUrl || '').trim();

      // Database Lookup:
      let existing: Novel | undefined = undefined;

      // Tier A: Match by exact novel title in DB
      if (tabNovelTitle && tabNovelTitle !== 'Chưa đặt tên' && !/^(?:chương|chapter)\s*\d+/i.test(tabNovelTitle)) {
        const allNovels = await db.novels.toArray();
        const cleanTabTitle = tabNovelTitle.toLowerCase().trim();
        existing = allNovels.find((n) => n.title && n.title.toLowerCase().trim() === cleanTabTitle);
      }

      // Tier B: Match by canonical novel URL
      if (!existing && canonicalUrl && !canonicalUrl.endsWith('/chapter') && !canonicalUrl.endsWith('/chapter/')) {
        existing = await db.novels.where('sourceUrl').equals(canonicalUrl).first();
      }

      // Tier C: Match by activeTabUrl if it's the main landing page
      if (!existing && !resolved.isReadingPage) {
        existing = await db.novels.where('sourceUrl').equals(activeTabUrl).first();
      }

      // Tier D: Match by chapter URL with title consistency check
      if (!existing) {
        const existingChap = await db.chapters.where('url').equals(activeTabUrl).first();
        if (existingChap?.novelId) {
          const candidate = await db.novels.get(existingChap.novelId);
          if (candidate) {
            const cleanCand = (candidate.title || '').toLowerCase().trim();
            const cleanTab = tabNovelTitle.toLowerCase().trim();
            if (cleanCand === cleanTab || !cleanCand || /^(?:chương|chapter)\s*\d+/i.test(cleanCand)) {
              existing = candidate;
            } else {
              console.warn(`[DataDecontamination] Chapter ${activeTabUrl} unlinked from "${candidate.title}".`);
              await db.chapters.delete(existingChap.id!);
            }
          }
        }
      }

      // Contradiction Guard
      if (
        existing &&
        tabNovelTitle &&
        tabNovelTitle !== 'Chưa đặt tên' &&
        !/^(?:chương|chapter)\s*\d+/i.test(tabNovelTitle) &&
        existing.title &&
        existing.title !== 'Chưa đặt tên' &&
        !/^(?:chương|chapter)\s*\d+/i.test(existing.title)
      ) {
        const cleanExisting = existing.title.toLowerCase().trim();
        const cleanDetected = tabNovelTitle.toLowerCase().trim();
        if (cleanExisting !== cleanDetected && !cleanExisting.includes(cleanDetected) && !cleanDetected.includes(cleanExisting)) {
          console.log(`[ContradictionGuard] Discarding false novel match: "${existing.title}" != "${tabNovelTitle}"`);
          existing = undefined;
        }
      }

      if (existing) {
        const dbUpdates: Partial<Novel> = {};
        if (
          tabNovelTitle &&
          !/^(?:chương|chapter)\s*\d+/i.test(tabNovelTitle) &&
          (!existing.title || /^(?:chương|chapter)\s*\d+/i.test(existing.title))
        ) {
          existing.title = tabNovelTitle;
          dbUpdates.title = tabNovelTitle;
        }
        if (resolved.coverUrl && !existing.coverUrl) {
          existing.coverUrl = resolved.coverUrl;
          dbUpdates.coverUrl = resolved.coverUrl;
        }
        if (resolved.author && !existing.author) {
          existing.author = resolved.author;
          dbUpdates.author = resolved.author;
        }
        if (Object.keys(dbUpdates).length > 0) {
          await db.novels.update(existing.id!, { ...dbUpdates, updatedAt: Date.now() });
        }
        currentNovel = existing;
        await cleanupJunkChapters(existing.id!, undefined, forceRefresh);
        await reloadChapters();
        syncSessionsState();
      } else {
        chapters = [];
        currentNovel = {
          title: tabNovelTitle || cleanTitle(activeTabTitle) || 'Chưa đặt tên',
          author: resolved.author,
          coverUrl: resolved.coverUrl,
          sourceUrl: canonicalUrl || activeTabUrl,
          totalChapters: 0,
          downloadedChapters: 0,
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        crawlProgress = { current: 0, total: 0, percent: 0, currentTitle: '' };
        syncSessionsState();
      }
    } catch (err) {
      console.warn('[ScraperTab] Failed to detect tab', err);
    }
  }

  async function cleanupJunkChapters(novelId: number, _storySlug?: string, forceCleanAllJunk = false) {
    try {
      const all = await db.chapters.where('novelId').equals(novelId).toArray();
      let changed = false;

      // Group by chapterNumber and deduplicate
      const byNum = new Map<number, Chapter[]>();
      for (const ch of all) {
        if (!byNum.has(ch.chapterNumber)) byNum.set(ch.chapterNumber, []);
        byNum.get(ch.chapterNumber)!.push(ch);
      }

      for (const [num, chaps] of byNum.entries()) {
        if (chaps.length > 1) {
          chaps.sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return -1;
            if (b.status === 'completed' && a.status !== 'completed') return 1;
            return (b.content?.length || 0) - (a.content?.length || 0);
          });
          for (let i = 1; i < chaps.length; i++) {
            if (chaps[i].id) {
              await db.chapters.delete(chaps[i].id!);
              changed = true;
            }
          }
        }
      }

      // Remove duplicate URLs & junk title lines
      const remaining = await db.chapters.where('novelId').equals(novelId).toArray();
      const seenUrls = new Set<string>();

      for (const ch of remaining) {
        if (!ch.id) continue;
        const title = (ch.title || '').trim();
        const url = ch.url || '';
        const isJunkCount = /^\d+\s*(?:chương|chapters?|chaps?)$/i.test(title);
        const isNavButton = /^(?:[《<‹\u300a\u2039]*\s*)?(?:chương\s+(?:sau|tiếp|trước)|tiếp(?:\s+theo)?|sau|next|prev|quay lại|lùi)(?:[\s»>→›\u300b\u203a\u2192]*)$/i.test(title);
        const isDuplicate = seenUrls.has(url);
        const isEmptyPendingOrFailed = (!ch.content || ch.content.length === 0) && (ch.status === 'pending' || ch.status === 'failed');

        if (
          isDuplicate ||
          (isEmptyPendingOrFailed && (isJunkCount || isNavButton)) ||
          (forceCleanAllJunk && (isJunkCount || isNavButton))
        ) {
          await db.chapters.delete(ch.id);
          changed = true;
          continue;
        }

        seenUrls.add(url);
      }

      if (changed) {
        const finalChapters = await db.chapters.where('novelId').equals(novelId).toArray();
        const completedCount = finalChapters.filter((c) => c.status === 'completed' || c.status === 'locked').length;
        await db.novels.update(novelId, {
          totalChapters: finalChapters.length,
          downloadedChapters: completedCount,
          updatedAt: Date.now()
        });
        if (currentNovel && currentNovel.id === novelId) {
          currentNovel.totalChapters = finalChapters.length;
          currentNovel.downloadedChapters = completedCount;
        }
      }
    } catch (err) {
      console.warn('[ScraperTab] Failed to cleanup junk chapters', err);
    }
  }

  async function handleManualRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      await decontaminateDatabase();
      const tab = await crawler.getActiveBrowserTab();
      if (!tab) {
        showToast('Không tìm thấy tab trình duyệt đang mở');
        return;
      }
      await detectCurrentTab(tab, true);

      if (currentNovel?.title && currentNovel.title !== 'Chưa đặt tên') {
        showToast(`Đã nhận diện: "${currentNovel.title}" (${chapters.length} chương)`);
      } else {
        showToast('Đã làm mới thông tin trang');
      }
    } catch (err) {
      showToast(`Không thể làm mới: ${(err as Error).message}`);
    } finally {
      setTimeout(() => {
        isRefreshing = false;
      }, 500);
    }
  }

  async function handleForceNewNovel() {
    try {
      const tab = await crawler.getActiveBrowserTab();
      if (!tab) return;
      const resolved = await resolveActiveTabNovel(tab);
      const title = resolved.title || 'Truyện mới';
      const plain = {
        title,
        author: resolved.author,
        coverUrl: resolved.coverUrl,
        sourceUrl: resolved.canonicalUrl || tab.url || '',
        totalChapters: 0,
        downloadedChapters: 0,
        status: 'idle' as const,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const newId = await db.novels.add(plain);
      currentNovel = { ...plain, id: newId as number };
      chapters = [];
      crawlProgress = { current: 0, total: 0, percent: 0, currentTitle: '' };
      showToast(`Đã tạo bộ truyện mới: "${title}"`);
    } catch (err) {
      showToast(`Lỗi tạo truyện mới: ${(err as Error).message}`);
    }
  }

  async function handleResetChapters() {
    if (!currentNovel?.id) return;
    if (isCrawling) {
      alert('Đang cào dữ liệu, không thể xóa danh sách chương.');
      return;
    }
    const confirmed = confirm('Bạn có chắc muốn xóa danh sách chương hiện tại để quét lại từ đầu không?');
    if (!confirmed) return;

    await db.chapters.where('novelId').equals(currentNovel.id).delete();
    await db.novels.update(currentNovel.id, {
      totalChapters: 0,
      downloadedChapters: 0,
      updatedAt: Date.now()
    });
    currentNovel.totalChapters = 0;
    currentNovel.downloadedChapters = 0;
    chapters = [];
    showToast('Đã làm trống danh sách chương');
  }

  function toPlainNovel(novel: Partial<Novel>): Novel {
    let raw: any = novel;
    try {
      raw = $state.snapshot(novel || {});
    } catch {
      raw = novel || {};
    }
    const clean: Novel = {
      ...(raw?.id ? { id: Number(raw.id) } : {}),
      title: String(raw?.title || 'Chưa đặt tên'),
      author: raw?.author ? String(raw.author) : undefined,
      coverUrl: raw?.coverUrl ? String(raw.coverUrl) : undefined,
      sourceUrl: String(raw?.sourceUrl || activeTabUrl || ''),
      totalChapters: Number(raw?.totalChapters || 0),
      downloadedChapters: Number(raw?.downloadedChapters || 0),
      status: (raw?.status || 'idle') as any,
      createdAt: Number(raw?.createdAt || Date.now()),
      updatedAt: Number(raw?.updatedAt || Date.now())
    };
    return JSON.parse(JSON.stringify(clean));
  }

  function cleanTitle(raw: string): string {
    return raw
      .replace(/ - (TruyệnFull|Cổ Mộng|Tàng Thư Viện|Mê Truyện Chữ|Web).*$/i, '')
      .replace(/\|.*$/, '')
      .trim();
  }

  async function reloadChapters() {
    if (!currentNovel?.id) return;
    chapters = await db.chapters.where('novelId').equals(currentNovel.id).sortBy('chapterNumber');
    missingChapters = detectMissingChapters(chapters);
  }

  async function startVisualPicker(targetType: 'content' | 'title' | 'next' | 'toc') {
    try {
      const tab = await crawler.getActiveBrowserTab();
      if (!tab?.id || !isInspectableWebUrl(tab.url)) {
        showToast('Hãy mở trang truyện web (http/https) trước khi chọn vùng.');
        return;
      }
      await chrome.tabs.sendMessage(tab.id, {
        action: 'START_PICKER',
        targetType
      });
    } catch (err) {
      showToast('Không thể kích hoạt picker: hãy tải lại (F5) trang web và thử lại.');
    }
  }

  async function handleAutoDetect() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        const plainRule = matchedRule ? JSON.parse(JSON.stringify(matchedRule)) : undefined;
        let plainKeywords: string[] = [];
        if (Array.isArray(settings?.adKeywords)) {
          plainKeywords = JSON.parse(JSON.stringify(settings.adKeywords));
        } else if (typeof settings?.adKeywords === 'string') {
          plainKeywords = (settings.adKeywords as string).split('\n').map((s) => s.trim()).filter(Boolean);
        } else if (settings?.adKeywords && typeof settings.adKeywords === 'object') {
          plainKeywords = Object.values(settings.adKeywords);
        }
        const res = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'EXTRACT_CURRENT_PAGE',
          rule: plainRule,
          adKeywords: plainKeywords
        });
        if (res?.success && res.data) {
          if (
            res.data.novelTitle &&
            (!currentNovel?.title ||
              currentNovel.title === 'Chưa đặt tên' ||
              /^(?:chương|chapter)\s*\d+/i.test(currentNovel.title))
          ) {
            if (currentNovel) {
              currentNovel.title = res.data.novelTitle;
              if (currentNovel.id) {
                await db.novels.update(currentNovel.id, { title: res.data.novelTitle, updatedAt: Date.now() });
              }
            }
          }
        }
        if (res?.success && res.data && res.data.content && res.data.content.trim().length > 0) {
          showToast(`Nhận diện: "${res.data.title}" (${res.data.content.length} ký tự)`);
        } else if (res?.success && res.data?.title) {
          showToast(`Tiêu đề: "${res.data.title}". Hãy dùng "Chọn vùng" để chọn khung nội dung.`);
        } else {
          showToast('Không tìm thấy nội dung hợp lệ trên trang này.');
        }
      }
    } catch (err) {
      showToast(`Lỗi nhận diện trang: ${(err as Error).message || 'Hãy F5 lại trang'}`);
    }
  }

  async function handleScanToc() {
    if (!activeTabUrl) return;
    isScanningToc = true;
    tocStatusText = 'Đang quét mục lục...';

    try {
      const tab = await crawler.getActiveBrowserTab();
      if (tab) {
        await detectCurrentTab(tab);
      }

      if (!currentNovel?.id) {
        const plainNovel = toPlainNovel(currentNovel || {});
        const newId = await db.novels.add(plainNovel);
        currentNovel = { ...plainNovel, id: newId as number };
      }

      const plainRule = matchedRule ? JSON.parse(JSON.stringify(matchedRule)) : undefined;
      const scanned = await crawler.scanFullToc(activeTabUrl, plainRule, 200, (page, found) => {
        tocStatusText = `Trang ${page}: Tìm thấy ${found} chương...`;
      });

      if (scanned.length === 0) {
        showToast('Không tìm thấy mục lục. Bạn có thể bấm "Tải nhanh" để cào trực tiếp.');
        isScanningToc = false;
        return;
      }

      const scannedUrlSet = new Set(scanned.map((s) => s.url));
      const existingChapters = await db.chapters.where('novelId').equals(currentNovel.id!).toArray();
      for (const ch of existingChapters) {
        if (!scannedUrlSet.has(ch.url)) {
          if (!ch.content || ch.content.length === 0 || ch.status === 'pending' || ch.chapterNumber > scanned.length) {
            await db.chapters.delete(ch.id!);
          }
        }
      }

      for (const item of scanned) {
        const existing = await db.chapters
          .where('novelId')
          .equals(currentNovel.id!)
          .and((c) => c.url === item.url || c.chapterNumber === item.chapterNumber)
          .first();

        if (!existing) {
          const plainChap = JSON.parse(JSON.stringify({
            novelId: currentNovel.id!,
            chapterNumber: item.chapterNumber,
            title: item.title,
            url: item.url,
            content: '',
            wordCount: 0,
            status: 'pending'
          }));
          await db.chapters.add(plainChap);
        } else if (existing.status === 'pending') {
          await db.chapters.update(existing.id!, {
            title: item.title,
            chapterNumber: item.chapterNumber,
            url: item.url
          });
        }
      }

      await cleanupJunkChapters(currentNovel.id!, undefined, true);
      await reloadChapters();

      const completedCount = chapters.filter(c => c.status === 'completed' || c.status === 'locked').length;
      await db.novels.update(currentNovel.id!, {
        totalChapters: chapters.length,
        downloadedChapters: completedCount,
        updatedAt: Date.now()
      });

      currentNovel.totalChapters = chapters.length;
      currentNovel.downloadedChapters = completedCount;

      showToast(`Đã tìm thấy ${scanned.length} chương!`);
    } catch (err) {
      showToast(`Lỗi quét mục lục: ${(err as Error).message}`);
    } finally {
      isScanningToc = false;
      tocStatusText = '';
    }
  }

  async function handleStartCrawl() {
    try {
      if (!currentNovel?.id) {
        const plainNovel = toPlainNovel(currentNovel || {});
        const newId = await db.novels.add(plainNovel);
        currentNovel = { ...plainNovel, id: newId as number };
      }

      if (chapters.length === 0) {
        const chapTitleMatch = (activeTabTitle || '').match(/(?:Chương|Chapter|Hồi|Tiết)\s*\d+[^\-|•]*/i);
        const firstChapTitle = chapTitleMatch ? chapTitleMatch[0].trim() : 'Chương 1';
        const firstChap = JSON.parse(JSON.stringify({
          novelId: currentNovel.id,
          chapterNumber: 1,
          title: firstChapTitle,
          url: activeTabUrl,
          content: '',
          wordCount: 0,
          status: 'pending'
        }));
        await db.chapters.add(firstChap);
        await reloadChapters();
      }

      isCrawling = true;
      isPaused = false;
      const plainSettings = JSON.parse(JSON.stringify(settings));
      const rangeOption = useRange
        ? { fromChapter: rangeFrom || undefined, toChapter: rangeTo || undefined, allowConcurrent: true }
        : { allowConcurrent: true };
      crawler.startCrawl(currentNovel.id, plainSettings, rangeOption);
      syncSessionsState();
    } catch (err) {
      syncSessionsState();
      showToast(`Lỗi cào truyện: ${(err as Error).message}`);
    }
  }

  function handlePauseCrawl() {
    crawler.pause(currentNovel?.id);
    syncSessionsState();
  }

  function handleResumeCrawl() {
    crawler.resume(currentNovel?.id);
    syncSessionsState();
  }

  function handleCancelCrawl() {
    crawler.cancel(currentNovel?.id);
    syncSessionsState();
  }

  async function handleExport() {
    if (!currentNovel) return;
    const downloaded = chapters.filter((c) => c.status === 'completed' || c.status === 'locked');
    if (downloaded.length === 0) {
      showToast('Chưa có chương nào được tải để xuất file');
      return;
    }
    isExporting = true;
    try {
      if (currentNovel.id && currentNovel.title) {
        await db.novels.update(currentNovel.id, {
          title: currentNovel.title.trim(),
          updatedAt: Date.now()
        });
      }
      await exportNovel(currentNovel, downloaded, selectedFormat, 0, { omitChapterTitles });
      showToast(`Đã xuất file ${selectedFormat.toUpperCase()} thành công!`);
    } catch (err) {
      showToast(`Lỗi xuất file: ${(err as Error).message}`);
    } finally {
      isExporting = false;
    }
  }

  async function toggleOmitChapterTitles() {
    omitChapterTitles = !omitChapterTitles;
    if (settings) {
      settings.omitChapterTitles = omitChapterTitles;
      await saveSettings(settings);
    }
  }

  async function handleRetryMissing() {
    if (!currentNovel?.id) return;
    for (const chap of chapters) {
      if (chap.status === 'failed' && chap.id) {
        await db.chapters.update(chap.id, { status: 'pending' });
      }
    }
    await reloadChapters();
    handleStartCrawl();
  }

  // Background sessions (other novels currently crawling in parallel across other tabs)
  const backgroundSessions = $derived(
    activeSessions.filter((s) => s.novelId !== currentNovel?.id)
  );

  // Derived statistics
  const downloadedCount = $derived(chapters.filter(c => c.status === 'completed' || c.status === 'locked').length);
  const totalWords = $derived(chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0));
  const estimatedReadMinutes = $derived(Math.max(1, Math.round(totalWords / 450)));

  // Realtime storage progress calculations
  const effectiveTotal = $derived(chapters.length || crawlProgress.total || currentNovel?.totalChapters || 0);
  const effectiveDownloaded = $derived(
    Math.max(
      downloadedCount,
      currentNovel?.downloadedChapters || 0,
      isCrawling && crawlProgress.current > 1 ? crawlProgress.current - 1 : 0
    )
  );
  const effectivePercent = $derived(
    effectiveTotal > 0 ? Math.min(100, Math.round((effectiveDownloaded / effectiveTotal) * 100)) : (crawlProgress.percent || 0)
  );

  const filteredChapters = $derived(
    chapters.filter(c => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (c.title || '').toLowerCase().includes(q) || String(c.chapterNumber) === q;
    })
  );

  function applyRange() {
    useRange = true;
    showToast(`Đã chọn dải chương từ ${rangeFrom} đến ${rangeTo}`);
    showRangeDrawer = false;
  }
</script>

<div class="scraper-container">
  
  <!-- Floating Toast Notification -->
  {#if toastMessage}
    <div class="toast-notification">
      <CheckCircle2 size={13} class="icon-toast" />
      <span class="toast-text">{toastMessage}</span>
    </div>
  {/if}

  <!-- ACTIVE BACKGROUND CRAWLS PANEL (Multi-Tab / Multi-Novel Concurrent Queue) -->
  {#if backgroundSessions.length > 0}
    <div class="bg-crawls-panel glass-panel">
      <div class="bg-crawls-header">
        <span class="bg-crawls-badge">
          <Loader2 size={11} class="spin" />
          <span>Đang cào ngầm ({backgroundSessions.length} truyện)</span>
        </span>
      </div>
      <div class="bg-crawls-list">
        {#each backgroundSessions as bg (bg.novelId)}
          <div class="bg-crawl-item">
            <button
              type="button"
              class="bg-crawl-info"
              onclick={() => switchToBackgroundNovel(bg.novelId)}
              title="Nhấn để xem tiến trình bộ truyện này"
            >
              <div class="bg-crawl-top">
                <span class="bg-crawl-title">{bg.novelTitle}</span>
                <span class="bg-crawl-ratio font-mono">{bg.downloadedChapters}/{bg.totalChapters} ({bg.percent}%)</span>
              </div>
              <div class="bg-crawl-bar">
                <div class="bg-crawl-fill" style="width: {bg.percent}%;"></div>
              </div>
            </button>
            <div class="bg-crawl-actions">
              {#if bg.isPaused}
                <button
                  type="button"
                  class="bg-mini-btn"
                  onclick={() => { crawler.resume(bg.novelId); syncSessionsState(); }}
                  title="Tiếp tục cào"
                >
                  <Play size={10} />
                </button>
              {:else}
                <button
                  type="button"
                  class="bg-mini-btn"
                  onclick={() => { crawler.pause(bg.novelId); syncSessionsState(); }}
                  title="Tạm dừng"
                >
                  <Pause size={10} />
                </button>
              {/if}
              <button
                type="button"
                class="bg-mini-btn cancel"
                onclick={() => { crawler.cancel(bg.novelId); syncSessionsState(); }}
                title="Hủy cào truyện này"
              >
                <Square size={10} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- HERO NOVEL CARD (Liquid Glass Kit + Gradient 03) -->
  <div class="hero-novel-card glass-panel">
    
    <!-- Top Source & Meta Header -->
    <div class="hero-header">
      <div class="source-tag">
        <span class="source-pulse"></span>
        <span class="source-domain">{currentDomain || 'comong.info'}</span>
        <span class="source-sep">•</span>
        <span class="preset-badge">{matchedRule ? matchedRule.name : 'Auto'}</span>
      </div>

      <div class="hero-header-actions">
        <button
          class="liquid-icon-btn"
          onclick={handleForceNewNovel}
          title="Tạo bộ truyện mới"
        >
          <PlusCircle size={12} />
        </button>
        <button
          class="liquid-icon-btn"
          onclick={handleManualRefresh}
          title="Đồng bộ tab và làm mới dữ liệu"
          disabled={isRefreshing}
        >
          <RefreshCw size={12} class={isRefreshing ? 'spin' : ''} />
        </button>
      </div>
    </div>

    <!-- Novel Details & Book Spine -->
    <div class="hero-body">
      <div class="book-spine" class:has-cover={Boolean(currentNovel?.coverUrl)}>
        {#if currentNovel?.coverUrl}
          <img src={currentNovel.coverUrl} alt={currentNovel.title} class="spine-cover-img" />
        {:else}
          <div class="spine-title">{currentNovel?.title || 'NOVEL'}</div>
        {/if}
        <div class="spine-badge">{effectiveTotal} CH</div>
      </div>

      <div class="novel-meta-content">
        {#if currentNovel}
          <input
            type="text"
            class="hero-title-input"
            bind:value={currentNovel.title}
            placeholder={t('novelTitle')}
            title="Nhấp để sửa tên truyện"
          />
        {/if}

        <div class="meta-chips-row">
          {#if currentNovel?.author}
            <span class="meta-chip author-chip" title={currentNovel.author}>{currentNovel.author}</span>
          {/if}
          <span class="meta-chip">{totalWords > 0 ? `${(totalWords / 1000).toFixed(1)}k chữ` : '0 chữ'}</span>
          <span class="meta-chip">~{estimatedReadMinutes}p đọc</span>
          {#if useRange}
            <span class="meta-chip range-chip">Chương {rangeFrom}–{rangeTo}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Realtime Liquid Progress Bar -->
    <div class="hero-progress-section">
      <div class="progress-info-row">
        <span class="progress-title">
          {#if isCrawling && crawlProgress.currentTitle}
            <Loader2 size={11} class="spin inline-loader" />
            <span class="live-title">{crawlProgress.currentTitle}</span>
          {:else}
            Tiến độ lưu trữ
          {/if}
        </span>
        <span class="progress-ratio font-mono">{effectiveDownloaded} / {effectiveTotal} ({effectivePercent}%)</span>
      </div>

      <div class="progress-bar-track">
        <div 
          class="progress-bar-fill" 
          class:crawling={isCrawling}
          style="width: {effectiveTotal > 0 ? effectivePercent : 0}%;"
        ></div>
      </div>
    </div>

    <!-- Liquid Glass Actions Row -->
    <div class="hero-actions-grid">
      {#if !isCrawling}
        <button class="btn-liquid-primary" onclick={handleStartCrawl}>
          <Zap size={13} />
          <span>{chapters.some(c => c.status === 'completed') ? 'Tiếp tục cào' : 'Tải nhanh'}</span>
        </button>
      {:else if isPaused}
        <button class="btn-liquid-primary resume" onclick={handleResumeCrawl}>
          <Play size={13} />
          <span>Tiếp tục</span>
        </button>
        <button class="btn-liquid-secondary cancel" onclick={handleCancelCrawl} title="Hủy bỏ">
          <Square size={11} />
        </button>
      {:else}
        <button class="btn-liquid-primary pause" onclick={handlePauseCrawl}>
          <Pause size={13} />
          <span>Tạm dừng</span>
        </button>
        <button class="btn-liquid-secondary cancel" onclick={handleCancelCrawl} title="Hủy bỏ">
          <Square size={11} />
        </button>
      {/if}

      <button class="btn-liquid-secondary" onclick={() => startVisualPicker('content')} title="Chọn khung nội dung bằng chuột">
        <MousePointer size={12} />
        <span>Chọn vùng</span>
      </button>

      <button class="btn-liquid-secondary" onclick={handleScanToc} disabled={isScanningToc} title="Quét toàn bộ mục lục">
        {#if isScanningToc}
          <Loader2 size={12} class="spin" />
          <span>Quét...</span>
        {:else}
          <ListOrdered size={12} />
          <span>Mục lục</span>
        {/if}
      </button>
    </div>

  </div>

  <!-- Missing Chapters Alert -->
  {#if missingChapters.length > 0}
    <div class="alert-missing">
      <AlertCircle size={13} />
      <span class="alert-text">Thiếu {missingChapters.length} chương ({missingChapters.slice(0, 4).join(', ')}{missingChapters.length > 4 ? '...' : ''})</span>
      <button class="btn-missing-retry" onclick={handleRetryMissing}>{t('btnExportMissing')}</button>
    </div>
  {/if}

  <!-- CHAPTER LIST SECTION -->
  <div class="chapter-manager-section">
    <div class="manager-header">
      <div class="header-left">
        <span class="section-title">{t('chapterList')}</span>
        <span class="count-badge font-mono">{effectiveTotal}</span>
      </div>

      {#if chapters.length > 0 && !isCrawling}
        <button class="text-btn danger" onclick={handleResetChapters}>Làm trống</button>
      {/if}
    </div>

    <!-- Liquid Glass Pill Search & Range Filter -->
    <div class="filter-toolbar">
      <div class="search-input-wrap">
        <Search size={12} class="search-icon" />
        <input 
          type="text" 
          bind:value={searchQuery}
          placeholder="Tìm kiếm chương..."
          class="search-input"
        />
        {#if searchQuery}
          <button class="search-clear-btn" onclick={() => searchQuery = ''}>✕</button>
        {/if}
      </div>

      <button 
        class="range-toggle-btn" 
        class:active={showRangeDrawer || useRange}
        onclick={() => showRangeDrawer = !showRangeDrawer}
        title="Chọn dải chương tải về"
      >
        <SlidersHorizontal size={12} />
        <span>Dải</span>
      </button>
    </div>

    <!-- Range Selector Drawer -->
    {#if showRangeDrawer}
      <div class="range-drawer glass-panel">
        <div class="range-inputs">
          <label>Từ
            <input type="number" min="1" max={chapters.length || 100} bind:value={rangeFrom} class="range-num-input" />
          </label>
          <label>Đến
            <input type="number" min="1" max={chapters.length || 100} bind:value={rangeTo} class="range-num-input" />
          </label>
        </div>
        <div class="range-actions">
          <button class="range-apply-btn" onclick={applyRange}>Áp dụng</button>
          {#if useRange}
            <button class="range-reset-btn" onclick={() => { useRange = false; showRangeDrawer = false; showToast('Đã hủy tải theo dải'); }}>Hủy</button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Liquid Glass Chapter List -->
    <div class="chapters-scroll-box">
      {#if chapters.length === 0}
        <div class="empty-chapters glass-panel">
          <p class="empty-lead">Chưa có danh sách chương</p>
          <p class="empty-sub">Bấm <strong>Tải nhanh</strong> hoặc <strong>Mục lục</strong> để bắt đầu.</p>
        </div>
      {:else if filteredChapters.length === 0}
        <div class="empty-chapters glass-panel">
          <p class="empty-sub">Không tìm thấy chương khớp với "{searchQuery}"</p>
        </div>
      {:else}
        {#each filteredChapters as chap (chap.id || chap.url)}
          <div class="chapter-card" class:completed={chap.status === 'completed'} class:crawling={chap.status === 'crawling'}>
            <div class="chap-left">
              <span class="chap-check" class:active={chap.status === 'completed'} class:crawling={chap.status === 'crawling'}>
                {#if chap.status === 'completed'}
                  <Check size={9} strokeWidth={3} />
                {:else if chap.status === 'crawling'}
                  <Loader2 size={9} class="spin" />
                {:else if chap.status === 'locked'}
                  <Lock size={9} />
                {:else if chap.status === 'failed'}
                  <AlertCircle size={9} />
                {/if}
              </span>
              <span class="chap-name" title={chap.title}>{chap.title}</span>
            </div>

            <div class="chap-right">
              {#if chap.wordCount > 0}
                <span class="chap-words font-mono">{chap.wordCount.toLocaleString()}w</span>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- STREAMLINED LIQUID GLASS EXPORT DOCK -->
  <footer class="export-dock glass-panel">
    <div class="dock-top-bar">
      <!-- Segmented Format Pills (No emoji clutter) -->
      <div class="format-pills-well">
        {#each (['docx', 'pdf', 'txt', 'epub'] as const) as fmt}
          <button 
            class="format-pill" 
            class:active={selectedFormat === fmt}
            onclick={() => selectedFormat = fmt}
          >
            {fmt.toUpperCase()}
          </button>
        {/each}
      </div>

      <!-- Compact Liquid Pill Switch for Omitting Chapter Numbers -->
      <button
        type="button"
        class="omit-pill-switch"
        class:active={omitChapterTitles}
        onclick={toggleOmitChapterTitles}
        title="Loại bỏ dòng đánh số chương (Chương 1, 2...) khi xuất file"
      >
        <span class="switch-dot"></span>
        <span>Bỏ số chương</span>
      </button>
    </div>

    <!-- Primary Liquid Dome Export Button -->
    <button 
      class="btn-dock-export"
      onclick={handleExport}
      disabled={chapters.length === 0 || isExporting}
    >
      {#if isExporting}
        <Loader2 size={13} class="spin" />
        <span>Đang đóng gói {selectedFormat.toUpperCase()}...</span>
      {:else}
        <Download size={13} />
        <span>Xuất file {selectedFormat.toUpperCase()}{omitChapterTitles ? ' (Đã bỏ số chương)' : ''}</span>
      {/if}
    </button>
  </footer>

</div>

<style>
  .scraper-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 6px 14px 96px 14px;
    min-height: calc(100vh - 84px);
    position: relative;
  }

  .font-mono {
    font-family: var(--font-mono);
  }

  /* Toast Notification */
  .toast-notification {
    position: fixed;
    bottom: 92px;
    left: 14px;
    right: 14px;
    background: rgba(18, 28, 46, 0.88);
    border: 1px solid var(--border-glass-strong);
    box-shadow: var(--liquid-pill-shadow);
    color: #FFFFFF;
    border-radius: var(--radius-full);
    padding: 7px 14px;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 7px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 1000;
    animation: toast-in 0.22s ease-out;
  }

  [data-theme="light"] .toast-notification {
    background: rgba(255, 255, 255, 0.92);
    color: var(--text-primary);
    border-color: var(--border-glass-accent);
  }

  @keyframes toast-in {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  /* ==========================================================================
     Background Multi-Novel Crawl Queue Panel
     ========================================================================== */
  .bg-crawls-panel {
    padding: 8px 11px;
    background:
      linear-gradient(135deg, rgba(167, 118, 147, 0.16) 0%, rgba(23, 72, 113, 0.22) 100%),
      var(--surface-glass);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .bg-crawls-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .bg-crawls-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 700;
    color: var(--accent-primary);
  }

  .bg-crawls-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .bg-crawl-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    background: var(--surface-pill-well);
    border: 1px solid var(--border-subtle);
  }

  .bg-crawl-info {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    color: inherit;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .bg-crawl-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .bg-crawl-title {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bg-crawl-ratio {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--accent-primary);
    flex-shrink: 0;
  }

  .bg-crawl-bar {
    width: 100%;
    height: 4px;
    border-radius: var(--radius-full);
    background: var(--surface-input);
    overflow: hidden;
  }

  .bg-crawl-fill {
    height: 100%;
    border-radius: var(--radius-full);
    background: var(--gradient-03-vivid);
    transition: width 0.25s ease;
  }

  .bg-crawl-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .bg-mini-btn {
    width: 22px;
    height: 22px;
    border-radius: var(--radius-full);
    border: 1px solid var(--border-glass);
    background: var(--surface-glass-card);
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .bg-mini-btn:hover {
    color: var(--text-primary);
    border-color: var(--border-glass-accent);
  }

  .bg-mini-btn.cancel:hover {
    color: var(--accent-error);
    border-color: rgba(251, 113, 133, 0.45);
  }

  /* ==========================================================================
     Hero Novel Card (Liquid Glass Kit)
     ========================================================================== */
  .hero-novel-card {
    padding: 12px 13px;
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(135deg, rgba(167, 118, 147, 0.14) 0%, rgba(23, 72, 113, 0.16) 100%),
      var(--surface-glass);
  }

  .hero-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .source-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: var(--radius-full);
    background: var(--surface-pill-well);
    border: 1px solid var(--border-subtle);
  }

  .source-pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-success);
    box-shadow: 0 0 8px var(--accent-success);
  }

  .source-domain {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .source-sep {
    font-size: 9px;
    color: var(--text-muted);
  }

  .preset-badge {
    font-size: 9.5px;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .hero-header-actions {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .liquid-icon-btn {
    width: 25px;
    height: 25px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-glass-card);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .liquid-icon-btn:hover {
    background: var(--surface-glass-hover);
    color: var(--text-primary);
    border-color: var(--border-glass-accent);
    transform: translateY(-0.5px);
  }

  /* Hero Body */
  .hero-body {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .book-spine {
    width: 42px;
    height: 56px;
    border-radius: 11px;
    background: var(--gradient-03-vivid);
    box-shadow: var(--liquid-pill-shadow);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 5px 4px;
    flex-shrink: 0;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.38);
    position: relative;
  }

  .book-spine.has-cover {
    padding: 0;
    justify-content: flex-end;
  }

  .spine-cover-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .book-spine.has-cover .spine-badge {
    position: relative;
    z-index: 1;
    margin: 0 3px 3px 3px;
    background: rgba(10, 18, 32, 0.78);
    backdrop-filter: blur(4px);
  }

  .author-chip {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--accent-primary) !important;
  }

  .spine-title {
    font-size: 6.5px;
    font-weight: 800;
    color: #FFFFFF;
    line-height: 1.15;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .spine-badge {
    background: rgba(10, 18, 32, 0.45);
    border-radius: 6px;
    font-size: 7px;
    font-weight: 700;
    color: #FFFFFF;
    text-align: center;
    padding: 1px 0;
    font-family: var(--font-mono);
  }

  .novel-meta-content {
    flex: 1;
    min-width: 0;
  }

  .hero-title-input {
    width: 100%;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    font-size: 13px;
    font-weight: 800;
    color: var(--text-primary);
    padding: 2px 5px;
    margin-left: -5px;
    line-height: 1.25;
    outline: none;
    transition: all 0.2s ease;
  }

  .hero-title-input:hover,
  .hero-title-input:focus {
    background: var(--surface-input);
    border-color: var(--border-glass-accent);
  }

  .meta-chips-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
  }

  .meta-chip {
    font-size: 9.5px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    background: var(--surface-glass-card);
    border: 1px solid var(--border-subtle);
    box-shadow: var(--liquid-inner-shadow);
    color: var(--text-secondary);
  }

  .meta-chip.range-chip {
    color: var(--grad-rose-bright);
    border-color: var(--border-glass-accent);
  }

  /* Liquid Progress Section */
  .hero-progress-section {
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
    margin-bottom: 10px;
  }

  .progress-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    margin-bottom: 5px;
    gap: 8px;
  }

  .progress-title {
    color: var(--text-secondary);
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    flex: 1;
  }

  .live-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary);
  }

  .progress-ratio {
    color: var(--text-primary);
    font-weight: 700;
    flex-shrink: 0;
  }

  .progress-bar-track {
    width: 100%;
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--surface-pill-well);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: var(--radius-full);
    background: var(--gradient-03-horizontal);
    box-shadow: 0 0 10px rgba(167, 118, 147, 0.5);
    transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .progress-bar-fill.crawling {
    background: linear-gradient(90deg, #A77693 0%, #4CC9B0 50%, #174871 100%);
    background-size: 200% 100%;
    animation: progress-glow 2s ease infinite;
  }

  @keyframes progress-glow {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  /* Liquid Glass Actions Grid */
  .hero-actions-grid {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-liquid-primary {
    flex: 1.6;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: var(--radius-full);
    background: var(--gradient-03-vivid);
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid rgba(255, 255, 255, 0.38);
    cursor: pointer;
    box-shadow: var(--liquid-pill-shadow);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-liquid-primary:hover {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }

  .btn-liquid-primary.pause {
    background: linear-gradient(135deg, #D98A4E 0%, #9E5231 100%);
  }

  .btn-liquid-primary.resume {
    background: linear-gradient(135deg, #4CC9B0 0%, #176D71 100%);
  }

  .btn-liquid-secondary {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 7px 9px;
    border-radius: var(--radius-full);
    background: var(--surface-glass-card);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    color: var(--text-primary);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-liquid-secondary:hover {
    background: var(--surface-glass-hover);
    border-color: var(--border-glass-accent);
    transform: translateY(-0.5px);
  }

  .btn-liquid-secondary.cancel {
    flex: 0 0 30px;
    padding: 7px 0;
    color: var(--accent-error);
    border-color: rgba(242, 116, 116, 0.35);
  }

  /* Missing Alert */
  .alert-missing {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 12px;
    background: rgba(245, 185, 95, 0.12);
    border: 1px solid rgba(245, 185, 95, 0.35);
    border-radius: var(--radius-full);
    color: var(--accent-warning);
    font-size: 10.5px;
    font-weight: 600;
  }

  .btn-missing-retry {
    background: var(--accent-warning);
    color: #0B1320;
    border: none;
    border-radius: var(--radius-full);
    padding: 2px 9px;
    font-size: 9.5px;
    font-weight: 700;
    cursor: pointer;
  }

  /* ==========================================================================
     Chapter Manager Section
     ========================================================================== */
  .chapter-manager-section {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .manager-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
  }

  .count-badge {
    font-size: 9.5px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: var(--radius-full);
    background: var(--surface-glass-card);
    border: 1px solid var(--border-glass);
    color: var(--text-primary);
  }

  .text-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.15s;
  }

  .text-btn.danger:hover {
    color: var(--accent-error);
  }

  .filter-toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .search-input-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 11px;
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 6px 26px 6px 30px;
    border-radius: var(--radius-full);
    background: var(--surface-input);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    color: var(--text-primary);
    font-size: 11px;
    outline: none;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    border-color: var(--border-glass-accent);
    box-shadow: var(--liquid-inner-shadow), var(--glow-cyan-sm);
  }

  .search-clear-btn {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 10px;
  }

  .range-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 11px;
    border-radius: var(--radius-full);
    background: var(--surface-glass-card);
    border: 1px solid var(--border-glass);
    box-shadow: var(--liquid-inner-shadow);
    color: var(--text-secondary);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .range-toggle-btn.active,
  .range-toggle-btn:hover {
    background: var(--surface-glass-hover);
    color: var(--text-primary);
    border-color: var(--border-glass-accent);
  }

  /* Range Drawer */
  .range-drawer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 11px;
    border-radius: var(--radius-md);
    font-size: 11px;
  }

  .range-inputs {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .range-inputs label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-secondary);
    font-size: 10.5px;
  }

  .range-num-input {
    width: 46px;
    padding: 3px 5px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--border-glass);
    background: var(--surface-input);
    color: var(--text-primary);
    text-align: center;
    font-family: var(--font-mono);
    font-size: 10.5px;
    outline: none;
  }

  .range-actions {
    display: flex;
    gap: 4px;
  }

  .range-apply-btn {
    padding: 4px 10px;
    border-radius: var(--radius-full);
    background: var(--gradient-03-vivid);
    color: #FFFFFF;
    border: 1px solid rgba(255, 255, 255, 0.35);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }

  .range-reset-btn {
    padding: 4px 8px;
    border-radius: var(--radius-full);
    background: transparent;
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-size: 10px;
    cursor: pointer;
  }

  /* Chapter Scroll Box */
  .chapters-scroll-box {
    max-height: 255px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-right: 2px;
  }

  .empty-chapters {
    padding: 20px 12px;
    text-align: center;
    border-style: dashed;
  }

  .empty-lead {
    font-weight: 700;
    font-size: 11.5px;
    color: var(--text-secondary);
    margin-bottom: 3px;
  }

  .empty-sub {
    font-size: 10.5px;
    color: var(--text-muted);
  }

  /* Liquid Glass Chapter Row (Inspired by "✓ Search projects..." pill row in Image 1) */
  .chapter-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border-radius: var(--radius-full);
    background: var(--surface-glass-card);
    border: 1px solid var(--border-subtle);
    box-shadow: var(--liquid-inner-shadow);
    transition: all 0.15s ease;
  }

  .chapter-card:hover {
    background: var(--surface-glass-hover);
    border-color: var(--border-glass-accent);
  }

  .chap-left {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .chap-check {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--border-glass);
    background: var(--surface-pill-well);
    display: flex;
    align-items: center;
    justify-content: center;
    color: transparent;
    flex-shrink: 0;
  }

  .chap-check.active {
    background: var(--gradient-03-vivid);
    border-color: rgba(255, 255, 255, 0.45);
    color: #FFFFFF;
  }

  .chap-check.crawling {
    border-color: var(--grad-rose-bright);
    color: var(--grad-rose-bright);
  }

  .chap-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chap-right {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .chap-words {
    font-size: 9.5px;
    color: var(--text-muted);
  }

  /* ==========================================================================
     Streamlined Liquid Glass Export Dock
     ========================================================================== */
  .export-dock {
    position: fixed;
    bottom: 8px;
    left: 12px;
    right: 12px;
    padding: 8px 10px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-glass-strong);
    background:
      linear-gradient(135deg, rgba(167, 118, 147, 0.18) 0%, rgba(23, 72, 113, 0.24) 100%),
      var(--surface-glass);
    backdrop-filter: blur(28px) saturate(170%);
    -webkit-backdrop-filter: blur(28px) saturate(170%);
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 90;
    box-shadow:
      0 12px 28px -4px rgba(5, 10, 20, 0.65),
      inset 0 1.5px 2px rgba(255, 255, 255, 0.35);
  }

  .dock-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .format-pills-well {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2.5px;
    border-radius: var(--radius-full);
    background: var(--surface-pill-well);
    border: 1px solid var(--border-subtle);
  }

  .format-pill {
    padding: 3px 8px;
    border-radius: var(--radius-full);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    font-size: 9.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .format-pill:hover:not(.active) {
    color: var(--text-primary);
  }

  .format-pill.active {
    background: var(--capsule-cream);
    color: var(--capsule-cream-text);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  .omit-pill-switch {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: var(--radius-full);
    background: var(--surface-pill-well);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .omit-pill-switch:hover {
    color: var(--text-primary);
    border-color: var(--border-glass-accent);
  }

  .omit-pill-switch.active {
    background: rgba(167, 118, 147, 0.25);
    border-color: var(--border-glass-accent);
    color: var(--text-primary);
  }

  .switch-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-muted);
    transition: all 0.2s ease;
  }

  .omit-pill-switch.active .switch-dot {
    background: var(--accent-success);
    box-shadow: 0 0 6px var(--accent-success);
  }

  .btn-dock-export {
    width: 100%;
    padding: 8px 14px;
    border-radius: var(--radius-full);
    background: var(--gradient-03-vivid);
    color: #FFFFFF;
    font-size: 11.5px;
    font-weight: 800;
    border: 1px solid rgba(255, 255, 255, 0.42);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-shadow: var(--liquid-pill-shadow);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition: all 0.2s ease;
  }

  .btn-dock-export:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }

  .btn-dock-export:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }

  .spin {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

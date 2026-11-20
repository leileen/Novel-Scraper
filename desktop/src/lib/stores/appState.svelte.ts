import type {
  ActiveTab,
  AppSettings,
  BookmarkItem,
  Chapter,
  ComicSettings,
  DownloadTask,
  LibraryFilter,
  LibraryProgressFilter,
  MediaCategory,
  Novel,
  ReaderSettings,
  ReplaceRule,
  ScraperRule,
  Toast
} from '../types';
import {
  fetchHtml,
  fetchFullNovelMetadata,
  extractChapterContent,
  extractRealChapterNumber,
  normalizeNovelUrl
} from '../crawler';
import { offlineStore, type StoredComicPageRecord } from '../db/offlineStore';

const STORAGE_KEY = 'novel_scraper_desktop_v1_0_release';
const ONBOARDING_KEY = 'novel_scraper_desktop_v1_0_onboarded';
const WHATS_NEW_KEY = 'novel_scraper_desktop_v1_3_seen';

export class AppState {
  // Navigation & Onboarding & What's New
  activeTab = $state<ActiveTab>('dashboard');
  isSidebarCollapsed = $state<boolean>(false);
  showOnboarding = $state<boolean>(false);
  showWhatsNew = $state<boolean>(false);

  // Download Queue (Starts 100% empty on clean v1.0 installation)
  downloadQueue = $state<DownloadTask[]>([]);

  // Library (Starts 100% empty on clean v1.0 installation)
  novels = $state<Novel[]>([]);

  // Chapters storage per novelId (TOC & metadata in RAM, full text in IndexedDB)
  novelChapters = $state<Record<string, Chapter[]>>({});

  // Power-User Reader Bookmarks & Replace Rules
  bookmarks = $state<BookmarkItem[]>([]);
  replaceRules = $state<ReplaceRule[]>([]);

  // Library Filters
  libraryFilter = $state<LibraryFilter>('all');
  libraryMediaCategory = $state<MediaCategory>('all');
  librarySearchQuery = $state<string>('');
  libraryViewMode = $state<'grid' | 'list'>('grid');
  libraryGenreFilter = $state<string>('all');
  libraryProgressFilter = $state<LibraryProgressFilter>('all');
  libraryDomainFilter = $state<string>('all');
  selectedNovel = $state<Novel | null>(null);

  // Immersive Reader State
  activeReaderNovel = $state<Novel | null>({
    id: 'sample-novel-1',
    title: 'Đại Quản Gia Là Ma Hoàng',
    author: 'Dạ Kiêu',
    sourceUrl: 'https://sample/novel-1',
    totalChapters: 1574,
    downloadedChapters: 1574,
    status: 'reading',
    readingProgress: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contentType: 'novel'
  });
  isChapterLoading = $state<boolean>(false);
  currentChapter = $state<Chapter>({
    id: 'ch-sample-1',
    novelId: 'sample-novel-1',
    chapterNumber: 1,
    index: 1,
    title: 'Chương 1: Cửu U Bí Lục',
    url: 'https://sample/chap-1',
    status: 'completed',
    wordCount: 1850,
    content: `Thiên Ma Phong đài cao, một vị hắc bào nam tử chính nín thở ngồi ngay ngắn ở phía trên.

Trên không trung, nhật nguyệt đi song song, ấm áp ánh sáng mặt trời cùng âm lãnh ánh trăng đồng thời vẩy hướng khắp nơi. Nam tử thật sâu hít một hơi, hai tay hướng lên trời, hai đạo quang mang trong nháy mắt tụ tập cùng một chỗ, đồng thời hướng hắn bắn tới, dung nhập hắn song chưởng bên trong, toàn bộ bầu trời cũng thoáng cái ảm đạm xuống.

Chỉ một thoáng, âm phong trận trận, phát ra thê lương tiếng gào thét, giống như ngàn vạn ác quỷ đang gào gọi.

Nam tử tóc dài phiêu dật nghênh phong phi lên, lộ ra một trương tà dị khuôn mặt.

Theo trên bầu trời hai đạo quang mang bị hút nhập thể nội, mặt trời cùng ánh trăng quang huy dần dần biến đến càng ngày càng ảm đạm, nam tử khí thế lại là càng ngày càng cường thịnh, quanh thân bắt đầu toát ra màu đen khí thể.

Cảm thụ lấy thấu xương gió lạnh tại gương mặt xẹt qua, nồng đậm hắc khí đã đem cả người hắn bao phủ đi vào, nam tử thở dài ra một hơi, lộ ra tà dị tiếu dung.

Ầm ầm!

Đột nhiên, một tiếng vang thật lớn phát ra, Thiên Ma Phong bốn phía bốn ngọn núi đột nhiên nổ tung lên, Thiên Ma Phong cũng càng không ngừng đang run rẩy. Chính đang hấp thụ nhật nguyệt tinh hoa nam tử bỗng nhiên mở ra hai mắt, hướng nơi xa nhìn qua.

Đúng lúc này, tiếng xé gió vang, thất đạo lưu quang chớp mắt là tới, rơi ở trước mặt hắn. Đợi quang mang tán đi, lộ ra bảy cái tản mát ra khí thế cường đại bóng người.

Mí đầu chưa phát giác lắc một cái, nam tử nhìn về phía trước mặt bảy người, thầm trầm mà nói: "Các ngươi bảy cái không phải luôn luôn xem thường chúng ta Ma đạo Tu giả a, hôm nay đến ta Thiên Ma Phong làm gì?"

"Hừ, Ma Hoàng Trác Nhất Phàm, chúng ta tới này mục đích chẳng lẽ ngươi hội không rõ ràng?" Một vị lão gia râu bạc trắng an ủi an ủi chòm râu, một mặt bễ nghễ nhìn về phía hắn nói.

Trong lòng chưa phát giác nhất động, Trác Nhất Phàm cẩn thận từng li từng tí thử dò xét nói: "Kiếm Hoàng lão đầu, ngươi ý tứ ta không hiểu."

"Hừ, ngươi thiếu giả bộ hồ đồ, thức thời liền đem Cửu U Bí Lục giao ra." Một vị đạo cô tiến lên trước một bước, vênh mặt hất hàm sai khiến quát to.

Nghe được lời này, Trác Nhất Phàm không khỏi quá sợ hãi.

Hắn một tháng trước mới tìm được truyền thuyết bên trong Cửu U Ma Đế động phủ, trải qua cửu tử nhất sinh rốt cục được đến ghi chép hắn suốt đời tuyệt học Cửu U Bí Lục, ngắn ngủi như vậy thời gian, bảy người này là như thế nào chiếm được tin tức này?

Nghĩ tới đây, hắn tựa hồ bỗng nhiên nghĩ đến cái gì, sắc mặt dần dần âm trầm xuống.

"Triệu Thành, ngươi đi ra cho ta." Trác Nhất Phàm quát to.

Thoại âm rơi xuống, một đạo tiếng cười khẽ đột nhiên tại Không Động Sơn trong rừng vang lên. Ngay sau đó, một vị thân mang áo trắng anh tuấn thiếu niên theo bảy người sau lưng đi ra, nhìn về phía Trác Nhất Phàm hơi hơi thi lễ, cười nói: "Ha ha ha... Sư phụ, ngài tìm ta sao?"

Đầy mắt âm trầm nhìn chằm chằm trướng này đổi trả khuôn mặt, Trác Nhất Phàm thản nhiên nói: "Ta được đến Cửu U Bí Lục sự tình, là ngươi tiết lộ cho bọn hắn?"

"Vâng!" Triệu Thành gật gật đầu, mỉm cười nói.

"Vậy ta bố trí xuống hộ sơn đại trận, cũng là ngươi mở ra?"

"Vâng!" Triệu Thành lần nữa gật đầu.

"Vì cái gì, lão tử đối ngươi không tệ đi." Trác Nhất Phàm song quyền nắm chặt, trong mắt sát ý cũng càng ngày càng đậm.

Hắn mặc dù là Ma Đạo tu gia, nhưng bình thường cũng không phải là làm sát người, chỉ là thẳng thắn mà làm thôi. Nếu không, sớm đã bị những cái kia biện hộ người trừ chi cho thống khoái. Riêng là đối cái này Triệu Thành, hắn vốn là cô nhi, Trác Nhất Phàm nhìn hắn tư chất không tệ, mới thu hắn làm đồ. Không nghĩ tới, hôm nay lại bị hắn phản bội.

Cảm nhận được Trác Nhất Phàm trên thân sát khí càng ngày càng đậm hơn, Triệu Thành trên mặt tuy nhiên vẫn như cũ bình tĩnh, nhưng là dưới chân lại là không tự giác hướng sau chuyển hai bước, đi vào thất bên người thân.

"Sư phụ, ngài đối ta ân trọng như sơn, Triệu Thành tự nhiên minh bạch. Thế nhưng là ngài không nên chiếm lấy tâm hoàng vị tử, để cho ta vĩnh viễn sống ở ngài bóng râm phía dưới, lại càng không nên đem Cửu U Bí Lục về sau, độc tự tu luyện, phòng ta như đề phòng cướp đồng dạng, hiển nhiên một chút cũng không cho ta nhìn."

Nghe được lời này, Trác Nhất Phàm không khỏi trong lòng đau xót.`
  });

  // Comic / Manga Reader State
  activeReaderComicPages = $state<StoredComicPageRecord[]>([]);
  activeComicPage = $state<number>(1);
  isComicLoading = $state<boolean>(false);

  readerSettings = $state<ReaderSettings>({
    theme: 'pure_white',
    customBgColor: '#ffffff',
    customTextColor: '#111111',
    fontSize: 18,
    lineHeight: 1.72,
    fontFamily: 'serif',
    fontWeight: 400,
    maxWidth: 960,
    paragraphSpacing: 0.35,
    textAlign: 'justify',
    textIndent: true,
    firstLineIndentEm: 1.8,
    dropCaps: false,
    twoColumn: false,
    columnsCount: 'auto',
    marginTop: 26,
    marginBottom: 26,
    marginLeftRight: 48,
    columnGap: 44,
    readingMode: 'auto_responsive',
    pageTurnEffect: 'instant',
    pinToolbar: false,
    autoScroll: false,
    autoScrollSpeed: 3,
    autoNextChapter: true,
    ttsRate: 1.0,
    autoNextTTS: true,

    // Viewer Headers/Footers
    showCalibreHeader: false,
    showCalibreFooter: true,
    showReaderHeader: false,
    showReaderFooter: true,
    headerLeft: 'none',
    headerCenter: 'chapter',
    headerRight: 'none',
    footerLeft: 'none',
    footerCenter: 'none',
    footerRight: 'percentage',
    referenceMode: false,
    distractionFree: true,
    autoHideToolbarSecs: 3
  });

  // App Settings
  settings = $state<AppSettings>({
    storagePath: 'D:\\Novels',
    concurrency: 4,
    requestDelayMs: 250,
    jitterDelayMs: 100,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    proxyUrl: '',
    accentColor: '#00D2FF',
    theme: 'dark',
    cloudSyncEnabled: false,
    licenseKey: 'PRO-2026-NOV-SCRAPER-OK',
    isPremium: true
  });

  // Scraper Rules
  rules = $state<ScraperRule[]>([
    {
      id: 'rule-metruyenchu',
      name: 'Mê Truyện Chữ',
      domain: 'metruyenchu.com.vn',
      version: '1.3.0',
      titleSelector: 'h1[itemprop="name"]',
      authorSelector: 'a[itemprop="author"]',
      descriptionSelector: '#gioithieu [itemprop="description"]',
      coverSelector: '.book-info-pic img',
      chapterListSelector: '#chapter-list',
      chapterItemSelector: '#chapter-list ul li a',
      chapterContentSelector: '#vungdoc .truyen',
      excludeSelectors: ['.ad-container', 'script', '.chapter_control', '#download-book']
    },
    {
      id: 'rule-truyenfull',
      name: 'Truyện Full',
      domain: 'truyenfull.vn',
      version: '1.4.1',
      titleSelector: 'h3.title',
      authorSelector: '.info a[itemprop="author"]',
      descriptionSelector: '.desc-text',
      coverSelector: '.book img',
      chapterListSelector: '#list-chapter',
      chapterItemSelector: '.list-chapter a',
      chapterContentSelector: '#chapter-c',
      excludeSelectors: ['.ads-holder', '.adsbygoogle', 'style']
    },
    {
      id: 'rule-tangthuvien',
      name: 'Tàng Thư Viện',
      domain: 'tangthuvien.net',
      version: '1.1.0',
      titleSelector: '.book-info h1',
      authorSelector: '.book-info .tag a:first-child',
      descriptionSelector: '.book-intro',
      coverSelector: '.book-img img',
      chapterListSelector: '#ul-list-chap',
      chapterItemSelector: 'li a',
      chapterContentSelector: '.box-chap',
      excludeSelectors: ['.chap-nav', '.banner-ads']
    }
  ]);

  // Notifications
  toasts = $state<Toast[]>([]);

  constructor() {
    this.loadPersistedState();
    // Run background migration for legacy chapter contents to IndexedDB
    setTimeout(() => {
      void this.migrateLegacyChaptersToIndexedDB();
    }, 1000);
  }

  private loadPersistedState() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      // Remove legacy development/demo state keys
      window.localStorage.removeItem('novel_scraper_desktop_state_v1');
      window.localStorage.removeItem('novel_scraper_desktop_state_v2');

      // Show onboarding welcome guide on first launch
      const hasOnboarded = window.localStorage.getItem(ONBOARDING_KEY);
      if (hasOnboarded !== 'true') {
        this.showOnboarding = true;
      }

      // Show What's New v1.3 modal
      const hasSeenWhatsNew = window.localStorage.getItem(WHATS_NEW_KEY);
      if (hasSeenWhatsNew !== 'true' && hasOnboarded === 'true') {
        this.showWhatsNew = true;
      }

      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        novels?: Novel[];
        downloadQueue?: DownloadTask[];
        novelChapters?: Record<string, Chapter[]>;
        bookmarks?: BookmarkItem[];
        replaceRules?: ReplaceRule[];
        readerSettings?: Partial<ReaderSettings>;
      };

      if (parsed.novelChapters && typeof parsed.novelChapters === 'object') {
        const upgradedChapters: Record<string, Chapter[]> = { ...this.novelChapters };
        for (const [nId, chList] of Object.entries(parsed.novelChapters)) {
          if (Array.isArray(chList)) {
            upgradedChapters[nId] = chList.map((c, idx) => ({
              ...c,
              index: idx + 1,
              chapterNumber: extractRealChapterNumber(c.title || '', c.url || '', idx + 1)
            }));
          }
        }
        this.novelChapters = upgradedChapters;
      }

      if (parsed.novels && Array.isArray(parsed.novels)) {
        const validNovels = parsed.novels
          .filter((n) => !/tauri\s*\+\s*sveltekit/i.test(n.title))
          .map((n) => {
            const chaps = this.novelChapters[n.id] || [];
            const lastChapNum = chaps[chaps.length - 1]?.chapterNumber || n.totalChapters;
            return {
              ...n,
              maxChapterNumber: Math.max(n.maxChapterNumber || 0, n.totalChapters || 0, lastChapNum),
              contentType: n.contentType || (n.isImported ? 'book' : 'novel')
            };
          });
        this.novels = validNovels;
      }

      if (parsed.downloadQueue && Array.isArray(parsed.downloadQueue)) {
        const validTasks = parsed.downloadQueue.filter(
          (t) => !/tauri\s*\+\s*sveltekit/i.test(t.title)
        );
        this.downloadQueue = validTasks;
      }

      if (parsed.bookmarks && Array.isArray(parsed.bookmarks)) {
        this.bookmarks = parsed.bookmarks;
      }
      if (parsed.replaceRules && Array.isArray(parsed.replaceRules)) {
        this.replaceRules = parsed.replaceRules;
      }
      if (parsed.readerSettings && typeof parsed.readerSettings === 'object') {
        this.readerSettings = {
          ...this.readerSettings,
          ...parsed.readerSettings,
          showCalibreHeader: false,
          showReaderHeader: false
        };
      }
    } catch (e) {
      console.warn('Failed to load persisted state:', e);
    }
  }

  private async migrateLegacyChaptersToIndexedDB() {
    try {
      const recordsToMigrate = [];
      for (const [nId, chaps] of Object.entries(this.novelChapters)) {
        for (const c of chaps) {
          if (c.content && c.content.trim().length > 30) {
            recordsToMigrate.push({
              novelId: nId,
              index: c.index || 1,
              chapterNumber: c.chapterNumber,
              title: c.title,
              url: c.url,
              content: c.content,
              wordCount: c.wordCount,
              downloadedAt: c.downloadedAt || Date.now()
            });
          }
        }
      }
      if (recordsToMigrate.length > 0) {
        await offlineStore.saveChaptersBatch(recordsToMigrate);
      }
    } catch (e) {
      console.warn('Migration to IndexedDB failed:', e);
    }
  }

  completeOnboarding() {
    this.showOnboarding = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ONBOARDING_KEY, 'true');
    }
  }

  openOnboarding() {
    this.showOnboarding = true;
  }

  completeWhatsNew() {
    this.showWhatsNew = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(WHATS_NEW_KEY, 'true');
    }
  }

  openWhatsNew() {
    this.showWhatsNew = true;
  }

  getAllGenres(): string[] {
    const set = new Set<string>();
    for (const n of this.novels) {
      if (Array.isArray(n.genres)) {
        for (const g of n.genres) {
          const trimmed = g.trim();
          if (trimmed) set.add(trimmed);
        }
      }
    }
    return Array.from(set).sort();
  }

  getAllDomains(): string[] {
    const set = new Set<string>();
    for (const n of this.novels) {
      if (n.sourceDomain) set.add(n.sourceDomain);
    }
    return Array.from(set).sort();
  }

  persistState() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      // Keep chapters in localStorage slim (metadata only) so localStorage NEVER exceeds quota
      const slimChapters: Record<string, Chapter[]> = {};
      for (const [nId, chaps] of Object.entries(this.novelChapters)) {
        slimChapters[nId] = chaps.map((c) => ({
          id: c.id,
          novelId: c.novelId,
          chapterNumber: c.chapterNumber,
          index: c.index,
          title: c.title,
          url: c.url,
          wordCount: c.wordCount,
          status: c.status,
          downloadedAt: c.downloadedAt
        }));
      }

      const payload = JSON.stringify({
        novels: this.novels,
        downloadQueue: this.downloadQueue,
        novelChapters: slimChapters,
        bookmarks: this.bookmarks,
        replaceRules: this.replaceRules,
        readerSettings: this.readerSettings
      });
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
      console.warn('Failed to persist state to localStorage:', e);
    }
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.toasts.push({ id, type, message });
    setTimeout(() => {
      this.removeToast(id);
    }, 3200);
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  getNovelChapters(novelId: string): Chapter[] {
    return this.novelChapters[novelId] || [];
  }

  // Bookmarks Management
  getNovelBookmarks(novelId: string): BookmarkItem[] {
    return this.bookmarks.filter((b) => b.novelId === novelId);
  }

  isChapterBookmarked(novelId: string, chapterIndex: number): boolean {
    return this.bookmarks.some(
      (b) => b.novelId === novelId && b.chapterIndex === chapterIndex
    );
  }

  toggleBookmark(scrollPercent = 0) {
    const novel = this.activeReaderNovel || this.novels[0];
    if (!novel) return;
    const chapIdx = this.currentChapter.index || 1;
    const chapNum =
      this.currentChapter.chapterNumber ||
      extractRealChapterNumber(
        this.currentChapter.title,
        this.currentChapter.url,
        chapIdx
      );

    const existingIdx = this.bookmarks.findIndex(
      (b) => b.novelId === novel.id && b.chapterIndex === chapIdx
    );

    if (existingIdx >= 0) {
      this.bookmarks.splice(existingIdx, 1);
      this.bookmarks = [...this.bookmarks];
      this.persistState();
      this.showToast(`Đã bỏ đánh dấu: ${this.currentChapter.title}`, 'info');
    } else {
      const firstLine =
        (this.currentChapter.content || '')
          .split('\n\n')
          .find((p) => p.trim().length > 20)
          ?.slice(0, 120) || this.currentChapter.title;

      const item: BookmarkItem = {
        id: `bm-${Date.now()}`,
        novelId: novel.id,
        chapterIndex: chapIdx,
        chapterNumber: chapNum,
        chapterTitle: this.currentChapter.title,
        scrollPercent: Math.round(scrollPercent),
        excerpt: firstLine + '...',
        createdAt: Date.now()
      };
      this.bookmarks = [item, ...this.bookmarks];
      this.persistState();
      this.showToast(`Đã đánh dấu trang: ${this.currentChapter.title}`, 'success');
    }
  }

  removeBookmark(bookmarkId: string) {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== bookmarkId);
    this.persistState();
  }

  // Custom Replace Rules Management
  addReplaceRule(find: string, replace: string, isRegex = false) {
    if (!find.trim()) return;
    this.replaceRules = [
      ...this.replaceRules,
      {
        id: `rr-${Date.now()}`,
        find: find.trim(),
        replace,
        isRegex,
        enabled: true
      }
    ];
    this.persistState();
    this.showToast(`Đã thêm quy tắc thay thế: "${find}" → "${replace}"`, 'success');
  }

  toggleReplaceRule(ruleId: string) {
    const r = this.replaceRules.find((item) => item.id === ruleId);
    if (r) {
      r.enabled = !r.enabled;
      this.replaceRules = [...this.replaceRules];
      this.persistState();
    }
  }

  removeReplaceRule(ruleId: string) {
    this.replaceRules = this.replaceRules.filter((item) => item.id !== ruleId);
    this.persistState();
  }

  applyReplaceRules(rawText: string): string {
    if (!rawText) return '';
    let result = rawText;
    for (const rule of this.replaceRules) {
      if (!rule.enabled || !rule.find) continue;
      try {
        if (rule.isRegex) {
          const regex = new RegExp(rule.find, 'g');
          result = result.replace(regex, rule.replace);
        } else {
          result = result.replaceAll(rule.find, rule.replace);
        }
      } catch (err) {
        console.warn(`Lỗi áp dụng quy tắc ${rule.find}:`, err);
      }
    }
    return result;
  }

  // Library Management
  async addImportedNovel(
    novel: Novel,
    chapters: Chapter[],
    comicPages?: Array<{ pageIndex: number; title?: string; dataUrl: string; width?: number; height?: number }>
  ) {
    this.novels = [novel, ...this.novels];
    this.novelChapters[novel.id] = chapters;

    // Save chapters in bulk to IndexedDB
    const records = chapters.map((c) => ({
      novelId: novel.id,
      index: c.index || 1,
      chapterNumber: c.chapterNumber,
      title: c.title,
      url: c.url,
      content: c.content || '',
      wordCount: c.wordCount,
      downloadedAt: Date.now()
    }));
    await offlineStore.saveChaptersBatch(records);

    // Save comic pages if present
    if (comicPages && comicPages.length > 0) {
      await offlineStore.saveComicPagesBatch(
        comicPages.map((p) => ({
          novelId: novel.id,
          pageIndex: p.pageIndex,
          title: p.title,
          dataUrl: p.dataUrl,
          width: p.width,
          height: p.height
        }))
      );
    }

    this.persistState();
  }

  async deleteNovel(novelId: string) {
    this.novels = this.novels.filter((n) => n.id !== novelId);
    delete this.novelChapters[novelId];
    this.bookmarks = this.bookmarks.filter((b) => b.novelId !== novelId);
    await offlineStore.deleteNovelChapters(novelId);
    await offlineStore.deleteComicPages(novelId);
    if (this.selectedNovel?.id === novelId) {
      this.selectedNovel = null;
    }
    if (this.activeReaderNovel?.id === novelId) {
      this.activeReaderNovel = null;
      this.activeTab = 'library';
    }
    this.persistState();
    this.showToast('Đã xóa tác phẩm và giải phóng bộ nhớ offline!', 'info');
  }

  async deleteNovels(novelIds: string[]) {
    const idSet = new Set(novelIds);
    this.novels = this.novels.filter((n) => !idSet.has(n.id));
    for (const id of novelIds) {
      delete this.novelChapters[id];
      await offlineStore.deleteNovelChapters(id);
      await offlineStore.deleteComicPages(id);
    }
    this.bookmarks = this.bookmarks.filter((b) => !idSet.has(b.novelId));
    if (this.selectedNovel && idSet.has(this.selectedNovel.id)) {
      this.selectedNovel = null;
    }
    this.persistState();
    this.showToast(`Đã xóa ${novelIds.length} tác phẩm khỏi thư viện!`, 'info');
  }

  async startScrape(rawUrl: string) {
    const novelUrl = normalizeNovelUrl(rawUrl);
    if (!novelUrl) {
      this.showToast('Vui lòng nhập đường dẫn truyện hợp lệ (http/https).', 'error');
      return;
    }

    const matchedRule = this.rules.find((r) => novelUrl.includes(r.domain));
    const domainName = matchedRule?.domain || new URL(novelUrl).hostname;

    const existingTask = this.downloadQueue.find((t) => t.url === novelUrl);
    if (existingTask) {
      if (existingTask.status === 'paused' || existingTask.status === 'error') {
        this.toggleTaskStatus(existingTask.id);
      } else {
        this.showToast('Truyện này đã có trong hàng đợi tải!', 'info');
      }
      this.activeTab = 'dashboard';
      return;
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const initialTask: DownloadTask = {
      id: taskId,
      url: novelUrl,
      title: 'Đang kết nối và lấy thông tin truyện...',
      sourceDomain: domainName,
      downloadedChapters: 0,
      totalChapters: 0,
      speed: 'Khởi động...',
      progressPercent: 0,
      status: 'crawling',
      createdAt: Date.now()
    };

    this.downloadQueue = [initialTask, ...this.downloadQueue];
    this.activeTab = 'dashboard';
    this.showToast(`Bắt đầu phân tích mục lục truyện từ ${domainName}...`, 'info');

    void this.runCrawlTask(initialTask);
  }

  private updateTask(taskId: string, updater: (task: DownloadTask) => void) {
    const idx = this.downloadQueue.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      updater(this.downloadQueue[idx]);
      this.downloadQueue = [...this.downloadQueue];
    }
  }

  /**
   * True 100% Offline Crawler Worker Pool.
   * Downloads 100% of chapters upfront and commits them to IndexedDB.
   */
  private async runCrawlTask(task: DownloadTask) {
    const taskId = task.id;
    try {
      this.updateTask(taskId, (t) => {
        t.status = 'crawling';
        t.speed = 'Đang đọc mục lục...';
      });

      const metadata = await fetchFullNovelMetadata(task.url, (loadedPages, totalPages, count) => {
        this.updateTask(taskId, (t) => {
          t.speed = `Mục lục trang ${loadedPages}/${totalPages}...`;
          t.downloadedChapters = count;
        });
      });

      const total = metadata.chapters.length;
      if (total === 0) {
        throw new Error('Không tìm thấy danh sách chương tại đường dẫn này.');
      }

      const novelId = `novel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const initialChapters: Chapter[] = metadata.chapters.map((ch) => ({
        id: `${novelId}-ch-${ch.index}`,
        novelId,
        chapterNumber: ch.chapterNumber || ch.index,
        index: ch.index,
        title: ch.title,
        url: ch.url,
        content: '',
        wordCount: 0,
        status: 'pending'
      }));

      const existingIdx = this.novels.findIndex(
        (n) => n.id === novelId || n.sourceUrl === metadata.sourceUrl
      );
      const targetNovelId = existingIdx >= 0 ? this.novels[existingIdx].id : novelId;

      const newNovel: Novel = {
        id: targetNovelId,
        title: metadata.title,
        author: metadata.author,
        genres: metadata.genres,
        totalPublishedChapters: metadata.totalPublishedChapters,
        sourceUrl: metadata.sourceUrl,
        sourceDomain: metadata.sourceDomain,
        coverUrl: metadata.coverUrl,
        description: metadata.description,
        totalChapters: total,
        maxChapterNumber: metadata.maxChapterNumber || total,
        downloadedChapters: 0,
        status: 'reading',
        readingProgress: 0,
        lastReadChapterId: `${targetNovelId}-ch-1`,
        lastReadChapterTitle: metadata.chapters[0]?.title || 'Chương 1',
        lastReadChapterNumber: metadata.chapters[0]?.chapterNumber || 1,
        createdAt: existingIdx >= 0 ? this.novels[existingIdx].createdAt : Date.now(),
        updatedAt: Date.now(),
        contentType: 'novel'
      };

      this.novelChapters[targetNovelId] = initialChapters.map((c) => ({
        ...c,
        id: `${targetNovelId}-ch-${c.index}`,
        novelId: targetNovelId
      }));

      if (existingIdx >= 0) {
        this.novels[existingIdx] = newNovel;
      } else {
        this.novels = [newNovel, ...this.novels];
      }

      this.updateTask(taskId, (t) => {
        t.title = metadata.title;
        t.novelId = targetNovelId;
        t.author = metadata.author;
        t.genres = metadata.genres;
        t.totalPublishedChapters = metadata.totalPublishedChapters;
        t.coverUrl = metadata.coverUrl;
        t.totalChapters = total;
        t.status = 'downloading';
        t.speed = 'Bắt đầu cào 100% offline...';
      });

      this.persistState();

      this.showToast(
        `Đã tải trọn bộ mục lục "${metadata.title}" (${total} chương)! Bắt đầu cào 100% về máy...`,
        'info'
      );

      const startTime = Date.now();
      const concurrency = Math.max(2, Math.min(6, this.settings.concurrency || 4));

      // 1. Check which chapters are already saved in IndexedDB
      const alreadyDownloaded = await offlineStore.getDownloadedChapterIndices(targetNovelId);
      let downloadedCount = alreadyDownloaded.size;

      // 2. Identify pending chapters
      const pendingIndices: number[] = [];
      for (let i = 1; i <= total; i++) {
        if (!alreadyDownloaded.has(i)) {
          pendingIndices.push(i);
        }
      }

      this.updateTask(taskId, (t) => {
        t.downloadedChapters = downloadedCount;
        t.progressPercent = Math.round((downloadedCount / total) * 100);
        t.speed = 'Đang kết nối workers...';
      });
      this.updateNovelProgress(targetNovelId, downloadedCount);

      // 3. Concurrency Worker Queue to download 100% of chapters
      let queueIdx = 0;
      const workerPoolSize = Math.min(concurrency, pendingIndices.length || 1);

      const processNext = async (): Promise<void> => {
        while (queueIdx < pendingIndices.length) {
          // Pause / abort check
          while (true) {
            const current = this.downloadQueue.find((t) => t.id === taskId);
            if (!current) return;
            if (current.status === 'error') return;
            if (current.status !== 'paused') break;
            await new Promise((r) => setTimeout(r, 400));
          }

          const currentQueuePos = queueIdx++;
          if (currentQueuePos >= pendingIndices.length) break;
          const chapIdx = pendingIndices[currentQueuePos];
          if (!chapIdx) break;

          const chap = await this.fetchAndCacheChapter(targetNovelId, chapIdx);
          if (chap && chap.content) {
            downloadedCount++;
          }

          // If first chapter just downloaded and reader is currently viewing this novel, update
          if (chapIdx === 1 && this.activeReaderNovel?.id === targetNovelId && chap?.content) {
            this.currentChapter = { ...chap };
          }

          // Calculate speed and update task progress
          const elapsedSec = Math.max(0.2, (Date.now() - startTime) / 1000);
          const speedVal = downloadedCount / elapsedSec;

          this.updateTask(taskId, (t) => {
            t.downloadedChapters = downloadedCount;
            t.progressPercent = Math.min(100, Math.round((downloadedCount / total) * 100));
            t.speed = `${speedVal.toFixed(1)} ch/giây`;
          });
          this.updateNovelProgress(targetNovelId, downloadedCount);

          // Rate limit delay between requests to be polite to servers
          const delay = Math.max(30, this.settings.requestDelayMs || 200);
          if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      };

      const workers = Array.from({ length: workerPoolSize }, () => processNext());
      await Promise.all(workers);

      // Verify all chapters downloaded
      this.updateTask(taskId, (t) => {
        t.status = 'completed';
        t.speed = 'Hoàn tất 100%';
        t.progressPercent = 100;
        t.downloadedChapters = total;
      });
      this.updateNovelProgress(targetNovelId, total);
      this.persistState();

      this.showToast(
        `Đã tải hoàn tất 100% "${metadata.title}" (${total} chương)! Đã lưu offline vĩnh viễn trên máy.`,
        'success'
      );
    } catch (err) {
      this.updateTask(taskId, (t) => {
        t.status = 'error';
        t.speed = 'Thất bại';
        t.errorMessage = `Lỗi: ${(err as Error).message}`;
      });
      this.showToast(`Lỗi khi tải truyện: ${(err as Error).message}`, 'error');
    }
  }

  private updateNovelProgress(novelId: string, downloadedChapters: number) {
    const n = this.novels.find((item) => item.id === novelId);
    if (n) {
      n.downloadedChapters = downloadedChapters;
      n.updatedAt = Date.now();
      this.novels = [...this.novels];
    }
  }

  /**
   * Fetches and caches a chapter's content into IndexedDB.
   */
  async fetchAndCacheChapter(novelId: string, chapterIndex: number): Promise<Chapter | null> {
    const chapters = this.novelChapters[novelId];
    if (!chapters || chapters.length === 0) return null;

    const chap =
      chapters.find((c) => c.index === chapterIndex) ||
      chapters[chapterIndex - 1] ||
      chapters.find((c) => c.chapterNumber === chapterIndex);
    if (!chap) return null;

    chap.chapterNumber = extractRealChapterNumber(
      chap.title,
      chap.url,
      chap.chapterNumber || chap.index || chapterIndex
    );

    // 1. Check in-memory content
    if (chap.content && chap.content.trim().length > 60) {
      return chap;
    }

    // 2. Check IndexedDB offlineStore
    try {
      const offlineContent = await offlineStore.getChapterContent(novelId, chap.index || chapterIndex);
      if (offlineContent && offlineContent.trim().length > 30) {
        chap.content = offlineContent;
        chap.wordCount = offlineContent.split(/\s+/).filter(Boolean).length;
        chap.status = 'completed';
        return chap;
      }
    } catch (e) {
      console.warn('IndexedDB read error:', e);
    }

    // 3. If not cached offline yet, fetch from origin server
    try {
      const novel = this.novels.find((n) => n.id === novelId);
      const rule = this.rules.find((r) => novel?.sourceDomain?.includes(r.domain));
      const html = await fetchHtml(chap.url);
      const extractedText = extractChapterContent(html, rule);

      if (extractedText && extractedText.trim().length > 20) {
        chap.content = extractedText;
        chap.wordCount = extractedText.split(/\s+/).filter(Boolean).length;
        chap.status = 'completed';
        chap.fetchedAt = Date.now();

        // Save immediately to IndexedDB offline store
        await offlineStore.saveChapter({
          novelId,
          index: chap.index || chapterIndex,
          chapterNumber: chap.chapterNumber,
          title: chap.title,
          url: chap.url,
          content: extractedText,
          wordCount: chap.wordCount,
          downloadedAt: Date.now()
        });

        return chap;
      }
    } catch (e) {
      console.warn(`Failed to fetch chapter ${chapterIndex} (${chap.url}):`, e);
    }

    return chap;
  }

  /**
   * Selects and loads a specific chapter into the Reader with 0ms delay if offline.
   */
  async selectChapter(novelId: string, targetIndex: number) {
    const novel = this.novels.find((n) => n.id === novelId);
    if (!novel) return;

    const chapters = this.novelChapters[novelId] || [];
    if (chapters.length === 0) return;

    const clampedIndex = Math.max(1, Math.min(chapters.length, targetIndex));
    const targetChap =
      chapters.find((c) => c.index === clampedIndex) || chapters[clampedIndex - 1];
    if (!targetChap) return;

    const realChapNum = extractRealChapterNumber(
      targetChap.title,
      targetChap.url,
      targetChap.chapterNumber || clampedIndex
    );
    targetChap.chapterNumber = realChapNum;

    // Check offline store first
    let content = targetChap.content || '';
    if (!content || content.trim().length <= 60) {
      try {
        const stored = await offlineStore.getChapterContent(novelId, clampedIndex);
        if (stored && stored.trim().length > 30) {
          content = stored;
          targetChap.content = stored;
          targetChap.wordCount = stored.split(/\s+/).filter(Boolean).length;
        }
      } catch (err) {
        console.warn('offlineStore query error:', err);
      }
    }

    const hasOfflineContent = Boolean(content && content.trim().length > 30);

    if (hasOfflineContent) {
      // INSTANT RENDER - NO SPINNER!
      this.isChapterLoading = false;
      this.currentChapter = {
        ...targetChap,
        chapterNumber: realChapNum,
        content
      };
    } else {
      // Only show spinner if content is not yet downloaded
      this.isChapterLoading = true;
      this.currentChapter = {
        ...targetChap,
        chapterNumber: realChapNum,
        content: 'Đang tải nội dung chương từ máy chủ truyện...'
      };

      const loaded = await this.fetchAndCacheChapter(novelId, clampedIndex);
      this.isChapterLoading = false;

      if (loaded && loaded.content) {
        this.currentChapter = {
          ...loaded,
          chapterNumber: realChapNum
        };
      }
    }

    novel.lastReadChapterId = String(targetChap.id || `${novelId}-ch-${clampedIndex}`);
    novel.lastReadChapterTitle = targetChap.title;
    novel.lastReadChapterNumber = realChapNum;
    novel.readingProgress = Math.max(
      1,
      Math.min(100, Math.round((clampedIndex / Math.max(1, chapters.length)) * 100))
    );
    novel.updatedAt = Date.now();
    this.novels = [...this.novels];
    this.persistState();

    // Background pre-fetch next chapter
    if (clampedIndex + 1 <= chapters.length) {
      void this.fetchAndCacheChapter(novelId, clampedIndex + 1);
    }
  }

  toggleTaskStatus(taskId: string) {
    const task = this.downloadQueue.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status === 'downloading' || task.status === 'crawling') {
      task.status = 'paused';
      task.speed = 'Đã tạm dừng';
      this.downloadQueue = [...this.downloadQueue];
      this.showToast(`Đã tạm dừng tải: ${task.title}`, 'info');
    } else if (task.status === 'paused' || task.status === 'error') {
      task.status = 'downloading';
      task.speed = 'Đang tiếp tục...';
      this.downloadQueue = [...this.downloadQueue];
      this.showToast(`Đang tiếp tục tải: ${task.title}`, 'success');
      if (task.downloadedChapters < task.totalChapters || task.totalChapters === 0) {
        void this.runCrawlTask(task);
      }
    }
  }

  removeTask(taskId: string) {
    this.downloadQueue = this.downloadQueue.filter((t) => t.id !== taskId);
    this.persistState();
    this.showToast('Đã xóa tác vụ khỏi hàng đợi', 'info');
  }

  pauseAll() {
    this.downloadQueue.forEach((task) => {
      if (task.status === 'downloading') {
        task.status = 'paused';
        task.speed = '0 ch/giây';
      }
    });
    this.downloadQueue = [...this.downloadQueue];
    this.showToast('Đã tạm dừng tất cả tác vụ', 'info');
  }

  clearCompleted() {
    this.downloadQueue = this.downloadQueue.filter((t) => t.status !== 'completed');
    this.persistState();
    this.showToast('Đã làm sạch hàng đợi tải', 'info');
  }

  async openReader(novel: Novel, chapterIndex?: number) {
    this.activeReaderNovel = novel;

    if (novel.contentType === 'comic') {
      // Load Comic pages from IndexedDB
      this.isComicLoading = true;
      try {
        const pages = await offlineStore.getComicPages(novel.id);
        this.activeReaderComicPages = pages;
        this.activeComicPage = novel.lastReadPageIndex || 1;
      } finally {
        this.isComicLoading = false;
      }
      this.activeTab = 'reader';
      return;
    }

    // Text Novel Reader
    this.activeTab = 'reader';
    const chapters = this.getNovelChapters(novel.id);
    if (chapters.length === 0) return;

    let targetIndex = chapterIndex || 1;
    if (!chapterIndex && novel.lastReadChapterId) {
      const found = chapters.find((c) => String(c.id) === novel.lastReadChapterId);
      if (found?.index) {
        targetIndex = found.index;
      }
    }

    await this.selectChapter(novel.id, targetIndex);
  }

  async setComicPage(pageIndex: number) {
    if (!this.activeReaderNovel || this.activeReaderComicPages.length === 0) return;
    const clamped = Math.max(1, Math.min(this.activeReaderComicPages.length, pageIndex));
    this.activeComicPage = clamped;
    this.activeReaderNovel.lastReadPageIndex = clamped;
    this.activeReaderNovel.readingProgress = Math.round(
      (clamped / this.activeReaderComicPages.length) * 100
    );
    this.activeReaderNovel.updatedAt = Date.now();
    this.novels = [...this.novels];
    this.persistState();
  }

  setComicSettings(settings: Partial<ComicSettings>) {
    if (!this.activeReaderNovel) return;
    if (!this.activeReaderNovel.comicSettings) {
      this.activeReaderNovel.comicSettings = {
        mode: 'webtoon',
        isRTL: false,
        fit: 'width',
        gap: 8,
        zoom: 100,
        preloadCount: 3,
        brightness: 100
      };
    }
    this.activeReaderNovel.comicSettings = {
      ...this.activeReaderNovel.comicSettings,
      ...settings
    };
    this.novels = [...this.novels];
    this.persistState();
  }

  async prevChapter(): Promise<boolean> {
    const novel = this.activeReaderNovel || this.novels[0];
    if (!novel) return false;

    if (novel.contentType === 'comic') {
      if (this.activeComicPage > 1) {
        await this.setComicPage(this.activeComicPage - 1);
        return true;
      }
      return false;
    }

    const chapters = this.getNovelChapters(novel.id);
    if (chapters.length === 0) return false;

    const currentPos = chapters.findIndex(
      (c) =>
        (c.id && c.id === this.currentChapter.id) ||
        (c.url && c.url === this.currentChapter.url) ||
        c.index === this.currentChapter.index
    );
    const currentIdx = currentPos >= 0 ? currentPos + 1 : this.currentChapter.index || 1;

    if (currentIdx <= 1) {
      this.showToast('Đây là chương đầu tiên của bộ truyện!', 'info');
      return false;
    }
    await this.selectChapter(novel.id, currentIdx - 1);
    return true;
  }

  async nextChapter(): Promise<boolean> {
    const novel = this.activeReaderNovel || this.novels[0];
    if (!novel) return false;

    if (novel.contentType === 'comic') {
      if (this.activeComicPage < this.activeReaderComicPages.length) {
        await this.setComicPage(this.activeComicPage + 1);
        return true;
      }
      return false;
    }

    const chapters = this.getNovelChapters(novel.id);
    if (chapters.length === 0) return false;

    const currentPos = chapters.findIndex(
      (c) =>
        (c.id && c.id === this.currentChapter.id) ||
        (c.url && c.url === this.currentChapter.url) ||
        c.index === this.currentChapter.index
    );
    const currentIdx = currentPos >= 0 ? currentPos + 1 : this.currentChapter.index || 1;

    if (currentIdx >= chapters.length) {
      this.showToast('Bạn đã đọc đến chương cuối cùng hiện có!', 'info');
      return false;
    }
    await this.selectChapter(novel.id, currentIdx + 1);
    return true;
  }

  async goToChapter(chapterIndex: number): Promise<boolean> {
    const novel = this.activeReaderNovel || this.novels[0];
    if (!novel) return false;
    await this.selectChapter(novel.id, chapterIndex);
    return true;
  }

  async jumpToChapterNumber(chapterNumber: number): Promise<boolean> {
    const novel = this.activeReaderNovel || this.novels[0];
    if (!novel) return false;
    const chapters = this.getNovelChapters(novel.id);
    const foundIdx = chapters.findIndex(
      (c, idx) => (c.chapterNumber || c.index || idx + 1) === chapterNumber
    );
    const targetIdx = foundIdx >= 0 ? foundIdx + 1 : chapterNumber;
    return this.goToChapter(targetIdx);
  }

  addDownload(url: string) {
    return this.startScrape(url);
  }

  togglePause(taskId: string) {
    return this.toggleTaskStatus(taskId);
  }

  closeReader() {
    this.activeTab = 'library';
  }
}

export const appState = new AppState();

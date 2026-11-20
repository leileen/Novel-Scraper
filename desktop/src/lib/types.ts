export type DownloadStatus = 'downloading' | 'paused' | 'queued' | 'error' | 'completed' | 'idle' | 'crawling';

export interface DownloadTask {
  id: string;
  novelId?: string | number;
  url: string;
  title: string;
  author?: string;
  genres?: string[];
  totalPublishedChapters?: number;
  coverUrl?: string;
  sourceDomain: string;
  downloadedChapters: number;
  totalChapters: number;
  speed: string; // e.g. "5.4 ch/giây"
  progressPercent: number;
  status: DownloadStatus;
  errorMessage?: string;
  createdAt: number;
}

export interface Chapter {
  id?: string | number;
  novelId: string | number;
  chapterNumber?: number;
  index?: number;
  title: string;
  url: string;
  content?: string;
  wordCount?: number;
  status: 'pending' | 'downloaded' | 'failed' | 'crawling' | 'completed' | 'locked';
  errorMessage?: string;
  fetchedAt?: number;
  downloadedAt?: number;
  images?: string[]; // Array of image URLs/Blobs for comic chapters
  totalImages?: number;
}

export interface BookmarkItem {
  id: string;
  novelId: string;
  chapterIndex: number;
  chapterNumber: number;
  chapterTitle: string;
  scrollPercent: number;
  excerpt: string;
  createdAt: number;
}

export interface ReplaceRule {
  id: string;
  find: string;
  replace: string;
  isRegex?: boolean;
  enabled: boolean;
}

export interface Novel {
  id: string;
  title: string;
  author?: string;
  genres?: string[];
  totalPublishedChapters?: number;
  sourceUrl: string;
  sourceDomain?: string;
  coverUrl?: string;
  description?: string;
  totalChapters: number;
  maxChapterNumber?: number;
  downloadedChapters: number;
  status: 'reading' | 'favorite' | 'completed' | 'needs_update' | 'idle' | 'crawling' | 'paused' | 'error';
  readingProgress?: number; // 0 - 100
  lastReadChapterId?: string;
  lastReadChapterTitle?: string;
  lastReadChapterNumber?: number;
  lastReadScrollPercent?: number;
  lastReadAt?: number;
  createdAt: number;
  updatedAt: number;
  ruleId?: number;
  isImported?: boolean;
  importFormat?: string;
  contentType?: 'novel' | 'book' | 'comic';
  totalComicPages?: number;
  lastReadPageIndex?: number;
  comicSettings?: ComicSettings;
}

export interface SiteRule {
  id?: number | string;
  domain: string;
  name: string;
  contentSelector?: string;
  titleSelector?: string;
  nextSelector?: string;
  tocSelector?: string;
  paginationSelector?: string;
  excludeSelectors?: string[];
  isPreset?: boolean;
  version?: string;
  authorSelector?: string;
  descriptionSelector?: string;
  coverSelector?: string;
  chapterListSelector?: string;
  chapterItemSelector?: string;
  chapterContentSelector?: string;
  isCustom?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export type ScraperRule = SiteRule;

export interface AppSettings {
  storagePath: string;
  concurrency: number;
  requestDelayMs: number;
  jitterDelayMs: number;
  userAgent: string;
  proxyUrl?: string;
  accentColor: string;
  theme: 'dark';
  cloudSyncEnabled: boolean;
  licenseKey?: string;
  isPremium: boolean;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export type ActiveTab = 'dashboard' | 'library' | 'reader' | 'rules' | 'settings';
export type MediaCategory = 'all' | 'novel' | 'book' | 'comic';
export type ReaderTheme = 'dark' | 'oled' | 'light' | 'sepia' | 'mint' | 'pure_white' | 'calibre_white' | 'solarized' | 'custom';
export type ReaderFontFamily = 'sans' | 'serif' | 'literata' | 'mono';
export type ReadingMode = 'single' | 'two_column' | 'three_column' | 'auto_responsive' | 'paginated' | 'continuous';
export type PageTurnEffect = 'flip_3d' | 'slide' | 'fade' | 'instant';
export type LibraryProgressFilter = 'all' | 'unread' | 'starting' | 'reading' | 'nearly_done' | 'completed';

export interface ComicSettings {
  mode: 'webtoon' | 'single' | 'double';
  isRTL: boolean; // Right-to-Left for Japanese manga
  fit: 'width' | 'height' | 'original';
  gap: number; // in px
  zoom: number; // 0.5 to 3.0
  preloadCount: number; // default 3
  brightness: number; // 50 to 150
}

export interface ReaderSettings {
  theme: ReaderTheme;
  customBgColor?: string;
  customTextColor?: string;
  fontSize: number;
  lineHeight: number;
  fontFamily: ReaderFontFamily;
  fontWeight: number;
  maxWidth: number;
  paragraphSpacing: number;
  textAlign: 'justify' | 'left';
  textIndent: boolean;
  firstLineIndentEm: number;
  dropCaps: boolean;
  twoColumn: boolean;
  columnsCount: 1 | 2 | 3 | 'auto';
  marginTop: number;
  marginBottom: number;
  marginLeftRight: number;
  columnGap: number;
  readingMode: ReadingMode;
  pageTurnEffect: PageTurnEffect;
  pinToolbar: boolean;
  autoScroll: boolean;
  autoScrollSpeed: number;
  autoNextChapter: boolean;
  ttsRate: number;
  autoNextTTS: boolean;

  // Book Viewer Headers & Footers
  showCalibreHeader?: boolean;
  showCalibreFooter?: boolean;
  showReaderHeader: boolean;
  showReaderFooter: boolean;
  headerLeft: 'title' | 'author' | 'none';
  headerCenter: 'chapter' | 'title' | 'none';
  headerRight: 'time' | 'none';
  footerLeft: 'pages' | 'chapter' | 'none';
  footerCenter: 'progress_bar' | 'none';
  footerRight: 'percentage' | 'time_left' | 'none';

  // Viewer Modes
  referenceMode: boolean;
  distractionFree: boolean;
  autoHideToolbarSecs: number;
}

export type LibraryFilter = 'all' | 'reading' | 'favorite' | 'completed' | 'needs_update';
export type ExportFormat = 'txt' | 'docx' | 'pdf' | 'epub' | 'json';

export interface ExportOptions {
  splitVolumeSize?: number;
  omitChapterTitles?: boolean;
}

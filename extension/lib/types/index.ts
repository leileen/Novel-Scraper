export interface Novel {
  id?: number;
  title: string;
  author?: string;
  sourceUrl: string;
  coverUrl?: string;
  description?: string;
  totalChapters: number;
  downloadedChapters: number;
  status: 'idle' | 'crawling' | 'paused' | 'completed' | 'error';
  createdAt: number;
  updatedAt: number;
  ruleId?: number;
}

export interface Chapter {
  id?: number;
  novelId: number;
  chapterNumber: number;
  title: string;
  url: string;
  content: string;
  wordCount: number;
  status: 'pending' | 'crawling' | 'completed' | 'failed' | 'locked';
  errorMessage?: string;
  fetchedAt?: number;
}

export interface CrawlQueueItem {
  id?: number;
  novelId: number;
  chapterUrl: string;
  chapterNumber: number;
  chapterTitle: string;
  retryCount: number;
  status: 'queued' | 'processing' | 'done' | 'failed';
}

export interface SiteRule {
  id?: number;
  domain: string;
  name: string;
  contentSelector: string;
  titleSelector: string;
  nextSelector?: string;
  tocSelector?: string;
  paginationSelector?: string;
  excludeSelectors?: string[];
  isPreset: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ExportFormat = 'txt' | 'docx' | 'pdf' | 'epub' | 'json';

export interface ExportOptions {
  splitVolumeSize?: number;
  omitChapterTitles?: boolean;
}

export interface AppSettings {
  language: 'vi' | 'en';
  theme: 'dark' | 'light';
  politeDelayMin: number;
  politeDelayMax: number;
  defaultFormat: ExportFormat;
  adKeywords: string[];
  deobfuscateText?: boolean;
  customReplacements?: Array<{ from: string; to: string; active?: boolean }>;
  splitVolumeSize?: number;
  omitChapterTitles?: boolean;
}

export interface ExtractedChapter {
  title: string;
  novelTitle?: string;
  content: string;
  nextUrl?: string;
  isLocked?: boolean;
}

export interface TocChapterItem {
  title: string;
  url: string;
  chapterNumber: number;
}

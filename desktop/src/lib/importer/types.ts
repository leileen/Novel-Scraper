export interface ComicPageData {
  pageIndex: number;
  title?: string;
  dataUrl: string;
  width?: number;
  height?: number;
}

export interface ImportedEbook {
  title: string;
  author?: string;
  genres?: string[];
  description?: string;
  coverUrl?: string;
  format: string; // 'epub' | 'txt' | 'mobi' | 'docx' | 'pdf' | 'fb2' | 'json' | 'cbz' | 'cbr' | 'zip'
  fileName: string;
  fileSize: number;
  totalChapters: number;
  contentType?: 'novel' | 'book' | 'comic';
  comicPages?: ComicPageData[];
  chapters: Array<{
    title: string;
    content: string;
    wordCount?: number;
    images?: string[];
    totalImages?: number;
  }>;
}

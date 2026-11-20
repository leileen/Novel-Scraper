import type { ImportedEbook, ComicPageData } from './types';
import { parseTxtFile } from './txt';
import { parseEpubFile } from './epub';
import { parseDocxFile } from './docx';
import { parseMobiFile } from './mobi';
import { parseFb2File } from './fb2';
import { parsePdfFile } from './pdf';
import { parseJsonOrZipBackup } from './json';
import { parseComicFile } from './comic';
import { ZipReader } from './zipReader';
import type { Novel, Chapter } from '../types';

export * from './types';
export * from './comic';

/**
 * Universal Ebook & Comic Parser Dispatcher.
 * Automatically recognizes and parses EPUB, CBZ, CBR, ZIP, TXT, MOBI, AZW, AZW3, PRC, DOCX, PDF, FB2, and JSON.
 */
export async function parseEbookFile(file: File): Promise<ImportedEbook> {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

  switch (ext) {
    case '.cbz':
    case '.cbr':
      return parseComicFile(file);

    case '.txt': {
      const ebook = await parseTxtFile(file);
      ebook.contentType = 'novel';
      return ebook;
    }

    case '.epub': {
      const ebook = await parseEpubFile(file);
      // Auto-detect comic EPUB: if text is extremely short and contains image markers
      const totalWords = ebook.chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0);
      const hasImagesInChapters = ebook.chapters.some(
        (ch) => ch.images && ch.images.length > 0
      );
      if (hasImagesInChapters && totalWords < ebook.chapters.length * 30) {
        ebook.contentType = 'comic';
      } else {
        ebook.contentType = 'book';
      }
      return ebook;
    }

    case '.docx': {
      const ebook = await parseDocxFile(file);
      ebook.contentType = 'book';
      return ebook;
    }

    case '.mobi':
    case '.azw':
    case '.azw3':
    case '.prc': {
      const ebook = await parseMobiFile(file);
      ebook.contentType = 'book';
      return ebook;
    }

    case '.fb2': {
      const ebook = await parseFb2File(file);
      ebook.contentType = 'book';
      return ebook;
    }

    case '.pdf': {
      const ebook = await parsePdfFile(file);
      ebook.contentType = 'book';
      return ebook;
    }

    case '.json':
      return parseJsonOrZipBackup(file);

    case '.zip': {
      if (file.name.endsWith('.fb2.zip')) {
        const ebook = await parseFb2File(file);
        ebook.contentType = 'book';
        return ebook;
      }

      // Check if ZIP is a comic archive (high ratio of image files)
      try {
        const buf = await file.arrayBuffer();
        const testReader = new ZipReader(buf);
        await testReader.parse();
        let imageCount = 0;
        let totalFiles = 0;
        for (const [name] of testReader.entries.entries()) {
          if (name.startsWith('__MACOSX/') || name.endsWith('/')) continue;
          totalFiles++;
          if (/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(name)) {
            imageCount++;
          }
        }

        if (totalFiles > 0 && imageCount / totalFiles >= 0.5) {
          // Detected Comic / Manga ZIP
          return parseComicFile(file);
        }
      } catch {
        // Fall back to backup parser
      }

      return parseJsonOrZipBackup(file);
    }

    default:
      return parseTxtFile(file);
  }
}

/**
 * Converts an ImportedEbook into a standard Novel object and its Chapter list.
 */
export function convertImportedToNovel(ebook: ImportedEbook): {
  novel: Novel;
  chapters: Chapter[];
  comicPages?: ComicPageData[];
} {
  const novelId = `imported-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const total = ebook.chapters.length;

  const isComic = ebook.contentType === 'comic';
  const detectedCategory = isComic
    ? 'comic'
    : ebook.format === 'txt'
      ? 'novel'
      : 'book';

  const chapters: Chapter[] = ebook.chapters.map((ch, idx) => ({
    id: `${novelId}-ch-${idx + 1}`,
    novelId,
    index: idx + 1,
    chapterNumber: idx + 1,
    title: ch.title || (isComic ? `Tập ${idx + 1}` : `Chương ${idx + 1}`),
    url: `local://imported/${encodeURIComponent(ebook.fileName)}/ch-${idx + 1}`,
    content: ch.content || '',
    wordCount: ch.wordCount || 1000,
    images: ch.images,
    totalImages: ch.totalImages,
    status: 'completed',
    downloadedAt: Date.now()
  }));

  const totalPages = isComic ? ebook.comicPages?.length || 0 : undefined;

  const novel: Novel = {
    id: novelId,
    title: ebook.title,
    author: ebook.author || (isComic ? 'Manga / Comic Artist' : 'Đang cập nhật'),
    genres:
      ebook.genres && ebook.genres.length > 0
        ? ebook.genres
        : isComic
          ? ['Truyện tranh', 'Manga']
          : undefined,
    contentType: detectedCategory,
    totalComicPages: totalPages,
    comicSettings: isComic
      ? {
          mode: 'webtoon',
          isRTL: false,
          fit: 'width',
          gap: 8,
          zoom: 100,
          preloadCount: 3,
          brightness: 100
        }
      : undefined,
    sourceUrl: `local://imported/${encodeURIComponent(ebook.fileName)}`,
    sourceDomain: isComic
      ? `Truyện Tranh (${ebook.format.toUpperCase()})`
      : `Sách Nhập (${ebook.format.toUpperCase()})`,
    coverUrl: ebook.coverUrl,
    description:
      ebook.description ||
      (isComic
        ? `Bộ truyện tranh nhập từ ${ebook.fileName} gồm ${totalPages || 0} trang.`
        : `Sách được nhập từ tệp ${ebook.fileName} (${ebook.format.toUpperCase()}).`),
    totalChapters: total,
    maxChapterNumber: total,
    downloadedChapters: total,
    totalPublishedChapters: total,
    status: 'reading',
    readingProgress: 0,
    lastReadChapterId: chapters[0]?.id ? String(chapters[0].id) : undefined,
    lastReadChapterTitle: chapters[0]?.title || (isComic ? 'Trang 1' : 'Chương 1'),
    lastReadChapterNumber: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isImported: true,
    importFormat: ebook.format
  };

  return { novel, chapters, comicPages: ebook.comicPages };
}

import type { Chapter } from '../types';
import { removeWatermarksAndDividers } from '../sanitizer';

/**
 * Extracts the chapter number from a chapter title or number field.
 * Supports patterns like "Chương 12", "Chapter 12.5", "Hồi 12", "12", etc.
 */
export function extractChapterNumber(title: string, fallbackIndex: number): number {
  if (!title) return fallbackIndex;

  const match = title.match(/(?:Chương|Chapter|Hồi|Tiết|Chap|Episode)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (match && match[1]) {
    const parsed = parseFloat(match[1]);
    if (!isNaN(parsed)) return parsed;
  }

  // Handle inverted machine-translated chapter numbers like "mà 1312 Chương" or "thứ 500 Chương"
  const invertedMatch = title.match(/(?:mà|thứ|đệ)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:Chương|Chapter|Hồi|Tiết)/i);
  if (invertedMatch && invertedMatch[1]) {
    const parsed = parseFloat(invertedMatch[1]);
    if (!isNaN(parsed)) return parsed;
  }

  // If title begins with numbers: "01. Khởi đầu"
  const startMatch = title.match(/^([0-9]+(?:\.[0-9]+)?)/);
  if (startMatch && startMatch[1]) {
    const parsed = parseFloat(startMatch[1]);
    if (!isNaN(parsed)) return parsed;
  }

  return fallbackIndex;
}

/**
 * Natural sort comparator for chapters.
 * Sorts 1, 2, 3... 9, 10, 11 (instead of alphabetical 1, 10, 11, 2).
 */
export function naturalSortChapters(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort((a, b) => {
    const rawNumA = a.chapterNumber;
    const parsedA = typeof rawNumA === 'number' ? rawNumA : parseFloat(rawNumA as any);
    const numA = !isNaN(parsedA) && parsedA !== 0 ? parsedA : extractChapterNumber(a.title || '', 0);

    const rawNumB = b.chapterNumber;
    const parsedB = typeof rawNumB === 'number' ? rawNumB : parseFloat(rawNumB as any);
    const numB = !isNaN(parsedB) && parsedB !== 0 ? parsedB : extractChapterNumber(b.title || '', 0);

    if (numA !== numB) {
      return numA - numB;
    }

    // Secondary fallback: localeCompare with numeric collation (defensive against undefined titles)
    const titleA = a.title || '';
    const titleB = b.title || '';
    const titleComp = titleA.localeCompare(titleB, 'vi', { numeric: true, sensitivity: 'base' });
    if (titleComp !== 0) {
      return titleComp;
    }

    // Tertiary deterministic fallback: stable sort on id
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}

/**
 * Deduplicates chapters by URL and composite identity (chapterNumber + '::' + normalizedTitle).
 * Prevents dropping genuine chapters sharing titles (e.g. "Ngoại truyện", "", "Tiếp theo", "Phần 2").
 */
export function deduplicateChapters(chapters: Chapter[]): Chapter[] {
  const seenUrls = new Set<string>();
  const seenKeys = new Set<string>();
  const result: Chapter[] = [];

  for (const chap of chapters) {
    const rawTitle = chap.title || '';
    const normalizedTitle = rawTitle.trim().replace(/\s+/g, ' ').toLowerCase();
    const cleanUrl = chap.url ? chap.url.trim().split('#')[0].replace(/\/+$/, '').toLowerCase() : '';

    // 1. Deduplicate by canonical URL
    if (cleanUrl && seenUrls.has(cleanUrl)) {
      continue;
    }

    // 2. Resolve chapter number from chapterNumber field or title fallback
    const rawNum = chap.chapterNumber;
    const parsedNum = typeof rawNum === 'number' ? rawNum : parseFloat(rawNum as any);
    const chapterNum = !isNaN(parsedNum) && parsedNum !== 0
      ? parsedNum
      : extractChapterNumber(rawTitle, 0);

    // 3. Composite identity: chapterNumber + '::' + normalizedTitle
    const compositeKey = `${chapterNum}::${normalizedTitle}`;

    if (chapterNum > 0 || normalizedTitle.length > 0) {
      if (seenKeys.has(compositeKey)) {
        continue;
      }
      seenKeys.add(compositeKey);
    } else if (!cleanUrl) {
      // Both URL, title, and number are missing/empty: deduplicate
      if (seenKeys.has(compositeKey)) {
        continue;
      }
      seenKeys.add(compositeKey);
    }

    if (cleanUrl) {
      seenUrls.add(cleanUrl);
    }
    result.push(chap);
  }

  return result;
}

/**
 * Detects missing chapter numbers in a sequential list.
 * e.g., if chapters are [1, 2, 3, 5, 8], returns [4, 6, 7].
 */
export function detectMissingChapters(chapters: Chapter[]): number[] {
  if (chapters.length === 0) return [];

  const sorted = naturalSortChapters(chapters);
  const presentNumbers = new Set<number>();

  for (const chap of sorted) {
    const num = Math.floor(chap.chapterNumber || extractChapterNumber(chap.title, 0));
    if (num > 0) {
      presentNumbers.add(num);
    }
  }

  if (presentNumbers.size === 0) return [];

  const min = Math.min(...Array.from(presentNumbers));
  const max = Math.max(...Array.from(presentNumbers));
  const missing: number[] = [];

  for (let i = min; i <= max; i++) {
    if (!presentNumbers.has(i)) {
      missing.push(i);
    }
  }

  return missing;
}

/**
 * Normalizes title for comparison: trims, lowercase, NFC, collapses whitespace & punctuation.
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\s\-_—–:：.,|/\\()[\]{}]+/g, ' ')
    .trim();
}

/**
 * Checks if a novel's chapters represent a continuous multi-part story without distinct chapter names
 * (e.g. paginated WordPress posts, comong.info stories, one-shots where all pages share the novel title).
 */
export function isContinuousStory(novel: { title?: string }, chapters: Chapter[]): boolean {
  if (!chapters || chapters.length === 0) return false;

  const normNovel = normalizeTitle(novel?.title || '');
  if (!normNovel) return false;

  let matchOrEmptyCount = 0;
  for (const c of chapters) {
    const norm = normalizeTitle(c.title || '');
    if (!norm || norm === normNovel) {
      matchOrEmptyCount++;
    } else if (norm.startsWith(normNovel)) {
      const remainder = norm.slice(normNovel.length).trim();
      if (!remainder) {
        matchOrEmptyCount++;
      }
    }
  }

  // If there's 1 chapter and its title matches novel title: treat as continuous (no redundant header)
  if (chapters.length === 1 && matchOrEmptyCount === 1) {
    return true;
  }

  // If >= 70% of chapters have the novel title or empty title, it's a multi-part continuous story
  return (matchOrEmptyCount / chapters.length) >= 0.7;
}

/**
 * Resolves a clean, user-friendly chapter heading for export across all formats (TXT, DOCX, EPUB, PDF).
 * - Returns null when a heading should NOT be shown (e.g. continuous multi-part stories sharing novel title).
 * - Strips redundant novel title prefixes (e.g. "Cậu Ấm... - Chương 1" -> "Chương 1").
 * - Returns the clean chapter title when it is genuine (e.g. "Chương 1: Mở đầu").
 */
export function formatChapterTitleForExport(
  chap: Chapter,
  novel: { title?: string },
  allChapters: Chapter[] = [],
  isContinuous?: boolean,
  options?: { omitChapterTitles?: boolean }
): string | null {
  if (options?.omitChapterTitles) {
    return null;
  }
  const rawTitle = (chap.title || '').trim();
  const rawNovelTitle = (novel?.title || '').trim();

  const normChap = normalizeTitle(rawTitle);
  const normNovel = normalizeTitle(rawNovelTitle);

  const continuous = typeof isContinuous === 'boolean' ? isContinuous : isContinuousStory(novel, allChapters);

  // If chapter title is completely empty
  if (!normChap) {
    if (continuous) return null;
    const chapNum = chap.chapterNumber || 0;
    return chapNum > 0 ? `Chương ${chapNum}` : null;
  }

  // If chapter title matches novel title exactly
  if (normChap === normNovel) {
    if (continuous) {
      // In a continuous story (like comong.info multi-part posts),
      // do not insert redundant novel title headers between paragraphs!
      return null;
    }
    // If other chapters have distinct titles, use "Chương X" for this chapter
    const chapNum = chap.chapterNumber || 0;
    return chapNum > 0 ? `Chương ${chapNum}` : null;
  }

  // Check if chapter title starts with novel title prefix (e.g. "Tên Truyện - Chương 1" or "Tên Truyện | Phần 1")
  if (rawNovelTitle && rawTitle.toLowerCase().startsWith(rawNovelTitle.toLowerCase())) {
    const remainder = rawTitle.slice(rawNovelTitle.length).replace(/^[\s\-_—–:：.,|/\\()[\]{}]+/, '').trim();
    if (!remainder) {
      return continuous ? null : ((chap.chapterNumber ?? 0) > 0 ? `Chương ${chap.chapterNumber}` : null);
    }
    return remainder;
  }

  // Genuine chapter title
  return rawTitle;
}

/**
 * Returns chapter text cleaned of any anti-scraping watermark headers, divider bars,
 * or repeated title artifacts at export time.
 */
export function getCleanChapterContent(
  chap: Chapter,
  novelTitle?: string,
  options?: { omitChapterTitles?: boolean }
): string {
  if (!chap.content || !chap.content.trim()) return '';
  return removeWatermarksAndDividers(chap.content, novelTitle, chap.title, options);
}

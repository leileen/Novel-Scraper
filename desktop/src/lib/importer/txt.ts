import type { ImportedEbook } from './types';

export async function parseTxtFile(file: File): Promise<ImportedEbook> {
  const arrayBuffer = await file.arrayBuffer();
  let text = '';

  // 1. Try UTF-8 decoding
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    text = decoder.decode(arrayBuffer);
  } catch {
    // 2. Fallback to windows-1258 or standard utf-8 non-fatal
    try {
      const decoder = new TextDecoder('windows-1258');
      text = decoder.decode(arrayBuffer);
    } catch {
      const decoder = new TextDecoder('utf-8');
      text = decoder.decode(arrayBuffer);
    }
  }

  // Remove BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const lines = text.split(/\r?\n/);
  let title = file.name.replace(/\.[^/.]+$/, '').trim();
  let author = 'Đang cập nhật';
  const genres: string[] = [];

  // Inspect first 30 lines for title, author, genres
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const l = lines[i].trim();
    if (!l) continue;

    const authorMatch = l.match(/^(?:Tác\s*giả|Author)\s*[:\-]\s*(.+)$/i);
    if (authorMatch?.[1]) {
      author = authorMatch[1].trim();
      continue;
    }

    const genreMatch = l.match(/^(?:Thể\s*loại|Genre|Thể\s*loại\s*truyện)\s*[:\-]\s*(.+)$/i);
    if (genreMatch?.[1]) {
      const gList = genreMatch[1].split(/[,;/]/).map(g => g.trim()).filter(Boolean);
      for (const g of gList) {
        if (!genres.includes(g)) genres.push(g);
      }
      continue;
    }

    const titleMatch = l.match(/^(?:Tên\s*truyện|Tiêu\s*đề|Title)\s*[:\-]\s*(.+)$/i);
    if (titleMatch?.[1]) {
      title = titleMatch[1].trim();
      continue;
    }

    // If first non-empty line has no colon and is short, might be the title
    if (i < 3 && !titleMatch && l.length < 80 && !/chương|chapter/i.test(l)) {
      title = l;
    }
  }

  // Smart Chapter Boundary Regex
  // Matches: "Chương 1", "Chương 1: Khởi đầu", "Hồi 12", "Chapter 3", "Quyển 1 - Chương 2", "Tiết 5"
  const chapterPattern = /(?:^|\r?\n\s*)((?:Quyển\s*\d+\s*[-:]\s*)?(?:Chương|Hồi|Tiết|Tập|Phần|Mục|Chapter|Chap|Ch\.)\s*(\d+|[IVXLCDM]+)[\s:.-]*([^\r\n]*))/gi;

  const matches: Array<{ fullMatch: string; title: string; index: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = chapterPattern.exec(text)) !== null) {
    matches.push({
      fullMatch: match[0],
      title: match[1].trim(),
      index: match.index + (match[0].length - match[1].length)
    });
  }

  const chapters: Array<{ title: string; content: string; wordCount?: number }> = [];

  if (matches.length >= 2) {
    // We found clean chapter breaks!
    // Intro/Prologue before Chapter 1 if it has substantial content
    if (matches[0].index > 100) {
      const prologueContent = text.slice(0, matches[0].index).trim();
      if (prologueContent.length > 50) {
        chapters.push({
          title: 'Lời mở đầu / Giới thiệu',
          content: prologueContent,
          wordCount: prologueContent.split(/\s+/).length
        });
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const startPos = current.index;
      const endPos = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const rawChunk = text.slice(startPos, endPos).trim();

      // Remove the chapter title line from the beginning of chunk content
      const contentLines = rawChunk.split(/\r?\n/);
      let content = rawChunk;
      if (contentLines.length > 1) {
        content = contentLines.slice(1).join('\n').trim();
      }

      const words = content.split(/\s+/).filter(Boolean).length;
      chapters.push({
        title: current.title,
        content: content || 'Nội dung chương trống.',
        wordCount: words
      });
    }
  } else {
    // No chapter headers found (raw continuous text file)
    // Chunk automatically by ~1800 words (~10KB) per chapter
    const paragraphs = text.split(/\r?\n\s*\r?\n/);
    let currentBatch: string[] = [];
    let currentWordCount = 0;
    let chapNum = 1;

    for (const para of paragraphs) {
      const p = para.trim();
      if (!p) continue;
      const wCount = p.split(/\s+/).length;

      currentBatch.push(p);
      currentWordCount += wCount;

      if (currentWordCount >= 1800) {
        chapters.push({
          title: `Phần ${chapNum}`,
          content: currentBatch.join('\n\n'),
          wordCount: currentWordCount
        });
        currentBatch = [];
        currentWordCount = 0;
        chapNum++;
      }
    }

    if (currentBatch.length > 0) {
      chapters.push({
        title: chapters.length === 0 ? 'Toàn văn' : `Phần ${chapNum}`,
        content: currentBatch.join('\n\n'),
        wordCount: currentWordCount
      });
    }
  }

  return {
    title,
    author,
    genres: genres.length > 0 ? genres : undefined,
    format: 'txt',
    fileName: file.name,
    fileSize: file.size,
    totalChapters: chapters.length,
    coverUrl: `https://picsum.photos/seed/${encodeURIComponent(title)}/240/340`,
    chapters
  };
}

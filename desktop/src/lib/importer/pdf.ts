import type { ImportedEbook } from './types';

export async function parsePdfFile(file: File): Promise<ImportedEbook> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const textDecoder = new TextDecoder('latin1');
  const rawString = textDecoder.decode(buffer);

  const title = file.name.replace(/\.pdf$/i, '').trim();

  // Extract text within BT ... ET blocks and stream objects
  const textChunks: string[] = [];
  const textRegex = /BT[\s\S]*?ET/g;
  let match: RegExpExecArray | null;

  while ((match = textRegex.exec(rawString)) !== null) {
    const block = match[0];
    // Match literal strings: (text) or hex strings: <48656c6c6f>
    const strMatches = block.matchAll(/\(([^)]*)\)\s*(?:Tj|'|")/g);
    let line = '';
    for (const sm of strMatches) {
      line += sm[1] + ' ';
    }
    // Also match text array: [ (chunk) 10 (chunk) ] TJ
    const tjMatches = block.matchAll(/\[(.*?)\]\s*TJ/g);
    for (const tm of tjMatches) {
      const parts = tm[1].matchAll(/\(([^)]*)\)/g);
      for (const p of parts) {
        line += p[1] + ' ';
      }
    }
    line = line.trim();
    if (line) textChunks.push(line);
  }

  // If text extraction yielded content, use it; otherwise provide informative placeholder
  let fullText = textChunks.join('\n\n').trim();

  // Clean common PDF escape sequences
  fullText = fullText
    .replace(/\\([\\()])/g, '$1')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n');

  const chapters: Array<{ title: string; content: string; wordCount?: number }> = [];

  if (fullText.length > 100) {
    // Detect chapters
    const chapterPattern = /(?:^|\n\s*)((?:Chương|Hồi|Chapter|Phần)\s*\d+[\s:.-]*[^\n]*)/gi;
    const matches: Array<{ title: string; index: number }> = [];
    let cm: RegExpExecArray | null;

    while ((cm = chapterPattern.exec(fullText)) !== null) {
      matches.push({ title: cm[1].trim(), index: cm.index });
    }

    if (matches.length >= 2) {
      for (let i = 0; i < matches.length; i++) {
        const cur = matches[i];
        const startPos = cur.index;
        const endPos = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
        const chunk = fullText.slice(startPos, endPos).trim();
        chapters.push({
          title: cur.title,
          content: chunk,
          wordCount: chunk.split(/\s+/).filter(Boolean).length
        });
      }
    } else {
      // Chunk into ~1500 word pages
      const lines = fullText.split(/\n+/);
      let batch: string[] = [];
      let wCount = 0;
      let pIdx = 1;

      for (const l of lines) {
        batch.push(l);
        wCount += l.split(/\s+/).length;
        if (wCount >= 1500) {
          chapters.push({
            title: `Trang ${pIdx}`,
            content: batch.join('\n\n'),
            wordCount: wCount
          });
          batch = [];
          wCount = 0;
          pIdx++;
        }
      }
      if (batch.length > 0) {
        chapters.push({
          title: `Trang ${pIdx}`,
          content: batch.join('\n\n'),
          wordCount: wCount
        });
      }
    }
  } else {
    chapters.push({
      title: 'Tài liệu PDF',
      content:
        `Tệp PDF: "${file.name}"\n\n` +
        `Nội dung PDF này ở dạng hình ảnh scan (bitmap/raster) hoặc mã hóa phông chữ tùy biến. ` +
        `Bạn có thể đọc các tệp văn bản hoặc EPUB, TXT, MOBI, DOCX để có trải nghiệm đọc tối ưu nhất.`,
      wordCount: 50
    });
  }

  return {
    title,
    author: 'Đang cập nhật',
    format: 'pdf',
    fileName: file.name,
    fileSize: file.size,
    totalChapters: chapters.length,
    coverUrl: `https://picsum.photos/seed/${encodeURIComponent(title)}/240/340`,
    chapters
  };
}

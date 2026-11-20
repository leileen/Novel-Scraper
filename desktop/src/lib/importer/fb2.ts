import { ZipReader } from './zipReader';
import type { ImportedEbook } from './types';

export async function parseFb2File(file: File): Promise<ImportedEbook> {
  let xmlText = '';

  if (file.name.endsWith('.fb2.zip') || (file.name.endsWith('.zip') && !file.name.endsWith('.epub'))) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = new ZipReader(arrayBuffer);
    await zip.parse();
    // Look for .fb2 entry
    for (const [name, entry] of zip.entries) {
      if (name.endsWith('.fb2')) {
        xmlText = await entry.readText('utf-8');
        break;
      }
    }
    if (!xmlText) {
      throw new Error('Không tìm thấy file .fb2 bên trong file nén.');
    }
  } else {
    xmlText = await file.text();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  // Title
  let title = doc.querySelector('book-title')?.textContent?.trim() || file.name.replace(/\.fb2(\.zip)?$/i, '');

  // Author
  const firstName = doc.querySelector('author first-name')?.textContent?.trim() || '';
  const lastName = doc.querySelector('author last-name')?.textContent?.trim() || '';
  const author = `${firstName} ${lastName}`.trim() || 'Đang cập nhật';

  // Genres
  const genres: string[] = [];
  doc.querySelectorAll('genre').forEach(g => {
    const val = g.textContent?.trim();
    if (val && !genres.includes(val)) genres.push(val);
  });

  // Description
  const description = doc.querySelector('annotation')?.textContent?.trim() || '';

  // Cover image from base64 binary
  let coverUrl = `https://picsum.photos/seed/${encodeURIComponent(title)}/240/340`;
  const coverImageHref = doc.querySelector('coverpage image')?.getAttribute('l:href') || '';
  const coverId = coverImageHref.replace(/^#/, '');

  if (coverId) {
    const binaryEl = doc.querySelector(`binary[id="${coverId}"]`);
    if (binaryEl?.textContent) {
      const cType = binaryEl.getAttribute('content-type') || 'image/jpeg';
      coverUrl = `data:${cType};base64,${binaryEl.textContent.trim()}`;
    }
  }

  // Chapters from sections
  const chapters: Array<{ title: string; content: string; wordCount?: number }> = [];
  const sections = doc.querySelectorAll('body > section');

  if (sections.length > 0) {
    sections.forEach((sec, idx) => {
      const secTitle = sec.querySelector('title')?.textContent?.trim() || `Chương ${idx + 1}`;
      const paras: string[] = [];
      sec.querySelectorAll('p').forEach(p => {
        const pt = p.textContent?.trim();
        if (pt) paras.push(pt);
      });
      const content = paras.join('\n\n');
      chapters.push({
        title: secTitle,
        content: content || 'Nội dung chương trống.',
        wordCount: content.split(/\s+/).filter(Boolean).length
      });
    });
  } else {
    const allP = doc.querySelectorAll('body p');
    const paras: string[] = [];
    allP.forEach(p => {
      const pt = p.textContent?.trim();
      if (pt) paras.push(pt);
    });
    const content = paras.join('\n\n');
    chapters.push({
      title: 'Toàn văn',
      content: content || 'Nội dung truyện trống.',
      wordCount: content.split(/\s+/).filter(Boolean).length
    });
  }

  return {
    title,
    author,
    genres: genres.length > 0 ? genres : undefined,
    description,
    coverUrl,
    format: 'fb2',
    fileName: file.name,
    fileSize: file.size,
    totalChapters: chapters.length,
    chapters
  };
}

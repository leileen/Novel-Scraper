import type { ImportedEbook, ComicPageData } from './types';
import { ZipReader } from './zipReader';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);

function isImageFile(fileName: string): boolean {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function getMimeType(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.avif':
      return 'image/avif';
    case '.jpg':
    case '.jpeg':
    default:
      return 'image/jpeg';
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Parses a Comic file (.cbz, .cbr, or image .zip).
 */
export async function parseComicFile(file: File): Promise<ImportedEbook> {
  const buffer = await file.arrayBuffer();
  const reader = new ZipReader(buffer);

  try {
    await reader.parse();
  } catch (e) {
    throw new Error(`Không thể giải nén tệp truyện tranh ${file.name}: ${(e as Error).message}`);
  }

  // Filter and sort image files
  const imageEntries: Array<{ name: string; entry: ReturnType<typeof reader.entries.get> }> = [];
  for (const [name, entry] of reader.entries.entries()) {
    // Ignore macOS metadata and directories
    if (name.startsWith('__MACOSX/') || name.endsWith('/')) continue;
    if (isImageFile(name)) {
      imageEntries.push({ name, entry });
    }
  }

  if (imageEntries.length === 0) {
    throw new Error(`Tệp ${file.name} không chứa bất kỳ hình ảnh trang truyện hợp lệ nào.`);
  }

  // Sort images naturally (e.g. 1.jpg, 2.jpg, 10.jpg)
  imageEntries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  const comicPages: ComicPageData[] = [];
  const imageUrls: string[] = [];
  let coverUrl = '';

  for (let idx = 0; idx < imageEntries.length; idx++) {
    const item = imageEntries[idx];
    if (!item.entry) continue;

    try {
      const bytes = await item.entry.read();
      const mime = getMimeType(item.name);
      const b64 = uint8ArrayToBase64(bytes);
      const dataUrl = `data:${mime};base64,${b64}`;

      imageUrls.push(dataUrl);
      if (idx === 0) {
        coverUrl = dataUrl;
      }

      const pageNumber = idx + 1;
      const baseName = item.name.split('/').pop() || `Trang ${pageNumber}`;

      comicPages.push({
        pageIndex: pageNumber,
        title: baseName,
        dataUrl
      });
    } catch (err) {
      console.warn(`Không thể đọc trang ${item.name}:`, err);
    }
  }

  const baseTitle = file.name.replace(/\.[^/.]+$/, '').trim();

  // Create chapter breakdown
  // If subdirectories exist, we can detect chapters, otherwise create 1 full chapter or chunks
  const chapters = [
    {
      title: 'Toàn bộ tập truyện',
      content: `Bộ truyện tranh "${baseTitle}" gồm ${comicPages.length} trang hình ảnh độ nét cao.`,
      images: imageUrls,
      totalImages: comicPages.length,
      wordCount: comicPages.length * 50
    }
  ];

  return {
    title: baseTitle,
    author: 'Truyện tranh Manga/Comic',
    genres: ['Truyện tranh', 'Manga', 'Comic'],
    description: `Truyện tranh nhập từ tệp ${file.name}. Tổng số trang: ${comicPages.length} trang.`,
    coverUrl,
    format: file.name.endsWith('.cbz') ? 'cbz' : file.name.endsWith('.cbr') ? 'cbr' : 'zip',
    fileName: file.name,
    fileSize: file.size,
    totalChapters: chapters.length,
    contentType: 'comic',
    comicPages,
    chapters
  };
}

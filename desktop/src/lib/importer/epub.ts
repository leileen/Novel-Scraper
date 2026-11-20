import { ZipReader } from './zipReader';
import type { ImportedEbook } from './types';

export async function parseEpubFile(file: File): Promise<ImportedEbook> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = new ZipReader(arrayBuffer);
  await zip.parse();

  // 1. Locate rootfile from META-INF/container.xml
  const containerEntry = zip.getEntry('META-INF/container.xml');
  if (!containerEntry) {
    throw new Error('Tệp EPUB không hợp lệ (không tìm thấy container.xml).');
  }

  const containerXml = await containerEntry.readText();
  const domParser = new DOMParser();
  const containerDoc = domParser.parseFromString(containerXml, 'text/xml');
  const rootfileEl = containerDoc.querySelector('rootfile');
  const opfPath = rootfileEl?.getAttribute('full-path');

  if (!opfPath) {
    throw new Error('Không tìm thấy đường dẫn file OPF trong container.xml.');
  }

  // 2. Parse OPF file
  const opfEntry = zip.getEntry(opfPath);
  if (!opfEntry) {
    throw new Error(`Không tìm thấy file OPF tại đường dẫn: ${opfPath}`);
  }

  const opfXml = await opfEntry.readText();
  const opfDoc = domParser.parseFromString(opfXml, 'text/xml');

  // Base directory for relative paths in OPF
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  // Extract Metadata
  let title = opfDoc.querySelector('title, dc\\:title')?.textContent?.trim() || file.name.replace(/\.epub$/i, '');
  let author = opfDoc.querySelector('creator, dc\\:creator')?.textContent?.trim() || 'Đang cập nhật';
  const description = opfDoc.querySelector('description, dc\\:description')?.textContent?.trim() || '';

  const genreEls = opfDoc.querySelectorAll('subject, dc\\:subject');
  const genres: string[] = [];
  genreEls.forEach(el => {
    const val = el.textContent?.trim();
    if (val && !genres.includes(val)) genres.push(val);
  });

  // Extract Manifest items: id -> href, media-type
  const manifestMap = new Map<string, { href: string; mediaType: string; properties?: string }>();
  const itemEls = opfDoc.querySelectorAll('manifest > item');
  itemEls.forEach(el => {
    const id = el.getAttribute('id') || '';
    const href = el.getAttribute('href') || '';
    const mediaType = el.getAttribute('media-type') || '';
    const properties = el.getAttribute('properties') || '';
    if (id && href) {
      manifestMap.set(id, { href, mediaType, properties });
    }
  });

  // Extract Cover Image
  let coverUrl = `https://picsum.photos/seed/${encodeURIComponent(title)}/240/340`;
  let coverHref: string | undefined;

  // 1. Check item with properties="cover-image"
  for (const item of manifestMap.values()) {
    if (item.properties?.includes('cover-image')) {
      coverHref = item.href;
      break;
    }
  }

  // 2. Check meta[name="cover"]
  if (!coverHref) {
    const coverMeta = opfDoc.querySelector('meta[name="cover"]');
    const coverId = coverMeta?.getAttribute('content');
    if (coverId && manifestMap.has(coverId)) {
      coverHref = manifestMap.get(coverId)?.href;
    }
  }

  // 3. Check items containing "cover" in ID or href
  if (!coverHref) {
    for (const [id, item] of manifestMap.entries()) {
      if (
        (id.toLowerCase().includes('cover') || item.href.toLowerCase().includes('cover')) &&
        item.mediaType.startsWith('image/')
      ) {
        coverHref = item.href;
        break;
      }
    }
  }

  if (coverHref) {
    const resolvedCoverPath = resolveZipPath(opfDir, coverHref);
    const coverEntry = zip.getEntry(resolvedCoverPath);
    if (coverEntry) {
      try {
        const coverBytes = await coverEntry.read();
        const base64 = uint8ArrayToBase64(coverBytes);
        const mime = coverHref.endsWith('.png') ? 'image/png' : 'image/jpeg';
        coverUrl = `data:${mime};base64,${base64}`;
      } catch (err) {
        console.warn('Failed to load EPUB cover image:', err);
      }
    }
  }

  // Read Spine (Reading Order)
  const spineItemrefs = opfDoc.querySelectorAll('spine > itemref');
  const orderedChapterHrefs: string[] = [];

  spineItemrefs.forEach(itemref => {
    const idref = itemref.getAttribute('idref');
    if (idref && manifestMap.has(idref)) {
      const item = manifestMap.get(idref)!;
      if (item.mediaType === 'application/xhtml+xml' || item.mediaType === 'text/html') {
        orderedChapterHrefs.push(item.href);
      }
    }
  });

  // Parse Chapter Contents
  const chapters: Array<{ title: string; content: string; wordCount?: number }> = [];

  for (let idx = 0; idx < orderedChapterHrefs.length; idx++) {
    const href = orderedChapterHrefs[idx];
    const resolvedPath = resolveZipPath(opfDir, href);
    const chapEntry = zip.getEntry(resolvedPath);
    if (!chapEntry) continue;

    try {
      const htmlText = await chapEntry.readText();
      const chapDoc = domParser.parseFromString(htmlText, 'text/html');

      // Strip non-content tags
      chapDoc.querySelectorAll('script, style, link, meta, head').forEach(el => el.remove());

      // Extract Chapter Title
      let chapTitle = '';
      const headingEl = chapDoc.querySelector('h1, h2, h3, title');
      if (headingEl?.textContent?.trim()) {
        chapTitle = headingEl.textContent.trim();
      } else {
        chapTitle = `Chương ${chapters.length + 1}`;
      }

      // Extract paragraphs
      const pElements = chapDoc.querySelectorAll('p, div.text, div.content, blockquote, li');
      const paragraphs: string[] = [];

      if (pElements.length > 0) {
        pElements.forEach(p => {
          const t = p.textContent?.trim();
          if (t && t.length > 0) paragraphs.push(t);
        });
      } else {
        // Fallback to body text
        const bodyText = (chapDoc.body?.textContent || '').trim();
        if (bodyText) {
          paragraphs.push(...bodyText.split(/\n\s*\n/).filter(Boolean));
        }
      }

      const content = paragraphs.join('\n\n').trim();
      if (!content || content.length < 15) {
        // Skip empty splash / cover pages
        if (idx === 0) continue;
      }

      const words = content.split(/\s+/).filter(Boolean).length;
      chapters.push({
        title: chapTitle,
        content: content || 'Nội dung chương trống.',
        wordCount: words
      });
    } catch (err) {
      console.warn(`Failed to parse chapter ${href}:`, err);
    }
  }

  if (chapters.length === 0) {
    chapters.push({
      title: 'Chương 1',
      content: 'Không thể trích xuất văn bản từ tệp EPUB này.',
      wordCount: 10
    });
  }

  return {
    title,
    author,
    genres: genres.length > 0 ? genres : undefined,
    description,
    coverUrl,
    format: 'epub',
    fileName: file.name,
    fileSize: file.size,
    totalChapters: chapters.length,
    chapters
  };
}

function resolveZipPath(baseDir: string, relativePath: string): string {
  // Normalize ../ and ./
  const cleanBase = baseDir.replace(/\/+$/, '');
  const combined = cleanBase ? `${cleanBase}/${relativePath}` : relativePath;
  const parts = combined.split('/');
  const resolvedParts: string[] = [];

  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      resolvedParts.pop();
    } else {
      resolvedParts.push(part);
    }
  }

  return resolvedParts.join('/');
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(len, i + chunkSize));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

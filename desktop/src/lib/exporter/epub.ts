import type { Novel, Chapter } from '../types';
import { naturalSortChapters, deduplicateChapters, formatChapterTitleForExport, isContinuousStory, getCleanChapterContent } from './sorter';
import { triggerBlobDownload, sanitizeFilename } from './txt';
import { ZipWriter } from './zip';

/**
 * Escapes characters for strict XML/XHTML compliance and strips invalid XML control chars.
 */
export function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Strip invalid XML 1.0 control codes
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a clean UUID v4 for the package unique identifier.
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Modern stylesheet embedded inside the EPUB for consistent typography across readers.
 */
export const EPUB_STYLESHEET = `@charset "utf-8";
body {
  font-family: "Times New Roman", "DejaVu Serif", Georgia, serif;
  line-height: 1.6;
  margin: 5%;
  text-align: justify;
  color: #111827;
}
h1, h2, h3 {
  text-align: center;
  font-weight: bold;
  color: #0f172a;
}
h1.book-title {
  font-size: 2em;
  margin-top: 20%;
  margin-bottom: 0.5em;
  line-height: 1.2;
}
p.book-author {
  font-size: 1.25em;
  font-style: italic;
  text-align: center;
  color: #4b5563;
  margin-bottom: 2em;
}
.book-meta {
  text-align: center;
  font-size: 0.9em;
  color: #6b7280;
  border-top: 1px solid #e2e8f0;
  padding-top: 1.5em;
  margin-top: 2em;
}
.book-desc {
  margin-top: 2em;
  font-style: italic;
  color: #334155;
  padding: 1em;
  background-color: #f8fafc;
  border-radius: 6px;
}
h2.chapter-title {
  font-size: 1.5em;
  margin-top: 1.5em;
  margin-bottom: 1.2em;
  padding-bottom: 0.5em;
  border-bottom: 1px solid #e2e8f0;
  line-height: 1.3;
}
p {
  text-indent: 1.5em;
  margin-top: 0;
  margin-bottom: 0.75em;
}
p.empty-notice {
  text-align: center;
  text-indent: 0;
  color: #94a3b8;
  font-style: italic;
}
nav#toc ol {
  list-style-type: none;
  padding-left: 0;
}
nav#toc li {
  margin-bottom: 0.6em;
  border-bottom: 1px dotted #cbd5e1;
  padding-bottom: 0.3em;
}
nav#toc a {
  text-decoration: none;
  color: #2563eb;
}
.cover-wrap {
  text-align: center;
  margin: 1.5em auto 1em auto;
}
.cover-img {
  max-width: 72%;
  max-height: 420px;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.2);
}
.toc-quick-jump {
  margin: 1em 0 1.5em 0;
  padding: 0.85em 1em;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  text-align: left;
}
.toc-quick-jump-title {
  font-weight: bold;
  font-size: 0.92em;
  color: #334155;
  margin-bottom: 0.6em;
  text-indent: 0;
}
.toc-jump-pills {
  display: block;
  line-height: 2;
}
.jump-pill {
  display: inline-block;
  margin: 0 0.4em 0.4em 0;
  padding: 0.2em 0.65em;
  background-color: #e0e7ff;
  color: #1e40af;
  border-radius: 999px;
  font-size: 0.85em;
  text-decoration: none;
  font-weight: 600;
}
li.toc-group-start {
  margin-top: 1.1em;
  padding-top: 0.45em;
  border-top: 2px solid #94a3b8;
}
.chapter-nav {
  margin-top: 2.2em;
  padding-top: 0.9em;
  border-top: 1px solid #e2e8f0;
  text-align: center;
  font-size: 0.9em;
}
.chapter-nav a {
  color: #2563eb;
  text-decoration: none;
  margin: 0 0.65em;
  font-weight: bold;
}
`;

/**
 * Attempts to fetch cover image bytes with a short timeout so offline/unit test runs never hang.
 */
async function tryFetchCoverImage(coverUrl?: string): Promise<{ bytes: Uint8Array; ext: string; mediaType: string } | null> {
  if (!coverUrl || !/^https?:\/\//i.test(coverUrl) || typeof fetch === 'undefined') {
    return null;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(coverUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = (res.headers?.get('content-type') || '').toLowerCase();
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.byteLength < 64) return null;

    if (contentType.includes('png') || /\.png(?:\?|$)/i.test(coverUrl)) {
      return { bytes, ext: 'png', mediaType: 'image/png' };
    }
    if (contentType.includes('webp') || /\.webp(?:\?|$)/i.test(coverUrl)) {
      return { bytes, ext: 'webp', mediaType: 'image/webp' };
    }
    return { bytes, ext: 'jpg', mediaType: 'image/jpeg' };
  } catch {
    return null;
  }
}

/**
 * Builds an EPUB 3 document container and returns a valid Blob.
 */
export async function buildEpubBlob(
  novel: Novel,
  chapters: Chapter[],
  options?: { omitChapterTitles?: boolean }
): Promise<Blob> {
  const sorted = deduplicateChapters(naturalSortChapters(chapters));
  const bookId = generateUuid();
  const modifiedDate = new Date().toISOString().replace(/\.[0-9]+Z$/, 'Z');
  const zip = new ZipWriter();

  // 1. mimetype: MUST be first entry, uncompressed, exact string "application/epub+zip"
  zip.addFile('mimetype', 'application/epub+zip');

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.addFile('META-INF/container.xml', containerXml);

  // 3. OEBPS/style.css
  zip.addFile('OEBPS/style.css', EPUB_STYLESHEET);

  // Optional Cover Image
  const coverData = await tryFetchCoverImage(novel.coverUrl);
  const coverFilename = coverData ? `cover.${coverData.ext}` : null;
  if (coverData && coverFilename) {
    zip.addFile(`OEBPS/${coverFilename}`, coverData.bytes);
  }

  // 4. OEBPS/titlepage.xhtml
  const titlePageXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(novel.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body class="titlepage">
  <section epub:type="frontmatter" role="doc-frontmatter">
    ${coverFilename ? `<div class="cover-wrap"><img src="${coverFilename}" alt="${escapeXml(novel.title)}" class="cover-img"/></div>` : ''}
    <h1 class="book-title">${escapeXml(novel.title)}</h1>
    ${novel.author ? `<p class="book-author">Tác giả: ${escapeXml(novel.author)}</p>` : ''}
    <div class="book-meta">
      <p>Nguồn: ${escapeXml(novel.sourceUrl || 'Novel Scraper')}</p>
      <p>Tổng số chương: ${sorted.length}</p>
      <p><a href="nav.xhtml">Mở Mục lục nhanh (${sorted.length} chương)</a></p>
      <p>Xuất bản bởi Novel Scraper Extension</p>
    </div>
    ${novel.description ? `<div class="book-desc"><p>${escapeXml(novel.description)}</p></div>` : ''}
  </section>
</body>
</html>`;
  zip.addFile('OEBPS/titlepage.xhtml', titlePageXhtml);

  const continuous = isContinuousStory(novel, sorted);

  // 5. Generate Chapter XHTMLs
  for (let i = 0; i < sorted.length; i++) {
    const chap = sorted[i];
    const fileIndex = i + 1;
    const heading = options?.omitChapterTitles ? null : formatChapterTitleForExport(chap, novel, sorted, continuous, options);
    const displayHeading = heading || (continuous || options?.omitChapterTitles ? `Phần ${fileIndex}` : (chap.title || `Chương ${fileIndex}`));

    const cleanText = getCleanChapterContent(chap, novel.title, options);
    const paragraphs = cleanText
      .split('\n\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => `<p>${escapeXml(p)}</p>`)
      .join('\n        ');

    const emptyNotice =
      chap.status === 'locked'
        ? '<p class="empty-notice">[Chương VIP / Nội dung đã bị khóa]</p>'
        : '<p class="empty-notice">[Nội dung trống hoặc chưa tải]</p>';

    const headingMarkup = heading
      ? `<h2 class="chapter-title">${escapeXml(heading)}</h2>`
      : (continuous || options?.omitChapterTitles ? '' : `<h2 class="chapter-title">${escapeXml(displayHeading)}</h2>`);

    const prevLink = fileIndex > 1 ? `<a href="chapter_${fileIndex - 1}.xhtml">← Chương trước</a>` : '';
    const tocLink = `<a href="nav.xhtml">☰ Mục lục</a>`;
    const nextLink = fileIndex < sorted.length ? `<a href="chapter_${fileIndex + 1}.xhtml">Chương sau →</a>` : '';

    const chapterXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(displayHeading)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <section epub:type="chapter" role="doc-chapter">
    ${headingMarkup}
    <div class="chapter-content">
        ${paragraphs || emptyNotice}
    </div>
    <div class="chapter-nav">
      ${prevLink}
      ${tocLink}
      ${nextLink}
    </div>
  </section>
</body>
</html>`;

    zip.addFile(`OEBPS/chapter_${fileIndex}.xhtml`, chapterXhtml);
  }

  // 6. OEBPS/nav.xhtml (EPUB 3 Navigation Document with Quick-Jump Range Menu for long novels)
  const GROUP_SIZE = 100;
  let quickJumpMarkup = '';
  if (sorted.length > 50) {
    const groupPills: string[] = [];
    for (let startIdx = 0; startIdx < sorted.length; startIdx += GROUP_SIZE) {
      const startNum = startIdx + 1;
      const endNum = Math.min(startIdx + GROUP_SIZE, sorted.length);
      groupPills.push(
        `        <a class="jump-pill" href="#chap-group-${startNum}">Chương ${startNum}–${endNum}</a>`
      );
    }
    quickJumpMarkup = `  <div class="toc-quick-jump">
    <p class="toc-quick-jump-title">Chọn nhanh phân đoạn (${sorted.length} chương):</p>
    <div class="toc-jump-pills">
${groupPills.join('\n')}
    </div>
  </div>\n`;
  }

  const navListItems = sorted
    .map((chap, idx) => {
      const heading = formatChapterTitleForExport(chap, novel, sorted, continuous);
      const displayTitle = heading || (continuous ? `Phần ${idx + 1}` : (chap.title || `Chương ${idx + 1}`));
      const isGroupStart = idx % GROUP_SIZE === 0;
      const liAttrs = isGroupStart ? ` id="chap-group-${idx + 1}" class="toc-group-start"` : '';
      return `      <li${liAttrs}><a href="chapter_${idx + 1}.xhtml">${escapeXml(displayTitle)}</a></li>`;
    })
    .join('\n');

  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>Mục lục - ${escapeXml(novel.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${quickJumpMarkup}  <nav epub:type="toc" id="toc">
    <h1>Mục lục (${sorted.length} chương)</h1>
    <ol>
      <li><a href="titlepage.xhtml">Trang bìa</a></li>
${navListItems}
    </ol>
  </nav>
</body>
</html>`;
  zip.addFile('OEBPS/nav.xhtml', navXhtml);

  // 7. OEBPS/toc.ncx (EPUB 2 Table of Contents — 2-level collapsible groups for long novels > 100 chapters)
  let ncxNavPoints = '';
  let ncxDepth = 1;
  if (sorted.length > 100) {
    ncxDepth = 2;
    let playOrder = 2;
    const groupBlocks: string[] = [];
    for (let startIdx = 0; startIdx < sorted.length; startIdx += GROUP_SIZE) {
      const startNum = startIdx + 1;
      const endNum = Math.min(startIdx + GROUP_SIZE, sorted.length);
      const groupOrder = playOrder++;
      const childPoints: string[] = [];
      for (let idx = startIdx; idx < endNum; idx++) {
        const chap = sorted[idx];
        const heading = formatChapterTitleForExport(chap, novel, sorted, continuous);
        const displayTitle = heading || (continuous ? `Phần ${idx + 1}` : (chap.title || `Chương ${idx + 1}`));
        const childOrder = playOrder++;
        childPoints.push(`      <navPoint id="navpoint-chap-${idx + 1}" playOrder="${childOrder}">
        <navLabel><text>${escapeXml(displayTitle)}</text></navLabel>
        <content src="chapter_${idx + 1}.xhtml"/>
      </navPoint>`);
      }
      groupBlocks.push(`    <navPoint id="navgroup-${startNum}" playOrder="${groupOrder}">
      <navLabel><text>Chương ${startNum} – ${endNum}</text></navLabel>
      <content src="chapter_${startNum}.xhtml"/>
${childPoints.join('\n')}
    </navPoint>`);
    }
    ncxNavPoints = groupBlocks.join('\n');
  } else {
    ncxNavPoints = sorted
      .map((chap, idx) => {
        const heading = formatChapterTitleForExport(chap, novel, sorted, continuous);
        const displayTitle = heading || (continuous ? `Phần ${idx + 1}` : (chap.title || `Chương ${idx + 1}`));
        return `    <navPoint id="navpoint-${idx + 2}" playOrder="${idx + 2}">
      <navLabel><text>${escapeXml(displayTitle)}</text></navLabel>
      <content src="chapter_${idx + 1}.xhtml"/>
    </navPoint>`;
      })
      .join('\n');
  }

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${bookId}"/>
    <meta name="dtb:depth" content="${ncxDepth}"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(novel.title)}</text>
  </docTitle>
  <navMap>
    <navPoint id="navpoint-1" playOrder="1">
      <navLabel><text>Trang bìa</text></navLabel>
      <content src="titlepage.xhtml"/>
    </navPoint>
${ncxNavPoints}
  </navMap>
</ncx>`;
  zip.addFile('OEBPS/toc.ncx', tocNcx);

  // 8. OEBPS/content.opf (EPUB 3 Package Document)
  const manifestItems = [
    '    <item id="style" href="style.css" media-type="text/css"/>',
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>',
    ...(coverData && coverFilename
      ? [`    <item id="cover-image" href="${coverFilename}" media-type="${coverData.mediaType}" properties="cover-image"/>`]
      : []),
    ...sorted.map(
      (_, idx) =>
        `    <item id="chap_${idx + 1}" href="chapter_${idx + 1}.xhtml" media-type="application/xhtml+xml"/>`
    )
  ].join('\n');

  const spineItems = [
    '    <itemref idref="titlepage"/>',
    '    <itemref idref="nav"/>',
    ...sorted.map((_, idx) => `    <itemref idref="chap_${idx + 1}"/>`)
  ].join('\n');

  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(novel.title)}</dc:title>
    <dc:creator id="creator">${escapeXml(novel.author || 'Không rõ')}</dc:creator>
    <dc:language>vi</dc:language>
    <dc:identifier id="BookId">urn:uuid:${bookId}</dc:identifier>
    <meta property="dcterms:modified">${modifiedDate}</meta>
    <dc:publisher>Novel Scraper</dc:publisher>
    ${novel.description ? `<dc:description>${escapeXml(novel.description)}</dc:description>` : ''}
    <dc:source>${escapeXml(novel.sourceUrl)}</dc:source>
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
  zip.addFile('OEBPS/content.opf', contentOpf);

  // Return standard EPUB Blob
  return zip.buildBlob('application/epub+zip');
}

/**
 * Exports novel as .epub file and triggers browser download.
 */
export async function exportToEpub(
  novel: Novel,
  chapters: Chapter[],
  options?: { omitChapterTitles?: boolean }
): Promise<Blob> {
  const blob = await buildEpubBlob(novel, chapters, options);
  const filename = `${sanitizeFilename(novel.title)}.epub`;
  triggerBlobDownload(blob, filename);
  return blob;
}

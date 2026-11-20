import { ZipReader } from './zipReader';
import type { ImportedEbook } from './types';

export async function parseDocxFile(file: File): Promise<ImportedEbook> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = new ZipReader(arrayBuffer);
  await zip.parse();

  const docEntry = zip.getEntry('word/document.xml');
  if (!docEntry) {
    throw new Error('Tệp DOCX không hợp lệ (không tìm thấy word/document.xml).');
  }

  const xmlText = await docEntry.readText();
  const domParser = new DOMParser();
  const xmlDoc = domParser.parseFromString(xmlText, 'text/xml');

  const title = file.name.replace(/\.docx$/i, '').trim();
  const paragraphs: Array<{ text: string; isHeading: boolean }> = [];

  const pNodes = xmlDoc.querySelectorAll('w\\:p, p');
  pNodes.forEach(pNode => {
    // Check if heading style
    const pStyle = pNode.querySelector('w\\:pStyle, pStyle')?.getAttribute('w:val') || '';
    const isHeading = /heading\s*[1-3]|tiêu\s*đề/i.test(pStyle);

    // Extract text runs
    const tNodes = pNode.querySelectorAll('w\\:t, t');
    let text = '';
    tNodes.forEach(t => {
      text += t.textContent || '';
    });
    text = text.trim();

    if (text) {
      paragraphs.push({
        text,
        isHeading: isHeading || /^(?:Chương|Hồi|Chapter|Phần)\s*\d+/i.test(text)
      });
    }
  });

  const chapters: Array<{ title: string; content: string; wordCount?: number }> = [];
  let currentTitle = 'Chương 1';
  let currentParas: string[] = [];

  for (const item of paragraphs) {
    if (item.isHeading && currentParas.length > 0) {
      const content = currentParas.join('\n\n');
      chapters.push({
        title: currentTitle,
        content,
        wordCount: content.split(/\s+/).filter(Boolean).length
      });
      currentTitle = item.text;
      currentParas = [];
    } else if (item.isHeading && currentParas.length === 0) {
      currentTitle = item.text;
    } else {
      currentParas.push(item.text);
    }
  }

  if (currentParas.length > 0 || chapters.length === 0) {
    const content = currentParas.join('\n\n') || 'Nội dung tệp Word trống.';
    chapters.push({
      title: currentTitle,
      content,
      wordCount: content.split(/\s+/).filter(Boolean).length
    });
  }

  return {
    title,
    author: 'Đang cập nhật',
    format: 'docx',
    fileName: file.name,
    fileSize: file.size,
    totalChapters: chapters.length,
    coverUrl: `https://picsum.photos/seed/${encodeURIComponent(title)}/240/340`,
    chapters
  };
}

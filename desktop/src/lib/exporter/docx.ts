import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak,
  Packer,
  AlignmentType
} from 'docx';
import type { Novel, Chapter } from '../types';
import { naturalSortChapters, deduplicateChapters, formatChapterTitleForExport, isContinuousStory, getCleanChapterContent } from './sorter';
import { triggerBlobDownload, sanitizeFilename } from './txt';

/**
 * Universal Word font configuration:
 * Uses Times New Roman for Latin / Vietnamese characters,
 * and Microsoft YaHei for East Asian punctuation (lenticular brackets 【 】, quotation 《 》, dashes —, etc.)
 * This prevents Microsoft Word on Windows from corrupting 【 into Ụ and 】 into ụ.
 */
export const DOCX_BODY_FONT = {
  ascii: 'Times New Roman',
  hAnsi: 'Times New Roman',
  cs: 'Times New Roman',
  eastAsia: 'Microsoft YaHei'
};

/**
 * Builds a professional Microsoft Word (.docx) document from novel and chapters.
 */
export async function buildDocxBlob(
  novel: Novel,
  chapters: Chapter[],
  options?: { omitChapterTitles?: boolean }
): Promise<Blob> {
  const sorted = deduplicateChapters(naturalSortChapters(chapters));
  const docChildren: Paragraph[] = [];

  // Title Page
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 300 },
      children: [
        new TextRun({
          text: novel.title,
          bold: true,
          size: 52, // 26pt
          font: DOCX_BODY_FONT
        })
      ]
    })
  );

  if (novel.author) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `Tác giả: ${novel.author}`,
            italics: true,
            size: 28, // 14pt
            font: DOCX_BODY_FONT
          })
        ]
      })
    );
  }

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Nguồn: ${novel.sourceUrl}`,
          size: 22,
          color: '666666',
          font: DOCX_BODY_FONT
        })
      ]
    })
  );

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `Tổng số: ${sorted.length} chương | Xuất bởi Novel Scraper`,
          size: 20,
          color: '888888',
          font: DOCX_BODY_FONT
        })
      ]
    })
  );

  // Page break after title page
  docChildren.push(
    new Paragraph({
      children: [new PageBreak()]
    })
  );

  const continuous = isContinuousStory(novel, sorted);

  // Chapters
  for (let i = 0; i < sorted.length; i++) {
    const chap = sorted[i];
    const heading = options?.omitChapterTitles ? null : formatChapterTitleForExport(chap, novel, sorted, continuous, options);

    // Chapter Title (Heading 2) - only if genuine distinct heading exists
    if (heading) {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 240 },
          children: [
            new TextRun({
              text: heading,
              bold: true,
              size: 32, // 16pt
              font: DOCX_BODY_FONT,
              color: '0F172A'
            })
          ]
        })
      );
    }

    // Chapter Content paragraphs
    const cleanText = getCleanChapterContent(chap, novel.title, options);
    const paragraphs = cleanText.split('\n\n').filter((p) => p.trim().length > 0);

    if (paragraphs.length > 0) {
      for (const p of paragraphs) {
        docChildren.push(
          new Paragraph({
            spacing: { line: 280, after: 140 },
            children: [
              new TextRun({
                text: p.trim(),
                size: 26, // 13pt
                font: DOCX_BODY_FONT
              })
            ]
          })
        );
      }
    } else {
      docChildren.push(
        new Paragraph({
          spacing: { line: 280, after: 140 },
          children: [
            new TextRun({
              text: chap.status === 'locked' ? '[Chương VIP / Nội dung đã bị khóa]' : '[Nội dung trống]',
              italics: true,
              color: '999999',
              size: 24,
              font: DOCX_BODY_FONT
            })
          ]
        })
      );
    }

    // Page break between chapters (except last chapter)
    if (i < sorted.length - 1) {
      docChildren.push(
        new Paragraph({
          children: [new PageBreak()]
        })
      );
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: DOCX_BODY_FONT
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch = 1440 dxa
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: docChildren
      }
    ]
  });

  return await Packer.toBlob(doc);
}

/**
 * Exports novel to DOCX file and triggers download.
 */
export async function exportToDocx(
  novel: Novel,
  chapters: Chapter[],
  options?: { omitChapterTitles?: boolean }
): Promise<void> {
  const blob = await buildDocxBlob(novel, chapters, options);
  const filename = `${sanitizeFilename(novel.title)}.docx`;
  triggerBlobDownload(blob, filename);
}

import type { Novel, Chapter, ExportFormat } from '../types';
import { exportToTxt, generateTxtContent, triggerBlobDownload, sanitizeFilename } from './txt';
import { exportToDocx } from './docx';
import { exportToPdf } from './pdf';
import { exportToEpub } from './epub';
import { exportToJson } from './json';
import { ZipWriter } from './zip';
import { naturalSortChapters, deduplicateChapters } from './sorter';

export { exportToTxt, generateTxtContent, triggerBlobDownload, sanitizeFilename } from './txt';
export { exportToDocx, buildDocxBlob } from './docx';
export { exportToPdf, generatePrintableHtml } from './pdf';
export { exportToEpub, buildEpubBlob, escapeXml } from './epub';
export { exportToJson, buildJsonBlob, generateJsonData, type NovelJsonExport } from './json';
export { ZipWriter, computeCrc32 } from './zip';
export { naturalSortChapters, deduplicateChapters, detectMissingChapters } from './sorter';

export async function exportNovel(
  novel: Novel,
  chapters: Chapter[],
  format: ExportFormat,
  splitVolumeSize: number = 0,
  options?: { omitChapterTitles?: boolean }
): Promise<void> {
  const sorted = deduplicateChapters(naturalSortChapters(chapters));

  // If user requested splitting chapters into volumes and total chapters exceed the split size:
  if (splitVolumeSize > 0 && sorted.length > splitVolumeSize && format === 'txt') {
    const zip = new ZipWriter();
    const totalVolumes = Math.ceil(sorted.length / splitVolumeSize);

    for (let v = 0; v < totalVolumes; v++) {
      const startIdx = v * splitVolumeSize;
      const endIdx = Math.min(startIdx + splitVolumeSize, sorted.length);
      const volumeChapters = sorted.slice(startIdx, endIdx);
      const startNum = volumeChapters[0].chapterNumber || startIdx + 1;
      const endNum = volumeChapters[volumeChapters.length - 1].chapterNumber || endIdx;

      const volumeNovel: Novel = {
        ...novel,
        title: `${novel.title} - Tập ${v + 1} (Chương ${startNum}-${endNum})`
      };

      const txtContent = generateTxtContent(volumeNovel, volumeChapters, options);
      const cleanVolTitle = volumeNovel.title.replace(/[\\/:*?"<>|]/g, '_');
      zip.addFile(`${cleanVolTitle}.txt`, txtContent);
    }

    const zipBlob = zip.buildBlob('application/zip');
    const cleanBookTitle = sanitizeFilename(novel.title);
    triggerBlobDownload(zipBlob, `${cleanBookTitle}_TronBo_${totalVolumes}Tap.zip`);
    return;
  }

  switch (format) {
    case 'docx':
      await (options ? exportToDocx(novel, chapters, options) : exportToDocx(novel, chapters));
      break;
    case 'pdf':
      options ? exportToPdf(novel, chapters, options) : exportToPdf(novel, chapters);
      break;
    case 'epub':
      await (options ? exportToEpub(novel, chapters, options) : exportToEpub(novel, chapters));
      break;
    case 'json':
      await exportToJson(novel, chapters);
      break;
    case 'txt':
    default:
      options ? exportToTxt(novel, chapters, options) : exportToTxt(novel, chapters);
      break;
  }
}


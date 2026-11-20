import { describe, it, expect } from 'vitest';
import { removeWatermarksAndDividers, formatParagraphs, sanitizeHtmlContent } from '../lib/sanitizer';
import { generateTxtContent } from '../lib/exporter/txt';
import { generatePrintableHtml } from '../lib/exporter/pdf';
import type { Novel, Chapter } from '../lib/types';

describe('Watermark & Divider Removal Engine', () => {
  const sampleRawText = `
Vì thế, tôi dứt khoát ở lại trường đi làm thêm.

---------------------------------
Cậu Ấm Giả Nghèo Và Cô Vợ Keo Kiệt
---------------------------------

Vốn dĩ tôi không muốn để bạn trai nhìn thấy dáng vẻ chật vật của mình.

---------------------------------
Cậu Ấm Giả Nghèo Và Cô Vợ Keo Kiệt
---------------------------------

Nhưng bây giờ, anh ấy không còn là bạn trai tôi nữa.
`;

  it('removes divider bars and framed novel title watermarks from raw chapter text', () => {
    const cleaned = removeWatermarksAndDividers(
      sampleRawText,
      'Cậu Ấm Giả Nghèo Và Cô Vợ Keo Kiệt',
      'Chương 1'
    );

    expect(cleaned).not.toContain('---------------------------------');
    expect(cleaned).not.toContain('Cậu Ấm Giả Nghèo Và Cô Vợ Keo Kiệt');
    expect(cleaned).toContain('Vì thế, tôi dứt khoát ở lại trường đi làm thêm.');
    expect(cleaned).toContain('Vốn dĩ tôi không muốn để bạn trai nhìn thấy dáng vẻ chật vật của mình.');
    expect(cleaned).toContain('Nhưng bây giờ, anh ấy không còn là bạn trai tôi nữa.');
  });

  it('removes repeated title watermarks inserted between paragraphs like in comong.info', () => {
    const comongWatermarkText = `
NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN

NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN LY HÔN TỪ CHỒNG. NHƯNG KHI NGOẢNH LẠI, HẮN VẪN ĐANG NGỦ SAY...

NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN

02

NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN

Hắn chỉ cúi đầu uống rượu, khóe môi thậm chí còn thấp thoáng ý cười.
`;

    const cleaned = removeWatermarksAndDividers(
      comongWatermarkText,
      'NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN',
      'Chương 1'
    );

    // Standalone "NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN" watermarks are stripped
    // But the actual narrative sentence containing it is kept intact!
    expect(cleaned).toContain('NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN LY HÔN TỪ CHỒNG');
    expect(cleaned).toContain('Hắn chỉ cúi đầu uống rượu');
    expect(cleaned).not.toContain('\n\n02\n\n');

    // Standalone lines equal to the novel title are removed
    const lines = cleaned.split('\n\n');
    for (const l of lines) {
      expect(l.trim()).not.toBe('NỬA ĐÊM, TÔI NHẬN ĐƯỢC TIN NHẮN');
      expect(l.trim()).not.toBe('02');
    }
  });

  it('guarantees TXT export output is completely clean of internal watermarks', () => {
    const novel: Novel = {
      id: 1,
      title: 'Cậu Ấm Giả Nghèo Và Cô Vợ Keo Kiệt',
      sourceUrl: 'https://comong.info/cau-am-gia-ngheo-va-co-vo-keo-kiet/chuong-1',
      totalChapters: 1,
      downloadedChapters: 1,
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const chapters: Chapter[] = [
      {
        id: 1,
        novelId: 1,
        chapterNumber: 1,
        title: 'Chương 1',
        url: 'https://comong.info/cau-am-gia-ngheo-va-co-vo-keo-kiet/chuong-1',
        content: sampleRawText,
        wordCount: 100,
        status: 'completed'
      }
    ];

    const txt = generateTxtContent(novel, chapters);
    // Novel header has uppercase title
    expect(txt).toContain('TÊN TRUYỆN: CẬU ẤM GIẢ NGHÈO VÀ CÔ VỢ KEO KIỆT');
    // But body content has no divider bars and no framed watermarks
    expect(txt).not.toContain('---------------------------------');
    expect(txt).toContain('Vì thế, tôi dứt khoát ở lại trường đi làm thêm.');
    expect(txt).toContain('Nhưng bây giờ, anh ấy không còn là bạn trai tôi nữa.');
  });
});

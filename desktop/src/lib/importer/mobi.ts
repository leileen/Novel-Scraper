import type { ImportedEbook } from './types';

export async function parseMobiFile(file: File): Promise<ImportedEbook> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  if (buffer.length < 78) {
    throw new Error('Tệp MOBI/AZW không hợp lệ (kích thước quá nhỏ).');
  }

  // 1. Palm Database Header
  const numRecords = view.getUint16(76, false); // big-endian
  const recordOffsets: number[] = [];

  for (let i = 0; i < numRecords; i++) {
    const recOffset = view.getUint32(78 + i * 8, false);
    recordOffsets.push(recOffset);
  }

  if (recordOffsets.length === 0) {
    throw new Error('Không tìm thấy bản ghi nào trong tệp MOBI.');
  }

  // 2. Parse Record 0 (PalmDOC & MOBI Headers)
  const rec0Offset = recordOffsets[0];
  const compression = view.getUint16(rec0Offset + 0, false);
  const textRecordCount = view.getUint16(rec0Offset + 8, false);

  let title = file.name.replace(/\.(mobi|azw|azw3|prc)$/i, '').trim();
  let author = 'Đang cập nhật';
  const genres: string[] = [];

  // Check for "MOBI" identifier at offset 16 from rec0Offset
  const mobiMagic = String.fromCharCode(
    buffer[rec0Offset + 16],
    buffer[rec0Offset + 17],
    buffer[rec0Offset + 18],
    buffer[rec0Offset + 19]
  );

  if (mobiMagic === 'MOBI') {
    const titleOffsetRel = view.getUint32(rec0Offset + 84, false);
    const titleLength = view.getUint32(rec0Offset + 88, false);
    if (titleLength > 0 && rec0Offset + titleOffsetRel + titleLength <= buffer.length) {
      try {
        const titleBytes = buffer.subarray(
          rec0Offset + titleOffsetRel,
          rec0Offset + titleOffsetRel + titleLength
        );
        const dec = new TextDecoder('utf-8');
        const extractedTitle = dec.decode(titleBytes).trim();
        if (extractedTitle) title = extractedTitle;
      } catch {}
    }

    // Inspect EXTH Header for Author and Genres
    const headerLength = view.getUint32(rec0Offset + 20, false);
    const exthOffset = rec0Offset + 16 + headerLength;

    if (exthOffset + 12 < buffer.length) {
      const exthMagic = String.fromCharCode(
        buffer[exthOffset],
        buffer[exthOffset + 1],
        buffer[exthOffset + 2],
        buffer[exthOffset + 3]
      );

      if (exthMagic === 'EXTH') {
        const recordCount = view.getUint32(exthOffset + 8, false);
        let currOffset = exthOffset + 12;

        for (let i = 0; i < recordCount; i++) {
          if (currOffset + 8 > buffer.length) break;
          const recType = view.getUint32(currOffset, false);
          const recLen = view.getUint32(currOffset + 4, false);
          if (recLen < 8 || currOffset + recLen > buffer.length) break;

          const dataBytes = buffer.subarray(currOffset + 8, currOffset + recLen);
          const dec = new TextDecoder('utf-8');

          if (recType === 100) {
            // Author
            const a = dec.decode(dataBytes).trim();
            if (a) author = a;
          } else if (recType === 105) {
            // Subject / Genre
            const g = dec.decode(dataBytes).trim();
            if (g && !genres.includes(g)) genres.push(g);
          }

          currOffset += recLen;
        }
      }
    }
  }

  // 3. Decompress Text Records (records 1 to textRecordCount)
  const decompressedChunks: Uint8Array[] = [];
  const countToRead = Math.min(textRecordCount, recordOffsets.length - 1);

  for (let i = 1; i <= countToRead; i++) {
    const start = recordOffsets[i];
    const end = i < recordOffsets.length - 1 ? recordOffsets[i + 1] : buffer.length;
    const chunk = buffer.subarray(start, end);

    if (compression === 1) {
      // Uncompressed
      decompressedChunks.push(chunk);
    } else if (compression === 2) {
      // PalmDOC compression
      decompressedChunks.push(decompressPalmDoc(chunk));
    } else {
      // Huffman or unsupported compression - take raw bytes
      decompressedChunks.push(chunk);
    }
  }

  // Assemble full text
  let fullText = '';
  const textDecoder = new TextDecoder('utf-8');
  for (const chunk of decompressedChunks) {
    try {
      fullText += textDecoder.decode(chunk);
    } catch {
      // fallback
      fullText += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
  }

  // If text is HTML, strip HTML tags cleanly
  let cleanText = fullText;
  if (/<[a-z][\s\S]*>/i.test(fullText)) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(fullText, 'text/html');
      doc.querySelectorAll('script, style').forEach(el => el.remove());
      cleanText = (doc.body?.textContent || fullText)
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
    } catch {}
  }

  // Chapter Detection
  const chapterPattern = /(?:^|\r?\n\s*)((?:Chương|Hồi|Tiết|Quyển|Chapter|Chap|Ch\.)\s*(\d+|[IVXLCDM]+)[\s:.-]*([^\r\n]*))/gi;
  const matches: Array<{ title: string; index: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = chapterPattern.exec(cleanText)) !== null) {
    matches.push({
      title: m[1].trim(),
      index: m.index
    });
  }

  const chapters: Array<{ title: string; content: string; wordCount?: number }> = [];

  if (matches.length >= 2) {
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const startPos = cur.index;
      const endPos = i + 1 < matches.length ? matches[i + 1].index : cleanText.length;
      const rawContent = cleanText.slice(startPos, endPos).trim();
      const lines = rawContent.split(/\r?\n/);
      const content = lines.length > 1 ? lines.slice(1).join('\n').trim() : rawContent;
      chapters.push({
        title: cur.title,
        content: content || 'Nội dung chương trống.',
        wordCount: content.split(/\s+/).filter(Boolean).length
      });
    }
  } else {
    // Split into ~2000 word segments
    const paras = cleanText.split(/\r?\n\s*\r?\n/);
    let curBatch: string[] = [];
    let curWords = 0;
    let chIdx = 1;

    for (const p of paras) {
      const pt = p.trim();
      if (!pt) continue;
      const w = pt.split(/\s+/).length;
      curBatch.push(pt);
      curWords += w;
      if (curWords >= 2000) {
        chapters.push({
          title: `Chương ${chIdx}`,
          content: curBatch.join('\n\n'),
          wordCount: curWords
        });
        curBatch = [];
        curWords = 0;
        chIdx++;
      }
    }
    if (curBatch.length > 0 || chapters.length === 0) {
      chapters.push({
        title: chapters.length === 0 ? 'Chương 1' : `Chương ${chIdx}`,
        content: curBatch.join('\n\n') || 'Nội dung trống.',
        wordCount: curWords
      });
    }
  }

  return {
    title,
    author,
    genres: genres.length > 0 ? genres : undefined,
    format: 'mobi',
    fileName: file.name,
    fileSize: file.size,
    totalChapters: chapters.length,
    coverUrl: `https://picsum.photos/seed/${encodeURIComponent(title)}/240/340`,
    chapters
  };
}

/**
 * PalmDOC LZ77 decompressor.
 */
function decompressPalmDoc(data: Uint8Array): Uint8Array {
  const output: number[] = [];
  let i = 0;
  const len = data.length;

  while (i < len) {
    const byte = data[i++];
    if (byte >= 1 && byte <= 8) {
      // Copy next `byte` literal bytes
      for (let k = 0; k < byte && i < len; k++) {
        output.push(data[i++]);
      }
    } else if (byte <= 0x7f) {
      // Literal single byte
      output.push(byte);
    } else if (byte >= 0xc0) {
      // Space + char
      output.push(0x20); // space
      output.push(byte ^ 0x80);
    } else {
      // LZ77 distance & length pair (2 bytes)
      if (i >= len) break;
      const next = data[i++];
      const distance = (((byte & 0x07) << 8) | next) >> 3;
      const matchLen = (next & 0x07) + 3;
      const startPos = output.length - distance;
      for (let k = 0; k < matchLen; k++) {
        if (startPos + k >= 0 && startPos + k < output.length) {
          output.push(output[startPos + k]);
        }
      }
    }
  }

  return new Uint8Array(output);
}

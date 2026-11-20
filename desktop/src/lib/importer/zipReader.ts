/**
 * Pure-TypeScript PKZip 2.0 Archive Reader with Native Web DecompressionStream.
 * Zero external dependencies. Reads EPUB, DOCX, FB2.ZIP and standard ZIP backups.
 */

export interface ZipFileEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  method: number; // 0 = Stored, 8 = Deflated
  localHeaderOffset: number;
  read(): Promise<Uint8Array>;
  readText(encoding?: string): Promise<string>;
}

export class ZipReader {
  private buffer: Uint8Array;
  private view: DataView;
  public entries: Map<string, ZipFileEntry> = new Map();

  constructor(buffer: ArrayBuffer | Uint8Array) {
    this.buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
  }

  public async parse(): Promise<this> {
    const eocdOffset = this.findEOCD();
    if (eocdOffset === -1) {
      throw new Error('Định dạng tệp ZIP không hợp lệ hoặc bị lỗi (không tìm thấy EOCD).');
    }

    const cdEntriesCount = this.view.getUint16(eocdOffset + 10, true);
    const cdOffset = this.view.getUint32(eocdOffset + 16, true);

    let offset = cdOffset;
    const textDecoder = new TextDecoder('utf-8');

    for (let i = 0; i < cdEntriesCount; i++) {
      if (offset + 46 > this.buffer.length) break;
      const signature = this.view.getUint32(offset, true);
      if (signature !== 0x02014b50) break; // Not central directory header

      const method = this.view.getUint16(offset + 10, true);
      const compressedSize = this.view.getUint32(offset + 20, true);
      const uncompressedSize = this.view.getUint32(offset + 24, true);
      const fileNameLen = this.view.getUint16(offset + 28, true);
      const extraLen = this.view.getUint16(offset + 30, true);
      const commentLen = this.view.getUint16(offset + 32, true);
      const localHeaderOffset = this.view.getUint32(offset + 42, true);

      const fileNameBytes = this.buffer.subarray(offset + 46, offset + 46 + fileNameLen);
      const fileName = textDecoder.decode(fileNameBytes);

      const entry: ZipFileEntry = {
        name: fileName,
        compressedSize,
        uncompressedSize,
        method,
        localHeaderOffset,
        read: () => this.extractEntry(localHeaderOffset, method, compressedSize, uncompressedSize),
        readText: async (enc = 'utf-8') => {
          const raw = await this.extractEntry(localHeaderOffset, method, compressedSize, uncompressedSize);
          const dec = new TextDecoder(enc);
          return dec.decode(raw);
        }
      };

      this.entries.set(fileName, entry);
      offset += 46 + fileNameLen + extraLen + commentLen;
    }

    return this;
  }

  private findEOCD(): number {
    const minOffset = Math.max(0, this.buffer.length - 65557);
    for (let i = this.buffer.length - 22; i >= minOffset; i--) {
      if (this.view.getUint32(i, true) === 0x06054b50) {
        return i;
      }
    }
    return -1;
  }

  private async extractEntry(
    localHeaderOffset: number,
    method: number,
    compressedSize: number,
    uncompressedSize: number
  ): Promise<Uint8Array> {
    if (localHeaderOffset + 30 > this.buffer.length) {
      throw new Error('Local file header vượt quá kích thước tệp.');
    }

    const localSig = this.view.getUint32(localHeaderOffset, true);
    if (localSig !== 0x04034b50) {
      throw new Error('Mã ký tự Local file header không hợp lệ.');
    }

    const nameLen = this.view.getUint16(localHeaderOffset + 26, true);
    const extraLen = this.view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + nameLen + extraLen;

    const compressedData = this.buffer.subarray(dataOffset, dataOffset + compressedSize);

    if (method === 0) {
      // Stored (no compression)
      return compressedData;
    } else if (method === 8) {
      // Deflated compression
      if (typeof DecompressionStream !== 'undefined') {
        try {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          // Write and close stream
          void writer.write(compressedData as unknown as BufferSource);
          void writer.close();
          const resp = new Response(ds.readable);
          const decompressedBuffer = await resp.arrayBuffer();
          return new Uint8Array(decompressedBuffer);
        } catch (e) {
          console.warn('DecompressionStream failed, fallback to raw', e);
        }
      }
      return compressedData;
    } else {
      throw new Error(`Thuật toán nén không được hỗ trợ (method: ${method}).`);
    }
  }

  public getEntry(path: string): ZipFileEntry | undefined {
    // Normal match
    if (this.entries.has(path)) return this.entries.get(path);
    // Case-insensitive / backslash normalization match
    const norm = path.replace(/\\/g, '/').toLowerCase();
    for (const [k, v] of this.entries.entries()) {
      if (k.replace(/\\/g, '/').toLowerCase() === norm) {
        return v;
      }
    }
    return undefined;
  }
}

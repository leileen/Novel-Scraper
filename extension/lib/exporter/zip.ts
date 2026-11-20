/**
 * Pure-TypeScript PKZip 2.0 Archive Writer.
 * Zero external dependencies. Operates entirely on Uint8Array and DataView.
 * Produces standards-compliant ZIP files compatible with EPUB OCF specifications.
 */

// Precomputed CRC-32 Lookup Table (IEEE 802.3 polynomial: 0xEDB88320)
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

export function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  size: number;
  method: number; // 0 = Stored
}

export class ZipWriter {
  private entries: ZipEntry[] = [];
  private textEncoder = new TextEncoder();

  /**
   * Adds a file to the archive.
   * If added first as 'mimetype' with uncompressed content, satisfies EPUB OCF specification.
   */
  public addFile(name: string, content: string | Uint8Array): this {
    const data = typeof content === 'string' ? this.textEncoder.encode(content) : content;
    const nameBytes = this.textEncoder.encode(name);
    this.entries.push({
      name,
      nameBytes,
      data,
      crc: computeCrc32(data),
      size: data.length,
      method: 0 // Stored (Uncompressed)
    });
    return this;
  }

  /**
   * Assembles the complete ZIP archive in a single contiguous Uint8Array.
   */
  public build(): Uint8Array {
    // 1. Calculate total buffer size required
    let localHeadersTotalSize = 0;
    let cdTotalSize = 0;

    for (const entry of this.entries) {
      // Local Header: 30 bytes + filename + data
      localHeadersTotalSize += 30 + entry.nameBytes.length + entry.size;
      // Central Directory Header: 46 bytes + filename
      cdTotalSize += 46 + entry.nameBytes.length;
    }

    const eocdSize = 22;
    const totalSize = localHeadersTotalSize + cdTotalSize + eocdSize;

    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // 2. Write Local File Headers and Data
    let localOffset = 0;
    const entryOffsets: number[] = [];

    for (const entry of this.entries) {
      entryOffsets.push(localOffset);

      // Local Header Signature: 0x04034b50 ("PK\x03\x04")
      view.setUint32(localOffset + 0, 0x04034b50, true);
      view.setUint16(localOffset + 4, 20, true); // Version needed to extract: 2.0
      view.setUint16(localOffset + 6, 0x0800, true); // Bit 11 set: UTF-8 filename encoding
      view.setUint16(localOffset + 8, entry.method, true); // Compression method (0 = Stored)
      view.setUint16(localOffset + 10, 0, true); // Last mod file time
      view.setUint16(localOffset + 12, 0, true); // Last mod file date
      view.setUint32(localOffset + 14, entry.crc, true); // CRC-32
      view.setUint32(localOffset + 18, entry.size, true); // Compressed size
      view.setUint32(localOffset + 22, entry.size, true); // Uncompressed size
      view.setUint16(localOffset + 26, entry.nameBytes.length, true); // File name length
      view.setUint16(localOffset + 28, 0, true); // Extra field length

      // Copy filename and file data
      buffer.set(entry.nameBytes, localOffset + 30);
      buffer.set(entry.data, localOffset + 30 + entry.nameBytes.length);

      localOffset += 30 + entry.nameBytes.length + entry.size;
    }

    // 3. Write Central Directory Records
    const cdOffset = localOffset;
    let cdPtr = cdOffset;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const localHeaderOffset = entryOffsets[i];

      // Central Directory Header Signature: 0x02014b50 ("PK\x01\x02")
      view.setUint32(cdPtr + 0, 0x02014b50, true);
      view.setUint16(cdPtr + 4, 20, true); // Version made by: 2.0 (DOS/FAT)
      view.setUint16(cdPtr + 6, 20, true); // Version needed to extract: 2.0
      view.setUint16(cdPtr + 8, 0x0800, true); // Bit 11 set: UTF-8 filename
      view.setUint16(cdPtr + 10, entry.method, true); // Compression method: 0
      view.setUint16(cdPtr + 12, 0, true); // File time
      view.setUint16(cdPtr + 14, 0, true); // File date
      view.setUint32(cdPtr + 16, entry.crc, true); // CRC-32
      view.setUint32(cdPtr + 20, entry.size, true); // Compressed size
      view.setUint32(cdPtr + 24, entry.size, true); // Uncompressed size
      view.setUint16(cdPtr + 28, entry.nameBytes.length, true); // File name length
      view.setUint16(cdPtr + 30, 0, true); // Extra field length
      view.setUint16(cdPtr + 32, 0, true); // Comment length
      view.setUint16(cdPtr + 34, 0, true); // Disk number start
      view.setUint16(cdPtr + 36, 0, true); // Internal file attributes
      view.setUint32(cdPtr + 38, 0, true); // External file attributes
      view.setUint32(cdPtr + 42, localHeaderOffset, true); // Relative offset of local header

      buffer.set(entry.nameBytes, cdPtr + 46);
      cdPtr += 46 + entry.nameBytes.length;
    }

    // 4. Write End of Central Directory (EOCD) Record
    const eocdPtr = cdPtr;
    // EOCD Signature: 0x06054b50 ("PK\x05\x06")
    view.setUint32(eocdPtr + 0, 0x06054b50, true);
    view.setUint16(eocdPtr + 4, 0, true); // Number of this disk
    view.setUint16(eocdPtr + 6, 0, true); // Disk where central directory starts
    view.setUint16(eocdPtr + 8, this.entries.length, true); // Total entries on this disk
    view.setUint16(eocdPtr + 10, this.entries.length, true); // Total central directory entries
    view.setUint32(eocdPtr + 12, cdTotalSize, true); // Size of central directory
    view.setUint32(eocdPtr + 16, cdOffset, true); // Offset of start of central directory
    view.setUint16(eocdPtr + 20, 0, true); // Comment length

    return buffer;
  }

  /**
   * Constructs a Blob from the generated ZIP binary.
   */
  public buildBlob(mimeType = 'application/zip'): Blob {
    return new Blob([this.build().buffer as ArrayBuffer], { type: mimeType });
  }

  /**
   * Alias for buildBlob.
   */
  public toBlob(mimeType = 'application/zip'): Blob {
    return this.buildBlob(mimeType);
  }
}

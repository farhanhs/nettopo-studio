import { zipSync } from 'fflate';
import { crc32, inflateRawSync } from 'node:zlib';
import { safePath, fail, canonicalFiles } from '../../release/beta/runtime/lib/integrity.mjs';

export const SMALL_JSON_MAX_BYTES = 4096;

function validateMembers(entries) {
  const seen = new Set();
  for (const { path, data } of entries) {
    safePath(path);
    const key = path.toLowerCase();
    if (seen.has(key) || !(data instanceof Uint8Array)) fail('BTA_ZIP_INVALID');
    seen.add(key);
  }
  for (const path of seen) {
    const parts = path.split('/');
    while (parts.pop() && parts.length) if (seen.has(parts.join('/'))) fail('BTA_ZIP_INVALID');
  }
}

export function createBetaZip(entries) {
  validateMembers(entries);
  // Avoid literal-only dynamic Huffman blocks rejected by Windows Explorer.
  return zipSync(Object.fromEntries(canonicalFiles(entries).map(({ path, data }) => [
    path, [data, { level: /\.json$/i.test(path) && data.length <= SMALL_JSON_MAX_BYTES ? 0 : 6 }],
  ])), { level: 6, mtime: new Date(2020, 0, 1) });
}

// Read the producer's narrow ZIP32 format before any filesystem extraction.
// fflate's object-based unzip alone cannot detect duplicate names or verify CRC.
export function inspectBetaZip(bytes) {
  try {
    const b = Buffer.from(bytes);
    const end = b.length - 22;
    if (b.length > 512 * 1024 * 1024 || end < 0 || b.readUInt32LE(end) !== 0x06054b50 ||
        b.readUInt16LE(end + 4) || b.readUInt16LE(end + 6) || b.readUInt16LE(end + 20)) fail();
    const count = b.readUInt16LE(end + 10), directorySize = b.readUInt32LE(end + 12);
    const directory = b.readUInt32LE(end + 16);
    if (!count || count > 4096 || b.readUInt16LE(end + 8) !== count || directory + directorySize !== end) fail();
    const entries = [];
    let offset = directory, localEnd = 0, total = 0;
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || b.readUInt32LE(offset) !== 0x02014b50) fail();
      const flags = b.readUInt16LE(offset + 8), method = b.readUInt16LE(offset + 10);
      const crc = b.readUInt32LE(offset + 16), compressedSize = b.readUInt32LE(offset + 20);
      const size = b.readUInt32LE(offset + 24), nameSize = b.readUInt16LE(offset + 28);
      const extraSize = b.readUInt16LE(offset + 30), commentSize = b.readUInt16LE(offset + 32);
      const attrs = b.readUInt32LE(offset + 38), local = b.readUInt32LE(offset + 42);
      const mode = (attrs >>> 16) & 0xf000;
      total += size;
      if ((flags & ~0x0806) || ![0, 8].includes(method) || b.readUInt16LE(offset + 34) ||
          (mode && mode !== 0x8000) || (attrs & 0x10) || local !== localEnd ||
          size > 128 * 1024 * 1024 || total > 512 * 1024 * 1024 ||
          offset + 46 + nameSize + extraSize + commentSize > end) fail();
      const name = b.subarray(offset + 46, offset + 46 + nameSize);
      const path = name.toString('utf8');
      if (!Buffer.from(path).equals(name) || (!(flags & 0x800) && name.some(byte => byte > 127))) fail();
      safePath(path);
      if (local + 30 > directory || b.readUInt32LE(local) !== 0x04034b50 ||
          b.readUInt16LE(local + 6) !== flags || b.readUInt16LE(local + 8) !== method ||
          b.readUInt32LE(local + 14) !== crc || b.readUInt32LE(local + 18) !== compressedSize ||
          b.readUInt32LE(local + 22) !== size || b.readUInt16LE(local + 26) !== nameSize) fail();
      const start = local + 30 + nameSize + b.readUInt16LE(local + 28);
      localEnd = start + compressedSize;
      if (localEnd > directory || !b.subarray(local + 30, local + 30 + nameSize).equals(name)) fail();
      const compressed = b.subarray(start, localEnd);
      const data = method === 0 ? Buffer.from(compressed)
        : inflateRawSync(compressed, { maxOutputLength: Math.max(1, size) });
      if (data.length !== size || crc32(data) !== crc) fail();
      entries.push({ path, data, method, crc, compressedSize });
      offset += 46 + nameSize + extraSize + commentSize;
    }
    if (offset !== end || localEnd !== directory) fail();
    validateMembers(entries);
    return canonicalFiles(entries);
  } catch {
    fail('BTA_ZIP_INVALID');
  }
}

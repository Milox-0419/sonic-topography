export interface AudioMetadata {
  displayName: string;
  lyrics: string | null;
  cover: string | null;
}

function getFallbackDisplayName(fallbackName: string): string {
  const decodedName = decodeURIComponent(fallbackName);
  return decodedName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Demo Track';
}

function pictureToDataUrl(picture: { data?: Uint8Array; format?: string } | undefined): string | null {
  if (!picture?.data?.length) return null;

  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < picture.data.length; index += chunkSize) {
    binary += String.fromCharCode(...picture.data.subarray(index, index + chunkSize));
  }

  return `data:${picture.format || 'image/jpeg'};base64,${btoa(binary)}`;
}

export async function extractAudioMetadata(blob: Blob, fallbackName: string): Promise<AudioMetadata> {
  const fallbackDisplayName = getFallbackDisplayName(fallbackName);

  try {
    const mm = await import('music-metadata-browser');
    const metadata = await mm.parseBlob(blob);
    const title = metadata.common.title?.trim();
    const artist = metadata.common.artist?.trim();
    const displayName = title ? (artist ? `${artist} - ${title}` : title) : fallbackDisplayName;
    const lyrics = metadata.common.lyrics?.find(Boolean) || null;
    const cover = pictureToDataUrl(metadata.common.picture?.[0]);

    return { displayName, lyrics, cover };
  } catch (error) {
    console.warn('Error reading tags with music-metadata-browser:', error);
  }

  return { displayName: fallbackDisplayName, lyrics: null, cover: null };
}

export async function extractLyricsFromAudio(file: File): Promise<string | null> {
  const metadata = await extractAudioMetadata(file, file.name);
  return metadata.lyrics;
}

export interface RemoteAudioTags {
  title: string | null;
  artist: string | null;
  cover: string | null;
}

function decodeId3Text(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const encoding = bytes[0];
  const payload = bytes.subarray(1);
  try {
    switch (encoding) {
      case 0: return new TextDecoder('iso-8859-1').decode(payload);
      case 1: return new TextDecoder('utf-16').decode(payload);
      case 2: return new TextDecoder('utf-16be').decode(payload);
      default: return new TextDecoder('utf-8').decode(payload);
    }
  } catch {
    return '';
  }
}

function trimNull(value: string): string {
  const index = value.indexOf('\0');
  return (index >= 0 ? value.slice(0, index) : value).trim();
}

function synchsafeSize(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] & 0x7f) << 21) | ((bytes[offset + 1] & 0x7f) << 14) | ((bytes[offset + 2] & 0x7f) << 7) | (bytes[offset + 3] & 0x7f);
}

function uint32Size(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function uint24Size(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

function parseApic(data: Uint8Array, version: number): string | null {
  try {
    let p = 1; // encoding byte
    let mime = 'image/jpeg';
    if (version >= 3) {
      let end = p;
      while (end < data.length && data[end] !== 0) end++;
      mime = new TextDecoder('iso-8859-1').decode(data.subarray(p, end)) || mime;
      p = end + 1;
    } else {
      const format = new TextDecoder('iso-8859-1').decode(data.subarray(p, p + 3)).toLowerCase();
      mime = format === 'png' ? 'image/png' : 'image/jpeg';
      p += 3;
    }
    p += 1; // picture type
    const encoding = data[0];
    if (encoding === 1 || encoding === 2) {
      while (p + 1 < data.length && !(data[p] === 0 && data[p + 1] === 0)) p += 2;
      p += 2;
    } else {
      while (p < data.length && data[p] !== 0) p++;
      p += 1;
    }
    const imageData = data.subarray(p);
    if (imageData.length === 0) return null;
    return pictureToDataUrl({ data: imageData, format: mime });
  } catch {
    return null;
  }
}

/** 解析 ID3v2(2.2/2.3/2.4) 头部字节，提取标题 / 歌手 / 封面。 */
export function parseId3Tags(head: Uint8Array): RemoteAudioTags | null {
  try {
    if (head.length < 10) return null;
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return null; // "ID3"
    const version = head[3];
    const flags = head[5];
    const tagSize = synchsafeSize(head, 6);
    let offset = 10;

    if ((flags & 0x40) && offset + 4 <= head.length) {
      // 扩展头：v2.4 为 synchsafe 且不含自身长度字段；v2.3 为普通 32 位且含自身
      offset += version >= 4 ? 4 + synchsafeSize(head, offset) : uint32Size(head, offset);
    }

    let title: string | null = null;
    let artist: string | null = null;
    let cover: string | null = null;
    const frameHeaderSize = version >= 3 ? 10 : 6;
    const end = Math.min(10 + tagSize, head.length);

    while (offset + frameHeaderSize <= end) {
      let frameId: string;
      let frameSize: number;
      if (version >= 3) {
        frameId = new TextDecoder('iso-8859-1').decode(head.subarray(offset, offset + 4));
        if (!/^[A-Z0-9]{4}$/.test(frameId)) break; // padding
        frameSize = version >= 4 ? synchsafeSize(head, offset + 4) : uint32Size(head, offset + 4);
      } else {
        frameId = new TextDecoder('iso-8859-1').decode(head.subarray(offset, offset + 3));
        if (!/^[A-Z0-9]{3}$/.test(frameId)) break;
        frameSize = uint24Size(head, offset + 3);
      }
      if (frameSize <= 0 || offset + frameHeaderSize + frameSize > head.length) break;

      const data = head.subarray(offset + frameHeaderSize, offset + frameHeaderSize + frameSize);
      if (frameId === 'TIT2' || frameId === 'TT2') title = trimNull(decodeId3Text(data)) || title;
      else if (frameId === 'TPE1' || frameId === 'TP1') artist = trimNull(decodeId3Text(data)) || artist;
      else if (frameId === 'APIC' || frameId === 'PIC') cover = cover || parseApic(data, version);

      offset += frameHeaderSize + frameSize;
    }

    if (!title && !artist && !cover) return null;
    return { title, artist, cover };
  } catch {
    return null;
  }
}

/**
 * 流式读取音频头部并解析 ID3v2 标签（标题 / 歌手 / 封面）。
 * 不依赖 Range 请求：读够标签字节后立即取消下载。
 */
export async function readAudioTagsFromUrl(url: string): Promise<RemoteAudioTags | null> {
  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) return null;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let tagEnd = -1;
    const LIMIT = 4 * 1024 * 1024;

    while (received < LIMIT) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (tagEnd < 0 && received >= 10) {
        const head = chunks.length === 1 ? value : concatChunks(chunks, received);
        if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) break; // 无 ID3 头
        tagEnd = 10 + synchsafeSize(head, 6);
      }
      if (tagEnd >= 0 && received >= Math.min(tagEnd, LIMIT)) break;
    }
    reader.cancel().catch(() => {});

    const head = concatChunks(chunks, received);
    return parseId3Tags(head);
  } catch (error) {
    console.warn('Unable to read audio tags from url:', error);
    return null;
  }
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= total) break;
    out.set(chunk.subarray(0, Math.min(chunk.length, total - offset)), offset);
    offset += chunk.length;
  }
  return out;
}

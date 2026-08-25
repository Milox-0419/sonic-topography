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

/**
 * 通过 HTTP Range 请求只读取音频头部的 ID3 标签（不下载整首歌），
 * 用于本地歌单列表展示标题 / 歌手 / 封面。
 */
export async function readAudioTagsFromUrl(url: string): Promise<RemoteAudioTags | null> {
  try {
    const mod: any = await import('jsmediatags/dist/jsmediatags.min.js');
    const jsmediatags = mod.default ?? mod;
    const tags: any = await new Promise((resolve, reject) => {
      jsmediatags.read(url, {
        onSuccess: (result: { tags: any }) => resolve(result.tags),
        onError: (error: any) => reject(error),
      });
    });

    const title = typeof tags?.title === 'string' && tags.title.trim() ? tags.title.trim() : null;
    const artist = typeof tags?.artist === 'string' && tags.artist.trim() ? tags.artist.trim() : null;

    let cover: string | null = null;
    const picture = tags?.picture;
    if (picture?.data?.length) {
      const bytes = picture.data instanceof Uint8Array ? picture.data : new Uint8Array(picture.data);
      cover = pictureToDataUrl({ data: bytes, format: picture.format });
    }

    if (!title && !artist && !cover) return null;
    return { title, artist, cover };
  } catch (error) {
    console.warn('Unable to read audio tags from url:', error);
    return null;
  }
}

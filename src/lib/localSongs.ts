import type { NeteaseSong } from '../types';

export interface LocalSongEntry {
  file: string;
  lrc?: string;
}

const AUDIO_EXT_PATTERN = /\.(mp3|wav|flac|ogg|m4a|aac)$/i;

function splitFileName(file: string): { name: string; artist: string } {
  const base = file.replace(/\.[^.]+$/, '').trim();
  const separatorIndex = base.indexOf(' - ');
  if (separatorIndex > 0) {
    return {
      artist: base.slice(0, separatorIndex).trim(),
      name: base.slice(separatorIndex + 3).trim() || base,
    };
  }
  return { name: base, artist: '' };
}

function toLocalSong(baseUrl: string, entry: LocalSongEntry, index: number): NeteaseSong {
  const { name, artist } = splitFileName(entry.file);
  return {
    provider: 'local',
    id: `local-${index}-${entry.file}`,
    name,
    artist: artist || '未知艺术家',
    album: '本地音乐',
    duration: 0,
    fee: 0,
    url: `${baseUrl}songs/${encodeURIComponent(entry.file)}`,
    lrcUrl: entry.lrc ? `${baseUrl}songs/${encodeURIComponent(entry.lrc)}` : undefined,
  };
}

/**
 * Loads the local playlist from public/songs.
 * Primary source is the dev/local-server API (/api/local-songs); falls back to an
 * optional static manifest at public/songs/manifest.json for pure static hosting.
 * Returns [] when the directory is empty or unavailable (UI shows 暂无歌曲).
 */
export async function fetchLocalSongs(baseUrl = '/'): Promise<NeteaseSong[]> {
  let entries: LocalSongEntry[] | null = null;

  try {
    const response = await fetch('/api/local-songs');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.songs)) entries = data.songs;
    }
  } catch {
    // API unavailable (static hosting) — try manifest fallback below.
  }

  if (!entries) {
    try {
      const response = await fetch(`${baseUrl}songs/manifest.json`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.songs)) {
          entries = data.songs
            .map((item: unknown) => (typeof item === 'string' ? { file: item } : item as LocalSongEntry))
            .filter((item: LocalSongEntry) => item && typeof item.file === 'string');
        }
      }
    } catch {
      // No manifest either — treat as empty playlist.
    }
  }

  if (!entries) return [];

  return entries
    .filter((entry) => entry.file && AUDIO_EXT_PATTERN.test(entry.file))
    .map((entry, index) => toLocalSong(baseUrl, entry, index));
}

import React from 'react';
import { ListMusic, Play } from 'lucide-react';
import type { NeteaseSong } from '../../types';

interface LocalPlaylistPanelProps {
  songs: NeteaseSong[];
  currentSongId: number | string | null;
  onPlay: (song: NeteaseSong) => void;
  accentHex?: string;
}

export function songKey(song: Pick<NeteaseSong, 'id' | 'provider'>) {
  return `${song.provider || 'netease'}:${String(song.id)}`;
}

export const LocalPlaylistPanel: React.FC<LocalPlaylistPanelProps> = ({
  songs,
  currentSongId,
  onPlay,
  accentHex = '#22d3ee',
}) => {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      style={{
        background: `linear-gradient(150deg, ${accentHex}1c, rgba(8, 11, 16, 0.62) 36%, rgba(8, 11, 16, 0.72))`,
        borderColor: `${accentHex}33`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 70px rgba(0,0,0,0.35), inset 0 0 30px ${accentHex}0d`,
      }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <ListMusic size={15} style={{ color: accentHex }} />
          <span className="text-[12px] uppercase tracking-[0.2em] text-white/75">立体歌单</span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">{songs.length} 首</span>
      </div>

      {/* Song list */}
      {songs.length > 0 ? (
        <div className="themed-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
          {songs.map((song, index) => {
            const isActive = currentSongId === songKey(song);
            return (
              <button
                key={songKey(song)}
                onClick={() => onPlay(song)}
                title={`${song.artist ? `${song.artist} - ` : ''}${song.name}`}
                className={`group relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5 ${
                  isActive ? 'bg-white/[0.06]' : ''
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-[60%] w-[2px] -translate-y-1/2 rounded-r-full"
                    style={{ backgroundColor: accentHex, boxShadow: `0 0 8px ${accentHex}` }}
                  />
                )}
                <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-white/30 group-hover:hidden">
                  {(index + 1).toString().padStart(2, '0')}
                </span>
                <span
                  className="hidden w-4 shrink-0 items-center justify-center group-hover:flex"
                  style={{ color: isActive ? accentHex : '#ffffff' }}
                >
                  <Play size={11} />
                </span>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm"
                  style={{ backgroundColor: isActive ? `${accentHex}26` : 'rgba(255,255,255,0.07)' }}
                >
                  <ListMusic size={13} className={isActive ? '' : 'text-white/35'} style={isActive ? { color: accentHex } : undefined} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[12px] leading-5 ${isActive ? 'font-medium' : 'text-white/80'}`}
                    style={isActive ? { color: accentHex } : undefined}
                  >
                    {song.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] leading-4 text-white/40">{song.artist}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <ListMusic size={26} className="text-white/25" />
          <div className="text-[13px] text-white/55">暂无歌曲</div>
          <div className="text-[10px] leading-5 text-white/30">将音频文件放入 public/songs/ 目录后刷新页面</div>
        </div>
      )}
    </div>
  );
};

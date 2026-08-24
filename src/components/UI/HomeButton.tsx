const HOME_URL = 'https://milox.dpdns.org';

export function HomeButton() {
  return (
    <a
      href={HOME_URL}
      className="fixed right-5 top-5 z-[200] flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-[13px] font-medium tracking-wide text-white/85 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 hover:border-white/35 hover:bg-black/50 hover:text-white"
      title="返回主页"
      aria-label="返回主页"
    >
      <span aria-hidden="true">🏠</span>
      <span>返回主页</span>
    </a>
  );
}

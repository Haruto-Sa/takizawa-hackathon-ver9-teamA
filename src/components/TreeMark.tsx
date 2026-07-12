// PorTree のブランドマーク(木のSVG)。public/favicon.svg と同じモチーフ。
export function TreeMark({ size = 30 }: { size?: number }) {
  return <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
    <defs>
      <linearGradient id="portree-leaf" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6ee7b7" />
        <stop offset="1" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="#0c1c30" />
    <path d="M30.4 52c.4-4.8.2-9.8-.8-13.2-1.6-1-4.6-2-8-4.6C17 31.6 15.6 26 16.4 21c3 6.6 7.6 8.4 11 10.4 1 .6 2 1.3 2.8 2.2-.5-3.4-1.5-6.4-3.4-9C24 20.6 22.4 15 24 10c2.4 6.2 6.2 8.6 8.4 13.2 1.2 2.5 1.8 5.6 2 8.8 1-1.6 2.3-2.9 3.8-3.9 3-2 6.8-3.4 9.4-8.6.6 5-1 10-6.6 12.6-2.6 1.2-5.2 1.8-6.6 3-.8 3.2-1 8.6-.6 16.9z" fill="url(#portree-leaf)" />
  </svg>
}

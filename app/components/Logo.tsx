// FluxPerp wordmark — a small emerald flux glyph + two-tone wordmark. No glow halo.

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <rect width="24" height="24" rx="6" fill="#2ebd85" fillOpacity="0.12" />
        <rect x="0.5" y="0.5" width="23" height="23" rx="5.5" stroke="#2ebd85" strokeOpacity="0.25" />
        <path d="M13.2 4 7 13.2h3.7l-1 6.8 7.1-9.6h-4.1l.5-6.4z" fill="#2ebd85" />
      </svg>
      <span className="font-bold tracking-tight text-base leading-none">
        <span className="text-txt">Flux</span>
        <span className="text-long">Perp</span>
      </span>
    </span>
  );
}

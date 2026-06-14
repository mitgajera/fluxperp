// Real token marks — official Solana gradient logo + Bitcoin. SVG, no emoji.

export function TokenIcon({ symbol, size = 18 }: { symbol: string; size?: number }) {
  const base = (symbol || "").split("-")[0].toUpperCase();
  if (base === "SOL") return <SolanaMark size={size} />;
  if (base === "BTC") return <BitcoinMark size={size} />;
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-surface-3 border border-line grid place-items-center text-[9px] text-muted font-semibold"
    >
      {base.slice(0, 1)}
    </div>
  );
}

function SolanaMark({ size }: { size: number }) {
  const id = "sol-grad";
  return (
    <svg width={size} height={size} viewBox="0 0 398 312" fill="none" aria-label="Solana" role="img">
      <defs>
        <linearGradient id={id} x1="360" y1="-30" x2="140" y2="350" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9945FF" />
          <stop offset="0.5" stopColor="#7B61FF" />
          <stop offset="1" stopColor="#19FB9B" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
      />
      <path
        fill={`url(#${id})`}
        d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
      />
      <path
        fill={`url(#${id})`}
        d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
      />
    </svg>
  );
}

function BitcoinMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Bitcoin" role="img">
      <circle cx="12" cy="12" r="12" fill="#F7931A" />
      <path
        fill="#fff"
        d="M16.93 10.66c.18-1.27-.78-1.96-2.1-2.42l.43-1.72-1.05-.26-.42 1.67c-.27-.07-.56-.13-.84-.2l.42-1.68-1.04-.26-.43 1.72c-.23-.05-.45-.1-.67-.16v-.01l-1.45-.36-.28 1.12s.78.18.76.19c.43.11.5.39.49.61l-.49 1.96c.03.01.07.02.11.04l-.11-.03-.69 2.75c-.05.13-.18.32-.48.25.01.02-.76-.19-.76-.19l-.52 1.2 1.37.34.75.2-.43 1.74 1.04.26.43-1.72c.29.08.56.15.83.22l-.43 1.71 1.05.26.43-1.74c1.79.34 3.13.2 3.7-1.42.46-1.3-.02-2.06-.96-2.55.69-.16 1.2-.61 1.34-1.54zm-2.4 3.37c-.32 1.3-2.5.6-3.21.42l.58-2.31c.71.18 2.97.53 2.63 1.89zm.33-3.39c-.3 1.18-2.11.58-2.7.43l.52-2.09c.59.15 2.48.42 2.18 1.66z"
      />
    </svg>
  );
}

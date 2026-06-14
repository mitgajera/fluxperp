// Real token marks — official CoinMarketCap coin images.

const CMC: Record<string, string> = {
  BTC: "https://s2.coinmarketcap.com/static/img/coins/32x32/1.png",
  ETH: "https://s2.coinmarketcap.com/static/img/coins/32x32/1027.png",
  BNB: "https://s2.coinmarketcap.com/static/img/coins/32x32/1839.png",
  SOL: "https://s2.coinmarketcap.com/static/img/coins/32x32/5426.png",
  HYPE: "https://s2.coinmarketcap.com/static/img/coins/32x32/32196.png",
  ZEC: "https://s2.coinmarketcap.com/static/img/coins/32x32/1437.png",
};

export function TokenIcon({ symbol, size = 18 }: { symbol: string; size?: number }) {
  const base = (symbol || "").split("-")[0].toUpperCase();
  const src = CMC[base];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={base}
        width={size}
        height={size}
        loading="lazy"
        className="rounded-full shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-surface-3 border border-line grid place-items-center text-[9px] text-muted font-semibold shrink-0"
    >
      {base.slice(0, 1)}
    </div>
  );
}

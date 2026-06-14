import Link from "next/link";
import LandingStats from "../components/LandingStats";
import Logo from "../components/Logo";
import PriceTicker from "../components/PriceTicker";

function Icon({ path }: { path: React.ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path}
    </svg>
  );
}

const FEATURES = [
  {
    title: "Sub-100ms matching",
    body: "Price-time-priority orderbook matching runs inside the Ephemeral Rollup — fills land in tens of milliseconds, not Solana slots.",
    icon: <><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></>,
  },
  {
    title: "Fully onchain book",
    body: "Every resting order, fill, position, and trigger is program state. No off-chain matching engine, no sequencer trust.",
    icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></>,
  },
  {
    title: "Atomic L1 settlement",
    body: "A fill on the ER and its Solana settlement are one atomic intent bundle via Magic Actions — committed and settled together.",
    icon: <><path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" /></>,
  },
  {
    title: "Permissionless liquidation",
    body: "Health is recomputed onchain from the oracle. Anyone can liquidate an underwater position and earn the bounty. The engine is the chain.",
    icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-surface-0 text-txt overflow-hidden">
      {}
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% -10%, rgba(46,189,133,0.10), transparent 70%), radial-gradient(40rem 30rem at 90% 20%, rgba(46,189,133,0.05), transparent 70%)",
        }}
        aria-hidden
      />

      {}
      <header className="relative z-10 mx-auto max-w-6xl flex items-center justify-between px-6 py-5">
        <Logo className="scale-110 origin-left" />
        <nav className="flex items-center gap-2 text-2xs">
          <Link href="/trade" className="px-3 h-8 grid place-items-center rounded-md text-muted hover:text-txt transition-colors">
            Trade
          </Link>
          <Link href="/portfolio" className="px-3 h-8 grid place-items-center rounded-md text-muted hover:text-txt transition-colors">
            Portfolio
          </Link>
          <Link
            href="/trade"
            className="px-4 h-8 grid place-items-center rounded-md bg-long/15 text-long border border-long/40 hover:bg-long/25 transition-colors shadow-glow-sm uppercase tracking-wide"
          >
            Launch App
          </Link>
        </nav>
      </header>

      {}
      <section className="relative z-10 mx-auto max-w-4xl text-center px-6 pt-20 pb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-1 px-3 py-1 text-2xs text-muted mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-long animate-pulse-dot" aria-hidden />
          Live on Solana devnet · MagicBlock Ephemeral Rollup
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05] text-balance">
          Perp trading at{" "}
          <span className="text-long drop-shadow-[0_0_18px_rgba(46,189,133,0.45)]">ER speed.</span>
          <br />
          Settled on Solana.
        </h1>
        <p className="mt-6 text-base text-muted max-w-2xl mx-auto leading-relaxed">
          A fully onchain perpetuals DEX. Matching, liquidation, and funding run inside MagicBlock&apos;s
          Ephemeral Rollup — sub-100ms fills with gasless session trading, settled atomically on L1.
          Zero trusted components.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            href="/trade"
            className="h-11 px-7 grid place-items-center rounded-md bg-long text-black font-semibold text-sm hover:bg-long/90 transition-colors shadow-glow cursor-pointer"
          >
            Launch App
          </Link>
          <Link
            href="/portfolio"
            className="h-11 px-7 grid place-items-center rounded-md bg-surface-2 border border-line text-txt font-medium text-sm hover:border-line-strong transition-colors cursor-pointer"
          >
            Portfolio
          </Link>
        </div>
        <div className="mt-12 flex justify-center">
          <LandingStats />
        </div>
      </section>

      {}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group rounded-xl border border-line bg-surface-1 p-5 hover:border-long/30 transition-colors"
          >
            <div className="h-10 w-10 grid place-items-center rounded-lg bg-long/10 text-long mb-4 group-hover:shadow-glow-sm transition-shadow">
              <Icon path={f.icon} />
            </div>
            <h3 className="text-sm font-semibold mb-2">{f.title}</h3>
            <p className="text-2xs leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </section>

      {}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl border border-line bg-surface-1 p-8">
          <h2 className="text-center text-2xs uppercase tracking-widest text-faint mb-8">One program · two execution layers</h2>
          <div className="flex items-stretch justify-center gap-3 text-center flex-wrap">
            <ArchBox title="Ephemeral Rollup" sub="hot state" lines={["Orderbook · Positions", "Price feed · Fills", "sub-100ms"]} accent />
            <ArchArrow label="Magic Actions" />
            <ArchBox title="Solana L1" sub="cold state" lines={["Vault · Insurance", "Market configs", "atomic settlement"]} />
          </div>
        </div>
      </section>

      {}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 text-center">
        <p className="text-2xl font-semibold tracking-tight">
          Matching, stop-losses, liquidation, funding —{" "}
          <span className="text-long">all onchain, all sub-second.</span>
        </p>
        <Link
          href="/trade"
          className="inline-grid mt-8 h-11 px-8 place-items-center rounded-md bg-long text-black font-semibold text-sm hover:bg-long/90 transition-colors shadow-glow cursor-pointer"
        >
          Start Trading
        </Link>
      </section>

      <div className="relative z-10">
        <PriceTicker />
      </div>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between text-2xs text-faint">
          <span className="text-long font-semibold">FluxPerp</span>
          <span>Built on MagicBlock · Solana devnet</span>
        </div>
      </footer>
    </main>
  );
}

function ArchBox({ title, sub, lines, accent }: { title: string; sub: string; lines: string[]; accent?: boolean }) {
  return (
    <div className={`flex-1 min-w-[180px] rounded-lg border p-4 ${accent ? "border-long/40 bg-long/[0.04]" : "border-line bg-surface-2"}`}>
      <div className={`text-sm font-semibold ${accent ? "text-long" : "text-txt"}`}>{title}</div>
      <div className="text-2xs text-faint uppercase tracking-wide mb-3">{sub}</div>
      <div className="space-y-1">
        {lines.map((l) => (
          <div key={l} className="text-2xs text-muted font-mono">{l}</div>
        ))}
      </div>
    </div>
  );
}

function ArchArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 min-w-[120px]">
      <span className="text-2xs text-long mb-1 font-mono">{label}</span>
      <svg width="100%" height="20" viewBox="0 0 120 20" fill="none" aria-hidden>
        <path d="M2 10h108" stroke="#2ebd85" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        <path d="M104 5l8 5-8 5" stroke="#2ebd85" strokeWidth="1" />
        <path d="M16 5l-8 5 8 5" stroke="#2ebd85" strokeWidth="1" opacity="0.7" />
      </svg>
      <span className="text-[9px] text-faint mt-1">atomic bridge</span>
    </div>
  );
}

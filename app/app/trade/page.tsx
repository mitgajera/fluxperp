import Link from "next/link";
import Providers from "../../components/Providers";
import StatsBar from "../../components/StatsBar";
import Orderbook from "../../components/Orderbook";
import Chart from "../../components/Chart";
import OrderForm from "../../components/OrderForm";
import PositionPanel from "../../components/PositionPanel";
import TradeHistory from "../../components/TradeHistory";
import SessionKeyButton from "../../components/SessionKeyButton";
import FillToast from "../../components/FillToast";
import ProofOfSpeed from "../../components/ProofOfSpeed";
import ShareCardHost from "../../components/ShareCardHost";

export default function TradePage() {
  return (
    <Providers>
      <div className="h-screen flex flex-col bg-surface-0 text-txt overflow-hidden">
        {}
        <header className="h-12 shrink-0 flex items-center gap-6 px-4 border-b border-line bg-surface-1">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-long font-bold tracking-tight text-base drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]">
              FluxPerp
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-2xs">
            <span className="px-3 h-7 grid place-items-center rounded bg-surface-3 text-txt">Trade</span>
            <Link href="/portfolio" className="px-3 h-7 grid place-items-center rounded text-faint hover:text-txt transition-colors">
              Portfolio
            </Link>
            <Link href="/leaderboard" className="px-3 h-7 grid place-items-center rounded text-faint hover:text-txt transition-colors">
              Leaderboard
            </Link>
          </nav>
          <div className="ml-auto">
            <SessionKeyButton />
          </div>
        </header>

        <StatsBar />

        {}
        <div className="flex-1 min-h-0 flex gap-2 p-2 overflow-x-auto">
          <div className="w-[280px] shrink-0">
            <Orderbook />
          </div>
          <div className="flex-1 min-w-[380px]">
            <Chart />
          </div>
          <div className="w-[296px] shrink-0 flex flex-col gap-2 overflow-y-auto">
            <OrderForm />
            <ProofOfSpeed />
          </div>
          <div className="w-[340px] shrink-0">
            <PositionPanel />
          </div>
        </div>

        {}
        <div className="h-44 shrink-0 px-2 pb-2">
          <TradeHistory />
        </div>

        <FillToast />
        <ShareCardHost />
      </div>
    </Providers>
  );
}

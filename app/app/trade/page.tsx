import Link from "next/link";
import Providers from "../../components/Providers";
import Logo from "../../components/Logo";
import StatsBar from "../../components/StatsBar";
import Orderbook from "../../components/Orderbook";
import Chart from "../../components/Chart";
import OrderForm from "../../components/OrderForm";
import AccountPanel from "../../components/AccountPanel";
import TradeHistory from "../../components/TradeHistory";
import PriceTicker from "../../components/PriceTicker";
import SessionKeyButton from "../../components/SessionKeyButton";
import FillToast from "../../components/FillToast";
import ProofOfSpeed from "../../components/ProofOfSpeed";

export default function TradePage() {
  return (
    <Providers>
      <div className="h-screen flex flex-col bg-surface-0 text-txt overflow-hidden">
        {}
        <header className="h-12 shrink-0 flex items-center gap-6 px-4 border-b border-line bg-surface-1">
          <Link href="/" className="flex items-center gap-2 group opacity-95 hover:opacity-100 transition-opacity">
            <Logo />
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
          {}
          <div className="w-[300px] shrink-0 flex flex-col gap-2 min-h-0">
            <div className="flex-[7] min-h-0">
              <Orderbook />
            </div>
            <div className="flex-[4] min-h-0">
              <TradeHistory />
            </div>
          </div>

          {}
          <div className="flex-1 min-w-[420px] min-h-0 flex flex-col gap-2">
            <div className="flex-1 min-h-0">
              <Chart />
            </div>
            <div className="h-[208px] shrink-0">
              <AccountPanel />
            </div>
          </div>

          {}
          <div className="w-[320px] shrink-0 flex flex-col gap-2 min-h-0">
            <div className="flex-1 min-h-0">
              <OrderForm />
            </div>
            <ProofOfSpeed />
          </div>
        </div>

        <PriceTicker />

        <FillToast />
      </div>
    </Providers>
  );
}

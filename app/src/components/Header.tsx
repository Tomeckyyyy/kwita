import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { addrUrl } from "../lib/explorer";

const CLUSTER = import.meta.env.VITE_CLUSTER ?? "localnet";

export function Header({ circle }: { circle: string }) {
  return (
    <header className="masthead">
      <div className="brand">
        <span className="logo">Kwita</span>
        <span className="tagline">Kredyt kupiecki bez banku. Firmy płacą sobie nawzajem, a limit liczy program.</span>
      </div>
      <div className="masthead-right">
        <a className="net" href={addrUrl(circle)} target="_blank" rel="noreferrer" title="Krąg w Solana Explorerze">
          <span className="net-dot" />
          Solana {CLUSTER === "devnet" ? "Devnet" : "localnet"}
        </a>
        <WalletMultiButton />
      </div>
    </header>
  );
}

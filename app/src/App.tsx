import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Keypair, PublicKey } from "@solana/web3.js";
import { errorMessage, fetchState, getProgram, type CircleState, type MemberView, type SignerWallet } from "./lib/kwita";
import { keypairWallet, loadDemoFirms, type DemoFirm } from "./lib/firms";
import { CircleTable } from "./components/CircleTable";
import { Actions } from "./components/Actions";
import { DefaultPanel } from "./components/DefaultPanel";
import { TxLog, type TxEntry } from "./components/TxLog";

const CIRCLE = import.meta.env.VITE_CIRCLE ? new PublicKey(import.meta.env.VITE_CIRCLE) : null;
const MINT = import.meta.env.VITE_MINT ? new PublicKey(import.meta.env.VITE_MINT) : null;
const PRESENTER = "Kawiarnia (Phantom)";

export default function App() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const [firms, setFirms] = useState<DemoFirm[]>([]);
  const [actingAs, setActingAs] = useState(PRESENTER);
  const [state, setState] = useState<{ circle: CircleState; members: MemberView[] } | null>(null);
  const [log, setLog] = useState<TxEntry[]>([]);

  useEffect(() => {
    loadDemoFirms().then(setFirms);
  }, []);

  const wallet: SignerWallet | null = useMemo(() => {
    if (actingAs === PRESENTER) return anchorWallet ?? null;
    const f = firms.find((x) => x.name === actingAs);
    return f ? keypairWallet(f.keypair) : null;
  }, [actingAs, anchorWallet, firms]);

  const program = useMemo(() => (wallet ? getProgram(connection, wallet) : null), [connection, wallet]);
  // Do odczytu stanu wystarczy dowolny portfel (nic nie podpisuje).
  const readProgram = useMemo(
    () => getProgram(connection, wallet ?? keypairWallet(Keypair.generate())),
    [connection, wallet],
  );

  const names = useMemo(() => {
    const m = new Map<string, string>(firms.map((f) => [f.keypair.publicKey.toBase58(), f.name]));
    if (anchorWallet) m.set(anchorWallet.publicKey.toBase58(), "Kawiarnia");
    return m;
  }, [firms, anchorWallet]);

  const refresh = useCallback(async () => {
    if (!CIRCLE) return;
    try {
      setState(await fetchState(readProgram, CIRCLE));
    } catch (e) {
      console.error("Odczyt kręgu nie powiódł się", e);
    }
  }, [readProgram]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const run = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      try {
        const sig = await fn();
        setLog((l) => [{ label, sig, at: Date.now() }, ...l]);
      } catch (e) {
        setLog((l) => [{ label, error: errorMessage(e), at: Date.now() }, ...l]);
      }
      await refresh();
    },
    [refresh],
  );

  if (!CIRCLE || !MINT)
    return (
      <main>
        <h1>Kwita</h1>
        <p>
          Brak VITE_CIRCLE / VITE_MINT: uruchom <code>make seed-local</code>.
        </p>
      </main>
    );

  return (
    <main>
      <header>
        <h1>
          Kwita <small>kredyt kupiecki bez banku</small>
        </h1>
        <WalletMultiButton />
        <label>
          Działam jako:{" "}
          <select value={actingAs} onChange={(e) => setActingAs(e.target.value)}>
            <option>{PRESENTER}</option>
            {firms.map((f) => (
              <option key={f.name}>{f.name}</option>
            ))}
          </select>
        </label>
      </header>
      {state && <CircleTable circle={state.circle} members={state.members} names={names} />}
      {state && (
        <>
          <Actions
            program={program}
            circle={CIRCLE}
            mint={MINT}
            me={wallet?.publicKey ?? null}
            members={state.members}
            names={names}
            run={run}
          />
          <DefaultPanel
            program={program}
            circle={CIRCLE}
            members={state.members}
            names={names}
            defaultAfterSecs={state.circle.defaultAfterSecs}
            run={run}
          />
        </>
      )}
      <TxLog entries={log} />
    </main>
  );
}

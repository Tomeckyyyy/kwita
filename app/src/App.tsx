import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as k from "./lib/kwita";
import { describeError, isProgramRejection, rejectionSignature } from "./lib/errors";
import { withFreshBlockhash } from "./lib/retry";
import { keypairWallet, loadDemoFirms, type DemoFirm } from "./lib/firms";
import { money } from "./lib/format";
import { Header } from "./components/Header";
import { ActAs, type Actor } from "./components/ActAs";
import { Ledger } from "./components/Ledger";
import { ActionPanel } from "./components/ActionPanel";
import { Feed, type FeedEntry, type Rule } from "./components/Feed";

const CIRCLE = import.meta.env.VITE_CIRCLE ? new PublicKey(import.meta.env.VITE_CIRCLE) : null;
const MINT = import.meta.env.VITE_MINT ? new PublicKey(import.meta.env.VITE_MINT) : null;
const PRESENTER_ID = "presenter";
const PRESENTER_NAME = "Kawiarnia";
const CODE = "https://github.com/Tomeckyyyy/kwita/blob/main/programs/kwita/src/instructions";
const NO_MIDDLEMAN = "Decyzję podjął program w sieci, nie bank ani operator.";
export const RULES: Record<string, Rule> = {
  pay: { text: NO_MIDDLEMAN, url: `${CODE}/pay.rs#L77` },
  default: { text: "Egzekucja bez sądu i bez operatora: zrobił to program.", url: `${CODE}/declare_default.rs#L29` },
};

export default function App() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const [firms, setFirms] = useState<DemoFirm[]>([]);
  const [actingAs, setActingAs] = useState(PRESENTER_ID);
  const [state, setState] = useState<{ circle: k.CircleState; members: k.MemberView[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    loadDemoFirms().then(setFirms);
  }, []);

  const wallet: k.SignerWallet | null = useMemo(() => {
    if (actingAs === PRESENTER_ID) return anchorWallet ?? null;
    const f = firms.find((x) => x.name === actingAs);
    return f ? keypairWallet(f.keypair) : null;
  }, [actingAs, anchorWallet, firms]);

  const program = useMemo(() => (wallet ? k.getProgram(connection, wallet) : null), [connection, wallet]);
  // Do odczytu stanu wystarczy dowolny portfel (nic nie podpisuje).
  const readProgram = useMemo(() => k.getProgram(connection, keypairWallet(Keypair.generate())), [connection]);

  const names = useMemo(() => {
    const m = new Map<string, string>(firms.map((f) => [f.keypair.publicKey.toBase58(), f.name]));
    if (anchorWallet) m.set(anchorWallet.publicKey.toBase58(), PRESENTER_NAME);
    return m;
  }, [firms, anchorWallet]);
  const nameOf = useCallback((owner: string) => names.get(owner) ?? `Firma ${owner.slice(0, 4)}`, [names]);

  const refresh = useCallback(async () => {
    if (!CIRCLE) return;
    try {
      setState(await k.fetchState(readProgram, CIRCLE));
      setLoadError(null);
    } catch (e) {
      setLoadError(describeError(e));
    }
  }, [readProgram]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const run = useCallback(
    async (label: string, fn: () => Promise<string>, rule?: Rule) => {
      const id = nextId.current++;
      setBusy(true);
      setFeed((f) => [{ id, label, status: "pending", rule }, ...f]);
      const update = (patch: Partial<FeedEntry>) => setFeed((f) => f.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      try {
        const sig = await withFreshBlockhash(fn, () =>
          update({
            detail:
              actingAs === PRESENTER_ID
                ? "Transakcja wygasła, zanim trafiła do sieci. Zatwierdź ją ponownie w Phantomie."
                : "Transakcja wygasła, wysyłam ponownie…",
          }),
        );
        update({ status: "ok", sig, detail: undefined });
        k.transactionLogs(connection, sig).then((logs) => {
          const note = k.decisionFromLogs(logs);
          if (note) update({ note });
        });
      } catch (e) {
        update({
          status: isProgramRejection(e) ? "rejected" : "failed",
          detail: describeError(e),
          sig: rejectionSignature(e),
        });
      } finally {
        setBusy(false);
        await refresh();
      }
    },
    [refresh, actingAs, connection],
  );

  const actors: Actor[] = useMemo(() => {
    const member = (key: string | undefined) => state?.members.find((m) => m.owner.toBase58() === key);
    const note = (key: string | undefined, fallback: string) => {
      const m = member(key);
      if (!m) return fallback;
      if (m.status !== "active") return m.status === "exited" ? "poza kręgiem" : "niewypłacalna";
      return `saldo ${m.balance < 0 ? "−" : ""}${money(Math.abs(m.balance))}`;
    };
    const presenterKey = anchorWallet?.publicKey.toBase58();
    return [
      {
        id: PRESENTER_ID,
        name: PRESENTER_NAME,
        note: presenterKey ? note(presenterKey, "w Phantomie, poza kręgiem") : "połącz Phantoma",
        available: Boolean(anchorWallet),
      },
      ...firms.map((f) => ({
        id: f.name,
        name: f.name,
        note: note(f.keypair.publicKey.toBase58(), "firma demo"),
        available: true,
      })),
    ];
  }, [firms, anchorWallet, state]);

  if (!CIRCLE || !MINT)
    return (
      <main className="page">
        <p className="setup">
          Brak adresu kręgu. Uruchom <code>make seed-local</code> albo <code>make seed-devnet</code> i odśwież stronę.
        </p>
      </main>
    );

  const myName = actingAs === PRESENTER_ID ? PRESENTER_NAME : actingAs;

  return (
    <main className="page">
      <Header circle={CIRCLE.toBase58()} />
      <ActAs actors={actors} selected={actingAs} onSelect={setActingAs} />
      {loadError && !state && <p className="setup">Nie udało się wczytać kręgu: {loadError}</p>}
      {state && (
        <div className="layout">
          <Ledger
            circle={state.circle}
            members={state.members}
            nameOf={nameOf}
            canDeclare={Boolean(program)}
            busy={busy}
            onDeclare={(m) =>
              run(
                `${myName} ogłasza niewypłacalność firmy ${nameOf(m.owner.toBase58())}`,
                () => k.declareDefault(program!, CIRCLE, m.owner),
                RULES.default,
              )
            }
          />
          <aside className="side">
            <ActionPanel
              key={actingAs}
              program={program}
              circle={state.circle}
              mint={MINT}
              me={wallet?.publicKey ?? null}
              myName={myName}
              members={state.members}
              nameOf={nameOf}
              run={run}
              busy={busy}
              needsWallet={actingAs === PRESENTER_ID && !anchorWallet}
            />
            <Feed entries={feed} />
          </aside>
        </div>
      )}
      {!state && !loadError && <p className="setup">Wczytuję krąg z sieci…</p>}
    </main>
  );
}

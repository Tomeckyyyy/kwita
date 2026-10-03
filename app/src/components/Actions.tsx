import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { Program } from "@anchor-lang/core";
import type { Kwita } from "../idl/kwita";
import * as k from "../lib/kwita";

type Run = (label: string, fn: () => Promise<string>) => Promise<void>;
type Props = {
  program: Program<Kwita> | null;
  circle: PublicKey;
  mint: PublicKey;
  me: PublicKey | null;
  members: k.MemberView[];
  names: Map<string, string>;
  run: Run;
};

export function Actions({ program, circle, mint, me, members, names, run }: Props) {
  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState(150);
  const [invoice, setInvoice] = useState("FV/1/2026");
  const [benef, setBenef] = useState("");
  const [gAmount, setGAmount] = useState(100);
  const [rAmount, setRAmount] = useState(50);
  const [forfeit, setForfeit] = useState(false);

  if (!program || !me) return <p className="card">Połącz portfel albo wybierz firmę demo, żeby wykonywać operacje.</p>;
  const mine = members.find((m) => m.owner.equals(me));
  const others = members.filter((m) => !m.owner.equals(me) && m.status === "active");
  const label = (o: PublicKey) => names.get(o.toBase58()) ?? o.toBase58().slice(0, 6);
  const options = others.map((m) => (
    <option key={m.owner.toBase58()} value={m.owner.toBase58()}>
      {label(m.owner)}
    </option>
  ));

  if (!mine) {
    return (
      <div className="panels">
        <div className="card">
          <b>Nie jesteś w kręgu</b>
          <button onClick={() => run("Dołączenie (kaucja)", () => k.join(program, circle, mint))}>
            Dołącz i wpłać kaucję
          </button>
        </div>
      </div>
    );
  }
  const active = mine.status === "active";
  return (
    <div className="panels">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(`Zapłata ${amount} dla ${label(new PublicKey(seller))}`, () =>
            k.pay(program, circle, new PublicKey(seller), amount, invoice),
          );
        }}
      >
        <b>Zapłać</b>
        <select required value={seller} onChange={(e) => setSeller(e.target.value)}>
          <option value="">— firma —</option>
          {options}
        </select>
        <input type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(+e.target.value)} />
        <input
          placeholder="Nr faktury (KSeF)"
          maxLength={64}
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
        />
        <button disabled={!active}>Zapłać jednostkami</button>
      </form>
      <form onSubmit={(e) => e.preventDefault()}>
        <b>Poręczenie</b>
        <select required value={benef} onChange={(e) => setBenef(e.target.value)}>
          <option value="">— za firmę —</option>
          {options}
        </select>
        <input type="number" min={0.01} step={0.01} value={gAmount} onChange={(e) => setGAmount(+e.target.value)} />
        <button
          disabled={!active || !benef}
          onClick={() =>
            run(`Poręczenie ${gAmount} za ${label(new PublicKey(benef))}`, () =>
              k.giveGuarantee(program, circle, new PublicKey(benef), gAmount),
            )
          }
        >
          Poręcz
        </button>
        <button
          disabled={!benef}
          onClick={() =>
            run(`Wycofanie poręczenia ${gAmount}`, () =>
              k.withdrawGuarantee(program, circle, new PublicKey(benef), gAmount),
            )
          }
        >
          Wycofaj
        </button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(`Wymiana ${rAmount} na tPLN`, () => k.redeem(program, circle, mint, rAmount));
        }}
      >
        <b>Wymień na tPLN z Rezerwy</b>
        <input type="number" min={0.01} step={0.01} value={rAmount} onChange={(e) => setRAmount(+e.target.value)} />
        <button disabled={!active}>Wymień</button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run("Wyjście z kręgu", () => k.leave(program, circle, mint, forfeit));
        }}
      >
        <b>Wyjdź z kręgu</b>
        <label>
          <input type="checkbox" checked={forfeit} onChange={(e) => setForfeit(e.target.checked)} /> oddaj saldo
          dodatnie Rezerwie
        </label>
        <button disabled={!active}>Wyjdź</button>
      </form>
    </div>
  );
}

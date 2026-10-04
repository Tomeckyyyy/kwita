import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { Program } from "@anchor-lang/core";
import type { Kwita } from "../idl/kwita";
import * as k from "../lib/kwita";
import { money, signed } from "../lib/format";
import { Avatar } from "./Avatar";

type Run = (label: string, fn: () => Promise<string>) => Promise<void>;
type Tab = "pay" | "guarantee" | "redeem" | "leave";

type Props = {
  program: Program<Kwita> | null;
  circle: k.CircleState;
  mint: PublicKey;
  me: PublicKey | null;
  myName: string;
  members: k.MemberView[];
  nameOf: (owner: string) => string;
  run: Run;
  busy: boolean;
  needsWallet: boolean;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "pay", label: "Zapłać" },
  { id: "guarantee", label: "Poręcz" },
  { id: "redeem", label: "Wymień" },
  { id: "leave", label: "Wyjdź" },
];

function Picker({
  firms,
  value,
  onChange,
  nameOf,
  label,
}: {
  firms: k.MemberView[];
  value: string;
  onChange: (v: string) => void;
  nameOf: (o: string) => string;
  label: string;
}) {
  return (
    <fieldset className="picker">
      <legend>{label}</legend>
      <div className="picker-list">
        {firms.map((m) => {
          const key = m.owner.toBase58();
          return (
            <label key={key} className="pick">
              <input type="radio" name={label} value={key} checked={value === key} onChange={() => onChange(key)} />
              <Avatar name={nameOf(key)} size={24} />
              <span>{nameOf(key)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Amount({ value, onChange, id }: { value: number; onChange: (n: number) => void; id: string }) {
  return (
    <div className="amount">
      <label htmlFor={id}>Kwota</label>
      <div className="amount-field">
        <input id={id} type="number" inputMode="decimal" min={0.01} step={0.01} value={value} onChange={(e) => onChange(+e.target.value)} />
        <span>tPLN</span>
      </div>
    </div>
  );
}

export function ActionPanel({ program, circle, mint, me, myName, members, nameOf, run, busy, needsWallet }: Props) {
  const [tab, setTab] = useState<Tab>("pay");
  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState(150);
  const [invoice, setInvoice] = useState("FV/1/10/2026");
  const [benef, setBenef] = useState("");
  const [gAmount, setGAmount] = useState(100);
  const [rAmount, setRAmount] = useState(50);
  const [forfeit, setForfeit] = useState(false);

  if (!program || !me) {
    return (
      <section className="sheet">
        <h2>Operacje</h2>
        <p className="hint">
          {needsWallet
            ? "Połącz Phantoma przyciskiem w prawym górnym rogu albo wybierz firmę demo w pasku „Działam jako”."
            : "Wybierz firmę w pasku „Działam jako”."}
        </p>
      </section>
    );
  }

  const mine = members.find((m) => m.owner.equals(me));
  if (!mine) {
    return (
      <section className="sheet">
        <h2>{myName} nie jest jeszcze w kręgu</h2>
        <p className="hint">
          Wpłacasz kaucję {money(circle.deposit)} tPLN do skarbca programu i od razu dostajesz limit {money(circle.deposit)}.
          Limit rośnie z każdą sprzedażą do innych firm w kręgu.
        </p>
        <button type="button" className="primary" disabled={busy} onClick={() => run(`${myName} dołącza do kręgu i wpłaca kaucję ${money(circle.deposit)} tPLN`, () => k.join(program, circle.address, mint))}>
          {busy ? "Trwa wysyłanie…" : `Dołącz i wpłać ${money(circle.deposit)} tPLN kaucji`}
        </button>
      </section>
    );
  }

  if (mine.status !== "active") {
    return (
      <section className="sheet">
        <h2>{myName} {mine.status === "exited" ? "wyszła z kręgu" : "jest niewypłacalna"}</h2>
        <p className="hint">Ta firma nie może już płacić ani poręczać w tym kręgu. Wybierz inną firmę w pasku „Działam jako”.</p>
      </section>
    );
  }

  const others = members.filter((m) => !m.owner.equals(me) && m.status === "active");
  const limit = k.limitOf(mine, circle);
  const after = mine.balance - amount;
  const fits = after >= -limit - 1e-9;
  const sellerName = seller ? nameOf(seller) : "";
  const benefName = benef ? nameOf(benef) : "";

  return (
    <section className="sheet">
      <div className="tabs" role="tablist" aria-label="Operacje">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pay" && (
        <form
          className="op"
          onSubmit={(e) => {
            e.preventDefault();
            run(`${myName} płaci firmie ${sellerName} ${money(amount)} tPLN (${invoice})`, () =>
              k.pay(program, circle.address, new PublicKey(seller), amount, invoice),
            );
          }}
        >
          <Picker firms={others} value={seller} onChange={setSeller} nameOf={nameOf} label="Komu płacisz" />
          <Amount id="pay-amount" value={amount} onChange={setAmount} />
          <div className="amount">
            <label htmlFor="pay-invoice">Numer faktury</label>
            <input id="pay-invoice" maxLength={64} value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          </div>
          <p className={fits ? "preview" : "preview warn"}>
            Saldo po zakupie: <strong>{signed(after)}</strong>, limit {money(limit)}.{" "}
            {fits ? "Program przepuści tę płatność." : "To ponad limit: program odrzuci tę płatność."}
          </p>
          <button type="submit" className="primary" disabled={busy || !seller || amount <= 0}>
            {busy ? "Trwa wysyłanie…" : `Zapłać ${money(amount)} tPLN`}
          </button>
        </form>
      )}

      {tab === "guarantee" && (
        <form className="op" onSubmit={(e) => e.preventDefault()}>
          <Picker firms={others} value={benef} onChange={setBenef} nameOf={nameOf} label="Za kogo poręczasz" />
          <Amount id="g-amount" value={gAmount} onChange={setGAmount} />
          <p className="hint">
            Twój limit spadnie o tę kwotę, a limit wybranej firmy wzrośnie. Jeśli firma nie spłaci długu w terminie, jego część
            przejdzie na Ciebie.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="primary"
              disabled={busy || !benef || gAmount <= 0}
              onClick={() =>
                run(`${myName} poręcza za firmę ${benefName}: ${money(gAmount)} tPLN`, () =>
                  k.giveGuarantee(program, circle.address, new PublicKey(benef), gAmount),
                )
              }
            >
              {busy ? "Trwa wysyłanie…" : "Poręcz"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy || !benef || gAmount <= 0}
              onClick={() =>
                run(`${myName} wycofuje poręczenie za firmę ${benefName}: ${money(gAmount)} tPLN`, () =>
                  k.withdrawGuarantee(program, circle.address, new PublicKey(benef), gAmount),
                )
              }
            >
              Wycofaj poręczenie
            </button>
          </div>
        </form>
      )}

      {tab === "redeem" && (
        <form
          className="op"
          onSubmit={(e) => {
            e.preventDefault();
            run(`${myName} wymienia ${money(rAmount)} jednostek na tPLN z Rezerwy`, () => k.redeem(program, circle.address, mint, rAmount));
          }}
        >
          <Amount id="r-amount" value={rAmount} onChange={setRAmount} />
          <p className="hint">
            Zamieniasz saldo dodatnie na tPLN z Rezerwy kręgu. Twoje saldo: {signed(mine.balance)}. W Rezerwie:{" "}
            {money(circle.reserveUsdc)} tPLN.
          </p>
          <button type="submit" className="primary" disabled={busy || rAmount <= 0}>
            {busy ? "Trwa wysyłanie…" : `Wymień ${money(rAmount)} na tPLN`}
          </button>
        </form>
      )}

      {tab === "leave" && (
        <form
          className="op"
          onSubmit={(e) => {
            e.preventDefault();
            run(`${myName} wychodzi z kręgu`, () => k.leave(program, circle.address, mint, forfeit));
          }}
        >
          <p className="hint">
            {mine.balance < 0 &&
              `Masz ${signed(mine.balance)}. Kaucja pokryje dług, a reszta (${money(mine.deposit + mine.balance)} tPLN) wróci do Ciebie.`}
            {mine.balance === 0 && `Saldo wynosi zero, więc odzyskasz całą kaucję: ${money(mine.deposit)} tPLN.`}
            {mine.balance > 0 &&
              `Masz ${signed(mine.balance)}. Wydaj je albo wymień na tPLN przed wyjściem. Możesz też oddać je Rezerwie.`}
            {mine.guaranteesGiven > 0 && " Najpierw wycofaj swoje poręczenia za inne firmy."}
          </p>
          {mine.balance > 0 && (
            <label className="check">
              <input type="checkbox" checked={forfeit} onChange={(e) => setForfeit(e.target.checked)} />
              Oddaj saldo dodatnie Rezerwie
            </label>
          )}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Trwa wysyłanie…" : "Wyjdź z kręgu"}
          </button>
        </form>
      )}
    </section>
  );
}

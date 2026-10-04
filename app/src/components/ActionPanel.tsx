import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { Program } from "@anchor-lang/core";
import type { Kwita } from "../idl/kwita";
import * as k from "../lib/kwita";
import { money, signed } from "../lib/format";
import { Avatar } from "./Avatar";

type Rule = { text: string; url: string };
type Run = (label: string, fn: () => Promise<string>, rule?: Rule) => Promise<void>;
const PAY_RULE: Rule = {
  text: "Decyzję podjął program w sieci, nie bank ani operator.",
  url: "https://github.com/Tomeckyyyy/kwita/blob/main/programs/kwita/src/instructions/pay.rs#L77",
};
const CODE = "https://github.com/Tomeckyyyy/kwita/blob/main/programs/kwita/src/instructions";
const JOIN_RULE: Rule = {
  text: "Bez zaproszenia od firmy z kręgu program nie wpuszcza. Nie ma admina, który by o tym decydował.",
  url: `${CODE}/join.rs#L47`,
};
const INVITE_RULE: Rule = {
  text: "Zaprasza dowolna aktywna firma z kręgu, nie admin ani operator.",
  url: `${CODE}/invite.rs#L33`,
};
type Tab = "pay" | "guarantee" | "invite" | "redeem" | "leave";

type Props = {
  program: Program<Kwita> | null;
  circle: k.CircleState;
  mint: PublicKey;
  me: PublicKey | null;
  myName: string;
  members: k.MemberView[];
  invites: k.InviteView[];
  /** Portfel prezentera (Phantom): podpowiedź adresu do zaproszenia. */
  presenter: PublicKey | null;
  nameOf: (owner: string) => string;
  run: Run;
  busy: boolean;
  needsWallet: boolean;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "pay", label: "Zapłać" },
  { id: "guarantee", label: "Poręcz" },
  { id: "invite", label: "Zaproś" },
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

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;

function validKey(s: string): PublicKey | null {
  try {
    return new PublicKey(s.trim());
  } catch {
    return null;
  }
}

/** Nazwa firmy albo skrócony adres (zaproszone firmy często nie mają jeszcze nazwy). */
function names(nameOf: (o: string) => string, key: string) {
  const n = nameOf(key);
  return n.startsWith("Firma ") ? `firma ${short(key)}` : n;
}

export function ActionPanel({ program, circle, mint, me, myName, members, invites, presenter, nameOf, run, busy, needsWallet }: Props) {
  const [tab, setTab] = useState<Tab>("pay");
  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState(150);
  const [invoice, setInvoice] = useState("FV/1/10/2026");
  const [benef, setBenef] = useState("");
  const [gAmount, setGAmount] = useState(100);
  const [rAmount, setRAmount] = useState(50);
  const [forfeit, setForfeit] = useState(false);
  const [invitee, setInvitee] = useState("");

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
    const myInvite = invites.find((i) => i.invitee.equals(me));
    const founder = circle.creator.equals(me);
    return (
      <section className="sheet">
        <h2>{myName} nie jest jeszcze w kręgu</h2>
        <div className="op">
          <p className="hint">
            Wpłacasz kaucję {money(circle.deposit)} tPLN do skarbca programu i od razu dostajesz limit {money(circle.deposit)}.
            Limit rośnie z każdą sprzedażą do innych firm w kręgu.
          </p>
          <p className={myInvite || founder ? "preview" : "preview warn"}>
            {myInvite
              ? `Masz zaproszenie od firmy ${nameOf(myInvite.inviter.toBase58())}.`
              : founder
                ? "Ta firma założyła krąg, więc dołącza bez zaproszenia (tylko to ją wyróżnia)."
                : "Nie masz zaproszenia: program odrzuci dołączenie. Poproś dowolną firmę z kręgu, żeby zaprosiła Twój adres:"}
          </p>
          {!myInvite && !founder && (
            <p className="hint">
              <code className="address">{me.toBase58()}</code>
            </p>
          )}
          <button type="button" className="primary" disabled={busy} onClick={() => run(`${myName} dołącza do kręgu i wpłaca kaucję ${money(circle.deposit)} tPLN`, () => k.join(program, circle.address, mint), JOIN_RULE)}>
            {busy ? "Trwa wysyłanie…" : `Dołącz i wpłać ${money(circle.deposit)} tPLN kaucji`}
          </button>
        </div>
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
            run(
              `${myName} płaci firmie ${sellerName} ${money(amount)} tPLN (${invoice})`,
              () => k.pay(program, circle.address, new PublicKey(seller), amount, invoice),
              PAY_RULE,
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

      {tab === "invite" && (
        <form
          className="op"
          onSubmit={(e) => {
            e.preventDefault();
            const key = validKey(invitee)!;
            run(`${myName} zaprasza do kręgu: ${names(nameOf, key.toBase58())}`, () => k.invite(program, circle.address, key), INVITE_RULE).then(
              () => setInvitee(""),
            );
          }}
        >
          <div className="amount">
            <label htmlFor="invitee">Zaproś firmę (adres portfela)</label>
            <input
              id="invitee"
              placeholder="np. adres Phantoma firmy"
              autoComplete="off"
              spellCheck={false}
              value={invitee}
              onChange={(e) => setInvitee(e.target.value)}
            />
          </div>
          {presenter &&
            !members.some((m) => m.owner.equals(presenter)) &&
            !invites.some((i) => i.invitee.equals(presenter)) &&
            invitee !== presenter.toBase58() && (
              <button type="button" className="secondary" onClick={() => setInvitee(presenter.toBase58())}>
                Wstaw adres: {nameOf(presenter.toBase58())} (Phantom)
              </button>
            )}
          <p className={invitee && !validKey(invitee) ? "preview warn" : "hint"}>
            {invitee && !validKey(invitee)
              ? "To nie jest poprawny adres Solany."
              : "Każda aktywna firma z kręgu może zaprosić nową. Zaproszona firma dołącza sama, wpłacając kaucję; zaproszenie działa raz."}
          </p>
          <button type="submit" className="primary" disabled={busy || !validKey(invitee)}>
            {busy ? "Trwa wysyłanie…" : "Zaproś"}
          </button>
          <h3>Oczekujące zaproszenia</h3>
          {invites.length === 0 ? (
            <p className="hint">Brak. Zaproszenie znika, gdy firma dołączy.</p>
          ) : (
            <ul className="invites">
              {invites.map((i) => {
                const to = i.invitee.toBase58();
                const mineInv = i.inviter.equals(me);
                return (
                  <li key={i.address.toBase58()}>
                    <span>
                      {names(nameOf, to)} <span className="hint">od {nameOf(i.inviter.toBase58())}</span>
                    </span>
                    {mineInv && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => run(`${myName} wycofuje zaproszenie dla ${names(nameOf, to)}`, () => k.revokeInvite(program, circle.address, i.invitee))}
                      >
                        Wycofaj
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
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

import { useEffect, useState } from "react";
import type { CircleState, MemberView } from "../lib/kwita";
import { limitOf } from "../lib/kwita";
import { money, signed } from "../lib/format";
import { Avatar } from "./Avatar";

type Props = {
  circle: CircleState;
  members: MemberView[];
  nameOf: (owner: string) => string;
  canDeclare: boolean;
  busy: boolean;
  onDeclare: (m: MemberView) => void;
};

const STATUS = { active: "", exited: "wyszła z kręgu", defaulted: "niewypłacalna" } as const;

function clock(secs: number) {
  const s = Math.max(0, secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Kreska salda na wspólnej osi zera: w lewo (czerwona) dług, w prawo (granatowa) należność. */
function Axis({ balance, limit, scale }: { balance: number; limit: number | null; scale: number }) {
  const pct = (v: number) => `${Math.min(50, (Math.abs(v) / scale) * 50)}%`;
  return (
    <div className="axis" aria-hidden="true">
      {limit !== null && <span className="axis-limit" style={{ right: `calc(50% + ${pct(limit)})` }} />}
      {balance < 0 && <span className="axis-bar neg" style={{ width: pct(balance) }} />}
      {balance > 0 && <span className="axis-bar pos" style={{ width: pct(balance) }} />}
      <span className="axis-zero" />
    </div>
  );
}

export function Ledger({ circle, members, nameOf, canDeclare, busy, onDeclare }: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const active = members.filter((m) => m.status === "active");
  const scale = Math.max(
    1,
    ...active.map((m) => Math.max(limitOf(m, circle), Math.abs(m.balance))),
    ...members.map((m) => Math.abs(m.balance)),
    Math.abs(circle.reserveBalance),
  );
  const sum = members.reduce((s, m) => s + m.balance, 0) + circle.reserveBalance;
  const even = Math.abs(sum) < 1e-9;
  const deposits = members.reduce((s, m) => s + m.deposit, 0);
  const sorted = [...members].sort(
    (a, b) =>
      (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) ||
      nameOf(a.owner.toBase58()).localeCompare(nameOf(b.owner.toBase58()), "pl"),
  );

  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <div className="ledger-head">
        <div>
          <h2 id="ledger-title">Księga kręgu</h2>
          <p className="lede">
            Każda firma zaczyna od zera. Kupując, schodzi na minus, ale tylko do swojego limitu (nawias). Sprzedając,
            wraca na plus.
          </p>
        </div>
        <div className={even ? "stamp" : "stamp off"} role="status">
          <span className="stamp-word">{even ? "kwita" : "nie kwita"}</span>
          <span className="stamp-note">suma sald i Rezerwy: {money(sum)}</span>
        </div>
      </div>

      <div className="rows" role="table" aria-label="Salda firm">
        <div className="row row-head" role="row">
          <span role="columnheader">Firma</span>
          <span role="columnheader" className="axis-legend">
            <span>dług</span>
            <span>0</span>
            <span>należność</span>
          </span>
          <span role="columnheader" className="num">Saldo</span>
          <span role="columnheader" className="num">Limit</span>
          <span role="columnheader" className="num">Kaucja</span>
        </div>

        {sorted.map((m) => {
          const name = nameOf(m.owner.toBase58());
          const isActive = m.status === "active";
          const limit = isActive ? limitOf(m, circle) : null;
          const left = m.negativeSince + circle.defaultAfterSecs - now;
          const overdue = isActive && m.balance < 0 && m.negativeSince > 0;
          return (
            <div key={m.address.toBase58()} className={isActive ? "row" : "row gone"} role="row">
              <span className="who" role="cell">
                <Avatar name={name} />
                <span className="who-text">
                  <span className="who-name">{name}</span>
                  <span className="who-meta">
                    {!isActive && STATUS[m.status]}
                    {isActive && m.guaranteesReceived > 0 && `ma poręczenie ${money(m.guaranteesReceived)}`}
                    {isActive && m.guaranteesReceived > 0 && m.guaranteesGiven > 0 && ", "}
                    {isActive && m.guaranteesGiven > 0 && `poręcza ${money(m.guaranteesGiven)}`}
                    {isActive && m.guaranteesReceived === 0 && m.guaranteesGiven === 0 && m.countedSales > 0 && `sprzedaż w kręgu ${money(m.countedSales)}`}
                  </span>
                </span>
              </span>
              <span role="cell" className="axis-cell">
                <Axis balance={m.balance} limit={limit} scale={scale} />
                {overdue && (
                  <span className="due">
                    {left > 0 ? (
                      <>Na minusie. Niewypłacalność możliwa za {clock(left)}</>
                    ) : (
                      <>
                        Termin spłaty minął.
                        <button type="button" className="link-btn" disabled={!canDeclare || busy} onClick={() => onDeclare(m)}>
                          Ogłoś niewypłacalność
                        </button>
                      </>
                    )}
                  </span>
                )}
              </span>
              <span role="cell" className={`num balance ${m.balance < 0 ? "neg" : m.balance > 0 ? "pos" : ""}`}>
                {signed(m.balance)}
              </span>
              <span role="cell" className="num">{limit === null ? "—" : money(limit)}</span>
              <span role="cell" className="num muted">{money(m.deposit)}</span>
            </div>
          );
        })}

        <div className="row reserve" role="row">
          <span className="who" role="cell">
            <span className="avatar reserve-mark" aria-hidden="true">R</span>
            <span className="who-text">
              <span className="who-name">Rezerwa kręgu</span>
              <span className="who-meta">
                {money(circle.reserveUsdc)} tPLN do wymiany
                {circle.unbackedLoss > 0 && `, niepokryta strata ${money(circle.unbackedLoss)}`}
              </span>
            </span>
          </span>
          <span role="cell" className="axis-cell">
            <Axis balance={circle.reserveBalance} limit={null} scale={scale} />
          </span>
          <span role="cell" className={`num balance ${circle.reserveBalance < 0 ? "neg" : circle.reserveBalance > 0 ? "pos" : ""}`}>
            {signed(circle.reserveBalance)}
          </span>
          <span role="cell" className="num">—</span>
          <span role="cell" className="num muted">—</span>
        </div>
      </div>

      <p className="vault">
        W skarbcu programu leży <strong>{money(deposits + circle.reserveUsdc)} tPLN</strong>: kaucje firm (
        {money(deposits)}) i Rezerwa ({money(circle.reserveUsdc)}). Wypłacić je mogą tylko instrukcje programu.
      </p>
    </section>
  );
}

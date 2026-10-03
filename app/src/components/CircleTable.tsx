import type { CircleState, MemberView } from "../lib/kwita";
import { limitOf } from "../lib/kwita";
import { addrUrl } from "../lib/explorer";

const fmt = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
const STATUS = { active: "aktywna", exited: "wyszła", defaulted: "niewypłacalna" } as const;

export function CircleTable({
  circle,
  members,
  names,
}: {
  circle: CircleState;
  members: MemberView[];
  names: Map<string, string>;
}) {
  return (
    <section>
      <h2>
        Krąg{" "}
        <a href={addrUrl(circle.address.toBase58())} target="_blank" rel="noreferrer">
          ↗
        </a>
      </h2>
      <table>
        <thead>
          <tr>
            <th>Firma</th>
            <th>Saldo</th>
            <th>Limit</th>
            <th>Kaucja</th>
            <th>Sprzedaż (liczona)</th>
            <th>Poręczenia dane / otrzymane</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.address.toBase58()} className={m.balance < 0 ? "neg" : ""}>
              <td>{names.get(m.owner.toBase58()) ?? m.owner.toBase58().slice(0, 6)}</td>
              <td>{fmt(m.balance)}</td>
              <td>{m.status === "active" ? fmt(limitOf(m, circle)) : "—"}</td>
              <td>{fmt(m.deposit)}</td>
              <td>{fmt(m.countedSales)}</td>
              <td>
                {fmt(m.guaranteesGiven)} / {fmt(m.guaranteesReceived)}
              </td>
              <td>{STATUS[m.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="reserve">
        Rezerwa: saldo {fmt(circle.reserveBalance)}, tPLN {fmt(circle.reserveUsdc)}, niepokryta strata{" "}
        {fmt(circle.unbackedLoss)}. Suma sald + Rezerwa ={" "}
        {fmt(members.reduce((s, m) => s + m.balance, 0) + circle.reserveBalance)}
      </p>
    </section>
  );
}

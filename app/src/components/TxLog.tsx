import { txUrl } from "../lib/explorer";

export type TxEntry = { label: string; sig?: string; error?: string; at: number };

export function TxLog({ entries }: { entries: TxEntry[] }) {
  return (
    <section>
      <h2>Transakcje</h2>
      <ul className="txlog">
        {entries.map((e) => (
          <li key={e.at} className={e.error ? "err" : "ok"}>
            {e.label}:{" "}
            {e.sig ? (
              <a href={txUrl(e.sig)} target="_blank" rel="noreferrer">
                Explorer ↗
              </a>
            ) : (
              <span>{e.error}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

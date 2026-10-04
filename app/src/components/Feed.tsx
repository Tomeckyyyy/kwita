import { txUrl } from "../lib/explorer";

export type Rule = { text: string; url: string };

export type FeedEntry = {
  id: number;
  label: string;
  status: "pending" | "ok" | "rejected" | "failed";
  sig?: string;
  detail?: string;
  /** Decyzja programu odczytana z logów transakcji („Kwita: …”). */
  note?: string;
  /** Gdzie w kodzie programu zapada ta decyzja. */
  rule?: Rule;
};

const ICON = { pending: "", ok: "✓", rejected: "✕", failed: "!" } as const;
const plain = (s?: string) => s?.replace(/^Kwita: /, "");

export function Feed({ entries }: { entries: FeedEntry[] }) {
  return (
    <section className="feed" aria-labelledby="feed-title" aria-live="polite">
      <h2 id="feed-title">Zdarzenia</h2>
      {entries.length === 0 ? (
        <p className="empty">Tu pojawi się każda transakcja z linkiem do Solana Explorera.</p>
      ) : (
        <ol className="events">
          {entries.map((e) => (
            <li key={e.id} className={`event ${e.status}`}>
              <span className="event-icon" aria-hidden="true">
                {ICON[e.status]}
              </span>
              <div className="event-body">
                <span className="event-label">{e.label}</span>
                {e.status === "pending" && (
                  <span className="event-detail">{e.detail ?? "Wysyłanie i potwierdzanie w sieci…"}</span>
                )}
                {e.status === "rejected" && <span className="event-detail">Program odrzucił: {plain(e.detail)}</span>}
                {e.status === "failed" && <span className="event-detail">Nie wysłano: {e.detail}</span>}
                {e.status === "ok" && e.note && <span className="event-note">{plain(e.note)}</span>}
                {e.rule && (e.status === "rejected" || e.status === "ok") && (
                  <span className="event-rule">
                    {e.rule.text}{" "}
                    <a href={e.rule.url} target="_blank" rel="noreferrer">
                      Zobacz regułę w kodzie
                    </a>
                  </span>
                )}
                {e.sig && (
                  <a className="event-link" href={txUrl(e.sig)} target="_blank" rel="noreferrer">
                    Zobacz w Explorerze
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

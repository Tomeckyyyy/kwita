import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { Program } from "@anchor-lang/core";
import type { Kwita } from "../idl/kwita";
import * as k from "../lib/kwita";

type Run = (label: string, fn: () => Promise<string>) => Promise<void>;

export function DefaultPanel({
  program,
  circle,
  members,
  names,
  defaultAfterSecs,
  run,
}: {
  program: Program<Kwita> | null;
  circle: PublicKey;
  members: k.MemberView[];
  names: Map<string, string>;
  defaultAfterSecs: number;
  run: Run;
}) {
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(t);
  }, []);
  const negative = members.filter((m) => m.status === "active" && m.balance < 0 && m.negativeSince > 0);
  if (negative.length === 0) return null;
  return (
    <section>
      <h2>Niewypłacalność</h2>
      <ul>
        {negative.map((m) => {
          const left = Math.ceil(m.negativeSince + defaultAfterSecs - now);
          const name = names.get(m.owner.toBase58()) ?? m.owner.toBase58().slice(0, 6);
          return (
            <li key={m.owner.toBase58()}>
              {name}: saldo {m.balance}, {left > 0 ? `termin za ${left} s` : "termin minął"}{" "}
              <button
                disabled={!program || left > 0}
                onClick={() => run(`Niewypłacalność: ${name}`, () => k.declareDefault(program!, circle, m.owner))}
              >
                Ogłoś niewypłacalność
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

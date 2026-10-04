const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });

/** Kwota z prawdziwym minusem (U+2212), żeby cyfry w kolumnach się nie przesuwały. */
export const money = (n: number) => (n < 0 ? `−${nf.format(-n)}` : nf.format(n));

/** Kwota ze znakiem: +150 / −150 / 0. */
export const signed = (n: number) => (n > 0 ? `+${nf.format(n)}` : money(n));

const HUES = [214, 352, 152, 32, 274, 190];

/** Stały kolor firmy liczony z nazwy (ten sam w przełączniku, księdze i zdarzeniach). */
export function firmHue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

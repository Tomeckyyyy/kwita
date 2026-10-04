import { ProgramRejection, errorMessage } from "./kwita";

/** Czy transakcję odrzucił program Kwity (a nie portfel albo sieć). */
export function isProgramRejection(e: unknown): boolean {
  if (e instanceof ProgramRejection) return true;
  const err = e as { error?: { errorCode?: { code?: string } } };
  return Boolean(err?.error?.errorCode?.code);
}

/** Podpis odrzuconej transakcji (jest w sieci, więc da się ją pokazać w Explorerze). */
export function rejectionSignature(e: unknown): string | undefined {
  return e instanceof ProgramRejection ? e.signature : undefined;
}

/** Czytelne komunikaty dla odmów, które warto wyjaśnić inaczej niż logiem programu. */
const FRIENDLY: Record<string, string> = {
  NotInvited: "Nie masz zaproszenia do tego kręgu. Poproś dowolną firmę z kręgu, żeby zaprosiła Twój adres.",
  InviterNotActive: "Zapraszać może tylko aktywna firma z kręgu.",
  CannotInviteSelf: "Nie można zaprosić samego siebie.",
};

function errorCodeName(e: unknown): string | undefined {
  if (e instanceof ProgramRejection) {
    for (const l of e.logs) {
      const m = l.match(/Error Code: (\w+)/);
      if (m) return m[1];
    }
    return undefined;
  }
  return (e as { error?: { errorCode?: { code?: string } } })?.error?.errorCode?.code;
}

export function describeError(e: unknown): string {
  const code = errorCodeName(e);
  if (code && FRIENDLY[code]) return FRIENDLY[code];
  if (e instanceof ProgramRejection && e.logs.some((l) => /already in use/.test(l)))
    return "To konto już istnieje: ta firma ma już oczekujące zaproszenie.";
  const msg = errorMessage(e);
  if (/User rejected|rejected the request/i.test(msg)) return "Odrzucono w portfelu.";
  if (/Blockhash not found|block height exceeded/i.test(msg))
    return "Transakcja wygasła: zatwierdzenie w portfelu trwało ponad minutę. Spróbuj jeszcze raz i zatwierdź od razu.";
  if (/timeout|Failed to fetch|NetworkError/i.test(msg)) return `Problem z siecią: ${msg}`;
  return msg;
}

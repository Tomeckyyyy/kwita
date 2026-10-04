import { errorMessage } from "./kwita";

/** Czy transakcję odrzucił program Kwity (a nie portfel albo sieć). */
export function isProgramRejection(e: unknown): boolean {
  const err = e as { error?: { errorCode?: { code?: string } } };
  return Boolean(err?.error?.errorCode?.code);
}

export function describeError(e: unknown): string {
  const msg = errorMessage(e);
  if (/User rejected|rejected the request/i.test(msg)) return "Odrzucono w portfelu.";
  if (/Blockhash not found|block height exceeded/i.test(msg))
    return "Transakcja wygasła: zatwierdzenie w portfelu trwało ponad minutę. Spróbuj jeszcze raz i zatwierdź od razu.";
  if (/timeout|Failed to fetch|NetworkError/i.test(msg)) return `Problem z siecią: ${msg}`;
  return msg;
}

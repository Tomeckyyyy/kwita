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

export function describeError(e: unknown): string {
  const msg = errorMessage(e);
  if (/User rejected|rejected the request/i.test(msg)) return "Odrzucono w portfelu.";
  if (/Blockhash not found|block height exceeded/i.test(msg))
    return "Transakcja wygasła: zatwierdzenie w portfelu trwało ponad minutę. Spróbuj jeszcze raz i zatwierdź od razu.";
  if (/timeout|Failed to fetch|NetworkError/i.test(msg)) return `Problem z siecią: ${msg}`;
  return msg;
}

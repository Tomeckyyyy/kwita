/** Blockhash wygasł, zanim transakcja dotarła do sieci (np. zatwierdzanie w portfelu trwało ponad minutę). */
export function isExpiredBlockhash(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /Blockhash not found|block height exceeded|TransactionExpiredBlockheightExceeded/i.test(msg);
}

/**
 * Wywołuje `send`, a przy wygasłym blockhashu buduje transakcję od nowa (świeży blockhash)
 * i prosi o podpis jeszcze raz. Inne błędy, w tym odrzucenie przez program, idą dalej bez ponawiania.
 */
export async function withFreshBlockhash<T>(
  send: () => Promise<T>,
  onRetry: (attempt: number) => void = () => {},
  maxRetries = 2,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (e) {
      if (attempt >= maxRetries || !isExpiredBlockhash(e)) throw e;
      onRetry(attempt + 1);
    }
  }
}

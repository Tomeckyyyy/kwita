import assert from "node:assert/strict";
import { isExpiredBlockhash, withFreshBlockhash } from "../src/lib/retry";

const expired = new Error("Simulation failed. Message: Transaction simulation failed: Blockhash not found. Logs: [].");

// wygasły blockhash: jedno ponowienie, potem sukces
{
  let calls = 0;
  const retries: number[] = [];
  const sig = await withFreshBlockhash(
    async () => {
      calls++;
      if (calls === 1) throw expired;
      return "SIG";
    },
    (n) => retries.push(n),
  );
  assert.equal(sig, "SIG");
  assert.equal(calls, 2);
  assert.deepEqual(retries, [1]);
}

// inne błędy (np. odrzucenie przez program) nie są ponawiane
{
  let calls = 0;
  await assert.rejects(
    withFreshBlockhash(async () => {
      calls++;
      throw new Error("Error Code: LimitExceeded");
    }),
  );
  assert.equal(calls, 1);
}

// najwyżej 2 ponowienia, potem błąd idzie dalej
{
  let calls = 0;
  await assert.rejects(
    withFreshBlockhash(async () => {
      calls++;
      throw expired;
    }),
  );
  assert.equal(calls, 3);
}

assert.ok(isExpiredBlockhash(new Error("block height exceeded")));
assert.ok(!isExpiredBlockhash(new Error("User rejected the request")));
console.log("retry: OK");

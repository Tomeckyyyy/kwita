import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import assert from "node:assert/strict";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import * as k from "../src/lib/kwita";
import { keypairWallet } from "../src/lib/firms";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split("=")),
);
const connection = new Connection(env.VITE_RPC_URL, "confirmed");
const circle = new PublicKey(env.VITE_CIRCLE);
const mint = new PublicKey(env.VITE_MINT);
const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8"))),
);
const [druk, studio, biuro] = (JSON.parse(readFileSync("public/demo-firms.json", "utf8")) as { secretKey: number[] }[]).map(
  (f) => Keypair.fromSecretKey(Uint8Array.from(f.secretKey)),
);
const P = (kp: Keypair) => k.getProgram(connection, keypairWallet(kp));
const bal = async (o: PublicKey) => (await k.fetchState(P(payer), circle)).members.find((m) => m.owner.equals(o))!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function step(name: string, fn: () => Promise<string>) {
  const sig = await fn();
  console.log(`OK  ${name}  ${sig}`);
}

async function expectFail(name: string, fn: () => Promise<string>, msg: string) {
  try {
    await fn();
  } catch (e) {
    assert.match(k.errorMessage(e), new RegExp(msg));
    console.log(`OK  ${name} (odrzucone: ${k.errorMessage(e)})`);
    return;
  }
  assert.fail(`${name}: miało się nie udać`);
}

async function main() {
  const kaw = Keypair.generate();
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: kaw.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL }),
    ),
    [payer],
  );
  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, kaw.publicKey);
  await mintTo(connection, payer, mint, ata.address, payer, 1_000 * k.UNIT);

  await step("Kawiarnia dołącza", () => k.join(P(kaw), circle, mint));
  await step("Kawiarnia kupuje ulotki 150", () => k.pay(P(kaw), circle, druk.publicKey, 150, "FV/1/2026"));
  await expectFail(
    "Kawiarnia kupuje projekt 100",
    () => k.pay(P(kaw), circle, studio.publicKey, 100, "FV/2/2026"),
    "limit",
  );
  await step("Studio poręcza 100", () => k.giveGuarantee(P(studio), circle, kaw.publicKey, 100));
  await step("Kawiarnia kupuje projekt 100", () => k.pay(P(kaw), circle, studio.publicKey, 100, "FV/2/2026"));
  assert.equal((await bal(kaw.publicKey)).balance, -250);
  await step("Drukarnia kupuje u Biura 200", () => k.pay(P(druk), circle, biuro.publicKey, 200, "FV/3/2026"));
  await step("Drukarnia wychodzi (-50)", () => k.leave(P(druk), circle, mint, false));
  await step("Biuro wymienia 50", () => k.redeem(P(biuro), circle, mint, 50));
  console.log("Czekam na termin niewypłacalności Kawiarni (60 s)...");
  await sleep(65_000);
  await step("Ogłoszenie niewypłacalności Kawiarni", () => k.declareDefault(P(biuro), circle, kaw.publicKey));
  assert.equal((await bal(studio.publicKey)).balance, 100 - 50); // +100 ze sprzedaży, -50 z poręczenia
  const s = await k.fetchState(P(payer), circle);
  assert.equal(s.members.reduce((a, m) => a + m.balance, 0) + s.circle.reserveBalance, 0);
  console.log("SMOKE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

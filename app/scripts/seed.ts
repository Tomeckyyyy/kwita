import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { BN } from "@anchor-lang/core";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { UNIT, createCircle, getProgram, invite, join, pda } from "../src/lib/kwita";
import { keypairWallet } from "../src/lib/firms";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const CLUSTER = process.env.CLUSTER ?? "localnet";
const PRESENTER = process.env.PRESENTER ? new PublicKey(process.env.PRESENTER) : null;
const NAMES = ["Drukarnia", "Studio graficzne", "Biuro rachunkowe"];

const connection = new Connection(RPC, "confirmed");
const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8"))),
);

async function fund(to: PublicKey, sol: number) {
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) }),
  );
  await sendAndConfirmTransaction(connection, tx, [payer]);
}

async function main() {
  console.log(`RPC ${RPC}, payer ${payer.publicKey.toBase58()}`);
  const mint = await createMint(connection, payer, payer.publicKey, null, 6);
  console.log("tPLN mint:", mint.toBase58());

  const firms = NAMES.map((name) => ({ name, keypair: Keypair.generate() }));
  for (const [i, f] of firms.entries()) {
    await fund(f.keypair.publicKey, i === 0 ? 0.1 : 0.05); // pierwsza firma zakłada krąg i płaci za konta
    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, f.keypair.publicKey);
    await mintTo(connection, payer, mint, ata.address, payer, 1_000 * UNIT);
  }
  if (PRESENTER) {
    await fund(PRESENTER, 0.2);
    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, PRESENTER);
    await mintTo(connection, payer, mint, ata.address, payer, 1_000 * UNIT);
    console.log("Prezenter (Phantom) zasilony:", PRESENTER.toBase58());
  }

  // Krąg zakłada pierwsza firma demo (Drukarnia): dołącza bez zaproszenia i zaprasza pozostałe.
  // Założyciel nie ma żadnych innych uprawnień. Phantoma prezentera seed NIE zaprasza:
  // w demo zaprasza go na żywo firma z kręgu.
  const [founder, ...others] = firms;
  const creator = getProgram(connection, keypairWallet(founder.keypair));
  const id = new BN(Date.now());
  await createCircle(creator, mint, id, {
    deposit: 200,
    salesLimitBps: 5_000,
    perCounterpartyCap: 300,
    maxSalesCredit: 1_000,
    defaultAfterSecs: 60,
    maxPositiveBalance: 1_500,
  });
  const circle = pda.circle(founder.keypair.publicKey, id);
  console.log(`Krąg: ${circle.toBase58()} (zakłada: ${founder.name})`);

  await join(creator, circle, mint);
  for (const f of others) {
    await invite(creator, circle, f.keypair.publicKey);
    await join(getProgram(connection, keypairWallet(f.keypair)), circle, mint);
  }
  console.log(`${founder.name} zaprosiła: ${others.map((f) => f.name).join(", ")}`);

  mkdirSync("public", { recursive: true });
  writeFileSync(
    "public/demo-firms.json",
    JSON.stringify(firms.map((f) => ({ name: f.name, secretKey: Array.from(f.keypair.secretKey) }))),
  );
  writeFileSync(
    ".env.local",
    `VITE_RPC_URL=${RPC}\nVITE_CLUSTER=${CLUSTER}\nVITE_CIRCLE=${circle.toBase58()}\nVITE_MINT=${mint.toBase58()}\n`,
  );
  console.log("Zapisano public/demo-firms.json i .env.local");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

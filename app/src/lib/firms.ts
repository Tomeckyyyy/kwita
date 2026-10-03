import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { SignerWallet } from "./kwita";

export type DemoFirm = { name: string; keypair: Keypair };

export async function loadDemoFirms(): Promise<DemoFirm[]> {
  const res = await fetch("/demo-firms.json");
  if (!res.ok) return [];
  const list = (await res.json()) as { name: string; secretKey: number[] }[];
  return list.map((f) => ({ name: f.name, keypair: Keypair.fromSecretKey(Uint8Array.from(f.secretKey)) }));
}

export function keypairWallet(kp: Keypair): SignerWallet {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx) => sign(tx),
    signAllTransactions: async (txs) => txs.map(sign),
  };
}

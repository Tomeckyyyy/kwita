import { AnchorProvider, BN, Program } from "@anchor-lang/core";
import { Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import idl from "../idl/kwita.json";
import type { Kwita } from "../idl/kwita";

export const UNIT = 1_000_000;
export const toUnits = (n: number) => new BN(Math.round(n * UNIT));
export const fromUnits = (x: BN | number) => (typeof x === "number" ? x : Number(x.toString())) / UNIT;

export type SignerWallet = {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
};

export function getProgram(connection: Connection, wallet: SignerWallet): Program<Kwita> {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(idl as unknown as Kwita, provider);
}

const PID = new PublicKey((idl as { address: string }).address);
const seed = (s: string) => Buffer.from(s);
const find = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PID)[0];

export const pda = {
  circle: (creator: PublicKey, id: BN) => find([seed("circle"), creator.toBuffer(), id.toArrayLike(Buffer, "le", 8)]),
  vault: (circle: PublicKey) => find([seed("vault"), circle.toBuffer()]),
  member: (circle: PublicKey, owner: PublicKey) => find([seed("member"), circle.toBuffer(), owner.toBuffer()]),
  pair: (circle: PublicKey, seller: PublicKey, buyer: PublicKey) =>
    find([seed("pair"), circle.toBuffer(), seller.toBuffer(), buyer.toBuffer()]),
  guarantee: (circle: PublicKey, guarantor: PublicKey, beneficiary: PublicKey) =>
    find([seed("guarantee"), circle.toBuffer(), guarantor.toBuffer(), beneficiary.toBuffer()]),
};

export type CircleParams = {
  deposit: number;
  salesLimitBps: number;
  perCounterpartyCap: number;
  maxSalesCredit: number;
  defaultAfterSecs: number;
  maxPositiveBalance: number;
};

export type CircleState = {
  address: PublicKey;
  mint: PublicKey;
  vault: PublicKey;
  deposit: number;
  salesLimitBps: number;
  perCounterpartyCap: number;
  maxSalesCredit: number;
  defaultAfterSecs: number;
  maxPositiveBalance: number;
  reserveBalance: number;
  reserveUsdc: number;
  unbackedLoss: number;
};

export type MemberView = {
  address: PublicKey;
  owner: PublicKey;
  balance: number;
  deposit: number;
  countedSales: number;
  guaranteesGiven: number;
  guaranteesReceived: number;
  negativeSince: number;
  status: "active" | "exited" | "defaulted";
};

export async function fetchState(program: Program<Kwita>, circle: PublicKey) {
  const c = await program.account.circle.fetch(circle);
  const ms = await program.account.member.all([{ memcmp: { offset: 8, bytes: circle.toBase58() } }]);
  const circleState: CircleState = {
    address: circle,
    mint: c.collateralMint,
    vault: c.vault,
    deposit: fromUnits(c.depositAmount),
    salesLimitBps: c.salesLimitBps,
    perCounterpartyCap: fromUnits(c.perCounterpartyCap),
    maxSalesCredit: fromUnits(c.maxSalesCredit),
    defaultAfterSecs: Number(c.defaultAfterSecs.toString()),
    maxPositiveBalance: fromUnits(c.maxPositiveBalance),
    reserveBalance: fromUnits(c.reserveBalance),
    reserveUsdc: fromUnits(c.reserveUsdc),
    unbackedLoss: fromUnits(c.unbackedLoss),
  };
  const members: MemberView[] = ms.map(({ publicKey, account: m }) => ({
    address: publicKey,
    owner: m.owner,
    balance: fromUnits(m.balance),
    deposit: fromUnits(m.deposit),
    countedSales: fromUnits(m.countedSales),
    guaranteesGiven: fromUnits(m.guaranteesGiven),
    guaranteesReceived: fromUnits(m.guaranteesReceived),
    negativeSince: Number(m.negativeSince.toString()),
    status: "active" in m.status ? "active" : "exited" in m.status ? "exited" : "defaulted",
  }));
  return { circle: circleState, members };
}

export function limitOf(m: MemberView, c: CircleState): number {
  const sales = Math.min(c.maxSalesCredit, (m.countedSales * c.salesLimitBps) / 10_000);
  return m.deposit + sales + m.guaranteesReceived - m.guaranteesGiven;
}

const me = (program: Program<Kwita>) => program.provider.publicKey!;

/** Transakcja dotarła do sieci, ale program ją odrzucił. Ma podpis, więc widać ją w Explorerze. */
export class ProgramRejection extends Error {
  signature: string;
  logs: string[];
  constructor(signature: string, message: string, logs: string[]) {
    super(message);
    this.name = "ProgramRejection";
    this.signature = signature;
    this.logs = logs;
  }
}

/** Decyzja programu z logów: linia "Kwita: ..." albo komunikat błędu Anchora. */
export function decisionFromLogs(logs: string[]): string | null {
  const kwita = logs.map((l) => l.match(/Program log: (Kwita: .*)$/)?.[1]).filter(Boolean);
  if (kwita.length) return kwita[kwita.length - 1]!;
  const anchor = logs.map((l) => l.match(/Error Message: (.*?)\.?$/)?.[1]).find(Boolean);
  return anchor ?? null;
}

type Sendable = { transaction(): Promise<Transaction> };

/**
 * Podpisuje i wysyła bez symulacji (skipPreflight): także odrzucona transakcja trafia do sieci,
 * więc decyzję programu widać w Explorerze. Przy błędzie programu rzuca ProgramRejection z podpisem.
 */
async function land(program: Program<Kwita>, builder: Sendable): Promise<string> {
  const provider = program.provider as AnchorProvider;
  const connection = provider.connection;
  const tx = await builder.transaction();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = provider.wallet.publicKey;
  tx.recentBlockhash = blockhash;
  const signed = await provider.wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
  const res = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) {
    const logs = await transactionLogs(connection, signature);
    throw new ProgramRejection(signature, decisionFromLogs(logs) ?? "Program odrzucił transakcję.", logs);
  }
  return signature;
}

/** Logi potwierdzonej transakcji (RPC bywa o chwilę w tyle, więc kilka prób). */
export async function transactionLogs(connection: Connection, signature: string): Promise<string[]> {
  for (let i = 0; i < 5; i++) {
    const t = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (t?.meta?.logMessages) return t.meta.logMessages;
    await new Promise((r) => setTimeout(r, 600));
  }
  return [];
}

export function createCircle(program: Program<Kwita>, mint: PublicKey, id: BN, p: CircleParams) {
  const circle = pda.circle(me(program), id);
  return program.methods
    .createCircle(
      id,
      toUnits(p.deposit),
      p.salesLimitBps,
      toUnits(p.perCounterpartyCap),
      toUnits(p.maxSalesCredit),
      new BN(p.defaultAfterSecs),
      toUnits(p.maxPositiveBalance),
    )
    .accountsPartial({
      creator: me(program),
      circle,
      collateralMint: mint,
      vault: pda.vault(circle),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

function tokenAccounts(program: Program<Kwita>, circle: PublicKey, mint: PublicKey) {
  return {
    owner: me(program),
    circle,
    member: pda.member(circle, me(program)),
    collateralMint: mint,
    ownerToken: getAssociatedTokenAddressSync(mint, me(program)),
    vault: pda.vault(circle),
    tokenProgram: TOKEN_PROGRAM_ID,
  };
}

export function join(program: Program<Kwita>, circle: PublicKey, mint: PublicKey) {
  return land(
    program,
    program.methods
      .join()
      .accountsPartial({ ...tokenAccounts(program, circle, mint), systemProgram: SystemProgram.programId }),
  );
}

export function pay(program: Program<Kwita>, circle: PublicKey, seller: PublicKey, amount: number, invoiceRef: string) {
  return land(
    program,
    program.methods.pay(toUnits(amount), invoiceRef).accountsPartial({
      buyer: me(program),
      circle,
      buyerMember: pda.member(circle, me(program)),
      sellerMember: pda.member(circle, seller),
      pair: pda.pair(circle, seller, me(program)),
      reversePair: pda.pair(circle, me(program), seller),
      systemProgram: SystemProgram.programId,
    }),
  );
}

export function giveGuarantee(program: Program<Kwita>, circle: PublicKey, beneficiary: PublicKey, amount: number) {
  return land(
    program,
    program.methods.giveGuarantee(toUnits(amount)).accountsPartial({
      guarantor: me(program),
      circle,
      guarantorMember: pda.member(circle, me(program)),
      beneficiaryMember: pda.member(circle, beneficiary),
      guarantee: pda.guarantee(circle, me(program), beneficiary),
      systemProgram: SystemProgram.programId,
    }),
  );
}

export function withdrawGuarantee(program: Program<Kwita>, circle: PublicKey, beneficiary: PublicKey, amount: number) {
  return land(
    program,
    program.methods.withdrawGuarantee(toUnits(amount)).accountsPartial({
      guarantor: me(program),
      circle,
      guarantorMember: pda.member(circle, me(program)),
      beneficiaryMember: pda.member(circle, beneficiary),
      guarantee: pda.guarantee(circle, me(program), beneficiary),
    }),
  );
}

export function redeem(program: Program<Kwita>, circle: PublicKey, mint: PublicKey, amount: number) {
  return land(program, program.methods.redeem(toUnits(amount)).accountsPartial(tokenAccounts(program, circle, mint)));
}

export function leave(program: Program<Kwita>, circle: PublicKey, mint: PublicKey, forfeit: boolean) {
  return land(program, program.methods.leave(forfeit).accountsPartial(tokenAccounts(program, circle, mint)));
}

export async function declareDefault(program: Program<Kwita>, circle: PublicKey, target: PublicKey) {
  const gs = await program.account.guarantee.all([{ memcmp: { offset: 8 + 32, bytes: target.toBase58() } }]);
  const remaining = gs
    .filter((g) => !g.account.amount.isZero() && pda.guarantee(circle, g.account.guarantor, target).equals(g.publicKey))
    .flatMap((g) => [
      { pubkey: g.publicKey, isWritable: true, isSigner: false },
      { pubkey: pda.member(circle, g.account.guarantor), isWritable: true, isSigner: false },
    ]);
  return land(
    program,
    program.methods
      .declareDefault()
      .accountsPartial({ caller: me(program), circle, member: pda.member(circle, target) })
      .remainingAccounts(remaining),
  );
}

export function errorMessage(e: unknown): string {
  const err = e as { error?: { errorMessage?: string }; message?: string };
  return err?.error?.errorMessage ?? err?.message ?? String(e);
}

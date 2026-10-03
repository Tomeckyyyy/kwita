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
  return program.methods
    .join()
    .accountsPartial({ ...tokenAccounts(program, circle, mint), systemProgram: SystemProgram.programId })
    .rpc();
}

export function pay(program: Program<Kwita>, circle: PublicKey, seller: PublicKey, amount: number, invoiceRef: string) {
  return program.methods
    .pay(toUnits(amount), invoiceRef)
    .accountsPartial({
      buyer: me(program),
      circle,
      buyerMember: pda.member(circle, me(program)),
      sellerMember: pda.member(circle, seller),
      pair: pda.pair(circle, seller, me(program)),
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export function giveGuarantee(program: Program<Kwita>, circle: PublicKey, beneficiary: PublicKey, amount: number) {
  return program.methods
    .giveGuarantee(toUnits(amount))
    .accountsPartial({
      guarantor: me(program),
      circle,
      guarantorMember: pda.member(circle, me(program)),
      beneficiaryMember: pda.member(circle, beneficiary),
      guarantee: pda.guarantee(circle, me(program), beneficiary),
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export function withdrawGuarantee(program: Program<Kwita>, circle: PublicKey, beneficiary: PublicKey, amount: number) {
  return program.methods
    .withdrawGuarantee(toUnits(amount))
    .accountsPartial({
      guarantor: me(program),
      circle,
      guarantorMember: pda.member(circle, me(program)),
      beneficiaryMember: pda.member(circle, beneficiary),
      guarantee: pda.guarantee(circle, me(program), beneficiary),
    })
    .rpc();
}

export function redeem(program: Program<Kwita>, circle: PublicKey, mint: PublicKey, amount: number) {
  return program.methods.redeem(toUnits(amount)).accountsPartial(tokenAccounts(program, circle, mint)).rpc();
}

export function leave(program: Program<Kwita>, circle: PublicKey, mint: PublicKey, forfeit: boolean) {
  return program.methods.leave(forfeit).accountsPartial(tokenAccounts(program, circle, mint)).rpc();
}

export async function declareDefault(program: Program<Kwita>, circle: PublicKey, target: PublicKey) {
  const gs = await program.account.guarantee.all([{ memcmp: { offset: 8 + 32, bytes: target.toBase58() } }]);
  const remaining = gs
    .filter((g) => !g.account.amount.isZero() && pda.guarantee(circle, g.account.guarantor, target).equals(g.publicKey))
    .flatMap((g) => [
      { pubkey: g.publicKey, isWritable: true, isSigner: false },
      { pubkey: pda.member(circle, g.account.guarantor), isWritable: true, isSigner: false },
    ]);
  return program.methods
    .declareDefault()
    .accountsPartial({ caller: me(program), circle, member: pda.member(circle, target) })
    .remainingAccounts(remaining)
    .rpc();
}

export function errorMessage(e: unknown): string {
  const err = e as { error?: { errorMessage?: string }; message?: string };
  return err?.error?.errorMessage ?? err?.message ?? String(e);
}

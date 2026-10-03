const cluster = import.meta.env.VITE_CLUSTER ?? "localnet";
const rpc = import.meta.env.VITE_RPC_URL ?? "http://127.0.0.1:8899";
const suffix = cluster === "devnet" ? "?cluster=devnet" : `?cluster=custom&customUrl=${encodeURIComponent(rpc)}`;
export const txUrl = (sig: string) => `https://explorer.solana.com/tx/${sig}${suffix}`;
export const addrUrl = (a: string) => `https://explorer.solana.com/address/${a}${suffix}`;

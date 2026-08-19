import { rpc } from "@stellar/stellar-sdk";
import { getSorobanRpcUrl } from "@/lib/stellar/soroban-common";

/** Confirm the wallet-submitted hash actually succeeded on testnet before claiming. */
export async function pizzaRedeemTxSucceeded(txHash: string): Promise<boolean> {
  const rpcUrl = getSorobanRpcUrl();
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const tx = await server.getTransaction(txHash);
  return tx.status === "SUCCESS";
}

// frontend/src/X402Provider.jsx 

import { Buffer } from "buffer";
import React, {
  createContext,
  useContext,
  useCallback,
} from "react"; 
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getMint,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";

window.Buffer = Buffer;
export const X402Context = createContext(null);

const isWalletError = (error) => {
  return (
    error.name === "WalletSignTransactionError" ||
    error.name === "WalletSendTransactionError" ||
    error.message.includes("User rejected the request")
  );
};

export function X402Provider({ children }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const executePayment = useCallback(
    async (invoice, memo) => {
      if (!publicKey || !sendTransaction) {
        throw new Error("Dompet tidak terhubung.");
      }

      console.log("Membangun transaksi untuk invoice:", invoice);
      console.log("Memo:", memo);

      const tx = new Transaction();
      const mintPubKey = new PublicKey(invoice.token);
      const recipientWalletPubKey = new PublicKey(invoice.recipientWallet);
      const payerPubKey = publicKey;

      const mintInfo = await getMint(connection, mintPubKey);
      const amountInSmallestUnit = BigInt(
        Math.floor(invoice.amount * Math.pow(10, mintInfo.decimals))
      );

      const payerTokenAccountAddress = await getAssociatedTokenAddress(
        mintPubKey,
        payerPubKey
      );
      const recipientTokenAccountAddress = await getAssociatedTokenAddress(
        mintPubKey,
        recipientWalletPubKey
      );

      try {
        await getAccount(connection, recipientTokenAccountAddress);
      } catch (err) {
        console.log("ATA penerima tidak ada, membuat...");
        tx.add(
          createAssociatedTokenAccountInstruction(
            payerPubKey,
            recipientTokenAccountAddress,
            recipientWalletPubKey,
            mintPubKey
          )
        );
      }

      tx.add(
        createTransferInstruction(
          payerTokenAccountAddress,
          recipientTokenAccountAddress,
          payerPubKey,
          amountInSmallestUnit
        )
      );

      tx.add(
        new TransactionInstruction({
          keys: [{ pubkey: payerPubKey, isSigner: true, isWritable: false }],
          data: Buffer.from(memo, "utf-8"),
          programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        })
      );

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = payerPubKey;

      const signature = await sendTransaction(tx, connection);
      console.log("Transaksi terkirim, menunggu konfirmasi:", signature);
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "finalized"
      );
      console.log("Transaksi di-finalisasi:", signature);
      return signature;
    },
    [connection, publicKey, sendTransaction]
  );

  const fetchWith402 = useCallback(
    async (url, options = {}) => {
      if (!publicKey) {
        throw new Error("Dompet tidak terhubung.");
      }

      const headers = new Headers(options.headers || {});
      headers.append("x402-Payer-Pubkey", publicKey.toBase58());

      const res = await fetch(url, { ...options, headers });

      if (res.ok) {
        console.log("Fetch berhasil (via anggaran atau publik)");
        return res.json(); 
      } else if (res.status === 402) {
        const invoice = await res.json();
        console.log("Menerima faktur 402:", invoice);

        const signature = await executePayment(invoice, invoice.reference);

        const separator = url.includes("?") ? "&" : "?";
        const retryUrl = `${url}${separator}reference=${invoice.reference}`;
        const finalRes = await fetch(retryUrl, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `x402 ${signature}`,
          },
        });

        if (!finalRes.ok) {
          const finalError = await finalRes.json();
          throw new Error(`Verifikasi gagal: ${finalError.error || "Server error"}`);
        }
        return finalRes.json(); 
      } else {
        const errorText = await res.text();
        throw new Error(`HTTP Error: ${res.status} ${res.statusText} - ${errorText}`);
      }
    },
    [publicKey, executePayment]
  );

  const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  const depositBudget = useCallback(
    async (invoiceUrl, amount) => {
      if (!publicKey) {
        throw new Error("Dompet tidak terhubung.");
      }
      
      let invoice;
      const res402 = await fetch(invoiceUrl);
      if (res402.status !== 402) {
        const toolsRes = await fetch(`${API_BASE}/api/agent-tools`);
        const tools = await toolsRes.json();
        if (!tools || tools.length === 0)
          throw new Error("Tidak bisa mendapatkan info invoice 402 untuk setoran.");
        const fallbackRes = await fetch(`${API_BASE}${tools[0].endpoint}`);
        if (fallbackRes.status !== 402)
          throw new Error("Gagal mengambil info invoice 402.");
        invoice = await fallbackRes.json();
      } else {
        invoice = await res402.json();
      }

      const depositInvoice = { ...invoice, amount: amount };
      const depositReference = `DEPOSIT-${invoice.reference}`;
      const signature = await executePayment(depositInvoice, depositReference);

      const confirmRes = await fetch(
        `${API_BASE}/api/confirm-budget-deposit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature,
            reference: depositReference,
            payerPubkey: publicKey.toBase58(),
            amount: amount,
          }),
        }
      );

      if (!confirmRes.ok) {
        const confirmError = await confirmRes.json();
        throw new Error(`Setoran terkirim, tapi konfirmasi backend gagal: ${confirmError.error}`);
      }
      
      const confirmData = await confirmRes.json();
      console.log("Setoran anggaran berhasil:", confirmData);
      return confirmData; 
    },
    [publicKey, executePayment, API_BASE]
  );

  const value = {
    fetchWith402,
    depositBudget,
    API_BASE,
    isWalletError, 
  };

  return <X402Context.Provider value={value}>{children}</X402Context.Provider>;
}
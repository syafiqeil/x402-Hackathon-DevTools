// frontend/src/X402Provider.jsx (FIXED)

import { Buffer } from "buffer";
import React, {
  createContext,
  useState,
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

// Pastikan polyfill buffer global ada (seperti di polyfills.js Anda)
window.Buffer = Buffer;

// INILAH PERBAIKANNYA: Menambahkan 'export'
export const X402Context = createContext(null);

const isWalletError = (error) => {
  return (
    error.name === "WalletSignTransactionError" ||
    error.name === "WalletSendTransactionError" ||
    error.message.includes("User rejected the request")
  );
};

export function X402Provider({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  /**
   * Fungsi helper internal untuk membangun dan mengirim transaksi pembayaran
   */
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

      // Cek apakah ATA penerima ada, jika tidak tambahkan instruksi
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

      // Tambahkan instruksi transfer
      tx.add(
        createTransferInstruction(
          payerTokenAccountAddress,
          recipientTokenAccountAddress,
          payerPubKey,
          amountInSmallestUnit
        )
      );

      // Tambahkan instruksi memo
      tx.add(
        new TransactionInstruction({
          keys: [{ pubkey: payerPubKey, isSigner: true, isWritable: false }],
          data: Buffer.from(memo, "utf-8"),
          programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        })
      );

      // Kirim transaksi
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

  /**
   * Fungsi utama untuk mengambil data yang dilindungi
   */
  const fetchWith402 = useCallback(
    async (url, options = {}) => {
      setIsLoading(true);
      setError(null);

      if (!publicKey) {
        setError("Dompet tidak terhubung.");
        setIsLoading(false);
        return null;
      }

      try {
        // IMPROVISASI #1: Coba akses dengan header anggaran
        const headers = new Headers(options.headers || {});
        headers.append("x402-Payer-Pubkey", publicKey.toBase58());

        const res = await fetch(url, { ...options, headers });

        if (res.ok) {
          // BERHASIL! Dibayar via anggaran atau rute publik
          console.log("Fetch berhasil (via anggaran atau publik)");
          const jsonData = await res.json();
          setIsLoading(false);
          return jsonData;
        } else if (res.status === 402) {
          // PEMBAYARAN DIPERLUKAN (Anggaran habis atau tidak ada)
          const invoice = await res.json();
          console.log("Menerima faktur 402:", invoice);

          // 1. Bayar
          const signature = await executePayment(invoice, invoice.reference);

          // 2. Coba lagi (Retry) dengan bukti bayar
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

          const finalJsonData = await finalRes.json();
          setIsLoading(false);
          return finalJsonData;
        } else {
          throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
        }
      } catch (err) {
        console.error(err);
        if (isWalletError(err)) {
          setError("Transaksi dibatalkan oleh pengguna.");
        } else {
          setError(err.message);
        }
        setIsLoading(false);
        return null;
      }
    },
    [publicKey, executePayment]
  );
  
  // Ambil API_BASE dari env
  const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  /**
   * IMPROVISASI #1: Fungsi untuk menyetor anggaran
   */
  const depositBudget = useCallback(
    async (invoiceUrl, amount) => {
      setIsLoading(true);
      setError(null);

      if (!publicKey) {
        setError("Dompet tidak terhubung.");
        setIsLoading(false);
        return null;
      }

      try {
        // 1. Dapatkan info invoice untuk detail pembayaran
         const res402 = await fetch(invoiceUrl);
         if(res402.status !== 402) {
            // Coba ambil dari /api/agent-tools jika endpoint pertama tidak 402
            const toolsRes = await fetch(`${API_BASE}/api/agent-tools`);
            const tools = await toolsRes.json();
            if(!tools || tools.length === 0) throw new Error("Tidak bisa mendapatkan info invoice 402 untuk setoran.");
            // Panggil 402 secara manual
            const fallbackRes = await fetch(`${API_BASE}${tools[0].endpoint}`);
            if(fallbackRes.status !== 402) throw new Error("Gagal mengambil info invoice 402.");
            invoice = await fallbackRes.json();
         } else {
            invoice = await res402.json();
         }


        // 2. Modifikasi invoice untuk setoran
        const depositInvoice = {
          ...invoice,
          amount: amount, // Gunakan jumlah setoran
        };
        const depositReference = `DEPOSIT-${invoice.reference}`; // Memo unik

        // 3. Lakukan pembayaran
        const signature = await executePayment(depositInvoice, depositReference);

        // 4. Konfirmasi setoran ke backend
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
        setIsLoading(false);
        return confirmData;
      } catch (err) {
        console.error(err);
        if (isWalletError(err)) {
          setError("Transaksi dibatalkan oleh pengguna.");
        } else {
          setError(err.message);
        }
        setIsLoading(false);
        return null;
      }
    },
    [publicKey, executePayment, API_BASE] // Tambahkan API_BASE ke dependensi
  );

  const value = {
    isLoading,
    error,
    fetchWith402,
    depositBudget,
    API_BASE,
  };

  return <X402Context.Provider value={value}>{children}</X402Context.Provider>;
}
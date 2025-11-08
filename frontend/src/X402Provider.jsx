// frontend/src/X402Provider.jsx

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

const X402Context = createContext(null);

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
        const res = await fetch(invoiceUrl, {
            headers: { "x402-Payer-Pubkey": publicKey.toBase58() }
        });
        if (res.status !== 402 && res.status !== 200) {
            // Jika 200, berarti anggaran sudah ada, kita tetap bisa dapat info dari body
             if(res.status !== 200) throw new Error("Gagal mengambil info invoice untuk setoran.");
        }
        
        // Kita hanya butuh info, jadi kita 'pura-pura' 402
        let invoice;
        if(res.status === 402) {
            invoice = await res.json();
        } else {
            // Jika 200 OK (karena anggaran sudah ada), server harusnya tetap
            // mengirim info pembayaran. Mari kita asumsikan kita perlu endpoint
            // /api/agent-tools untuk info ini.
            // UNTUK HACKATHON: Kita asumsikan SEMUA endpoint berbayar menggunakan
            // token dan penerima yang SAMA. Jadi kita panggil 402 saja.
             const res402 = await fetch(invoiceUrl);
             if(res402.status !== 402) throw new Error("Tidak bisa mendapatkan invoice 402 untuk setoran.");
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
    [publicKey, executePayment]
  );
  
  // Ambil API_BASE dari env
  const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  const value = {
    isLoading,
    error,
    fetchWith402,
    depositBudget,
    API_BASE,
  };

  return <X402Context.Provider value={value}>{children}</X402Context.Provider>;
}

/**
 * Hook kustom untuk mengakses X402 context
 */
export const useX402 = () => {
  const context = useContext(X402Context);
  if (!context) {
    throw new Error("useX402 harus digunakan di dalam X402Provider");
  }
  return context;
};
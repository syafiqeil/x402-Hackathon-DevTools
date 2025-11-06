// frontend/src/useX402.js 

import { useState } from "react";
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
} from "@solana/spl-token";

// Untuk mendeteksi error spesifik dari dompet
const isWalletError = (error) => {
  return error.name === 'WalletSignTransactionError' || 
         error.name === 'WalletSendTransactionError' ||
         error.message.includes('User rejected the request');
};

export function useX402(url) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      // 1. COBA AKSES RESOURCE
      const res = await fetch(url);

      if (res.ok) {
        setData(await res.json());
      } else if (res.status === 402) {
        // 2. PEMBAYARAN DIPERLUKAN!
        const invoice = await res.json();
        console.log("Menerima faktur 402:", invoice);

        if (!publicKey || !sendTransaction) {
          setError("Dompet tidak terhubung. Silakan hubungkan dompet Anda.");
          throw new Error("Dompet tidak terhubung.");
        }

        // 3. BANGUN TRANSAKSI
        const tx = new Transaction();

        // Alamat yang diperlukan
        const mintPubKey = new PublicKey(invoice.token);
        const recipientPubKey = new PublicKey(invoice.recipient); // Ini adalah ATA penerima
        const payerPubKey = publicKey;

        const mintInfo = await getMint(connection, mintPubKey);
        const amountInSmallestUnit = invoice.amount * Math.pow(10, mintInfo.decimals);

        // Cari alamat token account (ATA) pembayar
        const payerTokenAccount = await getAssociatedTokenAddress(
          mintPubKey,
          payerPubKey
        );

        // Tambahkan instruksi untuk MEMBUAT ATA jika belum ada.
        // Ini adalah langkah 'idempotent' dan sangat penting.
        tx.add(
          createAssociatedTokenAccountInstruction(
            payerPubKey, // Payer (yang bayar gas)
            payerTokenAccount, // Alamat ATA baru/yang sudah ada
            payerPubKey, // Pemilik ATA
            mintPubKey // Mint token
          )
        );

        // Buat instruksi transfer token
        tx.add(
          createTransferInstruction(
            payerTokenAccount, // Dari (ATA pembayar)
            recipientPubKey, // Ke (ATA penerima)
            payerPubKey, // Otoritas (dompet pembayar)
            amountInSmallestUnit
          )
        );

        // Buat instruksi memo
        tx.add(
          new TransactionInstruction({
            keys: [{ pubkey: payerPubKey, isSigner: true, isWritable: true }],
            data: Buffer.from(invoice.reference, "utf-8"),
            programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcVtrnbMpsBwiHggz"),
          })
        );
        
        // 4. KIRIM TRANSAKSI 
        let signature;
        try {
          console.log("Meminta persetujuan transaksi...");
          signature = await sendTransaction(tx, connection);
          await connection.confirmTransaction(signature, "confirmed");
          console.log("Transaksi dikonfirmasi:", signature);
        } catch (walletError) {
          // Tangkap error jika pengguna menolak
          if (isWalletError(walletError)) {
            console.log("Pengguna menolak transaksi.");
            setError("Transaksi dibatalkan oleh pengguna.");
          } else {
            console.error("Error saat mengirim transaksi:", walletError);
            setError("Gagal mengirim transaksi. Coba lagi.");
          }
          throw walletError; // Hentikan eksekusi
        }

        // 5. COBA LAGI (Retry) DENGAN BUKTI BAYAR
        const retryUrl = `${url}?reference=${invoice.reference}`;
        const finalRes = await fetch(retryUrl, {
          headers: {
            Authorization: `x402 ${signature}`,
          },
        });

        if (!finalRes.ok) {
          const finalError = await finalRes.json();
          throw new Error(`Pembayaran terkirim, tapi verifikasi gagal: ${finalError.error || 'Server error'}`);
        }

        setData(await finalRes.json());
      } else {
        throw new Error(`HTTP Error: ${res.status}`);
      }
    } catch (err) {
      console.error(err);
      // Tampilkan error yang sudah kita set sebelumnya, atau pesan default
      if (!error) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, fetchData };
}
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
  getAccount,
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

        // Validasi invoice
        if (!invoice.token || !invoice.recipient || !invoice.reference) {
          throw new Error("Invoice tidak lengkap. Pastikan backend mengirim token, recipient, dan reference.");
        }

        // Validasi publicKey dari wallet
        if (!publicKey) {
          throw new Error("Wallet publicKey tidak tersedia. Pastikan wallet terhubung.");
        }

        console.log("Invoice diterima:", invoice);
        console.log("PublicKey wallet:", publicKey?.toBase58());

        // Alamat yang diperlukan - dengan error handling
        let mintPubKey, recipientPubKey;
        try {
          const tokenStr = String(invoice.token).trim();
          console.log("Membuat PublicKey untuk token:", tokenStr);
          mintPubKey = new PublicKey(tokenStr);
          console.log("Token PublicKey berhasil:", mintPubKey.toBase58());
        } catch (err) {
          console.error("Error membuat PublicKey untuk token:", err);
          throw new Error(`Token mint address tidak valid: ${invoice.token}. Error: ${err.message}`);
        }
        
        try {
          const recipientStr = String(invoice.recipient).trim();
          console.log("Membuat PublicKey untuk recipient:", recipientStr);
          recipientPubKey = new PublicKey(recipientStr); // Ini adalah ATA penerima
          console.log("Recipient PublicKey berhasil:", recipientPubKey.toBase58());
        } catch (err) {
          console.error("Error membuat PublicKey untuk recipient:", err);
          throw new Error(`Recipient address tidak valid: ${invoice.recipient}. Error: ${err.message}`);
        }
        
        const payerPubKey = publicKey;
        console.log("Payer PublicKey:", payerPubKey.toBase58());

        const mintInfo = await getMint(connection, mintPubKey);
        const amountInSmallestUnit = invoice.amount * Math.pow(10, mintInfo.decimals);

        // Cari alamat token account (ATA) pembayar
        const payerTokenAccountAddress = await getAssociatedTokenAddress(
          mintPubKey,
          payerPubKey
        );

        // Cek apakah ATA pembayar sudah ada dan punya saldo
        let payerTokenAccountInfo = null;
        let payerTokenAccountExists = false;
        try {
          payerTokenAccountInfo = await getAccount(connection, payerTokenAccountAddress);
          payerTokenAccountExists = true;
          
          // Cek apakah saldo cukup
          if (payerTokenAccountInfo.amount < BigInt(amountInSmallestUnit)) {
            throw new Error(`Saldo token tidak cukup. Diperlukan: ${invoice.amount}, Tersedia: ${Number(payerTokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals)}`);
          }
        } catch (err) {
          if (err.message.includes('Saldo token tidak cukup')) {
            setError(err.message);
            throw err;
          }
          // Account tidak ada, perlu dibuat
          payerTokenAccountExists = false;
        }

        // Tambahkan instruksi untuk MEMBUAT ATA hanya jika belum ada
        if (!payerTokenAccountExists) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              payerPubKey, // Payer (yang bayar gas)
              payerTokenAccountAddress, // Alamat ATA baru
              payerPubKey, // Pemilik ATA
              mintPubKey // Mint token
            )
          );
        }

        // Buat instruksi transfer token
        tx.add(
          createTransferInstruction(
            payerTokenAccountAddress, // Dari (ATA pembayar)
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
          // Dapatkan konteks blockhash terbaru dan set ke transaksi
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.feePayer = payerPubKey;
          signature = await sendTransaction(tx, connection);
          await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed"
          );
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
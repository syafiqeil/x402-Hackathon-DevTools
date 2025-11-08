// frontend/src/useX402.js 

import { Buffer } from 'buffer';
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

// untuk mendeteksi error spesifik dari dompet
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
      // 1. coba akses resource
      const res = await fetch(url);

      if (res.ok) {
        setData(await res.json());
      } else if (res.status === 402) {
        // 2. pembayaran diperlukan!
        const invoice = await res.json();
        console.log("Menerima faktur 402:", invoice);

        if (!publicKey || !sendTransaction) {
          setError("Dompet tidak terhubung. Silakan hubungkan dompet Anda.");
          throw new Error("Dompet tidak terhubung.");
        }

        // 3. bangun transaksi
        const tx = new Transaction();

        // validasi invoice 
        if (!invoice.token || !invoice.recipientWallet || !invoice.reference) {
          throw new Error("Invoice tidak lengkap. Pastikan backend mengirim token, recipientWallet, dan reference.");
        }

        // validasi publicKey dari wallet
        if (!publicKey) {
          throw new Error("Wallet publicKey tidak tersedia. Pastikan wallet terhubung.");
        }

        console.log("Invoice diterima:", invoice);
        console.log("PublicKey wallet:", publicKey?.toBase58());

        let mintPubKey, recipientWalletPubKey; 
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
          const recipientStr = String(invoice.recipientWallet).trim(); 
          console.log("Membuat PublicKey untuk recipient WALLET:", recipientStr);
          recipientWalletPubKey = new PublicKey(recipientStr);
          console.log("Recipient Wallet PublicKey berhasil:", recipientWalletPubKey.toBase58());
        } catch (err) {
          console.error("Error membuat PublicKey untuk recipient wallet:", err);
          throw new Error(`Recipient wallet address tidak valid: ${invoice.recipientWallet}. Error: ${err.message}`);
        }
    
        const payerPubKey = publicKey;
        console.log("Payer PublicKey:", payerPubKey.toBase58());

        console.log("Mengambil mint info...");
        const mintInfo = await getMint(connection, mintPubKey);
        console.log("Mint info berhasil:", mintInfo);
        const amountInSmallestUnit = BigInt(Math.floor(invoice.amount * Math.pow(10, mintInfo.decimals)));
        console.log("Amount in smallest unit:", amountInSmallestUnit.toString(), "type:", typeof amountInSmallestUnit);

        // cari alamat token account ATA pembayar
        console.log("Menghitung ATA pembayar...");
        const payerTokenAccountAddress = await getAssociatedTokenAddress(
          mintPubKey,
          payerPubKey
        );
        console.log("ATA pembayar:", payerTokenAccountAddress.toBase58());

        console.log("Menghitung ATA penerima...");
        const recipientTokenAccountAddress = await getAssociatedTokenAddress(
          mintPubKey,
          recipientWalletPubKey 
        );
        console.log("ATA recipient (dihitung):", recipientTokenAccountAddress.toBase58());
     
        console.log("ATA recipient (dari invoice):", recipientTokenAccountAddress.toBase58()); 

        // validasi: ATA pembayar tidak boleh sama dengan ATA recipient
        if (payerTokenAccountAddress.equals(recipientTokenAccountAddress)) { 
          throw new Error("Error: Wallet pembayar dan wallet penerima sama!");
        }

        // cek apakah ATA pembayar sudah ada dan punya saldo
        let payerTokenAccountInfo = null;
        let payerTokenAccountExists = false;
        try {
          console.log("Mengecek apakah ATA pembayar sudah ada...");
          payerTokenAccountInfo = await getAccount(connection, payerTokenAccountAddress);
          console.log("ATA pembayar sudah ada, saldo:", payerTokenAccountInfo.amount.toString());
          payerTokenAccountExists = true;
          
          // cek apakah saldo cukup
          if (payerTokenAccountInfo.amount < BigInt(amountInSmallestUnit)) {
            throw new Error(`Saldo token tidak cukup. Diperlukan: ${invoice.amount}, Tersedia: ${Number(payerTokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals)}`);
          }
        } catch (err) {
          console.log("Error saat cek ATA pembayar:", err.message);
          if (err.message.includes('Saldo token tidak cukup')) {
            setError(err.message);
            throw err;
          }
          if (err.message.includes('Invalid public key')) {
            console.error("Invalid public key error di getAccount:", err);
            throw new Error(`Error saat mengakses token account: ${err.message}`);
          }
          // account tidak ada, perlu dibuat
          console.log("ATA pembayar belum ada, akan dibuat");
          payerTokenAccountExists = false;
        }

        // tambahkan instruksi untuk membuat ATA hanya jika belum ada
        if (!payerTokenAccountExists) {
          console.log("Menambahkan instruksi create ATA...");
          try {
            tx.add(
              createAssociatedTokenAccountInstruction(
                payerPubKey, 
                payerTokenAccountAddress, 
                payerPubKey,
                mintPubKey
              )
            );
            console.log("Instruksi create ATA berhasil ditambahkan");
          } catch (err) {
            console.error("Error saat membuat instruksi create ATA:", err);
            throw new Error(`Error saat membuat instruksi create ATA: ${err.message}`);
          }
        }

        try {
          console.log("Mengecek apakah ATA penerima sudah ada...");
          await getAccount(connection, recipientTokenAccountAddress); 
          console.log("ATA penerima sudah ada.");
        } catch (err) {
          if (err.name === 'TokenAccountNotFoundError' || err.message.includes('Account does not exist') || err.message.includes('Invalid account owner')) {
            console.log("ATA penerima belum ada, menambahkan instruksi untuk membuatnya...");
            tx.add(
              createAssociatedTokenAccountInstruction(
                payerPubKey,                
                recipientTokenAccountAddress, 
                recipientWalletPubKey,    
                mintPubKey                
              )
            );
            console.log("Instruksi create ATA penerima berhasil ditambahkan");
          } else {
            // error lain yang tidak terduga
            console.error("Error saat cek ATA penerima:", err);
            throw new Error(`Error saat cek ATA penerima: ${err.message}`);
          }
        }

        // buat instruksi transfer token
        console.log("Menambahkan instruksi transfer token...");
        try {
          tx.add(
            createTransferInstruction(
              payerTokenAccountAddress,   
              recipientTokenAccountAddress, 
              payerPubKey,                
              amountInSmallestUnit
            )
          );
          console.log("Instruksi transfer token berhasil ditambahkan");
        } catch (err) {
          console.error("Error saat membuat instruksi transfer:", err);
          throw new Error(`Error saat membuat instruksi transfer: ${err.message}`);
        }

        // buat instruksi memo
        console.log("Menambahkan instruksi memo...");
        
        console.log(`DEBUG: Mengecek 'window.Buffer'`);
        if (typeof window.Buffer === 'undefined') {
          console.error('DEBUG: window.Buffer IS UNDEFINED. Ini adalah penyebab error.');
        } else {
          console.log('DEBUG: window.Buffer IS DEFINED.');
        }
        
        console.log(`DEBUG: Mengecek 'global'`);
        if (typeof global === 'undefined') {
          console.error('DEBUG: global IS UNDEFINED. Ini juga bisa jadi penyebab.');
        } else {
          console.log('DEBUG: global IS DEFINED.');
        }

        try {
          let memoProgramId;
          try {
            memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
            
            console.log("Memo program ID berhasil:", memoProgramId.toBase58());
            
            console.log("Membuat buffer untuk memo data...");
            const memoData = Buffer.from(invoice.reference, "utf-8");
            console.log("Memo data:", memoData.toString());
            
            console.log("Membuat TransactionInstruction untuk memo...");
          
            const memoInstruction = new TransactionInstruction({
              keys: [{ pubkey: payerPubKey, isSigner: true, isWritable: false }], 
              data: memoData,
              programId: memoProgramId,
            });
            
            console.log("Memo instruction berhasil dibuat, menambahkan ke transaksi...");
            tx.add(memoInstruction);
            console.log("Instruksi memo berhasil ditambahkan");
            
          } catch (pubKeyErr) {
            console.error("Error saat membuat instruksi memo:", pubKeyErr); 
            setError(`Gagal membuat instruksi memo: ${pubKeyErr.message}`);
            throw pubKeyErr; 
          }
        } catch (err) {
          console.error("Error saat membuat instruksi memo:", err);
          setError(`Gagal membuat instruksi memo: ${err.message}`);
          throw err; 
        }
        
        // 4. kirim transaksi
        let signature;
        try {
          console.log("Meminta persetujuan transaksi...");
          console.log("Jumlah instruksi dalam transaksi:", tx.instructions.length);
          console.log("Instruksi:", tx.instructions.map((ix, idx) => ({
            index: idx,
            programId: ix.programId?.toBase58(),
            keys: ix.keys?.length,
            dataLength: ix.data?.length
          })));
          
          // dapatkan konteks blockhash terbaru dan set ke transaksi
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.feePayer = payerPubKey;
          
          console.log("Mengirim transaksi ke wallet...");
          console.log("Transaksi detail:", {
            recentBlockhash: tx.recentBlockhash,
            feePayer: tx.feePayer?.toBase58(),
            numInstructions: tx.instructions.length,
            numSigners: tx.signers?.length || 0
          });
          
          // pastikan transaksi memiliki signer yang benar
          console.log("Memverifikasi instruksi memiliki signer...");
          tx.instructions.forEach((ix, idx) => {
            const hasSigner = ix.keys.some(key => key.isSigner);
            console.log(`Instruksi ${idx}: programId=${ix.programId?.toBase58()}, hasSigner=${hasSigner}, keys=${ix.keys.length}`);
            if (!hasSigner) {
              console.warn(`Instruksi ${idx} tidak memiliki signer!`);
            }
          });
          
          // pastikan feePayer ada sebagai signer di transaksi
          console.log("Menyiapkan transaksi untuk wallet adapter...");
          
          // validasi transaksi sebelum dikirim
          if (!tx.recentBlockhash) {
            throw new Error("Transaksi tidak memiliki recentBlockhash");
          }
          if (!tx.feePayer) {
            throw new Error("Transaksi tidak memiliki feePayer");
          }
          if (tx.instructions.length === 0) {
            throw new Error("Transaksi tidak memiliki instruksi");
          }
          
          // cek apakah semua instruksi memiliki signer
          const allHaveSigner = tx.instructions.every(ix => ix.keys.some(key => key.isSigner));
          if (!allHaveSigner) {
            console.warn("Beberapa instruksi tidak memiliki signer, tapi melanjutkan...");
          }
          
          console.log("Transaksi valid, mengirim ke wallet...");
          
          try {
            const serialized = tx.serialize({
              requireAllSignatures: false,
              verifySignatures: false
            });
            console.log("Transaksi bisa di-serialize (validasi), ukuran:", serialized.length, "bytes");
          } catch (serializeError) {
            console.error("Error saat serialize transaksi:", serializeError);
            throw new Error(`Transaksi tidak valid: ${serializeError.message}`);
          }
          
          // pastikan wallet terhubung dan ready
          if (!publicKey) {
            throw new Error("Wallet tidak terhubung");
          }
          if (!sendTransaction) {
            throw new Error("sendTransaction tidak tersedia");
          }
          
          console.log("Wallet ready, publicKey:", publicKey.toBase58());
          console.log("Mengirim transaksi ke wallet adapter (tanpa serialize)...");
          
          // kirim transaksi UNSERIALIZED ke wallet adapter
          // wallet adapter akan serialize dan sign transaksi
          signature = await sendTransaction(tx, connection);
          console.log("Transaksi berhasil dikirim, signature:", signature);
          console.log("Menunggu konfirmasi...");
          
          try {
            await connection.confirmTransaction(
              { signature, blockhash, lastValidBlockHeight },
              "finalized"
            );
            console.log("Transaksi di-finalisasi:", signature);
          } catch (confirmError) {
            console.error("Error saat konfirmasi transaksi:", confirmError);
            // cek apakah transaksi benar-benar gagal atau hanya timeout
            const txStatus = await connection.getSignatureStatus(signature);
            console.log("Status transaksi:", txStatus);
            
            if (txStatus.value?.err) {
              throw new Error(`Transaksi gagal di blockchain: ${JSON.stringify(txStatus.value.err)}`);
            } else if (txStatus.value?.confirmationStatus === 'confirmed' || txStatus.value?.confirmationStatus === 'finalized') {
              console.log("Transaksi sebenarnya sudah confirmed, melanjutkan...");
            } else {
              throw new Error(`Transaksi belum dikonfirmasi: ${confirmError.message}`);
            }
          }
        } catch (walletError) {
          console.error("Error detail:", {
            name: walletError?.name,
            message: walletError?.message,
            stack: walletError?.stack,
            error: walletError
          });
          
          // jika sudah ada signature, berarti transaksi sudah dikirim
          if (signature) {
            console.log("Transaksi sudah dikirim dengan signature:", signature);
            console.log("Tapi terjadi error saat konfirmasi. Cek status transaksi...");
            try {
              const txStatus = await connection.getSignatureStatus(signature);
              console.log("Status transaksi:", txStatus);
              if (txStatus.value?.err) {
                setError(`Transaksi gagal di blockchain: ${JSON.stringify(txStatus.value.err)}. Signature: ${signature}`);
              } else {
                setError(`Transaksi dikirim tapi konfirmasi gagal. Signature: ${signature}. Cek di Solana Explorer.`);
              }
            } catch (statusError) {
              setError(`Transaksi dikirim (signature: ${signature}) tapi terjadi error: ${walletError.message}`);
            }
          } else {
            // tangkap error jika pengguna menolak
            if (isWalletError(walletError)) {
              console.log("Pengguna menolak transaksi atau wallet error.");
              setError("Transaksi dibatalkan oleh pengguna atau wallet error. Pastikan popup Phantom muncul dan Anda approve transaksi.");
            } else {
              console.error("Error saat mengirim transaksi:", walletError);
              setError(`Gagal mengirim transaksi: ${walletError.message || 'Unknown error'}. Coba lagi.`);
            }
          }
          throw walletError; // hentikan eksekusi
        }

        // 5. coba lagi (retry) dengan bukti bayar
        const separator = url.includes('?') ? '&' : '?';
        const retryUrl = `${url}${separator}reference=${invoice.reference}`;
        
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
      // tampilkan error yang sudah di set sebelumnya, atau pesan default
      if (!error) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, fetchData };
}
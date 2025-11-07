// backend/x402-paywall.js

const {
  Connection,
  clusterApiUrl,
  PublicKey,
} = require("@solana/web3.js");
const { getAssociatedTokenAddress, getAccount } = require("@solana/spl-token");
const { randomUUID } = require("crypto");
const bs58 = require("bs58");
let kvClient = null; 

// --- KONFIGURASI ---
const SOLANA_NETWORK = "devnet";
const connection = new Connection(clusterApiUrl(SOLANA_NETWORK), "confirmed");

/**
 * Factory function untuk membuat middleware x402
 * @param {number} amount - Jumlah token yang dibutuhkan
 */
function x402Paywall(amount) {
  return async (req, res, next) => {
    try {
      // Validasi konfigurasi penting
      const { SPL_TOKEN_MINT: MINT_STR, MY_WALLET_ADDRESS: RECIPIENT_OWNER_STR } = process.env;
      if (!MINT_STR || !RECIPIENT_OWNER_STR) {
        return res.status(500).json({ error: "Server not configured (missing SPL_TOKEN_MINT/MY_WALLET_ADDRESS)" });
      }
      
      let SPL_TOKEN_MINT, MY_WALLET_ADDRESS;
      try {
        SPL_TOKEN_MINT = new PublicKey(MINT_STR.trim());
      } catch (err) {
        console.error("Invalid SPL_TOKEN_MINT:", MINT_STR, err);
        return res.status(500).json({ error: `Invalid SPL_TOKEN_MINT: ${MINT_STR}` });
      }
      
      try {
        MY_WALLET_ADDRESS = new PublicKey(RECIPIENT_OWNER_STR.trim());
      } catch (err) {
        console.error("Invalid MY_WALLET_ADDRESS:", RECIPIENT_OWNER_STR, err);
        return res.status(500).json({ error: `Invalid MY_WALLET_ADDRESS: ${RECIPIENT_OWNER_STR}` });
      }
      const kvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
      if (kvConfigured && !kvClient) {
        ({ kv: kvClient } = require("@vercel/kv"));
      }
      // fallback in-memory store saat KV belum dikonfigurasi (dev/demo)
      global.__usedRefs = global.__usedRefs || new Set();
      // 1. LIHAT JIKA ADA BUKTI PEMBAYARAN (VERIFICATION PATH)
      const authHeader = req.headers["authorization"];
      const signature = authHeader && authHeader.startsWith("x402 ")
        ? authHeader.split(" ")[1]
        : null;
      const reference = req.query.reference ? req.query.reference.toString() : null;

      if (signature && reference) {
        // 1. Cek apakah referensi sudah pernah digunakan (MENGGUNAKAN VERCEL KV)
        let isUsed = false;
        if (kvConfigured && kvClient) {
          isUsed = await kvClient.get(reference);
        } else {
          isUsed = global.__usedRefs.has(reference);
        }
        if (isUsed) {
          return res.status(401).json({ error: "Pembayaran sudah diklaim" });
        }

        console.log(`Verifikasi pembayaran: sig=${signature}, ref=${reference}`);

        const tx = await connection.getParsedTransaction(signature, "confirmed");

        if (!tx) {
          return res.status(401).json({ error: "Transaksi tidak ditemukan" });
        }

        if (tx.meta && tx.meta.err) {
          console.warn("Pembayaran ditolak: Transaksi on-chain GAGAL.");
          return res.status(401).json({ error: "Transaksi pembayaran gagal di blockchain" });
        }

        // Ambil memo
        const memoInstruction = tx.transaction.message.instructions.find(
          (ix) => ix.programId.toBase58() === "MemoSq4gqABAXKb96qnH8TysNcVtrnbMpsBwiHggz"
        );
        const memo = memoInstruction ? bs58.decode(memoInstruction.data).toString('utf-8') : null;
        
        // 1. Dapatkan info mint untuk desimal
        let decimals;
        try {
          const mintInfo = await connection.getParsedAccountInfo(SPL_TOKEN_MINT);
          decimals = mintInfo.value.data.parsed.info.decimals;
        } catch (e) {
          console.error("Gagal mengambil info mint:", e);
          return res.status(500).json({ error: "Gagal memvalidasi mint token" });
        }
        const requiredAmountSmallestUnit = BigInt(Math.floor(amount * Math.pow(10, decimals)));

        // 2. Temukan saldo sebelum dan sesudah untuk wallet penerima
        const preBalance = tx.meta.preTokenBalances.find(
          b => b.owner === RECIPIENT_OWNER_STR && b.mint === MINT_STR
        );
        const postBalance = tx.meta.postTokenBalances.find(
          b => b.owner === RECIPIENT_OWNER_STR && b.mint === MINT_STR
        );

        // 3. Hitung jumlah yang diterima
        const preAmount = preBalance ? BigInt(preBalance.uiTokenAmount.amount) : 0n;
        const postAmount = postBalance ? BigInt(postBalance.uiTokenAmount.amount) : 0n;
        const amountReceived = postAmount - preAmount;

        console.log(`Verifikasi Saldo: Owner ${RECIPIENT_OWNER_STR}, Saldo Awal: ${preAmount}, Saldo Akhir: ${postAmount}, Diterima: ${amountReceived}, Dibutuhkan: ${requiredAmountSmallestUnit}`);
        
        // --- VALIDASI PEMBAYARAN ---
        const isAmountValid = amountReceived === requiredAmountSmallestUnit;
        const isReferenceValid = memo === reference; // Tetap wajibkan memo

        console.log(`Validasi: Amount (${isAmountValid}), Reference (${isReferenceValid}), Memo: ${memo || 'TIDAK ADA'}`);

        if (isAmountValid && isReferenceValid) {
          // PEMBAYARAN BERHASIL! Simpan referensi...
          if (kvConfigured && kvClient) {
            await kvClient.set(reference, true, { ex: 300 });
          } else {
            global.__usedRefs.add(reference);
          }
          
          console.log("Pembayaran valid via tokenBalances. Akses diberikan.");
          next();
        } else {
          let errorMsg = "Pembayaran tidak valid.";
          if (!isAmountValid) errorMsg = `Jumlah token salah. Diterima: ${amountReceived}, Dibutuhkan: ${requiredAmountSmallestUnit}`;
          else if (!isReferenceValid) errorMsg = `Memo referensi tidak cocok atau tidak ada. Memo: ${memo}`;
          
          return res.status(401).json({ error: errorMsg });
        }
      } else {
        console.log("Tidak ada bukti bayar. Mengirim tantangan 402.");

        const newReference = randomUUID();
        const invoice = {
          protocol: "x402",
          recipientWallet: MY_WALLET_ADDRESS.toBase58(), 
          amount: amount,
          token: SPL_TOKEN_MINT.toBase58(),
          reference: newReference,
        };
       
        return res.status(402).json(invoice);
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

module.exports = { x402Paywall };
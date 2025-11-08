// backend/x402-paywall.js

const {
  Connection,
  clusterApiUrl,
  PublicKey,
} = require("@solana/web3.js");
const { getAssociatedTokenAddress, getAccount } = require("@solana/spl-token");
const { randomUUID } = require("crypto");
let kvClient = null; 

const SOLANA_NETWORK = "devnet";
const connection = new Connection(clusterApiUrl(SOLANA_NETWORK), "confirmed");

/**
 * factory function untuk membuat middleware x402
 * @param {object} options
 * @param {number} options.amount - jumlah token yang dibutuhkan
 * @param {string} options.splToken - alamat string dari SPL Token Mint
 * @param {string} options.recipientWallet - alamat string dari dompet penerima
 */
function x402Paywall({ amount, splToken, recipientWallet }) {
  return async (req, res, next) => {
    try {
      // validasi konfigurasi penting
      const MINT_STR = splToken;
      const RECIPIENT_OWNER_STR = recipientWallet;
      
      if (!amount || !MINT_STR || !RECIPIENT_OWNER_STR) {
        return res.status(500).json({ error: "x402Paywall middleware not configured (missing amount, splToken, or recipientWallet)" });
      }
      
      let SPL_TOKEN_MINT, MY_WALLET_ADDRESS;
      try {
        SPL_TOKEN_MINT = new PublicKey(MINT_STR.trim());
      } catch (err) {
        console.error("Invalid splToken:", MINT_STR, err);
        return res.status(500).json({ error: `Invalid splToken: ${MINT_STR}` });
      }
      
      try {
        MY_WALLET_ADDRESS = new PublicKey(RECIPIENT_OWNER_STR.trim());
      } catch (err) {
        console.error("Invalid recipientWallet:", RECIPIENT_OWNER_STR, err);
        return res.status(500).json({ error: `Invalid recipientWallet: ${RECIPIENT_OWNER_STR}` });
      }
      
      const kvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
      if (kvConfigured && !kvClient) {
        ({ kv: kvClient } = require("@vercel/kv"));
      }
      // fallback in-memory store saat kv belum dikonfigurasi (dev/demo)
      global.__usedRefs = global.__usedRefs || new Set();
      
      // 1. lihat jika ada bukti pembayaran (verification path)
      const authHeader = req.headers["authorization"];
      const signature = authHeader && authHeader.startsWith("x402 ")
        ? authHeader.split(" ")[1]
        : null;
      const reference = req.query.reference ? req.query.reference.toString() : null;

      if (signature && reference) {
        // 1. cek apakah referensi sudah pernah digunakan (menggunakan vercel kv)
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

        // ambil memo
        const memoInstruction = tx.transaction.message.instructions?.find(
          (ix) => ix.programId.toBase58() === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
        );
        const memo = memoInstruction ? memoInstruction.parsed : null;
        
        // 1. dapatkan info mint untuk desimal
        let decimals;
        try {
          const mintInfo = await connection.getParsedAccountInfo(SPL_TOKEN_MINT);
          decimals = mintInfo.value.data.parsed.info.decimals;
        } catch (e) {
          console.error("Gagal mengambil info mint:", e);
          return res.status(500).json({ error: "Gagal memvalidasi mint token" });
        }
        const requiredAmountSmallestUnit = BigInt(Math.floor(amount * Math.pow(10, decimals)));

        // 2. temukan saldo sebelum dan sesudah untuk wallet penerima
        const preBalance = tx.meta.preTokenBalances?.find(
          b => b.owner === RECIPIENT_OWNER_STR && b.mint === MINT_STR
        );
        const postBalance = tx.meta.postTokenBalances?.find(
          b => b.owner === RECIPIENT_OWNER_STR && b.mint === MINT_STR
        );

        // 3. hitung jumlah yang diterima
        const preAmount = BigInt(preBalance?.uiTokenAmount?.amount || '0');
        const postAmount = BigInt(postBalance?.uiTokenAmount?.amount || '0');
        const amountReceived = postAmount - preAmount;

        console.log(`Verifikasi Saldo: Owner ${RECIPIENT_OWNER_STR}, Saldo Awal: ${preAmount}, Saldo Akhir: ${postAmount}, Diterima: ${amountReceived}, Dibutuhkan: ${requiredAmountSmallestUnit}`);
        
        // VALIDASI PEMBAYARAN
        const isAmountValid = amountReceived === requiredAmountSmallestUnit;
        const isReferenceValid = memo === reference; 

        console.log(`Validasi: Amount (${isAmountValid}), Reference (${isReferenceValid}), Memo: ${memo || 'TIDAK ADA'}`);

        if (isAmountValid && isReferenceValid) {
          // PEMBAYARAN BERHASIL! Simpan referensi
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
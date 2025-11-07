// backend/x402-paywall.js

const {
  Connection,
  clusterApiUrl,
  PublicKey,
} = require("@solana/web3.js");
const { getAssociatedTokenAddress, getAccount } = require("@solana/spl-token");
const { randomUUID } = require("crypto");
const bs58 = require("bs58");
let kvClient = null; // lazy-loaded KV client

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

        const memoInstruction = tx.transaction.message.instructions.find(
          (ix) => ix.programId.toBase58() === "MemoSq4gqABAXKb96qnH8TysNcVtrnbMpsBwiHggz"
        );
        const memo = memoInstruction ? bs58.decode(memoInstruction.data).toString('utf-8') : null;

        // Safeguard parsing innerInstructions
        const inner = (tx.meta && tx.meta.innerInstructions && tx.meta.innerInstructions[0]) ? tx.meta.innerInstructions[0] : null;
        const firstIx = inner && inner.instructions && inner.instructions[0] ? inner.instructions[0] : null;
        const tokenTransfer = firstIx && firstIx.parsed ? firstIx.parsed : null;
        if (!tokenTransfer || !tokenTransfer.info || !tokenTransfer.info.tokenAmount) {
          return res.status(401).json({ error: "Transaksi tidak mengandung transfer token yang valid" });
        }
        
        const myTokenAccount = await getAssociatedTokenAddress(SPL_TOKEN_MINT, MY_WALLET_ADDRESS);

        // --- VALIDASI PEMBAYARAN ---
        const isAmountValid = tokenTransfer.info.tokenAmount.uiAmount === amount;
        const isDestinationValid = tokenTransfer.info.destination === myTokenAccount.toBase58();
   
        const isReferenceValid = memo === reference; 

        console.log(`Validasi: Amount (${isAmountValid}), Destination (${isDestinationValid}), Reference (${isReferenceValid}), Memo: ${memo || 'TIDAK ADA'}`);

        if (isAmountValid && isDestinationValid && isReferenceValid) {
          // PEMBAYARAN BERHASIL! Simpan referensi ke Vercel KV agar tidak bisa dipakai lagi
          if (kvConfigured && kvClient) {
            await kvClient.set(reference, true, { ex: 300 });
          } else {
            global.__usedRefs.add(reference);
          }
          
          console.log("Pembayaran valid. Akses diberikan.");
          next();
        } else {
          return res.status(401).json({ error: "Pembayaran tidak valid" });
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
// backend/x402-paywall.js

const {
  Connection,
  clusterApiUrl,
  PublicKey,
} = require("@solana/web3.js");
const { getAssociatedTokenAddress, getAccount } = require("@solana/spl-token");
const { v4: uuidv4 } = require("uuid");
const bs58 = require("bs58");
const { kv } = require("@vercel/kv"); 

// --- KONFIGURASI ---
const SOLANA_NETWORK = "devnet";
const connection = new Connection(clusterApiUrl(SOLANA_NETWORK), "confirmed");

const SPL_TOKEN_MINT = new PublicKey(
  "Gh9ZwEmdLJ8DscKNTkTqYPbbyL6ixrC" 
);
const MY_WALLET_ADDRESS = new PublicKey(
  "Dkx5Ek7LJtXgazouGzp9SPGqUjj9ZTd2XMx4WkUJhvuo" 
);

/**
 * Factory function untuk membuat middleware x402
 * @param {number} amount - Jumlah token yang dibutuhkan
 */
function x402Paywall(amount) {
  return async (req, res, next) => {
    try {
      // 1. LIHAT JIKA ADA BUKTI PEMBAYARAN (VERIFICATION PATH)
      const authHeader = req.headers["authorization"];
      const signature = authHeader && authHeader.startsWith("x402 ")
        ? authHeader.split(" ")[1]
        : null;
      const reference = req.query.reference ? req.query.reference.toString() : null;

      if (signature && reference) {
        // 1. Cek apakah referensi sudah pernah digunakan (MENGGUNAKAN VERCEL KV)
        const isUsed = await kv.get(reference); 
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

        const tokenTransfer = tx.meta.innerInstructions[0].instructions[0].parsed;
        
        const myTokenAccount = await getAssociatedTokenAddress(SPL_TOKEN_MINT, MY_WALLET_ADDRESS);

        // --- VALIDASI PEMBAYARAN ---
        const isAmountValid = tokenTransfer.info.tokenAmount.uiAmount === amount;
        const isDestinationValid = tokenTransfer.info.destination === myTokenAccount.toBase58();
        const isReferenceValid = memo === reference;

        console.log(`Validasi: Amount (${isAmountValid}), Destination (${isDestinationValid}), Reference (${isReferenceValid})`);

        if (isAmountValid && isDestinationValid && isReferenceValid) {
          // PEMBAYARAN BERHASIL! Simpan referensi ke Vercel KV agar tidak bisa dipakai lagi
          await kv.set(reference, true, { ex: 300 }); 
          
          console.log("Pembayaran valid. Akses diberikan.");
          next();
        } else {
          return res.status(401).json({ error: "Pembayaran tidak valid" });
        }
      } else {
        // 2. TIDAK ADA BUKTI BAYAR (CHALLENGE PATH)
        console.log("Tidak ada bukti bayar. Mengirim tantangan 402.");

        const myTokenAccount = await getAssociatedTokenAddress(SPL_TOKEN_MINT, MY_WALLET_ADDRESS);
        const newReference = uuidv4();

        const invoice = {
          protocol: "x402",
          recipient: myTokenAccount.toBase58(),
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
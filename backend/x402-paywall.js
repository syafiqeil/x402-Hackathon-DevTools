// x402-paywall.js

const {
  Connection,
  clusterApiUrl,
  PublicKey,
} = require("@solana/web3.js");
const { getAssociatedTokenAddress, getAccount } = require("@solana/spl-token");
const { v4: uuidv4 } = require("uuid");
const bs58 = require("bs58");

// --- KONFIGURASI ---
const SOLANA_NETWORK = "devnet"; // Gunakan 'mainnet-beta' untuk produksi
const connection = new Connection(clusterApiUrl(SOLANA_NETWORK), "confirmed");

// Alamat MINT Token (Contoh: USDC di devnet)
// Anda bisa buat token Anda sendiri di https://spl-token-ui.solana.com/
const SPL_TOKEN_MINT = new PublicKey(
  "Gh9ZwEmdLJ8DscKNTkTqYPbbyL6ixrC tempList" // Ganti dengan MINT TOKEN ANDA di Devnet
);
// Alamat DOMPET (wallet) Anda untuk menerima pembayaran
const MY_WALLET_ADDRESS = new PublicKey(
  "YOUR_WALLET_PUBLIC_KEY" // Ganti dengan Public Key dompet ANDA
);

/**
 * Factory function untuk membuat middleware x402
 * @param {number} amount - Jumlah token yang dibutuhkan
 */
function x402Paywall(amount) {
  // Fungsi ini mengembalikan middleware Express yang sebenarnya
  return async (req, res, next) => {
    try {
      // 1. LIHAT JIKA ADA BUKTI PEMBAYARAN (VERIFICATION PATH)
      const authHeader = req.headers["authorization"];
      const signature = authHeader && authHeader.startsWith("x402 ")
        ? authHeader.split(" ")[1]
        : null;
      const reference = req.query.reference ? req.query.reference.toString() : null;

      if (signature && reference) {
        console.log(`Verifikasi pembayaran: sig=${signature}, ref=${reference}`);

        // Verifikasi transaksi di blockchain
        const tx = await connection.getParsedTransaction(signature, "confirmed");

        if (!tx) {
          return res.status(401).json({ error: "Transaksi tidak ditemukan" });
        }

        if (tx.meta && tx.meta.err) {
          console.warn("Pembayaran ditolak: Transaksi on-chain GAGAL.");
          return res.status(401).json({ error: "Transaksi pembayaran gagal di blockchain" });
        }

        // Cari instruksi memo
        const memoInstruction = tx.transaction.message.instructions.find(
          (ix) => ix.programId.toBase58() === "MemoSq4gqABAXKb96qnH8TysNcVtrnbMpsBwiHggz"
        );
        const memo = memoInstruction ? bs58.decode(memoInstruction.data).toString('utf-8') : null;

        // Cari instruksi transfer token
        const tokenTransfer = tx.meta.innerInstructions[0].instructions[0].parsed;
        
        // Dapatkan alamat token account (ATA) tujuan kita
        const myTokenAccount = await getAssociatedTokenAddress(SPL_TOKEN_MINT, MY_WALLET_ADDRESS);

        // --- VALIDASI PEMBAYARAN ---
        const isAmountValid = tokenTransfer.info.tokenAmount.uiAmount === amount;
        const isDestinationValid = tokenTransfer.info.destination === myTokenAccount.toBase58();
        const isReferenceValid = memo === reference;

        console.log(`Validasi: Amount (${isAmountValid}), Destination (${isDestinationValid}), Reference (${isReferenceValid})`);

        if (isAmountValid && isDestinationValid && isReferenceValid) {
          // PEMBAYARAN BERHASIL! Berikan akses ke resource.
          console.log("Pembayaran valid. Akses diberikan.");
          next(); // Lanjut ke handler route yang sebenarnya
        } else {
          return res.status(401).json({ error: "Pembayaran tidak valid" });
        }
      } else {
        // 2. TIDAK ADA BUKTI BAYAR (CHALLENGE PATH)
        // Kirim respons 402 Payment Required
        console.log("Tidak ada bukti bayar. Mengirim tantangan 402.");

        // Dapatkan alamat token account (ATA) kita. Klien perlu ini.
        const myTokenAccount = await getAssociatedTokenAddress(SPL_TOKEN_MINT, MY_WALLET_ADDRESS);

        // Buat referensi unik untuk transaksi ini
        const newReference = uuidv4();

        const invoice = {
          protocol: "x402",
          recipient: myTokenAccount.toBase58(), // Alamat *Token Account* penerima
          amount: amount,
          token: SPL_TOKEN_MINT.toBase58(), // Alamat *Mint* token
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
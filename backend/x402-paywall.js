// backend/x402-paywall.js

const { Connection, clusterApiUrl, PublicKey } = require("@solana/web3.js");
const { getMint } = require("@solana/spl-token");
const { randomUUID } = require("crypto");
let kvClient = null;

const SOLANA_NETWORK = "devnet";
const connection = new Connection(clusterApiUrl(SOLANA_NETWORK), "confirmed");

// In-memory fallback untuk KV (seperti di file asli Anda)
global.__usedRefs = global.__usedRefs || new Set();
global.__userBudgets = global.__userBudgets || new Map();

/**
 * Mendapatkan KV client, dengan fallback ke in-memory store
 */
async function getKvClient() {
  if (kvClient) return kvClient;
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = require("@vercel/kv");
      kvClient = kv;
      return kvClient;
    } catch (e) {
      console.warn("Gagal menginisialisasi Vercel KV:", e.message);
      return null;
    }
  }
  return null;
}

// Fungsi Helper untuk KV
const kv = {
  get: async (key) => {
    const client = await getKvClient();
    if (client) return client.get(key);
    return global.__userBudgets.get(key) || global.__usedRefs.has(key);
  },
  set: async (key, value, options) => {
    const client = await getKvClient();
    if (client) return client.set(key, value, options);
    if (key.startsWith("budget_")) {
      global.__userBudgets.set(key, value);
    } else {
      global.__usedRefs.add(key);
    }
  },
};

/**
 * Logika verifikasi transaksi yang diekstrak.
 * Memverifikasi jumlah, memo, dan penerima.
 * @returns {object|null} - Mengembalikan data transaksi jika valid, atau null.
 */
async function verifyTransaction(
  signature,
  reference,
  requiredAmount,
  splTokenMint,
  recipientWallet
) {
  try {
    const tx = await connection.getParsedTransaction(signature, "finalized");
    if (!tx || (tx.meta && tx.meta.err)) {
      throw new Error("Transaksi gagal atau tidak ditemukan.");
    }

    // 1. Verifikasi Memo (Reference)
    const memoInstruction = tx.transaction.message.instructions?.find(
      (ix) =>
        ix.programId.toBase58() === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
    );
    const memo = memoInstruction ? memoInstruction.parsed : null;
    const isReferenceValid = memo === reference;
    if (!isReferenceValid) {
      throw new Error(`Referensi memo tidak valid. Diharapkan: ${reference}, Diterima: ${memo}`);
    }

    // 2. Verifikasi Jumlah
    const MINT_STR = splTokenMint.toBase58();
    const RECIPIENT_OWNER_STR = recipientWallet.toBase58();

    const mintInfo = await getMint(connection, splTokenMint);
    const requiredAmountSmallestUnit = BigInt(
      Math.floor(requiredAmount * Math.pow(10, mintInfo.decimals))
    );

    const preBalance = tx.meta.preTokenBalances?.find(
      (b) => b.owner === RECIPIENT_OWNER_STR && b.mint === MINT_STR
    );
    const postBalance = tx.meta.postTokenBalances?.find(
      (b) => b.owner === RECIPIENT_OWNER_STR && b.mint === MINT_STR
    );

    const preAmount = BigInt(preBalance?.uiTokenAmount?.amount || "0");
    const postAmount = BigInt(postBalance?.uiTokenAmount?.amount || "0");
    const amountReceived = postAmount - preAmount;

    console.log(`Verifikasi Saldo: Awal: ${preAmount}, Akhir: ${postAmount}, Diterima: ${amountReceived}, Dibutuhkan: ${requiredAmountSmallestUnit}`);
    
    const isAmountValid = amountReceived === requiredAmountSmallestUnit;
    if (!isAmountValid) {
      throw new Error(`Jumlah token salah. Diterima: ${amountReceived}, Dibutuhkan: ${requiredAmountSmallestUnit}`);
    }
    
    // Semua valid!
    return {
      success: true,
      amountReceived: Number(amountReceived) / Math.pow(10, mintInfo.decimals),
    };
  } catch (error) {
    console.warn(`Verifikasi gagal: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * IMPROVISASI #1: Middleware Anggaran (Budget Paywall)
 * Ini berjalan SEBELUM x402Paywall.
 * Ia memeriksa apakah pengguna memiliki anggaran yang disetor.
 */
const budgetPaywall = ({ amount, splToken }) => async (req, res, next) => {
  const payerPubkey = req.headers["x402-payer-pubkey"];
  if (!payerPubkey) {
    return next(); // Tidak ada header, lanjutkan ke paywall 402 normal
  }

  try {
    const budgetKey = `budget_${payerPubkey}`;
    const currentBudget = (await kv.get(budgetKey)) || 0;

    const MINT_STR = splToken;
    const MINT_PUBKEY = new PublicKey(MINT_STR);
    const mintInfo = await getMint(connection, MINT_PUBKEY);
    const requiredAmount = amount * Math.pow(10, mintInfo.decimals);

    if (currentBudget >= requiredAmount) {
      // Anggaran CUKUP!
      console.log(`BudgetPaywall: Menggunakan anggaran untuk ${payerPubkey}. Sisa: ${currentBudget - requiredAmount}`);
      // Kurangi anggaran dan berikan akses
      await kv.set(budgetKey, currentBudget - requiredAmount);
      req.x402_payment_method = "budget"; // Tandai bahwa ini dibayar via anggaran
      return next(); // Lolos!
    } else {
      // Anggaran tidak cukup
      console.log(`BudgetPaywall: Anggaran tidak cukup untuk ${payerPubkey}. Diminta: ${requiredAmount}, Tersedia: ${currentBudget}`);
      return next(); // Lanjutkan ke paywall 402 normal
    }
  } catch (error) {
    console.error("Error di BudgetPaywall:", error);
    return next(); // Terjadi error, biarkan 402 paywall menanganinya
  }
};

/**
 * Paywall 402 Asli (Sekarang sebagai Fallback)
 * @param {object} options
 * @param {number} options.amount
 * @param {string} options.splToken
 * @param {string} options.recipientWallet
 */
function x402Paywall({ amount, splToken, recipientWallet }) {
  return async (req, res, next) => {
    try {
      // Jika request sudah diloloskan oleh budgetPaywall, lewati
      if (req.x402_payment_method === "budget") {
        return next();
      }

      // Konfigurasi Kunci
      const MINT_PUBKEY = new PublicKey(splToken.trim());
      const RECIPIENT_WALLET_PUBKEY = new PublicKey(recipientWallet.trim());

      // 1. Jalur Verifikasi (Verification Path)
      const authHeader = req.headers["authorization"];
      const signature = authHeader?.startsWith("x402 ")
        ? authHeader.split(" ")[1]
        : null;
      const reference = req.query.reference ? req.query.reference.toString() : null;

      if (signature && reference) {
        // Cek Replay Attack
        const refKey = `ref_${reference}`;
        if (await kv.get(refKey)) {
          return res.status(401).json({ error: "Pembayaran sudah diklaim (replay attack)" });
        }

        console.log(`Verifikasi pembayaran: sig=${signature}, ref=${reference}`);
        
        const verification = await verifyTransaction(
          signature,
          reference,
          amount,
          MINT_PUBKEY,
          RECIPIENT_WALLET_PUBKEY
        );

        if (verification.success) {
          // PEMBAYARAN BERHASIL! Simpan referensi
          await kv.set(refKey, true, { ex: 300 }); // simpan selama 5 menit
          console.log("Pembayaran valid. Akses diberikan.");
          req.x402_payment_method = "onetime"; // Tandai sebagai pembayaran sekali pakai
          return next();
        } else {
          return res.status(401).json({ error: `Pembayaran tidak valid: ${verification.error}` });
        }
      }

      // 2. Jalur Tantangan 402 (Challenge Path)
      console.log("Tidak ada bukti bayar. Mengirim tantangan 402.");
      const newReference = randomUUID();
      const invoice = {
        protocol: "x402",
        recipientWallet: RECIPIENT_WALLET_PUBKEY.toBase58(),
        amount: amount,
        token: MINT_PUBKEY.toBase58(),
        reference: newReference,
      };

      return res.status(402).json(invoice);
    } catch (error) {
      console.error("Error di x402Paywall:", error);
      return res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
  };
}

module.exports = { x402Paywall, budgetPaywall, verifyTransaction, kv };
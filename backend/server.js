// backend/server.js

const express = require("express");
const cors = require("cors");
const {
  x402Paywall,
  budgetPaywall,
  verifyTransaction,
  kv,
} = require("./x402-paywall");
const { PublicKey } = require("@solana/web3.js");

const app = express();

app.use(cors({
  origin: '*', // Izinkan semua origin
  exposedHeaders: ['Content-Type', 'Authorization'], // Pastikan header terekspos
}));
app.use(express.json()); // Middleware untuk mem-parsing body JSON

// Konfigurasi dasar
const CONFIG = {
  splToken: process.env.SPL_TOKEN_MINT,
  recipientWallet: process.env.MY_WALLET_ADDRESS,
};

// --- DATABASE DOKUMEN & ALAT AGEN ---

const documentDatabase = {
  tokenomics: "Tokenomics: 50% Community, 30% Team, 20% Foundation...",
  roadmap: "Roadmap: Q1 Launch, Q2 Partnerships, Q3 Scaling...",
};

/**
 * IMPROVISASI #3: Endpoint Dynamic Tool Discovery
 * Ini adalah endpoint GRATIS tempat agen belajar tentang kemampuannya.
 */
const agentTools = [
  {
    id: "tokenomics",
    description: "Ambil detail tentang tokenomics proyek.",
    endpoint: "/api/get-context?docId=tokenomics",
    cost: 0.005,
  },
  {
    id: "roadmap",
    description: "Ambil detail tentang roadmap proyek.",
    endpoint: "/api/get-context?docId=roadmap",
    cost: 0.005,
  },
  {
    id: "premium",
    description: "Ambil data premium umum (contoh).",
    endpoint: "/api/premium-data",
    cost: 0.01,
  },
];

app.get("/api/agent-tools", (req, res) => {
  res.json(agentTools);
});

// --- API PUBLIK ---
app.get("/api/public", (req, res) => {
  res.json({ message: "Free data for you all!" });
});

// --- API PREMIUM (DILINDUNGI) ---

// Ini adalah API premium
app.get(
  "/api/premium-data",
  budgetPaywall({ amount: 0.01, ...CONFIG }), // 1. Cek Anggaran
  x402Paywall({ amount: 0.01, ...CONFIG }), // 2. Fallback ke 402
  (req, res) => {
    // Kode ini hanya berjalan jika pembayaran sudah valid
    res.json({
      message: "This is your premium data sir.",
      paymentMethod: req.x402_payment_method || "unknown",
      timestamp: new Date().toISOString(),
    });
  }
);

// Endpoint RAG yang dilindungi
app.get(
  "/api/get-context",
  budgetPaywall({ amount: 0.005, ...CONFIG }), // 1. Cek Anggaran
  x402Paywall({ amount: 0.005, ...CONFIG }), // 2. Fallback ke 402
  (req, res) => {
    const docId = req.query.docId;
    const content = documentDatabase[docId];

    if (content) {
      res.json({
        context: content,
        paymentMethod: req.x402_payment_method || "unknown",
      });
    } else {
      res.status(404).json({ error: "Dokumen tidak ditemukan" });
    }
  }
);

/**
 * IMPROVISASI #1: Endpoint Konfirmasi Setoran Anggaran
 * Frontend memanggil ini SETELAH mengirim transaksi setoran.
 */
app.post("/api/confirm-budget-deposit", async (req, res) => {
  const { signature, reference, payerPubkey, amount } = req.body;

  if (!signature || !reference || !payerPubkey || !amount) {
    return res.status(400).json({ error: "Permintaan tidak lengkap (signature, reference, payerPubkey, amount)" });
  }

  // Cek Replay Attack
  const refKey = `ref_${reference}`;
  if (await kv.get(refKey)) {
    return res.status(401).json({ error: "Setoran anggaran ini sudah diklaim" });
  }

  const verification = await verifyTransaction(
    signature,
    reference,
    amount, // verifikasi jumlah yang DISETOR
    new PublicKey(CONFIG.splToken),
    new PublicKey(CONFIG.recipientWallet)
  );

  if (verification.success && verification.amountReceived === amount) {
    // Verifikasi BERHASIL! Tambahkan ke anggaran pengguna.
    const budgetKey = `budget_${payerPubkey}`;
    const currentBudget = (await kv.get(budgetKey)) || 0;
    
    const MINT_PUBKEY = new PublicKey(CONFIG.splToken);
    const mintInfo = await getMint(connection, MINT_PUBKEY);
    const depositAmount = amount * Math.pow(10, mintInfo.decimals);
    
    const newBudget = currentBudget + depositAmount;
    
    await kv.set(budgetKey, newBudget);
    await kv.set(refKey, true, { ex: 3600 }); // Tandai referensi sebagai digunakan

    console.log(`Setoran anggaran ${amount} berhasil untuk ${payerPubkey}. Total anggaran: ${newBudget}`);
    res.json({ success: true, newBudget: newBudget / Math.pow(10, mintInfo.decimals) });
  } else {
    res.status(401).json({ error: `Verifikasi setoran anggaran gagal: ${verification.error}` });
  }
});

// ... (Error handler Anda) ...
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
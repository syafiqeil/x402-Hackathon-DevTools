// backend/server.js

const express = require("express");
const cors = require("cors"); 
const { x402Paywall } = require("./x402-paywall"); 

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(cors());

// Ini adalah API publik
app.get("/api/public", (req, res) => {
  res.json({ message: "Free data for you all!" });
});

// Ini adalah API premium
app.get(
  "/api/premium-data",
  x402Paywall({
    amount: 0.01,
    splToken: process.env.SPL_TOKEN_MINT, 
    recipientWallet: process.env.MY_WALLET_ADDRESS 
  }), 
  (req, res) => {
    // Kode ini hanya akan berjalan jika pembayaran sudah valid
    res.json({
      message: "This is your premium data sir.",
      timestamp: new Date().toISOString(),
    });
  }
);

app.get(
  "/api/super-premium-data",
  x402Paywall({
    amount: 0.01,
    splToken: process.env.SPL_TOKEN_MINT,
    recipientWallet: process.env.MY_WALLET_ADDRESS
  }), 
  (req, res) => {
    res.json({
      message: "This is your SUPER premium data, Your Majesty",
    });
  }
);

const documentDatabase = {
  "tokenomics": "Details about the project's tokenomics...",
  "roadmap": "Q1: Mainnet launch, Q2: Integrations..."
};

app.get(
  "/api/get-context", 
  x402Paywall({
    amount: 0.005, 
    splToken: process.env.SPL_TOKEN_MINT,
    recipientWallet: process.env.MY_WALLET_ADDRESS
  }), 
  (req, res) => {
    const docId = req.query.docId; 
    const content = documentDatabase[docId];
    
    if (content) {
      res.json({ context: content });
    } else {
      res.status(404).json({ error: "Dokumen tidak ditemukan" });
    }
  }
);

// Global error handler untuk memastikan header CORS tetap diberikan saat terjadi error
app.use((err, req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
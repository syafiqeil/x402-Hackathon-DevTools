// server.js

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
  res.json({ message: "Ini data gratis untuk semua!" });
});

// Ini adalah API premium
app.get(
  "/api/premium-data",
  x402Paywall(0.01), 
  (req, res) => {
    // Kode ini hanya akan berjalan jika pembayaran sudah valid
    res.json({
      message: "Ini adalah data premium!",
      timestamp: new Date().toISOString(),
    });
  }
);

// Global error handler to ensure CORS headers on errors
app.use((err, req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
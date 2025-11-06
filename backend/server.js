// server.js

const express = require("express");
const { x402Paywall } = require("./x402-paywall"); // Impor middleware

const app = express();
const PORT = 3001;

// Ini adalah API publik, tidak perlu bayar
app.get("/api/public", (req, res) => {
  res.json({ message: "Ini data gratis untuk semua!" });
});

// Ini adalah API premium, dilindungi oleh x402
// Membutuhkan pembayaran 0.01 token
app.get(
  "/api/premium-data",
  x402Paywall(0.01), // <-- AJAIBNYA DI SINI!
  (req, res) => {
    // Kode ini HANYA akan berjalan jika pembayaran sudah valid
    res.json({
      message: "Ini adalah data premium yang sangat rahasia!",
      timestamp: new Date().toISOString(),
    });
  }
);

module.exports = app;
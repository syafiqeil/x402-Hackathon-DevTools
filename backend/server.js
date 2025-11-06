// server.js

const express = require("express");
const cors = require("cors"); 
const { x402Paywall } = require("./x402-paywall"); 

const app = express();

const cors = require('cors');

// Let everything through (debug only)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(cors());
app.options('*', cors());

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

module.exports = app;
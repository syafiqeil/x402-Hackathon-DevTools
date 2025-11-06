// server.js

const express = require("express");
const cors = require("cors");
const { x402Paywall } = require("./x402-paywall"); 

const app = express();
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN, 
].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); 
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

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
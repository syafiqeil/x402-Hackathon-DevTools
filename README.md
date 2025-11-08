x402 DevTools for Solana

This project is a full-stack implementation of the HTTP 402 paywall protocol adapted for Solana.

It provides a set of tools (SDK) for developers to easily monetize their APIs using SPL Tokens on the Solana network—without requiring API keys, user accounts, or subscriptions.

Main Components (SDK)

This toolkit consists of two main parts:

1. Backend (x402Paywall)

An Express.js middleware (x402-paywall.js) that can be attached to any API route to protect it with a Solana-based paywall.

2. Frontend (useX402)

A custom React hook (useX402.js) that handles the client-side payment flow—from receiving the 402 challenge to sending the transaction and submitting the proof of payment.

Workflow

This implementation uses a “Client Pays, Server Verifies” flow optimized for Solana:

Challenge:
The client (frontend) requests /api/premium-data.
The server (backend) responds with HTTP 402 Payment Required and a JSON “invoice.”

Payment:
The useX402 hook receives the invoice, builds an SPL Token transaction (including a Memo with a unique reference), and requests user wallet approval.

Proof of Payment:
After the transaction is confirmed on-chain, the useX402 hook retries the request to /api/premium-data, this time including the header:
Authorization: x402 <transaction_signature>.

Verification:
The x402Paywall middleware receives the signature, fetches the transaction details from the Solana RPC, validates the paid amount and memo reference, and then grants access to the premium data.

How to Use
1. Backend (Protecting Express Routes)

Apply the x402Paywall middleware to any route you want to monetize.

Example in server.js:
const express = require("express");
const { x402Paywall } = require("./x402-paywall");
const app = express();

// ... (CORS configuration) ...

// Load configuration from environment variables
const config = {
  splToken: process.env.SPL_TOKEN_MINT,
  recipientWallet: process.env.MY_WALLET_ADDRESS
};

// Free route
app.get("/api/public", (req, res) => {
  res.json({ message: "This is free data!" });
});

// Premium route (0.01 Token)
app.get(
  "/api/premium-data",
  x402Paywall({
    amount: 0.01,
    ...config
  }),
  (req, res) => {
    res.json({ message: "This is premium data!" });
  }
);

// Super-premium route (1.5 Token)
app.get(
  "/api/super-premium",
  x402Paywall({
    amount: 0.5,
    ...config
  }),
  (req, res) => {
    res.json({ message: "This is super premium data!" });
  }
);

module.exports = app;

2. Frontend (Accessing Protected Routes in React)

Use the useX402 hook to wrap your API calls.

Example in PremiumContent.jsx:
import React from "react";
import { useX402 } from "./useX402"; // Import the hook

function PremiumContent() {
  // Initialize the hook for the protected route
  const premiumApi = useX402("https://YOUR_BACKEND_URL/api/premium-data");

  return (
    <div>
      <h2>Test Premium API (Requires 0.01 Token)</h2>

      {/* Trigger fetchData() when button is clicked */}
      <button onClick={premiumApi.fetchData} disabled={premiumApi.isLoading}>
        {premiumApi.isLoading ? "Paying & Fetching..." : "Fetch Premium Data"}
      </button>

      {/* Display error if any */}
      {premiumApi.error && <p style={{ color: "red" }}>Error: {premiumApi.error}</p>}

      {/* Display data if successful */}
      {premiumApi.data && (
        <pre>{JSON.stringify(premiumApi.data, null, 2)}</pre>
      )}
    </div>
  );
}

Environment Configuration

To run this project, you need the following environment variables in your backend .env file (or in Vercel):
# Mint address of the SPL Token you want to accept (e.g., USDC on devnet)
SPL_TOKEN_MINT="Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"

# Your Solana wallet address to receive payments
MY_WALLET_ADDRESS="YourWalletAddressHere"

# (Required for Production) Vercel KV credentials for Replay Attack protection
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="ey..."


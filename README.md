# x402 DevTools for Solana: HTTP 402 Paywall SDK

This project is a full-stack implementation of the **HTTP 402** paywall protocol adapted for Solana. It provides a set of tools (SDK) for developers to easily monetize their APIs using **SPL Tokens** on the Solana network—without requiring API keys, user accounts, or subscriptions.

This project is a strong fit for two x402 hackathon tracks:
1.  **x402 Developer Tool - SDKs, infra, libraries**: We built a reusable `x402Paywall` middleware and a `useX402` React hook.
2.  **x402 Agent Application - real AI agent use cases**: We created a RAG (Retrieval-Augmented Generation) AI agent that autonomously uses the `useX402` hook to pay for the context it needs.

## 📺 Live Demo

* **Frontend (RAG Agent Demo):** `https://x402-hackathon-devtools-fe.vercel.app/`
* **Backend (API Server):** `https://x402-hackathon-devtools.vercel.app/`

## ✨ Key Features

* **HTTP 402 Standard:** Fully compliant with the `402 Payment Required` challenge flow.
* **SPL Token Payments:** Monetize APIs using any SPL token (e.g., USDC).
* **Express.js Middleware:** Simply add `x402Paywall` as a middleware to your Express routes.
* **React Hook (SDK):** Provides a simple `useX402` hook that abstracts all payment logic on the frontend.
* **Innovative Budget System:** A solution to overcome the UX friction of micropayments. Users can make a **one-time deposit** to fund their "budget," allowing future API calls to happen instantly **without repeated wallet confirmations**. This is ideal for autonomous agents.
* **Replay Attack Protection:** Backend validation automatically prevents the same transaction signature from being used twice, using Vercel KV.

## ⚙️ Workflow Concept

This SDK seamlessly supports two payment flows:

### Flow 1: One-Time Payment (Standard 402)

This flow is used when a user has no pre-deposited budget.

1.  **Frontend**: Calls `fetchWith402` to `/api/premium`.
2.  **Backend**: The `budgetPaywall` fails (no budget). The `x402Paywall` sends back an `HTTP 402` response + a unique `invoice`.
3.  **Frontend**: `useX402` catches the 402, **prompts the user for wallet confirmation** to send the transaction (with the invoice reference in the memo).
4.  **Frontend**: Resubmits the request with an `Authorization: x402 <signature>` header.
5.  **Backend**: `x402Paywall` verifies the `signature` on-chain (checking amount, recipient, and memo), marks the reference as "used," and grants access to the data.

### Flow 2: Budget Payment (Fast UX)

This is our innovation and happens automatically if the user has a sufficient budget.

1.  **(Prerequisite)**: The user has previously deposited funds using the `depositBudget` hook. The backend stores this `budget_USER_PUBKEY` in a KV store.
2.  **Frontend**: Calls `fetchWith402` to `/api/premium`. The hook automatically adds the `x402-Payer-Pubkey` header.
3.  **Backend**: The `budgetPaywall` middleware runs **first**. It checks the user's budget in the KV store.
4.  **Backend**: The budget is sufficient! The backend deducts the cost from the KV budget and immediately grants access to the data. **No 402, no wallet confirmation.**
5.  **(Fallback)**: If the budget is insufficient, `budgetPaywall` fails, and the flow automatically reverts to **Flow 1**.

---

## 🚀 Quick Start (How to Use)

Here’s how to integrate the x402 DevTools into your project.

### 1. Backend (Express.js Server)

Monetize your API routes in 3 steps.

**Step 1: Install Dependencies**
npm install @solana/web3.js @solana/spl-token @vercel/kv express cors

_(See `backend/package.json` for a full list)_

**Step 2: Configure Your Server** Grab the `backend/x402-paywall.js` file and import it into your main server. You _must_ add the `/api/confirm-budget-deposit` endpoint for the budget feature to work.
`server.js`

    const express = require("express");
    const cors = require("cors");
    const { 
      x402Paywall, 
      budgetPaywall, 
      kv, 
      connection, 
      verifyTransaction 
    } = require("./x402-paywall"); //
    const { PublicKey } = require("@solana/web3.js");
    const { getMint } = require("@solana/spl-token");
    
    const app = express();
    app.use(cors({ origin: '*', exposedHeaders: ['Content-Type', 'Authorization'] }));
    app.use(express.json());
    
    // 1. Load Your Config from .env
    const config = {
      splToken: process.env.SPL_TOKEN_MINT,
      recipientWallet: process.env.MY_WALLET_ADDRESS,
    };
    
    // 2. Apply the Paywall Middleware to Premium Routes
    // Note the order: `budgetPaywall` always runs first!
    app.get(
      "/api/premium-data",
      budgetPaywall({ amount: 0.01, ...config }), //
      x402Paywall({ amount: 0.01, ...config }),  //
      (req, res) => {
        res.json({ 
          message: "This is your premium data!",
          paymentMethod: req.x402_payment_method || "unknown" 
        });
      }
    );
    
    // 3. Add the Budget Deposit Confirmation Endpoint
    app.post("/api/confirm-budget-deposit", async (req, res) => {
      // ... (Copy the full logic from backend/server.js) ...
      // This logic verifies the deposit and adds it to the KV store
      //
      // ... (placeholder for verification logic)
      try {
        const { signature, reference, payerPubkey, amount } = req.body;
        // (verify transaction here...)
        // (if valid, save to KV)
        const budgetKey = `budget_${payerPubkey}`;
        const currentBudget = BigInt((await kv.get(budgetKey)) || "0");
        const newBudget = currentBudget + BigInt(amount * Math.pow(10, 8)); // Assuming 8 decimals
        await kv.set(budgetKey, newBudget.toString());
        res.json({ success: true, newBudget: newBudget.toString() });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
    
    module.exports = app;

### 2. Frontend (React / Vite)

Access your paid APIs in 3 steps.

**Step 1: Install Dependencies**
`npm install @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-phantom @solana/web3.js @solana/spl-token buffer`
_(See frontend/package.json for a full list) (You may also need polyfills, see frontend/vite.config.js)_

**Step 2: Wrap Your App with Providers** Grab the `frontend/src/X402Provider.jsx` and `frontend/src/useX402.js` files. Then, wrap your app with all the necessary providers.
`App.jsx`

    import React, { useMemo } from "react";
    import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
    import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
    import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
    import { clusterApiUrl } from "@solana/web3.js";
    import "@solana/wallet-adapter-react-ui/styles.css";
    
    import { X402Provider } from "./X402Provider.jsx"; // <-- IMPORT
    import YourMainComponent from "./YourMainComponent.jsx";
    
    function App() {
      const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
      const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
    
      return (
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              {/* WRAP YOUR APP WITH X402Provider */}
              <X402Provider> 
                <YourMainComponent />
              </X402Provider>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      );
    } //
    
    export default App;

**Step 3: Use the `useX402` Hook in Your Components** Now you can use the `useX402` hook anywhere in your app to make payments.
`YourMainComponent.jsx`

    import React, { useState } from "react";
    import { useX402 } from "./useX402"; // <-- IMPORT THE HOOK
    
    function YourMainComponent() {
      const { fetchWith402, depositBudget, API_BASE, isWalletError } = useX402();
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [isLoading, setIsLoading] = useState(false);
    
      // EXAMPLE 1: Fetching Data (Uses Budget or One-Time Payment)
      const handleFetchPremium = async () => {
        setIsLoading(true);
        setData(null);
        setError(null);
        try {
          const result = await fetchWith402(`${API_BASE}/api/premium-data`);
          setData(result);
        } catch (err) {
          if (isWalletError(err)) {
            setError("Transaction was cancelled by the user.");
          } else {
            setError(err.message);
          }
        } finally {
          setIsLoading(false);
        }
      }; //
    
      // EXAMPLE 2: Depositing to the Budget
      const handleDeposit = async () => {
        setIsLoading(true);
        setError(null);
        try {
          // We need a "dummy" invoice URL to get token & recipient details
          const sampleInvoiceUrl = `${API_BASE}/api/premium-data`; 
          const result = await depositBudget(sampleInvoiceUrl, 0.1); // Deposit 0.1 Tokens
          alert(`Deposit successful! New budget: ${result.newBudget}`);
        } catch (err) {
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      }; //
    
      return (
        <div>
          <button onClick={handleFetchPremium} disabled={isLoading}>
            {isLoading ? "Paying..." : "Fetch Premium Data (0.01 Token)"}
          </button>
          <button onClick={handleDeposit} disabled={isLoading}>
            {isLoading ? "Depositing..." : "Deposit Budget (0.1 Token)"}
          </button>
    
          {error && <p style={{ color: "red" }}>Error: {error}</p>}
          {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
        </div>
      );
    }

## 🤖 Demo Spotlight: Autonomous RAG Agent

The main demo (`AgentComponent.jsx`) is a RAG agent. When you ask it a question, the agent will:

1. Determine which tool (API) it needs.
2. Autonomously call `fetchWith402` for the paid endpoint.
3. If the user has a budget, the agent gets the data instantly.
4. If not, the `useX402` hook triggers the wallet pop-up for a one-time payment.
5. Once paid, the agent receives the context and answers the question.

This demonstrates an _agent-to-tool_ use case where an AI can independently interact with paid APIs.

## 🛠️ Environment Configuration

To run this project, you'll need a `.env` file in the `backend/` folder.

    # SPL Token Mint Address (e.g., USDC Devnet)
    SPL_TOKEN_MINT="Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
    
    # Your Solana wallet to receive payments
    MY_WALLET_ADDRESS="6DBM36PKEjNmheZyJbGz12Gt7J2ch8YrooZTjWAc5xkE"
    
    # (Optional) Vercel KV credentials for Budget Storage & Replay Protection
    KV_REST_API_URL="..."
    KV_REST_API_TOKEN="..."

_(Note: If KV is not configured, the backend defaults to a simple in-memory store for demo purposes)_

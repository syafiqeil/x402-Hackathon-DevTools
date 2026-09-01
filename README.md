# x402 DevTools for Solana: HTTP 402 Paywall SDK

This project is a full-stack implementation of the **HTTP 402 Payment Required** protocol adapted for Solana. It provides a set of tools (SDK) for developers to easily monetize their APIs using **SPL Tokens** on the Solana network—without requiring API keys, user accounts, or subscriptions.

This project is a strong fit for two x402 hackathon tracks:
1. **x402 Developer Tool - SDKs, infra, libraries**: We built a reusable `x402Paywall` middleware, `budgetPaywall` middleware, and a `useX402` React hook.
2. **x402 Agent Application - real AI agent use cases**: We created a RAG (Retrieval-Augmented Generation) AI agent that autonomously uses the `useX402` hook to pay for the context it needs.

---

## Live Demo

* **Frontend (RAG Agent Demo):** `https://x402-hackathon-devtools-fe.vercel.app/`
* **Backend (API Server):** `https://x402-hackathon-devtools.vercel.app/`

---

## Key Features

* **HTTP 402 Standard:** Fully compliant with the `402 Payment Required` challenge flow.
* **SPL Token Payments:** Monetize APIs using any SPL token (e.g., USDC on Solana Devnet).
* **Express.js Middleware:** Add `x402Paywall` and `budgetPaywall` as middlewares to protect your Express routes.
* **React Hook & Context (SDK):** Provides a simple `useX402` hook and `X402Provider` that abstract all wallet signing, payment execution, and verification logic on the frontend.
* **Innovative Budget System:** A solution to overcome the UX friction of micropayments. Users/agents can make a **one-time deposit** to fund their "budget", allowing future API calls to execute instantly **without repeated wallet pop-up confirmations**. Ideal for autonomous agents.
* **Replay Attack Protection:** On-chain memo verification and reference tracking prevent transaction signatures from being reused (using Vercel KV with seamless in-memory fallback).
* **Dynamic Tool Discovery:** Backend endpoint `/api/agent-tools` allows autonomous agents to dynamically discover available paid tools, cost requirements, and endpoints.

---

## Workflow Concept

This SDK seamlessly supports two payment flows:

### Flow 1: One-Time Payment (Standard 402)

This flow is used when a user has no pre-deposited budget or when budget is depleted.

```
[ Frontend ] -- (1) GET /api/premium-data -----------------------------> [ Backend ]
[ Frontend ] <-- (2) 402 Payment Required + JSON Invoice (Ref UUID) ---- [ Backend ]
[ Frontend ] -- (3) User signs SPL Transfer + Memo (Ref UUID) on-chain -> [ Solana Network ]
[ Frontend ] -- (4) GET /api/premium-data + Header Auth: x402 <Sig> ---> [ Backend ]
[ Frontend ] <-- (5) 200 OK + Premium Data ------------------------------ [ Backend ]
```

1. **Frontend**: Calls `fetchWith402` to a protected route (e.g., `/api/premium-data`).
2. **Backend**: `budgetPaywall` checks user budget (insufficient). `x402Paywall` returns an `HTTP 402` response with a unique `invoice` (amount, token, recipient, reference UUID).
3. **Frontend**: `useX402` catches the 402 response, prompts the user for wallet approval to send SPL tokens with the reference UUID included in the **Solana Memo Program**.
4. **Frontend**: Resubmits the request with an `Authorization: x402 <signature>` header and reference query param.
5. **Backend**: `x402Paywall` verifies the transaction signature on-chain (checking amount received, recipient owner, token mint, and memo match), marks reference as used, and grants access.

### Flow 2: Budget Payment (Fast UX for Micro-payments & Autonomous Agents)

This flow happens automatically if the user/agent has a pre-funded budget.

```
[ Frontend ] -- (1) Deposit via POST /api/confirm-budget-deposit -------> [ Backend ] (Saved to KV)
[ Frontend ] -- (2) GET /api/premium-data + Header x402-Payer-Pubkey --> [ Backend ]
[ Backend  ] -- (3) `budgetPaywall` deducts cost from KV ledger -------- [ Instant Access ]
[ Frontend ] <-- (4) 200 OK + Premium Data (No 402, No Wallet Popup) --- [ Backend ]
```

1. **Prerequisite**: The user/agent calls `depositBudget()`. The backend verifies the deposit transaction on-chain and updates `budget_<payerPubkey>` in the KV ledger.
2. **Frontend**: Calls `fetchWith402`. The hook automatically attaches the `x402-Payer-Pubkey` header.
3. **Backend**: `budgetPaywall` middleware runs first, checking the user's budget in the KV store.
4. **Backend**: Budget is sufficient! The backend deducts the cost in smallest token units and grants access immediately. **No 402 response, no wallet pop-up.**
5. **Fallback**: If the budget is insufficient, `budgetPaywall` passes control to `x402Paywall` (Flow 1).

---

## API Endpoints Specification

| Method | Endpoint | Auth / Protected | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/public` | Free | Public endpoint demonstration. |
| `GET` | `/api/agent-tools` | Free | Dynamic tool discovery endpoint for autonomous agents. |
| `GET` | `/api/get-context?docId={id}` | `budgetPaywall` / `x402Paywall` | Cost: **0.005 Tokens**. Returns RAG context documents (`tokenomics`, `roadmap`). |
| `GET` | `/api/premium-data` | `budgetPaywall` / `x402Paywall` | Cost: **0.01 Tokens**. Returns sample premium data. |
| `GET` | `/api/get-current-budget?payerPubkey={pubkey}` | Free | Fetches current available budget balance for a wallet public key. |
| `POST` | `/api/confirm-budget-deposit` | On-chain Verification | Verifies a budget deposit transaction on-chain and credits the user's KV ledger. |

---

## Quick Start (How to Use)

### 1. Backend (Express.js Server)

Monetize your API routes in 3 steps.

**Step 1: Install Dependencies**
```bash
npm install express cors @solana/web3.js @solana/spl-token @vercel/kv bs58 uuid
```

**Step 2: Configure Your Server (`server.js`)**  
Import `x402-paywall.js` and add `budgetPaywall`, `x402Paywall`, and the `/api/confirm-budget-deposit` endpoint:

```javascript
const express = require("express");
const cors = require("cors");
const { PublicKey } = require("@solana/web3.js");
const { getMint } = require("@solana/spl-token");
const {
  x402Paywall,
  budgetPaywall,
  verifyTransaction,
  kv,
  connection,
} = require("./x402-paywall");

const app = express();
app.use(cors({ origin: '*', exposedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// 1. Load Your Configuration
const CONFIG = {
  splToken: process.env.SPL_TOKEN_MINT,
  recipientWallet: process.env.MY_WALLET_ADDRESS,
};

// 2. Protect Premium Routes with Paywall Middlewares
// Note: `budgetPaywall` runs first, falling back to `x402Paywall`
app.get(
  "/api/premium-data",
  budgetPaywall({ amount: 0.01, ...CONFIG }),
  x402Paywall({ amount: 0.01, ...CONFIG }),
  (req, res) => {
    res.json({
      message: "This is your premium data!",
      paymentMethod: req.x402_payment_method || "unknown",
      timestamp: new Date().toISOString(),
    });
  }
);

// 3. Add Budget Deposit Confirmation Endpoint (With On-Chain Verification)
app.post("/api/confirm-budget-deposit", async (req, res) => {
  try {
    const { signature, reference, payerPubkey, amount } = req.body;

    if (!signature || !reference || !payerPubkey || !amount) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const refKey = `ref_${reference}`;
    if (await kv.get(refKey)) {
      return res.status(401).json({ error: "Deposit reference already claimed" });
    }

    // Verify transaction on-chain
    const verification = await verifyTransaction(
      signature,
      reference,
      amount,
      new PublicKey(CONFIG.splToken),
      new PublicKey(CONFIG.recipientWallet)
    );

    const MINT_PUBKEY = new PublicKey(CONFIG.splToken);
    const mintInfo = await getMint(connection, MINT_PUBKEY);
    const claimedAmountSmallestUnit = BigInt(Math.floor(amount * Math.pow(10, mintInfo.decimals)));

    if (verification.success && verification.amountReceivedSmallestUnit === claimedAmountSmallestUnit) {
      const budgetKey = `budget_${payerPubkey}`;
      const currentBudget = BigInt((await kv.get(budgetKey)) || "0");
      const depositAmount = verification.amountReceivedSmallestUnit;
      const newBudget = currentBudget + depositAmount;

      await kv.set(budgetKey, newBudget.toString());
      await kv.set(refKey, true, { ex: 3600 }); // Mark reference as used

      res.json({ 
        success: true, 
        newBudget: Number(newBudget) / Math.pow(10, mintInfo.decimals) 
      });
    } else {
      res.status(401).json({ error: `Verification failed: ${verification.error}` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;
```

---

### 2. Frontend (React / Vite)

Access your paid APIs in 3 steps.

**Step 1: Install Dependencies**
```bash
npm install @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-phantom @solana/web3.js @solana/spl-token buffer process
```

*Note for Vite users:* Solana SDK requires Node polyfills (`Buffer` and `process`). Ensure `vite-plugin-node-polyfills` is configured in `vite.config.js` and `Buffer` is attached to `window.Buffer` (see `frontend/src/polyfills.js`).

**Step 2: Wrap App with `X402Provider` (`App.jsx`)**
```jsx
import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

import { X402Provider } from "./X402Provider.jsx";
import YourMainComponent from "./YourMainComponent.jsx";

function App() {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <X402Provider>
            <YourMainComponent />
          </X402Provider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
```

**Step 3: Use `useX402` Hook in Components**
```jsx
import React, { useState } from "react";
import { useX402 } from "./useX402";

function YourMainComponent() {
  const { fetchWith402, depositBudget, API_BASE, isWalletError } = useX402();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch Paid API (Uses budget automatically or triggers 402 pop-up)
  const handleFetchPremium = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchWith402(`${API_BASE}/api/premium-data`);
      setData(result);
    } catch (err) {
      if (isWalletError(err)) {
        setError("Transaction cancelled by user.");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Deposit Funds into Agent Budget
  const handleDeposit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sampleInvoiceUrl = `${API_BASE}/api/premium-data`;
      const result = await depositBudget(sampleInvoiceUrl, 0.1); // Deposit 0.1 Tokens
      alert(`Deposit successful! New budget: ${result.newBudget}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

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
```

---

## Running Locally

Follow these steps to run both backend and frontend on your local development machine:

### Prerequisites
* Node.js (v18 or higher)
* Phantom Wallet installed in your browser (set network to **Devnet**)
* Solana Devnet SOL (from `solana airdrop` or faucet) and SPL Tokens (e.g. USDC Devnet mint)

### Step 1: Backend Setup
1. Navigate to backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file in `backend/`:
   ```env
   SPL_TOKEN_MINT="Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
   MY_WALLET_ADDRESS="YourSolanaWalletPublicKeyHere"
   ```
4. Start the server:
   ```bash
   npm start
   ```
   The backend runs on `http://localhost:3000` (or specified port).

### Step 2: Frontend Setup
1. Navigate to frontend directory in a new terminal:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file in `frontend/` (optional for local API target):
   ```env
   VITE_API_URL="http://localhost:3000"
   ```
4. Start Vite dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## Demo Spotlight: Autonomous RAG Agent

The main demo (`AgentComponent.jsx`) showcases a RAG (Retrieval-Augmented Generation) agent. When you ask it a question:

1. **Tool Discovery**: The agent fetches `/api/agent-tools` to discover available endpoints and costs.
2. **Autonomous Tool Execution**: The agent calls `fetchWith402` for the required endpoint (e.g., `/api/get-context?docId=tokenomics`).
3. **Fast Budget Execution**: If a budget is pre-funded, the agent retrieves context **instantly without interrupting the user**.
4. **Fallback 402 Challenge**: If no budget exists, `useX402` triggers a wallet prompt for a one-time payment.
5. **Context Ingestion**: Once data is retrieved, the agent uses the context to answer the user's query.

---

## Environment Configuration

| Variable | Location | Required | Description |
| :--- | :--- | :--- | :--- |
| `SPL_TOKEN_MINT` | `backend/.env` | Yes | Mint address of the accepted SPL Token (e.g., USDC Devnet mint). |
| `MY_WALLET_ADDRESS` | `backend/.env` | Yes | Your Solana wallet public key to receive payments. |
| `KV_REST_API_URL` | `backend/.env` | Optional | Vercel KV REST API URL for persistent budget & replay protection. |
| `KV_REST_API_TOKEN` | `backend/.env` | Optional | Vercel KV REST API Token. |
| `VITE_API_URL` | `frontend/.env` | Optional | Backend API URL (defaults to Vercel production or local server). |

*(Note: If Vercel KV credentials are not set, the backend automatically uses an in-memory `Map` and `Set` fallback for seamless local testing. Data in-memory will reset when the backend server restarts.)*

---

## License

This project is licensed under the MIT License.

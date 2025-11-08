// frontend/src/App.jsx

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import PremiumContent from "./PremiumContent.jsx";
import { X402Provider } from "./X402Provider.jsx";

function App() {
  const solanaNetwork = "devnet";
  const endpoint = useMemo(() => clusterApiUrl(solanaNetwork), [solanaNetwork]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <X402Provider>
            <div className="min-h-screen bg-white text-gray-900">
              <div className="container mx-auto max-w-7xl p-4 lg:p-8">
                
                <header className="flex lg:hidden justify-between items-center pb-4 mb-4 border-b border-gray-200">
                  <h1 className="text-2xl font-bold">x402 DevTools</h1>
                  <WalletMultiButton />
                </header>

                <div className="flex flex-col lg:flex-row lg:space-x-8">
                  
                  <div className="w-full lg:w-1/2 flex-shrink-0">
                    
                    <header className="hidden lg:flex justify-between items-center pb-4 mb-6">
                      <h1 className="text-3xl font-bold">x402 DevTools</h1>
                      <WalletMultiButton />
                    </header>
                    
                    <PremiumContent />
                  </div>

                  <div className="hidden lg:block w-px bg-gray-200"></div>

                  <div className="w-full lg:w-1/2 mt-8 lg:mt-0 lg:pt-20 lg:pl-8">
                    <div className="sticky top-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                      <h2 className="text-2xl font-semibold mb-4">Developer Tool</h2>
                      <p className="text-gray-600 leading-relaxed mb-4">
                        This demo showcases the full-stack implementation of the **HTTP 402 Paywall** protocol for Solana.
                      </p>
                      <p className="text-gray-600 leading-relaxed mb-2">
                        It provides a reusable developer toolkit:
                      </p>
                      <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                        <li>
                          <strong className="text-gray-800">`x402Paywall` (Backend):</strong> An Express.js middleware to protect API routes.
                        </li>
                        <li>
                          <strong className="text-gray-800">`useX402` (Frontend):</strong> A React hook that handles the entire 402 payment and verification flow.
                        </li>
                        <li>
                          <strong className="text-gray-800">Budget System:</strong> An innovative "deposit" flow to pre-fund autonomous agents, eliminating repeated transaction prompts.
                        </li>
                      </ul>
                      <p className="text-gray-600 leading-relaxed">
                        The **Autonomous Agent** on the left uses these tools. Try depositing a budget, then ask it a question to see it pay for its own data instantly, without a wallet pop-up.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </X402Provider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
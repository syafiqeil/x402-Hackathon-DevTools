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
import { AgentComponent } from "./AgentComponent.jsx"; 
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
              <div className="container mx-auto p-4 lg:p-8">
                
                <header className="flex justify-between items-center gap-6 pb-4 mb-6 border-b border-gray-200">
                  <h1 className="text-2xl lg:text-4xl font-bold">x402 DevTools</h1>
                  <WalletMultiButton />
                </header>

                <div className="flex flex-col lg:flex-row lg:space-x-6">
                  
                  <div className="w-full lg:w-1/3">
                    <AgentComponent /> 
                  </div>

                  <div className="w-full lg:w-1/3 mt-6 lg:mt-0">
                    <PremiumContent />
                  </div>

                  <div className="w-full lg:w-1/3 mt-6 lg:mt-0">
                    <div className="h-full p-6 bg-gray-50 rounded-lg border border-gray-200">
                      <h2 className="text-2xl font-semibold mb-4">Developer Tool</h2>
                      <p className="text-gray-600 leading-relaxed mb-4">
                        This demo showcases the full-stack implementation of the HTTP 402 Paywall protocol for Solana.
                      </p>
                      <p className="text-gray-600 leading-relaxed mb-2">
                        It provides a reusable developer toolkit:
                      </p>
                      <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                        <li>
                          <strong className="text-gray-800">x402Paywall (Backend):</strong> An Express.js middleware to protect API routes.
                        </li>
                        <li>
                          <strong className="text-gray-800">useX402 (Frontend):</strong> A React hook that handles the entire 402 payment and verification flow.
                        </li>
                        <li>
                          <strong className="text-gray-800">Budget System:</strong> An innovative "deposit" flow to pre-fund autonomous agents, eliminating repeated transaction prompts.
                        </li>
                      </ul>
                      <p className="text-gray-600 leading-relaxed">
                        The Autonomous Agent on the left uses these tools. Try depositing a budget, then ask it a question to see it pay for its own data instantly, without a wallet pop-up.
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
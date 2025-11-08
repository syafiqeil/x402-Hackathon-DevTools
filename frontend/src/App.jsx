// frontend/src/App.jsx

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

import { X402Provider } from "./X402Provider.jsx";
import AgentComponent from "./AgentComponent.jsx"; 

function App() {
  // Use 'devnet' for development
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  // Specify the wallets you want to support
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <X402Provider>
            <div className="min-h-screen bg-gray-100 p-4">
              <div className="flex flex-col lg:flex-row lg:space-x-8 max-w-7xl mx-auto">
                <div className="flex-1 lg:w-1/2 flex flex-col items-start lg:items-start lg:pr-4"> 
                  <div className="w-full"> 
                    <div className="flex items-center justify-between lg:justify-start lg:space-x-4 mb-6">
                      <h1 className="text-2xl font-bold text-gray-800">x402 DevTool Demo</h1>
                      <div className="lg:hidden"> 
                          <div className="wallet-button-container">
                            <AgentComponent showWalletButton={true} /> 
                          </div>
                      </div>
                    </div>

                    <div className="w-full">
                      <AgentComponent showWalletButton={false} /> 
                    </div>
                  </div>
                </div>

                <div className="hidden lg:block w-px bg-gray-300 my-4"></div> 

                <div className="flex-1 lg:w-1/2 flex flex-col items-start lg:pl-4 mt-8 lg:mt-0"> 
                  <h2 className="text-xl font-semibold text-gray-700 mb-4">Developer Tools</h2>
                  <p className="text-gray-600 leading-relaxed">
                    This demonstration showcases the power and flexibility of the x402 DevTools for Solana. It provides a full-stack implementation of the HTTP 402 paywall protocol, allowing developers to easily monetize their APIs using SPL Tokens.
                  </p>
                  <p className="text-gray-600 leading-relaxed mt-2">
                    Key features include an Express.js middleware for backend integration, a convenient React hook for frontend payments, and an innovative budget system that eliminates repeated wallet confirmations for autonomous agents.
                  </p>
                  <p className="text-gray-600 leading-relaxed mt-2">
                    Explore the live demo, review the code, and integrate these powerful tools into your Solana dApps.
                  </p>
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
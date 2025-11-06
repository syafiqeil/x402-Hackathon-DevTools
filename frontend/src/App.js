// frontend/src/App.js

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";

require("@solana/wallet-adapter-react-ui/styles.css");

import PremiumContent from "./PremiumContent"; 

function App() {
  const solanaNetwork = "devnet";
  const endpoint = useMemo(() => clusterApiUrl(solanaNetwork), [solanaNetwork]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <PremiumContent />
          
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
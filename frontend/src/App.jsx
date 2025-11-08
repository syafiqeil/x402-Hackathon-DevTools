// frontend/src/App.jsx

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";
import PremiumContent from "./PremiumContent.jsx";
import { X402Provider } from "./X402Provider.jsx"; // <-- IMPOR BARU

function App() {
  const solanaNetwork = "devnet";
  const endpoint = useMemo(() => clusterApiUrl(solanaNetwork), [solanaNetwork]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <X402Provider>
            {" "}
            {/* <-- BUNGKUS DI SINI */}
            <PremiumContent />
          </X402Provider>{" "}
          {/* <-- TUTUP DI SINI */}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
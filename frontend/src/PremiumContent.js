// PremiumContent.js

import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useX402 } from "./useX402";

function PremiumContent() {
  // Gunakan hook untuk API publik
  const publicApi = useX402("/api/public");
  
  // Gunakan hook untuk API premium
  const premiumApi = useX402("https://syafiqeil.vercel.app/api/premium-data");

  return (
    <div style={{ padding: 20 }}>
      <h1>Demo x402 Hackathon</h1>
      <WalletMultiButton />
      <hr />

      {/* API Publik */}
      <h2>Tes API Publik (Gratis)</h2>
      <button onClick={publicApi.fetchData} disabled={publicApi.isLoading}>
        {publicApi.isLoading ? "Loading..." : "Ambil Data Publik"}
      </button>
      {publicApi.error && <p style={{ color: "red" }}>Error: {publicApi.error}</p>}
      {publicApi.data && <pre>{JSON.stringify(publicApi.data, null, 2)}</pre>}

      <hr />

      {/* API Premium */}
      <h2>Tes API Premium (Perlu Bayar 0.01 Token)</h2>
      <button onClick={premiumApi.fetchData} disabled={premiumApi.isLoading}>
        {premiumApi.isLoading ? "Membayar & Mengambil..." : "Ambil Data Premium"}
      </button>
      {premiumApi.error && <p style={{ color: "red" }}>Error: {premiumApi.error}</p>}
      {premiumApi.data && (
        <pre style={{ background: "#e0ffe0" }}>
          {JSON.stringify(premiumApi.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default PremiumContent;
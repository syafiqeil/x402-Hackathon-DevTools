// frontend/src/PremiumContent.jsx

import React, { useState } from "react"; 
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useX402 } from "./useX402"; 
import { AgentComponent } from "./AgentComponent";

const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    maxWidth: "600px",
    margin: "0 auto",
    padding: "20px",
    color: "#333",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "20px",
    borderBottom: "1px solid #eaeaea",
  },
  headerTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "600",
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "24px",
    marginTop: "30px",
  },
  apiCard: {
    border: "1px solid #eaeaea",
    borderRadius: "8px",
    padding: "24px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
    display: "flex",
    flexDirection: "column",
  },
  apiCardTitle: {
    margin: "0 0 12px 0",
    fontSize: "20px",
    fontWeight: "600",
  },
  apiCardDescription: {
    fontSize: "14px",
    color: "#555",
    lineHeight: 1.5,
    minHeight: "84px",
  },
  button: {
    marginTop: "auto",
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    fontWeight: "500",
    cursor: "pointer",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "6px",
    transition: "background-color 0.2s",
  },
  buttonDisabled: {
    backgroundColor: "#c0c0c0",
    cursor: "not-allowed",
  },
  preBox: {
    backgroundColor: "#f4f4f4",
    border: "1px solid #ddd",
    borderRadius: "6px",
    padding: "16px",
    overflowX: "auto",
    marginTop: "20px",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  errorBox: {
    backgroundColor: "#fff0f0",
    border: "1px solid #d99",
    color: "#d00",
    padding: "16px",
    borderRadius: "6px",
    marginTop: "20px",
    fontSize: "14px",
  },
  successBox: {
    backgroundColor: "#f0fff0",
    border: "1px solid #9d9",
    color: "#0a6c0a",
  },
};

function PremiumContent() {
  // Gunakan hook konteks
  const { fetchWith402, isLoading, error, API_BASE } = useX402();

  // Kelola state data secara lokal di dalam komponen
  const [publicData, setPublicData] = useState(null);
  const [premiumData, setPremiumData] = useState(null);
  const [localError, setLocalError] = useState(null);

  const handleFetchPublic = async () => {
    setLocalError(null);
    const data = await fetchWith402(`${API_BASE}/api/public`);
    if (data) setPublicData(data);
    if (error) setLocalError(error);
  };

  const handleFetchPremium = async () => {
    setLocalError(null);
    const data = await fetchWith402(`${API_BASE}/api/premium-data`);
    if (data) setPremiumData(data);
    if (error) setLocalError(error);
  };

  return (
    <div style={styles.container}>
      {/* header */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>x402 DevTool Demo</h1>
        <WalletMultiButton />
      </header>

      {/* komponen agen */}
      <AgentComponent />

      <hr
        style={{
          margin: "30px 0",
          border: "none",
          borderBottom: "1px solid #eee",
        }}
      />

      {/* grid api */}
      <div style={styles.gridContainer}>
        {/* api card pub */}
        <div style={styles.apiCard}>
          <h2 style={styles.apiCardTitle}>Public API (Free)</h2>
          <p style={styles.apiCardDescription}>
            Endpoint ini mendemonstrasikan akses gratis tanpa pembayaran.
          </p>
          <button
            onClick={handleFetchPublic}
            disabled={isLoading}
            style={{
              ...styles.button,
              ...(isLoading ? styles.buttonDisabled : {}),
            }}
          >
            {isLoading ? "Loading..." : "Fetch Public Data"}
          </button>

          {publicData && (
            <pre style={styles.preBox}>
              {JSON.stringify(publicData, null, 2)}
            </pre>
          )}
        </div>

        {/* api card prem */}
        <div style={styles.apiCard}>
          <h2 style={styles.apiCardTitle}>Premium API (x402 Payment)</h2>
          <p style={styles.apiCardDescription}>
            Endpoint ini dilindungi. Coba dulu dengan Anggaran Agen, jika gagal
            atau kosong, ia akan memicu 402 popup.
          </p>
          <button
            onClick={handleFetchPremium}
            disabled={isLoading}
            style={{
              ...styles.button,
              ...(isLoading ? styles.buttonDisabled : {}),
            }}
          >
            {isLoading ? "Membayar & Mengambil..." : "Fetch Premium Data"}
          </button>

          {premiumData && (
            <pre style={{ ...styles.preBox, ...styles.successBox }}>
              {JSON.stringify(premiumData, null, 2)}
            </pre>
          )}
        </div>
      </div>
      {/* Tampilkan error global dari hook */}
      {localError && (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {localError}
        </div>
      )}
    </div>
  );
}

export default PremiumContent;
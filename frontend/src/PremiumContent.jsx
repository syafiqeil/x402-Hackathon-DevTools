// frontend/src/PremiumContent.jsx

import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useX402 } from "./useX402";
import { AgentComponent } from "./AgentComponent";

const rawBase = import.meta.env.VITE_API_URL || "";
const API_BASE = rawBase.replace(/\/$/, "");

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
    color: '#333',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '20px',
    borderBottom: '1px solid #eaeaea',
  },
  headerTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '600',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    marginTop: '30px',
  },
  apiCard: {
    border: '1px solid #eaeaea',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
  },
  apiCardTitle: {
    margin: '0 0 12px 0',
    fontSize: '20px',
    fontWeight: '600',
  },
  apiCardDescription: {
    fontSize: '14px',
    color: '#555',
    lineHeight: 1.5,
    minHeight: '84px', 
  },
  button: {
    marginTop: 'auto', 
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#c0c0c0',
    cursor: 'not-allowed',
  },
  preBox: {
    backgroundColor: '#f4f4f4',
    border: '1px solid #ddd',
    borderRadius: '6px',
    padding: '16px',
    overflowX: 'auto',
    marginTop: '20px',
    fontSize: '13px',
    lineHeight: 1.6,
  },
  errorBox: {
    backgroundColor: '#fff0f0',
    border: '1px solid #d99',
    color: '#d00',
    padding: '16px',
    borderRadius: '6px',
    marginTop: '20px',
    fontSize: '14px',
  },
  successBox: {
    backgroundColor: '#f0fff0',
    border: '1px solid #9d9',
    color: '#0a6c0a',
  },
};

function PremiumContent() {
  const publicApi = useX402(`${API_BASE}/api/public`);
  const premiumApi = useX402(`${API_BASE}/api/premium-data`);

  return (
    <div style={styles.container}>
      {/* header */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>x402 DevTool Demo</h1>
        <WalletMultiButton />
      </header>

      {/* komponen agen */}
      <AgentComponent /> 

      <hr style={{
        margin: '30px 0', 
        border: 'none', 
        borderBottom: '1px solid #eee'
      }} />

      {/* grid api */}
      <div style={styles.gridContainer}>
        
        {/* api card pub */}
        <div style={styles.apiCard}>
          <h2 style={styles.apiCardTitle}>Public API (Free)</h2>
          <p style={styles.apiCardDescription}>
            This endpoint is open to everyone. It demonstrates free access to 
            public data without any payment required.
          </p>
          <button 
            onClick={publicApi.fetchData} 
            disabled={publicApi.isLoading}
            style={{...styles.button, ...(publicApi.isLoading ? styles.buttonDisabled : {})}}
          >
            {publicApi.isLoading ? "Loading..." : "Fetch Public Data"}
          </button>
          
          {publicApi.error && (
            <div style={styles.errorBox}>
              <strong>Error:</strong> {publicApi.error}
            </div>
          )}
          {publicApi.data && (
            <pre style={styles.preBox}>
              {JSON.stringify(publicApi.data, null, 2)}
            </pre>
          )}
        </div>

        {/* api card prem */}
        <div style={styles.apiCard}>
          <h2 style={styles.apiCardTitle}>Premium API (x402 Payment)</h2>
          <p style={styles.apiCardDescription}>
            This endpoint is protected by the x402 paywall. Accessing it 
            requires a one-time 0.01 Token payment on Solana devnet.
          </p>
          <button 
            onClick={premiumApi.fetchData} 
            disabled={premiumApi.isLoading}
            style={{...styles.button, ...(premiumApi.isLoading ? styles.buttonDisabled : {})}}
          >
            {premiumApi.isLoading ? "Paying & Fetching..." : "Fetch Premium Data"}
          </button>
          
          {premiumApi.error && (
            <div style={styles.errorBox}>
              <strong>Error:</strong> {premiumApi.error}
            </div>
          )}
          {premiumApi.data && (
            <pre style={{...styles.preBox, ...styles.successBox}}>
              {JSON.stringify(premiumApi.data, null, 2)}
            </pre>
          )}
        </div>

      </div>
    </div>
  );
}

export default PremiumContent;
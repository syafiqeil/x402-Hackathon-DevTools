// frontend/src/AgentComponent.jsx (FIXED)

import React, { useState, useEffect } from "react";
import { useX402 } from "./useX402"; 

// ... (Salin 'styles' Anda dari file lama) ...
const styles = {
  chatBox: {
    border: "1px solid #ccc",
    padding: "10px",
    height: "300px",
    overflowY: "scroll",
    background: "#f9f9f9",
    borderRadius: "8px",
  },
  input: {
    width: "calc(100% - 70px)",
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "8px",
  },
  button: {
    width: "60px",
    padding: "10px",
    marginLeft: "10px",
    border: "none",
    background: "#007bff",
    color: "white",
    borderRadius: "8px",
    cursor: "pointer",
  },
  msg: { margin: "5px 0", padding: "8px 12px", borderRadius: "10px" },
  userMsg: {
    background: "#e1f5fe",
    textAlign: "right",
    marginLeft: "auto",
  },
  agentMsg: { background: "#f0f0f0" },
  agentThinking: {
    background: "#fffbe6",
    fontStyle: "italic",
    color: "#666",
  },
  budgetArea: {
    marginTop: '15px',
    padding: '10px',
    background: '#fafafa',
    border: '1px solid #eee',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  budgetInput: {
    padding: '8px',
    width: '60px',
    border: '1px solid #ccc',
    borderRadius: '4px'
  },
  errorBox: { // Tambahkan style ini untuk error lokal
    backgroundColor: '#fff0f0',
    border: '1px solid #d99',
    color: '#d00',
    padding: '10px',
    borderRadius: '6px',
    marginTop: '10px',
    fontSize: '14px',
  },
};


export function AgentComponent() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([
    {
      from: "agent",
      text: "Halo! Saya adalah agen RAG otonom. Saya dapat menemukan alat untuk menjawab pertanyaan Anda.",
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [availableTools, setAvailableTools] = useState([]);
  const [budgetAmount, setBudgetAmount] = useState(0.01);
  
  // State error LOKAL
  const [localError, setLocalError] = useState(null);

  // Ambil fungsi dari konteks
  const { fetchWith402, depositBudget, isWalletError, API_BASE } = useX402();

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const tools = await fetch(`${API_BASE}/api/agent-tools`).then((res) =>
          res.json()
        );
        setAvailableTools(tools);
        addMessage(
          "agent",
          `Saya telah memuat ${tools.length} alat yang tersedia untuk saya gunakan (misal: "tokenomics", "roadmap").`,
          styles.agentThinking
        );
      } catch (e) {
        setLocalError(e.message); // Gunakan error lokal
      }
    };
    fetchTools();
  }, [API_BASE]);

  const addMessage = (from, text, style = {}) => {
    setMessages((prev) => [...prev, { from, text, style }]);
  };

  const handleSend = async () => {
    if (!prompt || isThinking) return;

    addMessage("user", prompt, styles.userMsg);
    setPrompt("");
    setIsThinking(true);
    setLocalError(null); // Bersihkan error

    try {
      const normalizedPrompt = prompt.toLowerCase();
      const tool = availableTools.find((t) =>
        normalizedPrompt.includes(t.id)
      );
      let answer;

      if (tool) {
        addMessage(
          "agent",
          `Saya menemukan alat "${tool.id}" untuk ini. Biaya ${tool.cost} token. Mencoba mengambil (via anggaran atau 402)...`,
          styles.agentThinking
        );
        
        // Tambahkan try...catch di sini
        const result = await fetchWith402(`${API_BASE}${tool.endpoint}`);
        
        if (result && result.context) {
          answer = `Berikut adalah informasi tentang ${tool.id}: ${result.context} (Pembayaran via: ${result.paymentMethod})`;
        } else {
          // Seharusnya tidak terjadi, karena error akan di-throw
          answer = `Gagal mengambil konteks: Error tidak diketahui`;
        }
      } else {
        answer = "Maaf, saya tidak menemukan alat yang cocok untuk permintaan itu. Anda bisa bertanya tentang 'tokenomics' atau 'roadmap'.";
      }
      addMessage("agent", answer, styles.agentMsg);
    } catch (err) {
      const errorMsg = isWalletError(err) ? "Transaksi dibatalkan oleh pengguna." : err.message;
      setLocalError(errorMsg);
      addMessage("agent", `Error: ${errorMsg}`, {
        ...styles.agentMsg,
        color: "red",
      });
    } finally {
      setIsThinking(false);
    }
  };

  const handleDeposit = async () => {
    if (!budgetAmount || budgetAmount <= 0) {
      setLocalError("Silakan masukkan jumlah setoran yang valid.");
      return;
    }

    setIsThinking(true);
    setLocalError(null); // Bersihkan error
    addMessage(
      "agent",
      `Memulai setoran anggaran sebesar ${budgetAmount} token...`,
      styles.agentThinking
    );

    try {
      const sampleInvoiceUrl = `${API_BASE}${availableTools[0].endpoint}`;
      const result = await depositBudget(sampleInvoiceUrl, budgetAmount);
      
      if (result && result.success) {
        addMessage(
          "agent",
          `Setoran anggaran berhasil! Total anggaran Anda sekarang: ${result.newBudget} token.`,
          styles.agentMsg
        );
      }
    } catch (err) {
      const errorMsg = isWalletError(err) ? "Transaksi dibatalkan oleh pengguna." : err.message;
      setLocalError(errorMsg);
      addMessage("agent", `Setoran anggaran gagal: ${errorMsg}`, {
        ...styles.agentMsg,
        color: "red",
      });
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div style={/* ... style container ... */{
        border: "1px solid #eaeaea",
        borderRadius: "8px",
        padding: "24px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
        marginTop: "30px",
      }}>
      <h2 style={/* ... style h2 ... */{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: "600" }}>
        x402 Agent Otonom (RAG)
      </h2>
      <p style={/* ... style p ... */{ fontSize: "14px", color: "#555", lineHeight: 1.5 }}>
        Agen ini **menemukan alatnya** secara dinamis dan **mengelola anggarannya**
        sendiri. Setor anggaran untuk mengizinkan agen beroperasi tanpa
        meminta persetujuan setiap saat.
      </p>

      <div style={styles.budgetArea}>
        <label htmlFor="budget" style={{ fontSize: "14px", fontWeight: "500" }}>
          Anggaran Agen:
        </label>
        <input
          type="number"
          id="budget"
          style={styles.budgetInput}
          value={budgetAmount}
          onChange={(e) => setBudgetAmount(parseFloat(e.target.value))}
          min="0.001"
          step="0.001"
        />
        <button
          onClick={handleDeposit}
          disabled={isThinking} // Hanya nonaktifkan jika agen sedang berpikir
          style={{
            ...styles.button,
            width: "auto",
            padding: "8px 12px",
            fontSize: "14px",
            ...(isThinking ? styles.buttonDisabled : {})
          }}
        >
          {isThinking ? "Memproses..." : "Setor Anggaran"}
        </button>
      </div>

      <div style={styles.chatBox}>
        {messages.map((msg, i) => (
          <div key={i} style={{ ...styles.msg, ...msg.style }}>
            {msg.text}
          </div>
        ))}
      </div>
      <div style={{ marginTop: "10px", display: "flex" }}>
        <input
          type="text"
          style={styles.input}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Tanya tentang 'tokenomics' atau 'roadmap'"
        />
        <button
          onClick={handleSend}
          style={{...styles.button, ...(isThinking ? styles.buttonDisabled : {})}}
          disabled={isThinking} // Hanya nonaktifkan jika agen sedang berpikir
        >
          {isThinking ? "..." : "Kirim"}
        </button>
      </div>
      {localError && ( // Tampilkan error lokal
        <div style={styles.errorBox}>
          <strong>Error:</strong> {localError}
        </div>
      )}
    </div>
  );
}
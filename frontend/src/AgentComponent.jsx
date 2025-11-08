// frontend/src/AgentComponent.jsx
import React, { useState, useEffect } from "react";
import { useX402 } from "./useX402"; // Hook konteks baru kita!

// (Salin objek `styles` dari file asli Anda)
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
  }
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
  
  // IMPROVISASI #3: State untuk menyimpan alat yang ditemukan
  const [availableTools, setAvailableTools] = useState([]);
  
  // IMPROVISASI #1: State untuk manajemen anggaran
  const [budgetAmount, setBudgetAmount] = useState(0.01);

  // Ambil fungsi dari konteks
  const { fetchWith402, depositBudget, isLoading, error, API_BASE } = useX402();

  // IMPROVISASI #3: Muat alat yang tersedia saat komponen dimuat
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
        addMessage("agent", `Gagal memuat alat: ${e.message}`, {
          ...styles.agentMsg,
          color: "red",
        });
      }
    };
    fetchTools();
  }, [API_BASE]); // Hanya berjalan sekali

  const addMessage = (from, text, style = {}) => {
    setMessages((prev) => [...prev, { from, text, style }]);
  };

  /**
   * IMPROVISASI #3: Logika handleSend yang dinamis
   */
  const handleSend = async () => {
    if (!prompt || isThinking) return;

    addMessage("user", prompt, styles.userMsg);
    setPrompt("");
    setIsThinking(true);

    try {
      // 1. Temukan alat yang cocok
      const normalizedPrompt = prompt.toLowerCase();
      const tool = availableTools.find((t) =>
        normalizedPrompt.includes(t.id)
      );

      let answer;

      if (tool) {
        // 2. Alat ditemukan!
        addMessage(
          "agent",
          `Saya menemukan alat "${tool.id}" untuk ini. Biaya ${tool.cost} token. Mencoba mengambil (via anggaran atau 402)...`,
          styles.agentThinking
        );

        // 3. Panggil alat menggunakan fetchWith402
        // Ini akan secara otomatis menggunakan anggaran JIKA ada,
        // atau memicu popup 402 JIKA TIDAK.
        const result = await fetchWith402(`${API_BASE}${tool.endpoint}`);

        if (result && result.context) {
          answer = `Berikut adalah informasi tentang ${tool.id}: ${result.context} (Pembayaran via: ${result.paymentMethod})`;
        } else {
          // Error sudah ditangani oleh hook, tapi kita tampilkan pesan
          answer = `Gagal mengambil konteks: ${error || "Error tidak diketahui"}`;
        }
      } else {
        answer = "Maaf, saya tidak menemukan alat yang cocok untuk permintaan itu. Anda bisa bertanya tentang 'tokenomics' atau 'roadmap'.";
      }

      addMessage("agent", answer, styles.agentMsg);
    } catch (err) {
      addMessage("agent", `Error: ${err.message}`, {
        ...styles.agentMsg,
        color: "red",
      });
    } finally {
      setIsThinking(false);
    }
  };

  /**
   * IMPROVISASI #1: Fungsi untuk menangani setoran anggaran
   */
  const handleDeposit = async () => {
    if (!budgetAmount || budgetAmount <= 0) {
        addMessage("agent", "Silakan masukkan jumlah setoran yang valid.", styles.agentMsg);
        return;
    }
    
    setIsThinking(true);
    addMessage("agent", `Memulai setoran anggaran sebesar ${budgetAmount} token...`, styles.agentThinking);
    
    // Kita perlu satu URL invoice untuk mendapatkan detail (penerima, token)
    // Kita asumsikan semua alat menggunakan detail yang sama
    const sampleInvoiceUrl = `${API_BASE}${availableTools[0].endpoint}`;

    const result = await depositBudget(sampleInvoiceUrl, budgetAmount);

    if (result && result.success) {
        addMessage("agent", `Setoran anggaran berhasil! Total anggaran Anda sekarang: ${result.newBudget} token.`, styles.agentMsg);
    } else {
        addMessage("agent", `Setoran anggaran gagal: ${error}`, { ...styles.agentMsg, color: 'red' });
    }
    setIsThinking(false);
  };

  return (
    <div
      style={{
        border: "1px solid #eaeaea",
        borderRadius: "8px",
        padding: "24px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
        marginTop: "30px",
      }}
    >
      <h2
        style={{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: "600" }}
      >
        x402 Agent Otonom (RAG)
      </h2>
      <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.5 }}>
        Agen ini **menemukan alatnya** secara dinamis dan **mengelola anggarannya**
        sendiri. Setor anggaran untuk mengizinkan agen beroperasi tanpa
        meminta persetujuan setiap saat.
      </p>
      
      {/* IMPROVISASI #1: Area Setoran Anggaran */}
      <div style={styles.budgetArea}>
        <label htmlFor="budget" style={{fontSize: '14px', fontWeight: '500'}}>Anggaran Agen:</label>
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
            disabled={isLoading}
            style={{...styles.button, width: 'auto', padding: '8px 12px', fontSize: '14px'}}
        >
            {isLoading ? "Memproses..." : "Setor Anggaran"}
        </button>
      </div>

      <div style={styles.chatBox}>
        {messages.map((msg, i) => (
          <div key={i} style={{ ...styles.msg, ...msg.style }}>
            {msg.text}
          </div>
        ))}
        {isLoading && !isThinking && ( // Tampilkan jika loading tapi bukan dari handleSend
            <div style={{...styles.msg, ...styles.agentThinking}}>Memproses...</div>
        )}
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
        <button onClick={handleSend} style={styles.button} disabled={isThinking || isLoading}>
          {isThinking ? "..." : "Kirim"}
        </button>
      </div>
       {error && (
        <div style={{...styles.errorBox, marginTop: '10px', padding: '10px'}}>
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
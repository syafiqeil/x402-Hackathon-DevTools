// frontend/src/AgentComponent.jsx
import React, { useState } from 'react';
import { useX402 } from './useX402'; 

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const styles = {
  chatBox: { 
    border: '1px solid #ccc', 
    padding: '10px', 
    height: '300px', 
    overflowY: 'scroll', 
    background: '#f9f9f9', 
    borderRadius: '8px' 
  },
  input: { 
    width: 'calc(100% - 70px)', 
    padding: '10px', 
    border: '1px solid #ccc', 
    borderRadius: '8px' 
  },
  button: { 
    width: '60px', 
    padding: '10px', 
    marginLeft: '10px', 
    border: 'none', 
    background: '#007bff', 
    color: 'white', 
    borderRadius: '8px', 
    cursor: 'pointer' 
  },
  msg: { 
    margin: '5px 0', 
    padding: '8px 12px', 
    borderRadius: '10px' 
  },
  userMsg: { 
    background: '#e1f5fe', 
    textAlign: 'right', 
    marginLeft: 'auto' 
  },
  agentMsg: { 
    background: '#f0f0f0' 
  },
  agentThinking: { 
    background: '#fffbe6', 
    fontStyle: 'italic', 
    color: '#666' 
  }
};

export function AgentComponent() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    { from: 'agent', text: 'Halo! Saya adalah agen RAG. Anda bisa bertanya tentang "tokenomics" atau "roadmap".' }
  ]);

  // agen ini memiliki alat (tool) yang dilindungi oleh x402
  const contextApi = useX402();

  const addMessage = (from, text, style = {}) => {
    setMessages(prev => [...prev, { from, text, style }]);
  };

  const handleSend = async () => {
    if (!prompt) return;
    
    addMessage('user', prompt, styles.userMsg);
    setPrompt('');

    // Logika Inti Agen AI 
    try {
      // 1. agen berpikir dan memutuskan apakah ia butuh data
      let docId = null;
      if (prompt.toLowerCase().includes('tokenomics')) {
        docId = 'tokenomics';
      } else if (prompt.toLowerCase().includes('roadmap')) {
        docId = 'roadmap';
      }

      let context = "Maaf, saya tidak tahu jawabannya.";

      // 2. jika butuh data, agen membeli data tersebut
      if (docId) {
        addMessage('agent', `Saya perlu mengambil dokumen "${docId}". Ini memerlukan pembayaran 0.005 Token...`, styles.agentThinking);
        
        // agen secara otonom menggunakan Dev Tool yang ada
        const url = `${API_BASE}/api/get-context?docId=${docId}`;
        const data = await contextApi.fetchData(url); // memicu alur 402
        
        if (data && data.context) {
          context = `Berikut adalah informasi tentang ${docId}: ${data.context}`;
        } else {
          throw new Error(contextApi.error || "Gagal mengambil konteks.");
        }
      }

      // 3. agen memberikan jawaban
      addMessage('agent', context, styles.agentMsg);

    } catch (err) {
      addMessage('agent', `Error: ${err.message}`, { ...styles.agentMsg, color: 'red' });
    }
  };

  return (
    <div style={{ border: '1px solid #eaeaea', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)', marginTop: '30px' }}>
      <h2 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '600' }}>x402 Agent Application (RAG)</h2>
      <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.5 }}>
        This agent autonomously pays for the context it needs to answer your questions. 
        It uses the `useX402` Dev Tool.
      </p>
      <div style={styles.chatBox}>
        {messages.map((msg, i) => (
          <div key={i} style={{...styles.msg, ...msg.style}}>{msg.text}</div>
        ))}
      </div>
      <div style={{ marginTop: '10px', display: 'flex' }}>
        <input 
          type="text"
          style={styles.input}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} style={styles.button}>Send</button>
      </div>
    </div>
  );
}
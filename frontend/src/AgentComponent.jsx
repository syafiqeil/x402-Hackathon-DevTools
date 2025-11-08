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
    { from: 'agent', text: 'Hello! I am a RAG agent. You can ask me about "tokenomics" or "roadmap".' }
  ]);
  const [isThinking, setIsThinking] = useState(false);

  // panggil hook di top level untuk setiap endpoint yang mungkin
  const tokenomicsApi = useX402(
    `${API_BASE}/api/get-context?docId=tokenomics`
  );
  const roadmapApi = useX402(
    `${API_BASE}/api/get-context?docId=roadmap`
  );
  
  const addMessage = (from, text, style = {}) => {
    setMessages(prev => [...prev, { from, text, style }]);
  };

  const handleSend = async () => {
    if (!prompt || isThinking) return;
    
    addMessage('user', prompt, styles.userMsg);
    setPrompt('');
    setIsThinking(true);

    try {
      let docId = null;
      if (prompt.toLowerCase().includes('tokenomics')) {
        docId = 'tokenomics';
      } else if (prompt.toLowerCase().includes('roadmap')) {
        docId = 'roadmap';
      }

      let answer = "Maaf, saya tidak tahu jawabannya.";

      if (docId) {
        addMessage('agent', `Saya perlu mengambil dokumen "${docId}". Ini memerlukan pembayaran 0.005 Token...`, styles.agentThinking);
        
        let context = null;
        let apiError = null;

        // panggil fungsi fetchData dari hook yang sudah diinisialisasi
        if (docId === 'tokenomics') {
          // jika isLoading atau ada error sebelumnya, tampilkan
          if (tokenomicsApi.isLoading) {
             addMessage('agent', 'Pembayaran tokenomics sedang diproses...', styles.agentThinking);
             return; // jangan kirim lagi jika sudah loading
          }
          if (tokenomicsApi.error) {
            apiError = tokenomicsApi.error;
          }
          const result = await tokenomicsApi.fetchData();
          if (result && result.context) {
            context = result.context;
          } else {
            apiError = tokenomicsApi.error; // ambil error terbaru dari hook
          }

        } else if (docId === 'roadmap') {
          // jika isLoading atau ada error sebelumnya, tampilkan
          if (roadmapApi.isLoading) {
             addMessage('agent', 'Pembayaran roadmap sedang diproses...', styles.agentThinking);
             return; // jangan kirim lagi jika sudah loading
          }
           if (roadmapApi.error) {
            apiError = roadmapApi.error;
          }
          const result = await roadmapApi.fetchData();
          if (result && result.context) {
            context = result.context;
          } else {
            apiError = roadmapApi.error; // ambil error terbaru dari hook
          }
        }
       
        if (context) {
          answer = `Berikut adalah informasi tentang ${docId}: ${context}`;
        } else {
          // lempar error jika ada, agar ditangkap oleh 'catch'
          throw new Error(apiError || "Gagal mengambil konteks.");
        }
      }

      addMessage('agent', answer, styles.agentMsg);

    } catch (err) {
      addMessage('agent', `Error: ${err.message}`, { ...styles.agentMsg, color: 'red' });
    } finally {
      setIsThinking(false);
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
// frontend/src/AgentComponent.jsx
import React, { useState, useEffect } from "react";
import { useX402 } from "./useX402";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

// Receive a prop to optionally show the wallet button
function AgentComponent({ showWalletButton }) {
  const { 
    fetchWith402, 
    depositBudget, 
    API_BASE, 
    isWalletConnected, 
    isWalletError, 
    publicKey 
  } = useX402();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [premiumData, setPremiumData] = useState(null);
  const [freeData, setFreeData] = useState(null);
  const [agentBudget, setAgentBudget] = useState(0.01); // Default budget
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch current budget from the backend
  const fetchCurrentBudget = async () => {
    if (!publicKey) return;
    try {
      const response = await fetch(`${API_BASE}/api/get-current-budget?payerPubkey=${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Update local state with the actual budget from backend
        // Assuming the backend returns budget in lamports, convert to SOL/USDC
        setAgentBudget(parseFloat(data.currentBudget) / Math.pow(10, 8)); // Adjust for decimals
      }
    } catch (err) {
      console.error("Failed to fetch current budget:", err);
    }
  };

  useEffect(() => {
    if (isWalletConnected && publicKey) {
      fetchCurrentBudget();
    }
  }, [isWalletConnected, publicKey]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !isWalletConnected) return;

    setLoading(true);
    setError(null);
    const newMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");

    try {
      // Simulate agent thinking and using a premium tool
      const agentThinkingMessage = { sender: "agent", text: "Agent thinking... fetching premium data if needed." };
      setMessages((prev) => [...prev, agentThinkingMessage]);

      const result = await fetchWith402(`${API_BASE}/api/rag-agent-tool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input }),
      });
      
      const agentResponse = { sender: "agent", text: result.response || "No response from agent." };
      setMessages((prev) => [...prev, agentResponse]);
      setPremiumData(result); // Store for debugging/display
      fetchCurrentBudget(); // Refresh budget after agent uses it

    } catch (err) {
      if (isWalletError(err)) {
        setError("Transaction cancelled by user.");
      } else {
        setError(`Error: ${err.message}`);
      }
      setMessages((prev) => [...prev, { sender: "agent", text: `Error processing your request: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDepositBudget = async () => {
    if (!isWalletConnected || loading) return;

    setLoading(true);
    setError(null);
    try {
      // Use a dummy premium endpoint to get the invoice details
      const dummyInvoiceUrl = `${API_BASE}/api/rag-agent-tool`; 
      const result = await depositBudget(dummyInvoiceUrl, agentBudget);
      alert(`Deposit successful! New budget: ${parseFloat(result.newBudget) / Math.pow(10, 8)} tokens.`);
      fetchCurrentBudget(); // Refresh budget after deposit
    } catch (err) {
      setError(`Deposit failed: ${err.message}`);
      if (isWalletError(err)) {
        setError("Deposit transaction cancelled by user.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFetchFreeData = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/free-data`);
      if (!response.ok) throw new Error("Failed to fetch free data");
      const data = await response.json();
      setFreeData(data);
    } catch (err) {
      setError(`Error fetching free data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md w-full">
      {/* WalletMultiButton - Render conditionally */}
      {showWalletButton && (
        <div className="mb-4">
          <WalletMultiButton />
        </div>
      )}

      {/* Autonomous Agent Section */}
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Autonomous Agent (RAG)</h2>
      <p className="text-sm text-gray-600 mb-4">
        This agent "finds" and "manages its budget" dynamically. Deposit funds to enable the agent to operate without requiring explicit approval for every single action.
      </p>

      {/* Budget Control */}
      <div className="flex items-center space-x-2 mb-6">
        <label htmlFor="agentBudget" className="text-gray-700 whitespace-nowrap">Agent Budget:</label>
        <input
          id="agentBudget"
          type="number"
          step="0.01"
          value={agentBudget}
          onChange={(e) => setAgentBudget(parseFloat(e.target.value))}
          className="p-2 border border-gray-300 rounded-md w-24"
        />
        <button
          onClick={handleDepositBudget}
          disabled={!isWalletConnected || loading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50"
        >
          {loading ? "Depositing..." : "Deposit Budget"}
        </button>
      </div>

      {/* Agent Chat */}
      <div className="border border-gray-300 rounded-md p-4 bg-gray-50 h-64 overflow-y-auto mb-4 text-sm">
        {messages.length === 0 ? (
          <p className="text-gray-500">
            Hello! I am an autonomous RAG agent. I can find tools to answer your questions.
          </p>
        ) : (
          messages.map((msg, index) => (
            <p key={index} className={msg.sender === "user" ? "text-blue-700" : "text-gray-800"}>
              <strong>{msg.sender === "user" ? "You" : "Agent"}:</strong> {msg.text}
            </p>
          ))
        )}
      </div>

      <form onSubmit={handleSendMessage} className="flex space-x-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about 'tokenomics' or 'roadmap'"
          className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          disabled={!isWalletConnected || loading}
        />
        <button
          type="submit"
          disabled={!isWalletConnected || loading}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {/* Public API (Free) Section */}
      <h2 className="text-xl font-semibold text-gray-800 mb-4 mt-8">Public API (Free)</h2>
      <p className="text-sm text-gray-600 mb-4">
        This endpoint demonstrates free access without any payment.
      </p>
      <button
        onClick={handleFetchFreeData}
        disabled={loading}
        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50"
      >
        {loading ? "Fetching..." : "Fetch Free Data"}
      </button>

      {freeData && (
        <div className="mt-4 bg-gray-100 p-3 rounded-md text-sm">
          <h3 className="font-semibold mb-2">Free Data Response:</h3>
          <pre className="whitespace-pre-wrap">{JSON.stringify(freeData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default AgentComponent;
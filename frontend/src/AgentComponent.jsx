// frontend/src/AgentComponent.jsx (TAILWIND & ENGLISH)

import React, { useState, useEffect } from "react";
import { useX402 } from "./useX402"; 

export function AgentComponent() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([
    {
      from: "agent",
      text: "Hello! I am an autonomous RAG agent. I can find tools to answer your questions.",
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [availableTools, setAvailableTools] = useState([]);
  const [budgetAmount, setBudgetAmount] = useState(0.01);
  const [localError, setLocalError] = useState(null);

  const { fetchWith402, depositBudget, isWalletError, API_BASE } = useX402();

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const tools = await fetch(`${API_BASE}/api/agent-tools`).then((res) =>
          res.json()
        );
        setAvailableTools(tools);
        addMessage(
          "agent-info",
          `I have loaded ${tools.length} tools available for me to use (e.g., "tokenomics", "roadmap").`
        );
      } catch (e) {
        setLocalError(e.message);
      }
    };
    fetchTools();
  }, [API_BASE]);

  const addMessage = (from, text) => {
    setMessages((prev) => [...prev, { from, text }]);
  };

  const handleSend = async () => {
    if (!prompt || isThinking) return;

    addMessage("user", prompt);
    const userPrompt = prompt;
    setPrompt("");
    setIsThinking(true);
    setLocalError(null);

    try {
      const normalizedPrompt = userPrompt.toLowerCase();
      const tool = availableTools.find((t) =>
        normalizedPrompt.includes(t.id)
      );
      let answer;

      if (tool) {
        addMessage(
          "agent-thinking",
          `Found tool "${tool.id}". Cost: ${tool.cost} tokens. Attempting fetch (via budget or 402)...`
        );
        
        const result = await fetchWith402(`${API_BASE}${tool.endpoint}`);
        
        if (result && result.context) {
          answer = `Here is the info on ${tool.id}: ${result.context} (Payment via: ${result.paymentMethod})`;
        } else {
          answer = `Failed to retrieve context: Unknown error`;
        }
      } else {
        answer = "Sorry, I couldn't find a tool for that request. You can ask about 'tokenomics' or 'roadmap'.";
      }
      addMessage("agent", answer);
    } catch (err) {
      const errorMsg = isWalletError(err) ? "Transaction cancelled by user." : err.message;
      setLocalError(errorMsg);
      addMessage("agent-error", `Error: ${errorMsg}`);
    } finally {
      setIsThinking(false);
    }
  };

  const handleDeposit = async () => {
    if (!budgetAmount || budgetAmount <= 0) {
      setLocalError("Please enter a valid deposit amount.");
      return;
    }

    setIsThinking(true);
    setLocalError(null);
    addMessage(
      "agent-thinking",
      `Initiating budget deposit of ${budgetAmount} tokens...`
    );

    try {
      const sampleInvoiceUrl = `${API_BASE}${availableTools[0].endpoint}`;
      const result = await depositBudget(sampleInvoiceUrl, budgetAmount);
      
      if (result && result.success) {
        addMessage(
          "agent-info",
          `Budget deposit successful! Your new total budget is: ${result.newBudget} tokens.`
        );
      }
    } catch (err) {
      const errorMsg = isWalletError(err) ? "Transaction cancelled by user." : err.message;
      setLocalError(errorMsg);
      addMessage("agent-error", `Deposit failed: ${errorMsg}`);
    } finally {
      setIsThinking(false);
    }
  };

  const getMessageStyle = (from) => {
    switch (from) {
      case 'user':
        return 'bg-blue-100 text-blue-900 text-right ml-auto';
      case 'agent':
        return 'bg-gray-100 text-gray-900';
      case 'agent-thinking':
        return 'bg-yellow-50 text-yellow-700 italic';
      case 'agent-info':
        return 'bg-green-50 text-green-700';
      case 'agent-error':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg shadow p-6 bg-white">
      <h2 className="text-xl font-semibold mb-3">
        x402 Autonomous Agent (RAG)
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        This agent dynamically **finds its tools** and **manages its budget**.
        Deposit a budget to allow the agent to operate without prompting you
        for every micro-payment.
      </p>

      {/* Area Setor Anggaran */}
      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-wrap items-center gap-4">
        <label htmlFor="budget" className="text-sm font-medium text-gray-700">
          Agent Budget:
        </label>
        <input
          type="number"
          id="budget"
          value={budgetAmount}
          onChange={(e) => setBudgetAmount(parseFloat(e.target.value) || 0)}
          min="0.001"
          step="0.001"
          className="w-24 px-2 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm"
        />
        <button
          onClick={handleDeposit}
          disabled={isThinking}
          className="bg-indigo-600 text-white font-semibold text-sm py-2 px-4 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isThinking ? "Processing..." : "Deposit Budget"}
        </button>
      </div>

      {/* Kotak Obrolan */}
      <div className="mt-4 border border-gray-200 rounded-lg p-4 h-64 overflow-y-auto bg-gray-50 space-y-3">
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`p-3 rounded-lg text-sm max-w-[85%] ${getMessageStyle(msg.from)}`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      {/* Input Pengguna */}
      <div className="mt-4 flex gap-3">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about 'tokenomics' or 'roadmap'"
          className="flex-grow px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={isThinking}
          className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {isThinking ? "..." : "Send"}
        </button>
      </div>

      {/* Kotak Error Lokal */}
      {localError && (
        <div className="mt-4 bg-red-50 border border-red-300 text-red-700 p-3 rounded-lg text-sm">
          <strong>Error:</strong> {localError}
        </div>
      )}
    </div>
  );
}

// frontend/src/PremiumContent.jsx 

import React, { useState } from "react";
import "@solana/wallet-adapter-react-ui/styles.css"; 
import { useX402 } from "./useX402";

function PremiumContent() {
  const { fetchWith402, API_BASE } = useX402();

  // State untuk data API
  const [publicData, setPublicData] = useState(null);
  const [premiumData, setPremiumData] = useState(null);
  
  // State UI Lokal
  const [isPublicLoading, setIsPublicLoading] = useState(false);
  const [isPremiumLoading, setIsPremiumLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleFetchPublic = async () => {
    setLocalError(null);
    setPublicData(null);
    setIsPublicLoading(true);
    try {
      const data = await fetchWith402(`${API_BASE}/api/public`);
      if (data) setPublicData(data);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setIsPublicLoading(false);
    }
  };

  const handleFetchPremium = async () => {
    setLocalError(null);
    setPremiumData(null);
    setIsPremiumLoading(true);
    try {
      const data = await fetchWith402(`${API_BASE}/api/premium-data`);
      if (data) setPremiumData(data);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setIsPremiumLoading(false);
    }
  };

  const isLoading = isPublicLoading || isPremiumLoading;

  return (
    <div className="w-full h-full flex flex-col space-y-6">
      <div className="flex flex-col gap-6 h-full">
        
        {/* Kartu API Publik */}
        <div className="bg-white border border-gray-200 rounded-lg shadow p-6 flex flex-col h-full">
          <h2 className="text-xl font-semibold mb-3">Public API (Free)</h2>
          <p className="text-gray-600 text-sm mb-4 min-h-[40px]">
            This endpoint demonstrates free access without any payment.
          </p>
          <button
            onClick={handleFetchPublic}
            disabled={isLoading}
            className="mt-auto w-full bg-gray-800 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isPublicLoading ? "Loading..." : "Fetch Public Data"}
          </button>
          {publicData && (
            <pre className="mt-4 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
              {JSON.stringify(publicData, null, 2)}
            </pre>
          )}
        </div>

        {/* Kartu API Premium */}
        <div className="bg-white border border-gray-200 rounded-lg shadow p-6 flex flex-col h-full">
          <h2 className="text-xl font-semibold mb-3">Premium API (x402)</h2>
          <p className="text-gray-600 text-sm mb-4 min-h-[40px]">
            This endpoint is protected. It will use the Agent Budget first, or trigger a 402 popup.
          </p>
          <button
            onClick={handleFetchPremium}
            disabled={isLoading}
            className="mt-auto w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {isPremiumLoading ? "Paying & Fetching..." : "Fetch Premium Data"}
          </button>
          {premiumData && (
            <pre className="mt-4 bg-green-50 border border-green-200 text-green-800 p-3 rounded text-xs overflow-x-auto">
              {JSON.stringify(premiumData, null, 2)}
            </pre>
          )}
        </div>
      </div>
      
      {/* Kotak Error Global */}
      {localError && (
        <div className="mt-6 bg-red-50 border border-red-300 text-red-700 p-4 rounded-lg text-sm">
          <strong>Error:</strong> {localError}
        </div>
      )}
    </div>
  );
}

export default PremiumContent;
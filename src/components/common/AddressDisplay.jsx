import React, { useState, useEffect } from "react";
import { formatAddress } from "../blockchain/contracts";
import axios from "axios";

export default function AddressDisplay({ address, showFull = false }) {
  const [alias, setAlias] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlias = async () => {
      if (!address) {
        setLoading(false);
        return;
      }
      
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
        const res = await axios.get(`${apiBaseUrl.replace("/api", "")}/api/users/${address.toUpperCase()}`);
        setAlias(res.data.alias);
      } catch (error) {
        console.error("Failed to fetch alias:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlias();
  }, [address]);

  if (loading) {
    return <span className="font-mono text-sm text-gray-400">Loading...</span>;
  }

  if (alias) {
    return (
      <div className="flex flex-col">
        <span className="font-semibold text-gray-200">{alias}</span>
        <span className="font-mono text-xs text-gray-500">{formatAddress(address)}</span>
      </div>
    );
  }

  return (
    <span className="font-mono text-sm text-gray-300">
      {showFull ? address : formatAddress(address)}
    </span>
  );
}
// frontend/src/useX402.js
import { useContext } from "react";
import { X402Context } from "./X402Provider"; // Impor dari file baru

/**
 * Hook kustom untuk mengakses fungsi fetchWith402 dan depositBudget.
 */
export const useX402 = () => {
  const context = useContext(X402Context);
  if (!context) {
    throw new Error("useX402 harus digunakan di dalam X402Provider");
  }
  return context;
};
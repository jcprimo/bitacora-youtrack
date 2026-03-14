// ─── hooks/useOpenAIUsage.js — OpenAI Costs & Usage Tracker ─────
// Fetches spend data from the OpenAI Organization Costs API (v1).
// Requires an Admin API key (sk-admin-*) — standard project keys
// (sk-proj-*) do NOT have access. Key is stored in localStorage
// ("bitacora-openai-key") or VITE_OPENAI_KEY env var.
//
// Data is cached in localStorage for 5 minutes to avoid repeat
// API calls on tab switches.
//
// Also manages the Anthropic/OpenAI sub-tab state for the Usage view.

import { useState, useCallback } from "react";
import {
  fetchCosts,
  computeDailyBreakdown,
  computeModelTotals,
  getMonthRange,
  isAdminKey,
  toUnix,
} from "../openai";

export function useOpenAIUsage() {
  // In production (Express proxy), the key is stored server-side in the DB.
  // We check localStorage/env for dev mode compatibility, but also assume
  // the key exists if we're on the Express server (port !== 5173).
  const localKey = localStorage.getItem("bitacora-openai-key") || import.meta.env.VITE_OPENAI_KEY || "";
  const isExpressProxy = window.location.port !== "5173";
  const openaiKey = localKey;
  const hasOpenAIKey = localKey.length > 0 || isExpressProxy;

  const [usageTab, setUsageTab] = useState("anthropic");

  const [openaiUsage, setOpenaiUsage] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("bitacora-openai-usage"));
      if (cached && Date.now() - cached._ts < 5 * 60 * 1000) return cached;
    } catch {}
    return null;
  });
  const [openaiLoading, setOpenaiLoading] = useState(false);
  const [openaiError, setOpenaiError] = useState(null);
  const [openaiDateRange, setOpenaiDateRange] = useState(getMonthRange);

  const loadOpenaiUsage = useCallback(async () => {
    if (!hasOpenAIKey) return;
    // In Express proxy mode, the key is server-side so we can't check prefix.
    // Only validate in dev mode where we have the key locally.
    if (!isExpressProxy && openaiKey && !isAdminKey(openaiKey)) {
      setOpenaiError("OpenAI Usage API requires an Admin key (sk-admin-*). Standard project keys (sk-proj-*) don't have access.");
      return;
    }
    setOpenaiLoading(true);
    setOpenaiError(null);
    try {
      const startUnix = toUnix(openaiDateRange.startDate);
      const endUnix = toUnix(openaiDateRange.endDate);
      // In Express proxy mode, pass null — server injects the key
      const keyForRequest = isExpressProxy ? null : openaiKey;
      const costBuckets = await fetchCosts(keyForRequest, startUnix, endUnix);

      const dailyBreakdown = computeDailyBreakdown(costBuckets);
      const { totals: modelTotals, grandTotal } = computeModelTotals(dailyBreakdown);

      const data = {
        _ts: Date.now(),
        dailyBreakdown,
        modelTotals,
        grandTotal,
        startDate: openaiDateRange.startDate,
        endDate: openaiDateRange.endDate,
      };

      setOpenaiUsage(data);
      localStorage.setItem("bitacora-openai-usage", JSON.stringify(data));
    } catch (e) {
      setOpenaiError(e.message);
    } finally {
      setOpenaiLoading(false);
    }
  }, [openaiKey, openaiDateRange]);

  const openaiTotalSpend = openaiUsage?.grandTotal || 0;

  return {
    openaiKey, hasOpenAIKey,
    usageTab, setUsageTab,
    openaiUsage, openaiLoading, openaiError,
    openaiDateRange, setOpenaiDateRange,
    loadOpenaiUsage, openaiTotalSpend,
  };
}

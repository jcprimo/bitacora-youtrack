// ─── OpenAI API Service Module ──────────────────────────────────
// Uses the official Organization Usage & Costs APIs (launched Dec 2024).
// Requires an Admin API key (sk-admin-*) — standard project keys won't work.
// Create one at: https://platform.openai.com/settings/organization/admin-keys

export const OPENAI_BASE = "/openai-api";

// ─── Console links ──────────────────────────────────────────────
export const OPENAI_USAGE_URL = "https://platform.openai.com/usage";
export const OPENAI_BILLING_URL = "https://platform.openai.com/settings/organization/billing/overview";
export const OPENAI_ADMIN_KEYS_URL = "https://platform.openai.com/settings/organization/admin-keys";

function headers(key) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

// ─── Key type detection ─────────────────────────────────────────
export function isAdminKey(key) {
  return key?.startsWith("sk-admin-");
}

// ─── Costs API (admin keys only, daily buckets) ─────────────────
// Returns dollar-amount spend grouped by day and line item.

export async function fetchCosts(key, startTime, endTime) {
  const params = new URLSearchParams({
    start_time: String(startTime),
    bucket_width: "1d",
  });
  if (endTime) params.set("end_time", String(endTime));

  let allBuckets = [];
  let page = null;

  // Paginate through all results
  do {
    const url = new URL(`${OPENAI_BASE}/v1/organization/costs?${params}`, window.location.origin);
    if (page) url.searchParams.set("page", page);

    const res = await fetch(url.toString(), { headers: headers(key) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI Costs API returned ${res.status}`);
    }
    const data = await res.json();
    allBuckets = allBuckets.concat(data.data || []);
    page = data.next_page || null;
  } while (page);

  return allBuckets;
}

// ─── Usage API (admin keys only) ────────────────────────────────
// Token-level usage for completions, audio, etc.

async function fetchUsageEndpoint(key, endpoint, startTime, endTime, groupBy) {
  const params = new URLSearchParams({
    start_time: String(startTime),
    bucket_width: "1d",
  });
  if (endTime) params.set("end_time", String(endTime));
  if (groupBy) {
    for (const g of groupBy) params.append("group_by", g);
  }

  let allBuckets = [];
  let page = null;

  do {
    const url = new URL(`${OPENAI_BASE}/v1/organization/usage/${endpoint}?${params}`, window.location.origin);
    if (page) url.searchParams.set("page", page);

    const res = await fetch(url.toString(), { headers: headers(key) });
    if (!res.ok) {
      if (res.status === 404) return []; // endpoint may not exist for unused features
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI Usage API returned ${res.status}`);
    }
    const data = await res.json();
    allBuckets = allBuckets.concat(data.data || []);
    page = data.next_page || null;
  } while (page);

  return allBuckets;
}

export async function fetchCompletionsUsage(key, startTime, endTime) {
  return fetchUsageEndpoint(key, "completions", startTime, endTime, ["model"]);
}

export async function fetchAudioUsage(key, startTime, endTime) {
  return fetchUsageEndpoint(key, "audio_speeches", startTime, endTime, ["model"]);
}

// ─── Aggregate helpers ──────────────────────────────────────────

export function computeDailyBreakdown(costBuckets) {
  if (!costBuckets?.length) return [];

  return costBuckets
    .map((bucket) => {
      const models = {};
      let dayTotal = 0;
      for (const result of bucket.results || []) {
        const model = result.object || "unknown";
        // Costs API returns amounts in cents
        const cost = (result.amount?.value || 0) / 100;
        models[model] = (models[model] || 0) + cost;
        dayTotal += cost;
      }
      return {
        date: new Date(bucket.start_time * 1000).toISOString().slice(0, 10),
        total: dayTotal,
        models,
      };
    })
    .filter((d) => d.total > 0);
}

export function computeModelTotals(dailyBreakdown) {
  const totals = {};
  let grandTotal = 0;
  for (const day of dailyBreakdown) {
    for (const [model, cost] of Object.entries(day.models)) {
      totals[model] = (totals[model] || 0) + cost;
    }
    grandTotal += day.total;
  }
  return { totals, grandTotal };
}

// ─── Date helpers ───────────────────────────────────────────────

export function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(); // today
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function toUnix(dateStr) {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

// ─── Model color map (for charts) ──────────────────────────────

export const MODEL_COLORS = {
  "whisper-1": "#06b6d4",
  "gpt-4o-mini": "#34d399",
  "gpt-4o": "#7c6aff",
  "gpt-4-turbo": "#f59e0b",
  "gpt-3.5-turbo": "#64748b",
  "dall-e-3": "#ec4899",
  "tts-1": "#8b5cf6",
  default: "#94a3b8",
};

export function getModelColor(model) {
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (model.includes(key)) return color;
  }
  return MODEL_COLORS.default;
}

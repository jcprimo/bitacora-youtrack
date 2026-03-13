import { useState, useCallback, useEffect } from "react";
import "./App.css";
import {
  fetchIssues,
  createIssue,
  updateIssue,
  updateCustomField,
  deleteIssue,
  getCustomFieldValue,
  formatDate,
  STAGES,
  PRIORITIES,
} from "./youtrack";
import {
  fetchCosts,
  computeDailyBreakdown,
  computeModelTotals,
  getMonthRange,
  getModelColor,
  isAdminKey,
  toUnix,
  OPENAI_USAGE_URL,
  OPENAI_BILLING_URL,
  OPENAI_ADMIN_KEYS_URL,
} from "./openai";

// ─── Bitacora Agent Team ─────────────────────────────────────────
const AGENTS = [
  { id: "pm", label: "PM Agent", icon: "🧠", color: "#7c6aff", defaultPriority: "Normal", desc: "Strategy & orchestration" },
  { id: "ios", label: "iOS Sr. Developer", icon: "📱", color: "#34d399", defaultPriority: "Normal", desc: "Swift/SwiftUI engineering" },
  { id: "ux", label: "UX/UI Agent", icon: "🎨", color: "#ec4899", defaultPriority: "Normal", desc: "Design & accessibility" },
  { id: "qa", label: "QA Agent", icon: "🔍", color: "#f59e0b", defaultPriority: "Major", desc: "Quality assurance & testing" },
  { id: "data", label: "Data Agent", icon: "📊", color: "#8b5cf6", defaultPriority: "Normal", desc: "Analytics & measurement" },
  { id: "security", label: "Security Agent", icon: "🔒", color: "#ef4444", defaultPriority: "Critical", desc: "FERPA + LFPDPPP compliance" },
  { id: "gtm", label: "GTM Agent", icon: "📣", color: "#06b6d4", defaultPriority: "Normal", desc: "Growth & positioning" },
  { id: "cs", label: "CS Agent", icon: "🗣️", color: "#f97316", defaultPriority: "Normal", desc: "Retention & bilingual support" },
];

const EFFORTS = ["S", "M", "L", "XL"];

// ─── Bitacora System Prompts ─────────────────────────────────────
const CONTEXT = `You work on Bitacora, a bilingual (English/Spanish) iOS app for student behavioral incident reporting used by teachers, principals, and school administrators in US and Mexico school systems.

Dual compliance: FERPA (US) + LFPDPPP (Mexico).
Stack: Swift/SwiftUI, MVVM, Core Data.
Users: teachers, principals, school admins.
Markets: US K-12 + Mexico escuelas.

IMPORTANT: Respond ONLY with a valid JSON object. No markdown fencing, no explanation.`;

const PROMPTS = {
  pm: `${CONTEXT}\nYou are the PM Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## User Story\\nAs a [teacher|principal|admin],\\nI want to [action],\\nSo that [outcome].\\n\\n## Acceptance Criteria\\n- [ ] criterion 1\\n- [ ] criterion 2\\n\\n## Bilingual Impact\\n[EN/ES considerations]\\n\\n## Compliance\\n**FERPA:** [Yes/No]\\n**LFPDPPP:** [Yes/No]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"M"}`,
  ios: `${CONTEXT}\nYou are the iOS Senior Developer Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## Task\\n[what to build/fix]\\n\\n## Technical Requirements\\n- Swift/SwiftUI details\\n- Architecture (MVVM)\\n- Data layer (Core Data, API)\\n\\n## Done When\\n- [ ] Code reviewed\\n- [ ] XCTests passing\\n- [ ] Localization (EN+ES)\\n- [ ] Accessibility verified\\n\\n## Compliance\\n**FERPA:** [Yes/No]\\n**LFPDPPP:** [Yes/No]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"M"}`,
  ux: `${CONTEXT}\nYou are the UX/UI Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## Design Task\\n**Persona:** [Teacher|Principal|Admin]\\n**Device:** [iPhone|iPad|Both]\\n\\n**Problem:**\\n[pain point]\\n\\n**Deliverables:**\\n- [ ] Wireframe\\n- [ ] Hi-fi (Light+Dark)\\n- [ ] Component spec\\n- [ ] Bilingual layout review (ES ~30% longer)\\n\\n**Accessibility:** WCAG 2.1 AA, VoiceOver, Dynamic Type\\n\\n## Compliance\\n**FERPA:** [Yes/No]\\n**LFPDPPP:** [Yes/No]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"M"}`,
  qa: `${CONTEXT}\nYou are the QA Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## Bug Report\\n**Env:** [Staging|Dev|TestFlight]\\n**Device:** [model, iOS version]\\n**Language:** [EN|ES|Both]\\n\\n**Steps:**\\n1. step\\n2. step\\n\\n**Expected:** [should happen]\\n**Actual:** [happened]\\n\\n**Roles Affected:** [Teacher|Principal|Admin|All]\\n**RBAC:** [Pass/Fail]\\n**Blocking Release:** [Yes/No]\\n\\n## Compliance\\n**FERPA:** [Yes/No]\\n**LFPDPPP:** [Yes/No]","priority":"Major","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"S"}`,
  data: `${CONTEXT}\nYou are the Data Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## Analytics Task\\n**Objective:** [what to measure]\\n\\n**Events:**\\n- event_name: description (educator IDs only)\\n\\n**FERPA Boundary:** [no student PII]\\n**LFPDPPP Boundary:** [Mexico data handling]\\n\\n**Output:** [dashboard/report]\\n**Vendor:** [tool — must have DPA]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"M"}`,
  security: `${CONTEXT}\nYou are the Security Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## Security Finding\\n**Risk:** [Critical|High|Medium|Low]\\n\\n**FERPA:** [implication]\\n**LFPDPPP:** [implication]\\n\\n**Component:** [affected]\\n**Data Classification:** [Education Record|Directory Info|Behavioral|Non-PII]\\n\\n**Remediation:**\\n1. step\\n2. step\\n\\n**Verification:**\\n- [ ] Security re-review\\n- [ ] No PII in logs\\n- [ ] DPA/Aviso current\\n- [ ] AES-256 + TLS 1.2+","priority":"Critical","ferpa_risk":true,"lfpdppp_risk":true,"estimated_effort":"M"}`,
  gtm: `${CONTEXT}\nYou are the GTM Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## GTM Task\\n**Market:** [US|Mexico|Both]\\n**Audience:** [Teacher|Principal|Admin|IT|SEP]\\n\\n**Message (EN):** [value prop]\\n**Message (ES):** [value prop]\\n\\n**Deliverables:**\\n- [ ] item 1\\n- [ ] item 2\\n\\n**Compliance Badges:** FERPA [Y/N] LFPDPPP [Y/N]\\n**Launch Window:** [timing]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"M"}`,
  cs: `${CONTEXT}\nYou are the CS Agent. Generate a YouTrack ticket:\n{"summary":"title under 80 chars","description":"## CS Task\\n**Segment:** [Teacher|Principal|Admin]\\n**Market:** [US|Mexico|Both]\\n**Language:** [EN|ES|Bilingual]\\n\\n**Problem/Opportunity:** [description]\\n**Action:** [what CS will do]\\n**Docs Update:** [Yes/No — EN, ES, or both]\\n**Churn Risk:** [High|Medium|Low|None]\\n\\n**Compliance:** No student PII: [Confirmed]","priority":"Normal","ferpa_risk":false,"lfpdppp_risk":false,"estimated_effort":"S"}`,
};

function getPlaceholder(id) {
  const p = {
    pm: "Describe a feature need, priority decision, or user story...\n\nEx: \"Teachers need to log behavior incidents with severity and photo attachments\"",
    ios: "Describe a feature to build or bug to fix...\n\nEx: \"Build incident report form: severity picker, student selector, notes, photo\"",
    ux: "Describe a design need or usability issue...\n\nEx: \"Design the incident creation flow for iPhone — fast, one-handed\"",
    qa: "Describe a bug or test scenario...\n\nEx: \"Teacher can see students from another class in the selector dropdown\"",
    data: "What do you want to measure?\n\nEx: \"Track behavior log creation funnel: where do teachers drop off?\"",
    security: "Describe a security concern or compliance need...\n\nEx: \"Review new OpenAI integration for auto-categorizing incidents\"",
    gtm: "Describe a marketing or launch task...\n\nEx: \"App Store listing copy for Mexico launch (Spanish)\"",
    cs: "Describe a support or retention task...\n\nEx: \"Bilingual onboarding email sequence for new teacher signups\"",
  };
  return p[id] || "Describe your task...";
}

// ─── Token estimation ────────────────────────────────────────────
// System prompt (~250 tokens) + user input + JSON output (~400 tokens)
function estimateTokens(inputText) {
  // ~1 token per 4 chars for English text (rough heuristic)
  const inputTokens = Math.ceil((inputText?.length || 0) / 4);
  const systemTokens = 250;  // CONTEXT + agent prompt
  const outputTokens = 450;  // structured JSON response
  return { input: systemTokens + inputTokens, output: outputTokens, total: systemTokens + inputTokens + outputTokens };
}

function estimateCost(tokens) {
  // Claude Sonnet 4 pricing: $3/MTok input, $15/MTok output
  const inputCost = (tokens.input / 1_000_000) * 3;
  const outputCost = (tokens.output / 1_000_000) * 15;
  return inputCost + outputCost;
}

function priorityColor(p) {
  switch (p) {
    case "Show-stopper": return "#ef4444";
    case "Critical": return "#f87171";
    case "Major": return "#f59e0b";
    case "Normal": return "#7c6aff";
    case "Minor": return "#64748b";
    default: return "#7c6aff";
  }
}

function stageColor(s) {
  switch (s) {
    case "Backlog": return "#64748b";
    case "Develop": return "#7c6aff";
    case "Review": return "#f59e0b";
    case "Test": return "#8b5cf6";
    case "Staging": return "#06b6d4";
    case "Done": return "#34d399";
    default: return "#64748b";
  }
}

// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("bitacora-yt-token") || import.meta.env.VITE_YT_TOKEN || "");
  const [view, setView] = useState("board");
  const [theme, setTheme] = useState(() => localStorage.getItem("bitacora-theme") || "dark");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    token: "",
    anthropicKey: "",
    openaiKey: "",
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bitacora-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const copyTicketJson = useCallback((data, label) => {
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      showToast(`${label} copied to clipboard`);
    }).catch(() => {
      showToast("Copy failed — check browser permissions", "error");
    });
  }, []);

  const openSettings = () => {
    setSettingsForm({
      token: token,
      anthropicKey: localStorage.getItem("bitacora-anthropic-key") || import.meta.env.VITE_ANTHROPIC_KEY || "",
      openaiKey: localStorage.getItem("bitacora-openai-key") || import.meta.env.VITE_OPENAI_KEY || "",
    });
    setShowSettings(true);
  };

  const saveSettings = () => {
    if (settingsForm.token.trim()) {
      localStorage.setItem("bitacora-yt-token", settingsForm.token.trim());
      setToken(settingsForm.token.trim());
    }
    if (settingsForm.anthropicKey.trim()) {
      localStorage.setItem("bitacora-anthropic-key", settingsForm.anthropicKey.trim());
    } else {
      localStorage.removeItem("bitacora-anthropic-key");
    }
    if (settingsForm.openaiKey.trim()) {
      localStorage.setItem("bitacora-openai-key", settingsForm.openaiKey.trim());
    } else {
      localStorage.removeItem("bitacora-openai-key");
    }
    setShowSettings(false);
    showToast("Settings saved");
    loadIssues();
  };

  // Board
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterQuery, setFilterQuery] = useState("");

  // Create
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);
  const [rawInput, setRawInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState(null);
  const [createStep, setCreateStep] = useState("input");

  // Detail
  const [activeIssue, setActiveIssue] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Load Bitacora issues ────────────────────────────────────
  const loadIssues = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = filterQuery.trim()
        ? `project: BIT ${filterQuery}`
        : "project: BIT sort by: updated desc";
      const data = await fetchIssues(token, { query: q, top: 50 });
      setIssues(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, filterQuery]);

  useEffect(() => {
    if (token) loadIssues();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── AI Usage Tracker ───────────────────────────────────────
  const [aiUsage, setAiUsage] = useState(() => {
    const defaults = {
      totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0,
      history: [], budgetUsd: null, creditBalance: null,
    };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem("bitacora-ai-usage")) };
    } catch { return defaults; }
  });

  const recordUsage = useCallback((usage, agent, model) => {
    setAiUsage((prev) => {
      const entry = {
        ts: Date.now(),
        agent,
        model,
        inputTokens: usage.input_tokens || 0,
        outputTokens: usage.output_tokens || 0,
        cacheCreation: usage.cache_creation_input_tokens || 0,
        cacheRead: usage.cache_read_input_tokens || 0,
      };
      const updated = {
        ...prev,
        totalInputTokens: prev.totalInputTokens + entry.inputTokens,
        totalOutputTokens: prev.totalOutputTokens + entry.outputTokens,
        totalRequests: prev.totalRequests + 1,
        history: [entry, ...prev.history].slice(0, 50),
      };
      localStorage.setItem("bitacora-ai-usage", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetUsage = useCallback(() => {
    const fresh = { totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0, history: [], budgetUsd: aiUsage.budgetUsd };
    setAiUsage(fresh);
    localStorage.setItem("bitacora-ai-usage", JSON.stringify(fresh));
    showToast("Usage stats reset");
  }, [aiUsage.budgetUsd]);

  const setBudget = useCallback((val) => {
    setAiUsage((prev) => {
      const updated = { ...prev, budgetUsd: val || null };
      localStorage.setItem("bitacora-ai-usage", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setCreditBalance = useCallback((val) => {
    setAiUsage((prev) => {
      const updated = { ...prev, creditBalance: val || null };
      localStorage.setItem("bitacora-ai-usage", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Cost calculation (Claude Sonnet 4: $3/MTok in, $15/MTok out)
  const totalSpendUsd = (aiUsage.totalInputTokens * 3 + aiUsage.totalOutputTokens * 15) / 1_000_000;
  const budgetPct = aiUsage.budgetUsd ? Math.min((totalSpendUsd / aiUsage.budgetUsd) * 100, 100) : null;
  const overBudget = aiUsage.budgetUsd && totalSpendUsd >= aiUsage.budgetUsd;

  // ─── OpenAI Usage Tracker ──────────────────────────────────────
  const [usageTab, setUsageTab] = useState("anthropic");
  const openaiKey = localStorage.getItem("bitacora-openai-key") || import.meta.env.VITE_OPENAI_KEY || "";
  const hasOpenAIKey = openaiKey.length > 0;

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
    if (!openaiKey) return;
    if (!isAdminKey(openaiKey)) {
      setOpenaiError("OpenAI Usage API requires an Admin key (sk-admin-*). Standard project keys (sk-proj-*) don't have access.");
      return;
    }
    setOpenaiLoading(true);
    setOpenaiError(null);
    try {
      const startUnix = toUnix(openaiDateRange.startDate);
      const endUnix = toUnix(openaiDateRange.endDate);
      const costBuckets = await fetchCosts(openaiKey, startUnix, endUnix);

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

  // Combined spend for sidebar
  const openaiTotalSpend = openaiUsage?.grandTotal || 0;
  const combinedSpend = totalSpendUsd + openaiTotalSpend;

  // ─── AI Generate ─────────────────────────────────────────────
  const anthropicKey = localStorage.getItem("bitacora-anthropic-key") || import.meta.env.VITE_ANTHROPIC_KEY || "";
  const hasAIKey = anthropicKey.length > 0;
  const [aiError, setAiError] = useState(null);

  const generateWithAI = useCallback(async () => {
    if (!rawInput.trim()) return;
    if (!hasAIKey) {
      showToast("Set VITE_ANTHROPIC_KEY in .env to use AI generation", "error");
      return;
    }
    setIsGenerating(true);
    setAiError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: PROMPTS[selectedAgent.id],
          messages: [{ role: "user", content: rawInput }],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Anthropic API returned ${res.status}`);
      }

      const data = await res.json();

      // Track usage
      if (data.usage) {
        recordUsage(data.usage, selectedAgent.label, data.model || "claude-sonnet-4-20250514");
      }

      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();

      if (!clean) throw new Error("AI returned empty response");

      const parsed = JSON.parse(clean);

      if (!parsed.summary) throw new Error("AI response missing summary field");

      setDraft({
        summary: parsed.summary,
        description: parsed.description || "",
        priority: parsed.priority || selectedAgent.defaultPriority,
        ferpa_risk: parsed.ferpa_risk || false,
        lfpdppp_risk: parsed.lfpdppp_risk || false,
        estimated_effort: parsed.estimated_effort || "M",
      });
      setCreateStep("review");
    } catch (e) {
      setAiError(e.message);
      showToast("AI failed — use Template Generate instead", "error");
    } finally {
      setIsGenerating(false);
    }
  }, [rawInput, selectedAgent, hasAIKey, anthropicKey]);

  // ─── Template Generate (no API needed) ─────────────────────
  const generateFromTemplate = useCallback(() => {
    if (!rawInput.trim()) return;
    const input = rawInput.trim();
    const agent = selectedAgent;
    const templates = {
      pm: {
        summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
        description: `## User Story\nAs a [teacher | principal | admin],\nI want to ${input},\nSo that [define the outcome].\n\n## Acceptance Criteria\n- [ ] [Define criterion 1]\n- [ ] [Define criterion 2]\n- [ ] [Define criterion 3]\n\n## Bilingual Impact\n[Does this need EN/ES support?]\n\n## Compliance\n**FERPA:** [Yes/No — explain]\n**LFPDPPP:** [Yes/No — explain]\n\n## Notes\n${input}`,
      },
      ios: {
        summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
        description: `## Task\n${input}\n\n## Technical Requirements\n- [ ] Swift/SwiftUI implementation\n- [ ] Architecture: MVVM\n- [ ] Data layer: [Core Data / API]\n\n## Done When\n- [ ] Code reviewed\n- [ ] XCTests passing\n- [ ] Localization added (EN + ES)\n- [ ] Accessibility verified (VoiceOver)\n- [ ] QA Agent sign-off\n\n## Compliance\n**FERPA:** [Yes/No]\n**LFPDPPP:** [Yes/No]`,
      },
      ux: {
        summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
        description: `## Design Task\n**Persona:** [Teacher | Principal | Admin]\n**Device:** [iPhone | iPad | Both]\n\n**Problem:**\n${input}\n\n**Deliverables:**\n- [ ] Lo-fi wireframe\n- [ ] Hi-fi spec (Light + Dark mode)\n- [ ] Component spec for iOS developer\n- [ ] Bilingual layout review (ES text ~30% longer)\n\n**Accessibility:**\n- WCAG 2.1 AA\n- VoiceOver labels\n- Dynamic Type support\n\n## Compliance\n**FERPA:** [Yes/No]\n**LFPDPPP:** [Yes/No]`,
      },
      qa: {
        summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
        description: `## QA Task\n${input}\n\n**Environment:** [Staging | Dev | TestFlight]\n**Device:** [iPhone model, iOS version]\n**Language:** [EN | ES | Both]\n\n## Test Scenarios\n- [ ] [Define test case 1]\n- [ ] [Define test case 2]\n- [ ] [Define test case 3]\n\n**User Journeys to Cover:**\n- [ ] Teacher flow\n- [ ] Principal flow\n- [ ] Admin flow\n\n**Roles Affected:** [Teacher | Principal | Admin | All]\n**RBAC Boundary Test:** [Define scope]\n**Blocking Release:** [Yes/No]\n\n## Compliance\n**FERPA:** [Yes/No]\n**LFPDPPP:** [Yes/No]\n\n## Notes\n[Leave room for edits as test scenarios are refined]`,
      },
      data: {
        summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
        description: `## Analytics Task\n**Objective:**\n${input}\n\n**Events to Track:**\n- [ ] event_name: [description — educator IDs only]\n\n**FERPA Boundary:** No student PII in event properties\n**LFPDPPP Boundary:** [Mexico data handling]\n\n**Output:** [Dashboard / Report]\n**Vendor:** [Tool — must have DPA]`,
      },
      security: {
        summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
        description: `## Security / Compliance Review\n**Risk Level:** [Critical | High | Medium | Low]\n\n**Context:**\n${input}\n\n**FERPA Implication:** [Explain]\n**LFPDPPP Implication:** [Explain]\n\n**Affected Component:** [Define]\n**Data Classification:** [Education Record | Directory Info | Behavioral | Non-PII]\n\n**Remediation:**\n1. [Step 1]\n2. [Step 2]\n\n**Verification:**\n- [ ] Security Agent re-review\n- [ ] No PII in logs or analytics\n- [ ] DPA/Aviso de Privacidad current\n- [ ] AES-256 + TLS 1.2+`,
      },
      gtm: {
        summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
        description: `## GTM Task\n**Market:** [US | Mexico | Both]\n**Audience:** [Teacher | Principal | Admin | IT]\n\n**Context:**\n${input}\n\n**Message (EN):** [Value prop in English]\n**Message (ES):** [Value prop in Spanish]\n\n**Deliverables:**\n- [ ] [Deliverable 1]\n- [ ] [Deliverable 2]\n\n**Compliance Badges:** FERPA [Y/N] · LFPDPPP [Y/N]\n**Launch Window:** [Timing]`,
      },
      cs: {
        summary: input.length > 80 ? input.slice(0, 77) + "..." : input,
        description: `## CS Task\n**Segment:** [Teacher | Principal | Admin]\n**Market:** [US | Mexico | Both]\n**Language:** [EN | ES | Bilingual]\n\n**Problem/Opportunity:**\n${input}\n\n**Proposed Action:** [What CS will do]\n**Docs Update Needed:** [Yes/No — EN, ES, or both]\n**Churn Risk:** [High | Medium | Low | None]\n\n**Compliance:** No student PII: [Confirmed]`,
      },
    };

    const tmpl = templates[agent.id] || { summary: input, description: input };
    setDraft({
      summary: tmpl.summary,
      description: tmpl.description,
      priority: agent.defaultPriority,
      ferpa_risk: false,
      lfpdppp_risk: false,
      estimated_effort: "M",
    });
    setAiError(null);
    setCreateStep("review");
  }, [rawInput, selectedAgent]);

  // ─── Submit to YouTrack ──────────────────────────────────────
  const submitTicket = useCallback(async () => {
    if (!draft || !token) return;
    if (!draft.summary.trim()) {
      showToast("Summary is required", "error");
      return;
    }
    setActionLoading("create");
    try {
      const result = await createIssue(token, {
        summary: draft.summary,
        description: draft.description,
        priority: draft.priority,
      });
      showToast(`${result.idReadable} created`);
      setCreateStep("done");
      setDraft((d) => ({ ...d, createdId: result.idReadable }));
      loadIssues();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setActionLoading(null);
    }
  }, [draft, token, loadIssues]);

  // ─── Update issue ────────────────────────────────────────────
  const saveEdit = useCallback(async () => {
    if (!activeIssue || !token) return;
    setActionLoading("save");
    try {
      await updateIssue(token, activeIssue.idReadable, {
        summary: editFields.summary,
        description: editFields.description,
      });
      showToast(`${activeIssue.idReadable} updated`);
      loadIssues();
      setView("board");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setActionLoading(null);
    }
  }, [activeIssue, editFields, token, loadIssues]);

  // ─── Change stage / priority ─────────────────────────────────
  const changeField = useCallback(
    async (issueId, field, value) => {
      setActionLoading(`${field}-${issueId}`);
      try {
        await updateCustomField(token, issueId, field, value);
        showToast(`${issueId}: ${field} → ${value}`);
        loadIssues();
        if (activeIssue?.idReadable === issueId) {
          const updated = await fetchIssues(token, { query: `issue id: ${issueId}`, top: 1 });
          if (updated[0]) setActiveIssue(updated[0]);
        }
      } catch (e) {
        showToast(e.message, "error");
      } finally {
        setActionLoading(null);
      }
    },
    [token, loadIssues, activeIssue]
  );

  // ─── Delete ──────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!activeIssue || !token) return;
    setActionLoading("delete");
    try {
      await deleteIssue(token, activeIssue.idReadable);
      showToast(`${activeIssue.idReadable} deleted`);
      setConfirmDelete(false);
      setActiveIssue(null);
      setView("board");
      loadIssues();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setActionLoading(null);
    }
  }, [activeIssue, token, loadIssues]);

  const openDetail = (issue) => {
    setActiveIssue(issue);
    setEditFields({ summary: issue.summary, description: issue.description || "" });
    setConfirmDelete(false);
    setView("detail");
  };

  const resetCreate = () => {
    setRawInput("");
    setDraft(null);
    setCreateStep("input");
  };

  const agentColor = selectedAgent.color;
  const tokenEst = estimateTokens(rawInput);
  const costEst = estimateCost(tokenEst);

  // ═════════════════════════════════════════════════════════════
  return (
    <div className="app-shell">
      {/* Toast */}
      {toast && (
        <div className="animate-fade" style={{
          position: "fixed", top: 16, right: 16, zIndex: 999,
          padding: "0.6rem 1.1rem", borderRadius: "var(--radius-md)",
          fontSize: "0.75rem", fontWeight: 600,
          background: toast.type === "error" ? "rgba(248,113,113,0.12)" : "rgba(52,211,153,0.12)",
          border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`,
          color: toast.type === "error" ? "var(--accent-red)" : "var(--accent-green)",
          backdropFilter: "blur(12px)",
        }}>
          {toast.type === "error" ? "✕ " : "✓ "}{toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="header-icon" style={{ background: "linear-gradient(135deg, #7c6aff20, #7c6aff08)", border: "1px solid #7c6aff40" }}>
            📋
          </div>
          <div>
            <div className="header-title">Bitacora → YouTrack</div>
            <div className="header-subtitle">Bitacora iOS Agent Pipeline</div>
          </div>
        </div>
        <div className="header-badge">
          <div className="badge-tooltip-wrap">
            <span className="compliance-badge" style={{ color: "#7c6aff", borderColor: "rgba(124,106,255,0.3)", background: "rgba(124,106,255,0.06)", cursor: "help" }}>FERPA</span>
            <div className="badge-tooltip">
              <div className="badge-tooltip-title">Family Educational Rights and Privacy Act</div>
              <div className="badge-tooltip-body">
                US federal law protecting the privacy of student education records. Applies to all schools receiving federal funding. Bitacora enforces FERPA by ensuring no student PII is exposed in logs, analytics, or third-party integrations.
              </div>
              <a className="badge-tooltip-link" href="https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html" target="_blank" rel="noopener noreferrer">
                Learn more at ed.gov →
              </a>
            </div>
          </div>
          <div className="badge-tooltip-wrap">
            <span className="compliance-badge" style={{ color: "#f59e0b", borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)", cursor: "help" }}>LFPDPPP</span>
            <div className="badge-tooltip">
              <div className="badge-tooltip-title">Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares</div>
              <div className="badge-tooltip-body">
                Mexico's federal data protection law governing the processing of personal data by private entities. Requires an Aviso de Privacidad (privacy notice) and explicit consent. Bitacora enforces LFPDPPP for schools operating in Mexico.
              </div>
              <a className="badge-tooltip-link" href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf" target="_blank" rel="noopener noreferrer">
                Learn more at diputados.gob.mx →
              </a>
            </div>
          </div>
          {token && (
            <span
              className="compliance-badge bit-connected"
              style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.06)", cursor: "pointer" }}
              onClick={openSettings}
              title="Click to edit connection settings"
            >
              ● BIT Connected
            </span>
          )}
          {!token && (
            <span
              className="compliance-badge bit-connected"
              style={{ color: "var(--accent-red)", borderColor: "rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.06)", cursor: "pointer" }}
              onClick={openSettings}
              title="Click to configure connection"
            >
              ● Not Connected
            </span>
          )}
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* ═══ SETTINGS MODAL ════════════════════════════════════ */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal animate-fade" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>Connection Settings</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>Configure your YouTrack and AI credentials</div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer", padding: "0.25rem" }}
              >
                ✕
              </button>
            </div>

            <div className="settings-field">
              <label className="settings-label">YouTrack Token</label>
              <input
                className="settings-input"
                type="password"
                value={settingsForm.token}
                onChange={(e) => setSettingsForm((f) => ({ ...f, token: e.target.value }))}
                placeholder="perm-..."
              />
              <div className="settings-hint">
                Generate at YouTrack → Profile → Authentication → New Token
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-label">Anthropic API Key <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span></label>
              <input
                className="settings-input"
                type="password"
                value={settingsForm.anthropicKey}
                onChange={(e) => setSettingsForm((f) => ({ ...f, anthropicKey: e.target.value }))}
                placeholder="sk-ant-api03-..."
              />
              <div className="settings-hint">
                For AI-assisted ticket generation. Without it, use Template Generate.
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-label">OpenAI API Key <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span></label>
              <input
                className="settings-input"
                type="password"
                value={settingsForm.openaiKey}
                onChange={(e) => setSettingsForm((f) => ({ ...f, openaiKey: e.target.value }))}
                placeholder="sk-..."
              />
              <div className="settings-hint">
                For OpenAI usage & balance tracking (Whisper, GPT-4o-mini).
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button
                className="btn-ship"
                onClick={saveSettings}
                style={{ background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.4)", color: "var(--accent-green)" }}
              >
                Save Settings
              </button>
              <button className="btn-back" onClick={() => setShowSettings(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button
          className={`step-btn ${view === "board" ? "active" : ""}`}
          onClick={() => setView("board")}
          style={{ borderBottom: view === "board" ? "2px solid var(--accent-indigo)" : "2px solid transparent" }}
        >
          📋 Board
        </button>
        <button
          className={`step-btn ${view === "create" ? "active" : ""}`}
          onClick={() => { setView("create"); resetCreate(); }}
          style={{ borderBottom: view === "create" ? "2px solid var(--accent-indigo)" : "2px solid transparent" }}
        >
          ＋ Create
        </button>
        <button
          className={`step-btn ${view === "usage" ? "active" : ""}`}
          onClick={() => setView("usage")}
          style={{ borderBottom: view === "usage" ? "2px solid var(--accent-cyan)" : "2px solid transparent" }}
        >
          📊 AI Usage
        </button>
        {view === "detail" && (
          <button className="step-btn active" style={{ borderBottom: "2px solid var(--accent-indigo)" }}>
            🔎 {activeIssue?.idReadable}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="step-btn" onClick={loadIssues} disabled={loading} style={{ opacity: loading ? 0.5 : 1 }}>
          {loading ? "↻ Loading..." : "↻ Refresh"}
        </button>
      </nav>

      {!token && (
        <div className="compliance-alert ferpa" style={{ marginBottom: "1rem", cursor: "pointer" }} onClick={openSettings}>
          🔑 No YouTrack token configured — click here or the "Not Connected" badge to set one.
        </div>
      )}
      {error && <div className="error-banner" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* ═══ BOARD ════════════════════════════════════════════ */}
      {view === "board" && (
        <div className="animate-fade">
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
            <input
              className="config-input"
              style={{ flex: 1, fontSize: "0.78rem", padding: "0.55rem 0.85rem", borderRadius: "var(--radius-md)" }}
              placeholder="Filter Bitacora: priority: Critical  or  Stage: Develop  or  free text..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadIssues()}
            />
            <button className="btn btn-config" style={{ padding: "0.55rem 1rem", width: "auto" }} onClick={loadIssues}>
              Search
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {issues.length === 0 && !loading && (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-dim)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
                <div style={{ fontSize: "0.82rem" }}>No issues in Bitacora</div>
                <div style={{ fontSize: "0.7rem", marginTop: "0.25rem" }}>Create your first ticket to get started</div>
              </div>
            )}

            {issues.map((issue) => {
              const priority = getCustomFieldValue(issue, "Priority");
              const stage = getCustomFieldValue(issue, "Stage");
              return (
                <div
                  key={issue.id}
                  className="panel"
                  style={{ padding: "0.85rem 1rem", cursor: "pointer", borderColor: "var(--border-subtle)" }}
                  onClick={() => openDetail(issue)}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-medium)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 700, fontFamily: "var(--font-mono)",
                      color: "var(--accent-indigo)", minWidth: "58px", paddingTop: "2px",
                    }}>
                      {issue.idReadable}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
                        {issue.summary}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                        {stage && (
                          <span style={{
                            fontSize: "0.58rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                            borderRadius: 10, background: `${stageColor(stage)}15`,
                            color: stageColor(stage), border: `1px solid ${stageColor(stage)}30`,
                          }}>{stage}</span>
                        )}
                        {priority && (
                          <span style={{
                            fontSize: "0.58rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                            borderRadius: 10, background: `${priorityColor(priority)}15`,
                            color: priorityColor(priority), border: `1px solid ${priorityColor(priority)}30`,
                          }}>{priority}</span>
                        )}
                        <span style={{ fontSize: "0.58rem", color: "var(--text-dim)" }}>
                          {formatDate(issue.updated || issue.created)}
                        </span>
                      </div>
                    </div>
                    <select
                      className="review-select"
                      style={{ fontSize: "0.62rem", padding: "0.25rem 0.4rem", minWidth: 90 }}
                      value={stage || "Backlog"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); changeField(issue.idReadable, "Stage", e.target.value); }}
                    >
                      {STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ CREATE ═══════════════════════════════════════════ */}
      {view === "create" && (
        <div className="main-grid animate-fade">
          <aside className="sidebar">
            {/* Agent selector */}
            <div className="panel">
              <div className="panel-label">Agent Team</div>
              <div className="agent-list">
                {AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    className={`agent-btn ${selectedAgent.id === agent.id ? "active" : ""}`}
                    onClick={() => { setSelectedAgent(agent); resetCreate(); }}
                    style={selectedAgent.id === agent.id ? { background: `${agent.color}10`, borderColor: `${agent.color}40`, color: agent.color } : {}}
                  >
                    <span className="agent-icon">{agent.icon}</span>
                    <span>{agent.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active agent info */}
            <div className="panel" style={{ borderColor: `${agentColor}20` }}>
              <div className="panel-label" style={{ color: agentColor }}>Active Agent</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                {selectedAgent.icon} {selectedAgent.label}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                {selectedAgent.desc}
              </div>
              <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.4rem" }}>
                <span style={{
                  fontSize: "0.55rem", fontWeight: 600, padding: "0.15rem 0.45rem",
                  borderRadius: 10, background: `${agentColor}12`, color: agentColor, border: `1px solid ${agentColor}30`,
                }}>{selectedAgent.defaultPriority}</span>
              </div>
            </div>

            {/* Token estimate — only when on input step */}
            {createStep === "input" && (
              <div className="panel" style={{ borderColor: hasAIKey ? "rgba(124,106,255,0.15)" : "rgba(248,113,113,0.15)" }}>
                <div className="panel-label">{hasAIKey ? "AI Token Estimate" : "🔑 AI Not Configured"}</div>
                {!hasAIKey && (
                  <div style={{ fontSize: "0.63rem", color: "var(--accent-red)", lineHeight: 1.6, marginBottom: "0.5rem" }}>
                    Add your Anthropic API key to <code style={{ fontSize: "0.6rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>.env</code>:
                    <div style={{ fontFamily: "var(--font-mono)", marginTop: "0.3rem", color: "var(--text-secondary)" }}>
                      VITE_ANTHROPIC_KEY=sk-ant-...
                    </div>
                    <div style={{ marginTop: "0.3rem", color: "var(--text-dim)" }}>Then restart the dev server.</div>
                  </div>
                )}
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <span>System prompt</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>~250</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <span>Your input</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>~{tokenEst.input - 250}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <span>JSON output (est.)</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>~{tokenEst.output}</span>
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    borderTop: "1px solid var(--border-subtle)", paddingTop: "0.35rem", marginTop: "0.35rem",
                    fontWeight: 600, color: "var(--text-primary)",
                  }}>
                    <span>Total</span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>~{tokenEst.total} tokens</span>
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between", marginTop: "0.25rem",
                    fontSize: "0.6rem", color: "var(--accent-green)",
                  }}>
                    <span>Est. cost</span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>${costEst.toFixed(4)}</span>
                  </div>
                </div>
                <div style={{
                  marginTop: "0.6rem", fontSize: "0.55rem", color: "var(--text-dim)", lineHeight: 1.5,
                  borderTop: "1px solid var(--border-subtle)", paddingTop: "0.5rem",
                }}>
                  Claude Sonnet 4 · $3/MTok in · $15/MTok out
                </div>
              </div>
            )}

            {/* AI Tips — only when on input step */}
            {createStep === "input" && (
              <div className="panel" style={{ borderColor: "rgba(251,191,36,0.15)" }}>
                <div className="panel-label" style={{ color: "var(--accent-amber)" }}>AI Prompt Tips</div>
                <ul style={{ fontSize: "0.63rem", color: "var(--text-muted)", lineHeight: 1.7, paddingLeft: "1rem", margin: 0 }}>
                  <li><strong style={{ color: "var(--text-secondary)" }}>Be specific</strong> — "teachers on iPhone need to log incidents in under 30 seconds" beats "add logging"</li>
                  <li><strong style={{ color: "var(--text-secondary)" }}>Name the user</strong> — teacher, principal, or admin. The agent tailors the ticket to that persona</li>
                  <li><strong style={{ color: "var(--text-secondary)" }}>Mention compliance</strong> — if it touches student data, say so. The agent will flag FERPA/LFPDPPP risks</li>
                  <li><strong style={{ color: "var(--text-secondary)" }}>One task per ticket</strong> — "build the form AND redesign the dashboard" should be two separate tickets</li>
                  <li><strong style={{ color: "var(--text-secondary)" }}>Include constraints</strong> — deadlines, device targets (iPhone only?), language requirements (EN, ES, both)</li>
                  <li><strong style={{ color: "var(--text-secondary)" }}>Shorter is fine</strong> — even 1-2 sentences work. The agent expands with structure, acceptance criteria, and compliance checks</li>
                </ul>
              </div>
            )}

            {/* AI Usage — compact */}
            <div className="panel" style={{ borderColor: overBudget ? "rgba(248,113,113,0.3)" : "rgba(34,211,238,0.15)" }}>
              <div className="panel-label" style={{ color: overBudget ? "var(--accent-red)" : "var(--accent-cyan)" }}>
                {overBudget ? "Budget Exceeded" : "AI Spend"}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 700, color: overBudget ? "var(--accent-red)" : "var(--accent-green)" }}>
                <span>{aiUsage.totalRequests} requests</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>${combinedSpend.toFixed(4)}</span>
              </div>
              {openaiTotalSpend > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>
                  <span>Anthropic ${totalSpendUsd.toFixed(4)}</span>
                  <span>OpenAI ${openaiTotalSpend.toFixed(4)}</span>
                </div>
              )}
              {aiUsage.budgetUsd && (
                <div style={{ marginTop: "0.45rem" }}>
                  <div style={{ width: "100%", height: "4px", borderRadius: "2px", background: "var(--bg-input)", overflow: "hidden" }}>
                    <div style={{
                      width: `${budgetPct}%`, height: "100%", borderRadius: "2px",
                      background: budgetPct > 90 ? "var(--accent-red)" : budgetPct > 70 ? "var(--accent-amber)" : "var(--accent-green)",
                    }} />
                  </div>
                </div>
              )}
              <button
                onClick={() => setView("usage")}
                style={{
                  marginTop: "0.5rem", width: "100%", background: "none", border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)", color: "var(--accent-cyan)", fontSize: "0.65rem", fontWeight: 600,
                  padding: "0.35rem", cursor: "pointer", transition: "border-color 0.2s",
                }}
              >
                View full usage →
              </button>
            </div>
          </aside>

          <main className="content-panel">
            <div className="step-bar">
              {[
                { id: "input", label: "Input", num: "1" },
                { id: "review", label: "Review", num: "2" },
                { id: "done", label: "Shipped", num: "3" },
              ].map((s) => (
                <button
                  key={s.id}
                  className={`step-btn ${createStep === s.id ? "active" : ""} ${
                    (s.id === "input" && createStep !== "input") || (s.id === "review" && createStep === "done") ? "completed" : ""
                  }`}
                  onClick={() => {
                    if (s.id === "input") setCreateStep("input");
                    if (s.id === "review" && draft) setCreateStep("review");
                  }}
                >
                  <span className="step-number">{s.num}</span>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="content-area">
              {/* Step 1: Input */}
              {createStep === "input" && (
                <div className="animate-fade">
                  <div className="content-label">Describe your task for {selectedAgent.label}</div>
                  <textarea
                    className="input-textarea"
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    placeholder={getPlaceholder(selectedAgent.id)}
                  />
                  {aiError && (
                    <div style={{
                      marginTop: "0.75rem", padding: "0.6rem 0.85rem", borderRadius: "var(--radius-md)",
                      background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                      fontSize: "0.68rem", color: "var(--accent-red)", lineHeight: 1.5,
                    }}>
                      <strong>AI Error:</strong> {aiError}
                      <div style={{ marginTop: "0.3rem", color: "var(--text-muted)" }}>
                        Use <strong>Template Generate</strong> instead — no API key needed.
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                    <button
                      className="btn-generate"
                      onClick={generateWithAI}
                      disabled={isGenerating || !rawInput.trim() || !hasAIKey}
                      style={{
                        flex: 1,
                        background: !hasAIKey ? "var(--bg-elevated)" : `${agentColor}18`,
                        borderColor: !hasAIKey ? "var(--border-medium)" : `${agentColor}60`,
                        color: !hasAIKey ? "var(--text-dim)" : agentColor,
                      }}
                    >
                      {isGenerating ? (
                        <><span className="spinner" /> Generating with {selectedAgent.label}...</>
                      ) : !hasAIKey ? (
                        "🔑 VITE_ANTHROPIC_KEY not set"
                      ) : (
                        <>{selectedAgent.icon} AI Generate</>
                      )}
                    </button>
                    <button
                      className="btn-generate"
                      onClick={generateFromTemplate}
                      disabled={!rawInput.trim()}
                      style={{
                        flex: 1,
                        background: `${agentColor}0a`,
                        borderColor: `${agentColor}35`,
                        color: agentColor,
                      }}
                    >
                      📝 Template Generate
                    </button>
                    <button
                      className="btn-generate"
                      onClick={() => {
                        setDraft({
                          summary: "", description: "", priority: selectedAgent.defaultPriority,
                          ferpa_risk: false, lfpdppp_risk: false, estimated_effort: "M",
                        });
                        setCreateStep("review");
                      }}
                      style={{ flex: 0, minWidth: 120, background: "var(--bg-elevated)", borderColor: "var(--border-medium)", color: "var(--text-secondary)" }}
                    >
                      Manual
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Review */}
              {createStep === "review" && draft && (
                <div className="animate-fade">
                  <div className="content-label">Review & edit before shipping to Bitacora</div>

                  {draft.ferpa_risk && (
                    <div className="compliance-alert ferpa">🔒 FERPA Risk — Security Agent review required</div>
                  )}
                  {draft.lfpdppp_risk && (
                    <div className="compliance-alert lfpdppp">🛡️ LFPDPPP Risk — Security Agent must review</div>
                  )}

                  <div className="review-field">
                    <div className="review-field-label">Summary *</div>
                    <input
                      className="review-input"
                      value={draft.summary}
                      onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                      placeholder="Ticket title (required)..."
                    />
                  </div>

                  <div className="review-meta">
                    <div className="meta-item">
                      <div className="review-field-label">Priority</div>
                      <select className="review-select" value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}>
                        {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="meta-item">
                      <div className="review-field-label">Effort</div>
                      <div className="effort-badges">
                        {EFFORTS.map((e) => (
                          <button key={e} className={`effort-btn ${draft.estimated_effort === e ? "active" : ""}`}
                            onClick={() => setDraft((d) => ({ ...d, estimated_effort: e }))}>{e}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="review-field">
                    <div className="review-field-label">Description (Markdown)</div>
                    <textarea
                      className="review-textarea"
                      value={draft.description}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      placeholder="Ticket description..."
                    />
                  </div>

                  <div className="action-bar">
                    <button className="btn-back" onClick={() => setCreateStep("input")}>← Back</button>
                    <button
                      className="btn-back"
                      title="Copy ticket as JSON for agent handoff"
                      onClick={() => copyTicketJson({
                        agent: selectedAgent.label,
                        summary: draft.summary,
                        description: draft.description,
                        priority: draft.priority,
                        estimated_effort: draft.estimated_effort,
                        ferpa_risk: draft.ferpa_risk,
                        lfpdppp_risk: draft.lfpdppp_risk,
                      }, "Ticket JSON")}
                      style={{ color: "var(--accent-cyan)", borderColor: "rgba(34,211,238,0.3)" }}
                    >
                      📋 Copy JSON
                    </button>
                    <button
                      className="btn-ship"
                      onClick={submitTicket}
                      disabled={actionLoading === "create" || !draft.summary.trim() || !token}
                      style={{ background: `${agentColor}18`, borderColor: `${agentColor}60`, color: agentColor }}
                    >
                      {actionLoading === "create" ? <><span className="spinner" /> Creating...</> : "🚀 Ship to Bitacora"}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Done */}
              {createStep === "done" && (
                <div className="success-screen animate-pop">
                  <div className="success-check">✓</div>
                  <div className="success-title">Ticket Created</div>
                  <div className="success-card">
                    <div className="success-id">{draft?.createdId}</div>
                    <div className="success-summary">{draft?.summary}</div>
                  </div>
                  <div style={{ marginBottom: "1rem", fontSize: "0.65rem", color: agentColor, fontWeight: 600 }}>
                    {selectedAgent.icon} Created by {selectedAgent.label}
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                    <button className="btn-new-ticket" onClick={resetCreate}>+ Create Another</button>
                    <button className="btn-new-ticket"
                      style={{ background: "rgba(52,211,153,0.1)", borderColor: "rgba(52,211,153,0.3)", color: "var(--accent-green)" }}
                      onClick={() => { setView("board"); loadIssues(); }}>← Back to Board</button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* ═══ AI USAGE ════════════════════════════════════════ */}
      {view === "usage" && (() => {
        const remaining = aiUsage.creditBalance != null ? Math.max(aiUsage.creditBalance - totalSpendUsd, 0) : null;
        const pendingCost = aiUsage.history.length > 0
          ? (aiUsage.history[0].inputTokens * 3 + aiUsage.history[0].outputTokens * 15) / 1_000_000
          : 0;

        return (
          <div className="animate-fade">
            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <button
                className={`step-btn ${usageTab === "anthropic" ? "active" : ""}`}
                onClick={() => setUsageTab("anthropic")}
                style={{ borderBottom: usageTab === "anthropic" ? "2px solid var(--accent-indigo)" : "2px solid transparent" }}
              >
                Anthropic Claude
              </button>
              <button
                className={`step-btn ${usageTab === "openai" ? "active" : ""}`}
                onClick={() => { setUsageTab("openai"); if (!openaiUsage && hasOpenAIKey) loadOpenaiUsage(); }}
                style={{ borderBottom: usageTab === "openai" ? "2px solid #10a37f" : "2px solid transparent" }}
              >
                OpenAI
              </button>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", alignSelf: "center" }}>
                Combined: <strong style={{ color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>${combinedSpend.toFixed(4)}</strong>
              </div>
            </div>

            {/* ─── OpenAI Tab ─── */}
            {usageTab === "openai" && (
              <div className="animate-fade">
                {/* Console Links Bar */}
                <div style={{
                  display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap",
                  padding: "0.65rem 0.85rem", background: "rgba(16,163,127,0.06)", borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(16,163,127,0.15)", alignItems: "center",
                }}>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>OpenAI Console:</span>
                  <a href={OPENAI_USAGE_URL} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "0.68rem", color: "#10a37f", textDecoration: "none", fontWeight: 600 }}>
                    Usage Dashboard
                  </a>
                  <span style={{ color: "var(--border-medium)" }}>|</span>
                  <a href={OPENAI_BILLING_URL} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "0.68rem", color: "#10a37f", textDecoration: "none", fontWeight: 600 }}>
                    Billing
                  </a>
                  <span style={{ color: "var(--border-medium)" }}>|</span>
                  <a href={OPENAI_ADMIN_KEYS_URL} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "0.68rem", color: "#10a37f", textDecoration: "none", fontWeight: 600 }}>
                    Admin Keys
                  </a>
                </div>

                {!hasOpenAIKey ? (
                  <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔑</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.35rem" }}>No OpenAI API key configured</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.75rem", lineHeight: 1.6 }}>
                      The OpenAI Usage API requires an <strong>Admin key</strong> (<code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-admin-*</code>).
                      <br />Standard project keys (<code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-proj-*</code>) don't have access to usage data.
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                      <button className="btn-back" onClick={openSettings} style={{ color: "var(--accent-indigo)", borderColor: "rgba(124,106,255,0.3)" }}>
                        Open Settings
                      </button>
                      <a href={OPENAI_ADMIN_KEYS_URL} target="_blank" rel="noopener noreferrer"
                        className="btn-back" style={{ color: "#10a37f", borderColor: "rgba(16,163,127,0.3)", textDecoration: "none" }}>
                        Create Admin Key
                      </a>
                    </div>
                  </div>
                ) : !isAdminKey(openaiKey) ? (
                  <div className="panel" style={{ padding: "2rem" }}>
                    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                      <div style={{ fontSize: "1.5rem" }}>&#9888;&#65039;</div>
                      <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.35rem" }}>Admin key required</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                          Your current key starts with <code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>{openaiKey.slice(0, 10)}...</code> — this is a standard project key.
                          <br />The Usage & Costs API only works with <strong>Admin keys</strong> (<code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-admin-*</code>).
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginBottom: "1rem", lineHeight: 1.6 }}>
                          <strong>How to get an Admin key:</strong><br />
                          1. Go to <a href={OPENAI_ADMIN_KEYS_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#10a37f" }}>platform.openai.com/settings/organization/admin-keys</a><br />
                          2. Click "Create new admin key"<br />
                          3. Paste the <code style={{ fontSize: "0.65rem", background: "var(--bg-input)", padding: "1px 4px", borderRadius: 3 }}>sk-admin-...</code> key in Settings
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                          <a href={OPENAI_ADMIN_KEYS_URL} target="_blank" rel="noopener noreferrer"
                            className="btn-back" style={{ color: "#10a37f", borderColor: "rgba(16,163,127,0.3)", textDecoration: "none" }}>
                            Create Admin Key
                          </a>
                          <button className="btn-back" onClick={openSettings} style={{ color: "var(--accent-indigo)", borderColor: "rgba(124,106,255,0.3)" }}>
                            Update Key in Settings
                          </button>
                          <a href={OPENAI_USAGE_URL} target="_blank" rel="noopener noreferrer"
                            className="btn-back" style={{ color: "var(--text-muted)", borderColor: "var(--border-medium)", textDecoration: "none" }}>
                            View usage on OpenAI Console instead
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Date Range Filter */}
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>Date range:</div>
                      <input
                        className="settings-input"
                        type="date"
                        value={openaiDateRange.startDate}
                        onChange={(e) => setOpenaiDateRange((r) => ({ ...r, startDate: e.target.value }))}
                        style={{ fontSize: "0.72rem", padding: "0.4rem 0.6rem", width: 150 }}
                      />
                      <span style={{ color: "var(--text-dim)", fontSize: "0.68rem" }}>to</span>
                      <input
                        className="settings-input"
                        type="date"
                        value={openaiDateRange.endDate}
                        onChange={(e) => setOpenaiDateRange((r) => ({ ...r, endDate: e.target.value }))}
                        style={{ fontSize: "0.72rem", padding: "0.4rem 0.6rem", width: 150 }}
                      />
                      <button
                        className="btn-back"
                        onClick={loadOpenaiUsage}
                        disabled={openaiLoading}
                        style={{ fontSize: "0.72rem", padding: "0.4rem 1rem" }}
                      >
                        {openaiLoading ? "Loading..." : "Fetch"}
                      </button>
                    </div>

                    {openaiError && (
                      <div style={{
                        marginBottom: "1rem", padding: "0.6rem 0.85rem", borderRadius: "var(--radius-md)",
                        background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                        fontSize: "0.72rem", color: "var(--accent-red)", lineHeight: 1.5,
                      }}>
                        <strong>Error:</strong> {openaiError}
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem", marginBottom: "1.5rem" }}>
                      <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#10a37f", fontFamily: "var(--font-mono)" }}>
                          ${openaiTotalSpend.toFixed(4)}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Total Spent</div>
                      </div>
                      <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                          {openaiUsage?.modelTotals?.["whisper-1"] != null
                            ? `$${openaiUsage.modelTotals["whisper-1"].toFixed(4)}`
                            : "—"
                          }
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Whisper Usage</div>
                      </div>
                      <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                          {openaiUsage?.modelTotals?.["gpt-4o-mini"] != null
                            ? `$${openaiUsage.modelTotals["gpt-4o-mini"].toFixed(4)}`
                            : "—"
                          }
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>GPT-4o-mini Usage</div>
                      </div>
                      <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
                          {openaiUsage?.dailyBreakdown?.length > 0
                            ? `$${(openaiTotalSpend / openaiUsage.dailyBreakdown.length).toFixed(4)}`
                            : "—"
                          }
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Daily Average</div>
                      </div>
                    </div>

                    {/* Model Breakdown Table */}
                    {openaiUsage?.modelTotals && Object.keys(openaiUsage.modelTotals).length > 0 && (
                      <div className="panel" style={{ marginBottom: "1.5rem" }}>
                        <div className="panel-label" style={{ color: "#10a37f" }}>Model Breakdown</div>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                <th style={{ textAlign: "left", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Model</th>
                                <th style={{ textAlign: "right", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Cost</th>
                                <th style={{ textAlign: "right", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>% of Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(openaiUsage.modelTotals)
                                .sort(([, a], [, b]) => b - a)
                                .map(([model, cost]) => (
                                  <tr key={model} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                    <td style={{ padding: "0.5rem 0.6rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                                      <span style={{
                                        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                                        background: getModelColor(model), marginRight: "0.5rem", verticalAlign: "middle",
                                      }} />
                                      {model}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--accent-green)", fontWeight: 600 }}>
                                      ${cost.toFixed(4)}
                                    </td>
                                    <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                                      {openaiTotalSpend > 0 ? ((cost / openaiTotalSpend) * 100).toFixed(1) : 0}%
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Daily Usage Bars */}
                    {openaiUsage?.dailyBreakdown?.length > 0 && (
                      <div className="panel">
                        <div className="panel-label" style={{ color: "#10a37f" }}>Daily Usage</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          {(() => {
                            const maxDay = Math.max(...openaiUsage.dailyBreakdown.map((d) => d.total));
                            return openaiUsage.dailyBreakdown.map((day) => (
                              <div key={day.date} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--text-dim)", minWidth: 72 }}>
                                  {day.date}
                                </span>
                                <div style={{ flex: 1, height: 16, borderRadius: 3, overflow: "hidden", display: "flex", background: "var(--bg-input)" }}>
                                  {Object.entries(day.models).map(([model, cost]) => (
                                    <div
                                      key={model}
                                      title={`${model}: $${cost.toFixed(4)}`}
                                      style={{
                                        width: `${(cost / maxDay) * 100}%`,
                                        height: "100%",
                                        background: getModelColor(model),
                                        opacity: 0.8,
                                      }}
                                    />
                                  ))}
                                </div>
                                <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--accent-green)", minWidth: 58, textAlign: "right" }}>
                                  ${day.total.toFixed(4)}
                                </span>
                              </div>
                            ));
                          })()}
                        </div>
                        {/* Legend */}
                        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem", paddingTop: "0.6rem", borderTop: "1px solid var(--border-subtle)" }}>
                          {Object.keys(openaiUsage.modelTotals).map((model) => (
                            <div key={model} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.58rem", color: "var(--text-muted)" }}>
                              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: getModelColor(model) }} />
                              {model}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {!openaiUsage && !openaiLoading && !openaiError && (
                      <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
                        <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>📊</div>
                        <div style={{ fontSize: "0.78rem" }}>Click Fetch to load OpenAI usage data</div>
                      </div>
                    )}

                    {openaiUsage && !openaiUsage.dailyBreakdown?.length && !openaiLoading && (
                      <div className="panel" style={{ textAlign: "center", padding: "2rem" }}>
                        <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>📭</div>
                        <div style={{ fontSize: "0.78rem" }}>No usage data for this period</div>
                        <div style={{ fontSize: "0.65rem", marginTop: "0.2rem", color: "var(--text-dim)" }}>Try adjusting the date range</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ─── Anthropic Tab ─── */}
            {usageTab === "anthropic" && (
            <div>
            {/* Credit Balance Section */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem" }}>Credit balance</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                Your credit balance is consumed by AI ticket generation. Set your starting balance from the{" "}
                <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--accent-indigo)", textDecoration: "none" }}>Anthropic Console</a>{" "}
                to track remaining credits here.
              </div>

              <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                {/* Balance Card */}
                <div className="credit-card">
                  {remaining != null ? (
                    <>
                      <div className="credit-card-amount">${remaining.toFixed(2)}</div>
                      <div className="credit-card-label">Remaining Balance</div>
                      {totalSpendUsd > 0 && (
                        <div className="credit-card-pending">${totalSpendUsd.toFixed(4)} spent of ${aiUsage.creditBalance.toFixed(2)}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="credit-card-amount" style={{ fontSize: "1.4rem", fontWeight: 500 }}>No balance set</div>
                      <div className="credit-card-label">Enter your balance from the Anthropic Console →</div>
                    </>
                  )}
                </div>

                {/* Right side info */}
                <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.85rem" }}>
                  <div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginBottom: "0.35rem" }}>
                      {remaining != null ? "Starting balance" : "Enter your balance from console.anthropic.com/settings/billing"}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <div style={{ position: "relative", flex: 1, maxWidth: 200 }}>
                        <span style={{
                          position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)",
                          color: "var(--text-dim)", fontSize: "0.82rem", fontWeight: 600, pointerEvents: "none",
                        }}>$</span>
                        <input
                          className="settings-input"
                          autoFocus={aiUsage.creditBalance == null}
                          type="number" step="0.01" min="0"
                          placeholder="e.g. 4.95"
                          value={aiUsage.creditBalance ?? ""}
                          onChange={(e) => setCreditBalance(e.target.value ? parseFloat(e.target.value) : null)}
                          style={{
                            paddingLeft: "1.5rem", fontSize: "0.82rem",
                            borderColor: aiUsage.creditBalance == null ? "var(--accent-indigo)" : undefined,
                          }}
                        />
                      </div>
                      <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer"
                        className="btn-back" style={{ fontSize: "0.72rem", textDecoration: "none", padding: "0.5rem 1rem" }}>
                        Buy credits
                      </a>
                    </div>
                  </div>

                  <div style={{
                    display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.65rem 0.85rem",
                    background: "var(--bg-input)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
                  }}>
                    <span style={{ fontSize: "0.85rem" }}>{overBudget ? "🔴" : aiUsage.budgetUsd ? "🟢" : "⚪"}</span>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                      {aiUsage.budgetUsd
                        ? <>Budget alert set at <strong>${aiUsage.budgetUsd.toFixed(2)}</strong>. {overBudget ? "Budget exceeded!" : "Tracking active."}</>
                        : <>Budget alert is <strong>not set</strong>. Set a monthly limit below to get warnings.</>
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem", marginBottom: "1.5rem" }}>
              <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-indigo)", fontFamily: "var(--font-mono)" }}>
                  {aiUsage.totalRequests}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Total Requests</div>
              </div>
              <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                  {(aiUsage.totalInputTokens + aiUsage.totalOutputTokens).toLocaleString()}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Total Tokens</div>
              </div>
              <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: overBudget ? "var(--accent-red)" : "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
                  ${totalSpendUsd.toFixed(4)}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Total Spent</div>
              </div>
              <div className="panel" style={{ textAlign: "center", padding: "1.25rem 1rem" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                  {aiUsage.totalRequests > 0
                    ? `$${(totalSpendUsd / aiUsage.totalRequests).toFixed(4)}`
                    : "—"
                  }
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Avg Cost / Request</div>
              </div>
            </div>

            {/* Budget + Token Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              {/* Budget */}
              <div className="panel">
                <div className="panel-label" style={{ color: "var(--accent-amber)" }}>Monthly Budget</div>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{
                      position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)",
                      color: "var(--text-dim)", fontSize: "0.78rem", fontWeight: 600, pointerEvents: "none",
                    }}>$</span>
                    <input
                      className="settings-input"
                      type="number" step="0.5" min="0"
                      placeholder="No limit"
                      value={aiUsage.budgetUsd ?? ""}
                      onChange={(e) => setBudget(e.target.value ? parseFloat(e.target.value) : null)}
                      style={{ paddingLeft: "1.4rem", fontSize: "0.78rem" }}
                    />
                  </div>
                  {aiUsage.totalRequests > 0 && (
                    <button onClick={resetUsage} className="btn-back" style={{ fontSize: "0.68rem", padding: "0.4rem 0.75rem" }}>
                      Reset Stats
                    </button>
                  )}
                </div>
                {aiUsage.budgetUsd && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                      <span>${totalSpendUsd.toFixed(4)} used</span>
                      <span>${aiUsage.budgetUsd.toFixed(2)} limit</span>
                    </div>
                    <div style={{ width: "100%", height: "8px", borderRadius: "4px", background: "var(--bg-input)", overflow: "hidden" }}>
                      <div style={{
                        width: `${budgetPct}%`, height: "100%", borderRadius: "4px",
                        background: budgetPct > 90 ? "var(--accent-red)" : budgetPct > 70 ? "var(--accent-amber)" : "var(--accent-green)",
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                    <div style={{ fontSize: "0.6rem", color: "var(--text-dim)", marginTop: "0.35rem", textAlign: "right" }}>
                      {budgetPct.toFixed(1)}% used
                    </div>
                  </>
                )}
              </div>

              {/* Token breakdown */}
              <div className="panel">
                <div className="panel-label" style={{ color: "var(--accent-cyan)" }}>Token Breakdown</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Input tokens</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{aiUsage.totalInputTokens.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Output tokens</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{aiUsage.totalOutputTokens.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.3rem", marginTop: "0.2rem" }}>
                    <span>Input cost</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>${(aiUsage.totalInputTokens * 3 / 1_000_000).toFixed(4)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Output cost</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>${(aiUsage.totalOutputTokens * 15 / 1_000_000).toFixed(4)}</span>
                  </div>
                </div>
                <div style={{ marginTop: "0.5rem", fontSize: "0.58rem", color: "var(--text-dim)" }}>
                  Claude Sonnet 4 · $3/MTok in · $15/MTok out
                </div>
              </div>
            </div>

            {/* Request History */}
            <div className="panel">
              <div className="panel-label" style={{ color: "var(--accent-indigo)" }}>Request History</div>
              {aiUsage.history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-dim)" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>📭</div>
                  <div style={{ fontSize: "0.78rem" }}>No AI requests yet</div>
                  <div style={{ fontSize: "0.65rem", marginTop: "0.2rem" }}>Generate a ticket with AI to start tracking</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <th style={{ textAlign: "left", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Time</th>
                        <th style={{ textAlign: "left", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Agent</th>
                        <th style={{ textAlign: "right", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>In</th>
                        <th style={{ textAlign: "right", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Out</th>
                        <th style={{ textAlign: "right", padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiUsage.history.map((h, i) => {
                        const cost = (h.inputTokens * 3 + h.outputTokens * 15) / 1_000_000;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "0.5rem 0.6rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "0.65rem" }}>
                              {new Date(h.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td style={{ padding: "0.5rem 0.6rem", color: "var(--text-secondary)", fontWeight: 500 }}>{h.agent}</td>
                            <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{h.inputTokens.toLocaleString()}</td>
                            <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{h.outputTokens.toLocaleString()}</td>
                            <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--accent-green)", fontWeight: 600 }}>${cost.toFixed(4)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </div>
            )}
          </div>
        );
      })()}

      {/* ═══ DETAIL ═══════════════════════════════════════════ */}
      {view === "detail" && activeIssue && (
        <div className="animate-fade">
          <button className="btn-back" onClick={() => setView("board")} style={{ marginBottom: "1rem" }}>← Back to Board</button>
          <div className="content-panel" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent-indigo)" }}>
                {activeIssue.idReadable}
              </span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: "0.62rem", color: "var(--text-dim)" }}>
                Created {formatDate(activeIssue.created)} · Updated {formatDate(activeIssue.updated)}
              </span>
            </div>

            <div className="review-field">
              <div className="review-field-label">Summary</div>
              <input className="review-input" value={editFields.summary}
                onChange={(e) => setEditFields((f) => ({ ...f, summary: e.target.value }))} />
            </div>

            <div className="review-meta">
              <div className="meta-item">
                <div className="review-field-label">Stage</div>
                <select className="review-select"
                  value={getCustomFieldValue(activeIssue, "Stage") || "Backlog"}
                  onChange={(e) => changeField(activeIssue.idReadable, "Stage", e.target.value)}
                  disabled={!!actionLoading}>
                  {STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="meta-item">
                <div className="review-field-label">Priority</div>
                <select className="review-select"
                  value={getCustomFieldValue(activeIssue, "Priority") || "Normal"}
                  onChange={(e) => changeField(activeIssue.idReadable, "Priority", e.target.value)}
                  disabled={!!actionLoading}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="review-field">
              <div className="review-field-label">Description</div>
              <textarea className="review-textarea" style={{ minHeight: 260 }}
                value={editFields.description}
                onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="action-bar">
              <button
                className="btn-back"
                title="Copy ticket as JSON for agent handoff"
                onClick={() => copyTicketJson({
                  id: activeIssue.idReadable,
                  summary: editFields.summary,
                  description: editFields.description,
                  stage: getCustomFieldValue(activeIssue, "Stage"),
                  priority: getCustomFieldValue(activeIssue, "Priority"),
                  created: formatDate(activeIssue.created),
                  updated: formatDate(activeIssue.updated),
                }, `${activeIssue.idReadable} JSON`)}
                style={{ color: "var(--accent-cyan)", borderColor: "rgba(34,211,238,0.3)" }}
              >
                📋 Copy JSON
              </button>
              <button className="btn-ship" onClick={saveEdit} disabled={actionLoading === "save"}
                style={{ flex: 1, background: "rgba(124,106,255,0.15)", borderColor: "rgba(124,106,255,0.5)", color: "var(--accent-indigo)" }}>
                {actionLoading === "save" ? <><span className="spinner" /> Saving...</> : "💾 Save Changes"}
              </button>
              {!confirmDelete ? (
                <button className="btn-back" style={{ color: "var(--accent-red)", borderColor: "rgba(248,113,113,0.3)" }}
                  onClick={() => setConfirmDelete(true)}>🗑 Delete</button>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.68rem", color: "var(--accent-red)", fontWeight: 600 }}>Confirm?</span>
                  <button className="btn-back"
                    style={{ color: "var(--accent-red)", borderColor: "rgba(248,113,113,0.5)", background: "rgba(248,113,113,0.08)" }}
                    onClick={handleDelete} disabled={actionLoading === "delete"}>
                    {actionLoading === "delete" ? "Deleting..." : "Yes, delete"}
                  </button>
                  <button className="btn-back" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <span className="footer-text">Bitacora Agent Team → YouTrack</span>
        <div className="footer-badges">
          <span className="footer-badge" style={{ color: "var(--accent-green)", borderColor: "rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.04)" }}>
            Bilingual EN/ES
          </span>
          <span className="footer-badge" style={{ color: "var(--text-dim)", borderColor: "var(--border-subtle)" }}>
            {issues.length} issues
          </span>
        </div>
      </footer>
    </div>
  );
}

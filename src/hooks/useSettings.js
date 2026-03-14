// ─── hooks/useSettings.js — Runtime Credential Management ───────
// Manages the Settings modal state and credential persistence.
//
// In production (Express on :8080):
//   Saves credentials to the server via /api/credentials/:service
//   (encrypted at rest with AES-256-GCM). The server proxy injects
//   them into API calls — keys never reach the browser.
//
// In development (Vite on :5173):
//   Saves to localStorage for the Vite dev proxy passthrough.
//   Falls back to Vite env vars (VITE_YT_TOKEN, etc.).

import { useState, useCallback } from "react";

const isExpressProxy = window.location.port !== "5173";

export function useSettings(token, setToken, showToast, loadIssues) {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    token: "",
    anthropicKey: "",
    openaiKey: "",
  });

  const openSettings = useCallback(async () => {
    if (isExpressProxy) {
      // Load current credential status from the server
      try {
        const res = await fetch("/api/credentials");
        if (res.ok) {
          const data = await res.json();
          // Show placeholder text if configured (we never get raw keys back)
          setSettingsForm({
            token: data.youtrack?.configured ? "••••••••" : "",
            anthropicKey: data.anthropic?.configured ? "••••••••" : "",
            openaiKey: data.openai?.configured ? "••••••••" : "",
          });
        }
      } catch {
        // Fall through to empty form
      }
    } else {
      setSettingsForm({
        token: token,
        anthropicKey: localStorage.getItem("bitacora-anthropic-key") || import.meta.env.VITE_ANTHROPIC_KEY || "",
        openaiKey: localStorage.getItem("bitacora-openai-key") || import.meta.env.VITE_OPENAI_KEY || "",
      });
    }
    setShowSettings(true);
  }, [token]);

  const saveSettings = useCallback(async () => {
    if (isExpressProxy) {
      // Save to server-side encrypted storage
      try {
        const saves = [];

        // Only save if user entered a new value (not the placeholder)
        if (settingsForm.token.trim() && settingsForm.token !== "••••••••") {
          saves.push(
            fetch("/api/credentials/youtrack", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: settingsForm.token.trim() }),
            })
          );
        }

        if (settingsForm.anthropicKey.trim() && settingsForm.anthropicKey !== "••••••••") {
          saves.push(
            fetch("/api/credentials/anthropic", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: settingsForm.anthropicKey.trim() }),
            })
          );
        } else if (!settingsForm.anthropicKey.trim()) {
          saves.push(fetch("/api/credentials/anthropic", { method: "DELETE" }));
        }

        if (settingsForm.openaiKey.trim() && settingsForm.openaiKey !== "••••••••") {
          saves.push(
            fetch("/api/credentials/openai", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: settingsForm.openaiKey.trim() }),
            })
          );
        } else if (!settingsForm.openaiKey.trim()) {
          saves.push(fetch("/api/credentials/openai", { method: "DELETE" }));
        }

        const results = await Promise.all(saves);
        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          const errData = await failed[0].json().catch(() => ({}));
          showToast(errData.error || "Failed to save credentials", "error");
          return;
        }

        // Set a flag so the board knows a token exists (for UI purposes)
        setToken(settingsForm.token.trim() && settingsForm.token !== "••••••••"
          ? settingsForm.token.trim()
          : token || "server-managed");

        setShowSettings(false);
        showToast("Settings saved");
        loadIssues();
      } catch (err) {
        showToast("Failed to save settings: " + err.message, "error");
      }
    } else {
      // Dev mode — save to localStorage
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
    }
  }, [settingsForm, token, setToken, showToast, loadIssues]);

  return { showSettings, setShowSettings, settingsForm, setSettingsForm, openSettings, saveSettings };
}

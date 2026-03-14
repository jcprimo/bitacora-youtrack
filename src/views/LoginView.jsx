// ─── views/LoginView.jsx — Authentication Screen ─────────────────
// Renders either the Login form or the first-run Setup form, based
// on whether any users exist in the database (needsSetup flag).
//
// Uses the same glass-morphism style as the rest of the dashboard.
// Fully responsive for iPhone 16 (393px) and desktop.

import { useState } from "react";

export default function LoginView({ needsSetup, login, register, error, clearError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const displayError = error || localError;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError("Email and password are required");
      return;
    }
    setSubmitting(true);
    await login(email.trim(), password);
    setSubmitting(false);
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError("Email and password are required");
      return;
    }
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    await register(email.trim(), password, name.trim() || null);
    setSubmitting(false);
  };

  const handleInputChange = () => {
    if (displayError) {
      clearError();
      setLocalError(null);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card animate-fade">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">📋</div>
          <div className="login-logo-title">Bitacora</div>
          <div className="login-logo-subtitle">App Dashboard</div>
        </div>

        {needsSetup ? (
          <>
            {/* ─── First-Run Setup ──────────────────────────────── */}
            <div className="login-heading">Create Admin Account</div>
            <p className="login-description">
              Welcome to Bitacora. Create your admin account to get started.
              This will be the primary account for managing the dashboard.
            </p>

            <form onSubmit={handleSetup} className="login-form">
              <div className="login-field">
                <label className="login-label">Name</label>
                <input
                  className="login-input"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); handleInputChange(); }}
                  placeholder="Your name (optional)"
                  autoComplete="name"
                />
              </div>

              <div className="login-field">
                <label className="login-label">Email</label>
                <input
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); handleInputChange(); }}
                  placeholder="admin@yourcompany.com"
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>

              <div className="login-field">
                <label className="login-label">Password</label>
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); handleInputChange(); }}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>

              <div className="login-field">
                <label className="login-label">Confirm Password</label>
                <input
                  className="login-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); handleInputChange(); }}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  required
                />
              </div>

              {displayError && (
                <div className="login-error">{displayError}</div>
              )}

              <button
                type="submit"
                className="login-submit"
                disabled={submitting}
              >
                {submitting ? (
                  <><span className="spinner" /> Creating account...</>
                ) : (
                  "Create Admin Account"
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            {/* ─── Login ────────────────────────────────────────── */}
            <div className="login-heading">Sign In</div>
            <p className="login-description">
              Enter your credentials to access the dashboard.
            </p>

            <form onSubmit={handleLogin} className="login-form">
              <div className="login-field">
                <label className="login-label">Email</label>
                <input
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); handleInputChange(); }}
                  placeholder="you@yourcompany.com"
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>

              <div className="login-field">
                <label className="login-label">Password</label>
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); handleInputChange(); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              {displayError && (
                <div className="login-error">{displayError}</div>
              )}

              <button
                type="submit"
                className="login-submit"
                disabled={submitting}
              >
                {submitting ? (
                  <><span className="spinner" /> Signing in...</>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </>
        )}

        <div className="login-footer">
          Bitacora App Dashboard — #OpsLife
        </div>
      </div>
    </div>
  );
}

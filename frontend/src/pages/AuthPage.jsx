import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function AuthPage() {
  const { needsSetup, login } = useAuth();
  const [step, setStep] = useState(needsSetup ? "setup" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [preToken, setPreToken] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitCredentials = (e) => {
    e.preventDefault();
    run(async () => {
      const path = step === "setup" ? "/api/auth/setup" : "/api/auth/login";
      const res = await api(path, { method: "POST", body: { username, password } });
      setPreToken(res.pre_token);
      if (res.totp_setup_required) {
        const enroll = await api("/api/auth/totp/begin", {
          method: "POST",
          body: { pre_token: res.pre_token },
        });
        setSecret(enroll.secret);
        setStep("enroll");
      } else {
        setStep("code");
      }
    });
  };

  const submitCode = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await api("/api/auth/totp/verify", {
        method: "POST",
        body: { pre_token: preToken, code },
      });
      login(res.token, res.user);
    });
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo" style={{ padding: 0, marginBottom: 6 }}>
          Rom<span>Repo</span>
        </div>

        {(step === "setup" || step === "login") && (
          <form onSubmit={submitCredentials}>
            <p className="muted" style={{ marginBottom: 18 }}>
              {step === "setup"
                ? "Welcome! Create the primary admin account."
                : "Sign in to your library."}
            </p>
            <div className="field">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)}
                autoFocus autoComplete="username" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={step === "setup" ? "new-password" : "current-password"} />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }}
              disabled={busy || !username || !password}>
              {step === "setup" ? "Create admin account" : "Continue"}
            </button>
          </form>
        )}

        {step === "enroll" && (
          <form onSubmit={submitCode}>
            <p className="muted" style={{ marginBottom: 8 }}>
              Two-factor authentication is required. Scan this QR code with your
              authenticator app (Aegis, Google Authenticator, Authy…), then enter
              the 6-digit code.
            </p>
            <div className="qr-box">
              <img alt="TOTP QR code" width="220" height="220"
                src={`/api/auth/totp/qr?pre_token=${encodeURIComponent(preToken)}`} />
            </div>
            <p className="muted" style={{ marginBottom: 6 }}>Or enter manually:</p>
            <div className="secret-code">{secret}</div>
            <div className="field" style={{ marginTop: 16 }}>
              <label>6-digit code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)}
                inputMode="numeric" maxLength={6} autoFocus />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }}
              disabled={busy || code.length !== 6}>
              Verify & finish
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={submitCode}>
            <p className="muted" style={{ marginBottom: 18 }}>
              Enter the code from your authenticator app.
            </p>
            <div className="field">
              <label>6-digit code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)}
                inputMode="numeric" maxLength={6} autoFocus />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }}
              disabled={busy || code.length !== 6}>
              Sign in
            </button>
          </form>
        )}

        {error && <div className="error-text">{error}</div>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../api";

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [msg, setMsg] = useState(null); // {ok, text}
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const s = await api("/api/settings");
    setSettings(s);
    setClientId(s.igdb_client_id);
  };

  useEffect(() => { refresh().catch((e) => setMsg({ ok: false, text: e.message })); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: { igdb_client_id: clientId, igdb_client_secret: clientSecret || null },
      });
      setClientSecret("");
      await refresh();
      setMsg({ ok: true, text: "Settings saved." });
    } catch (e2) {
      setMsg({ ok: false, text: e2.message });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/settings/test-igdb", { method: "POST" });
      setMsg({ ok: true, text: "IGDB connection works." });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/scan/retry-unmatched", { method: "POST" });
      setMsg({ ok: true, text: "Re-matching unmatched games in the background." });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-title">Settings</div>
      <div className="page-sub">Library and metadata configuration.</div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 6 }}>Library path</h3>
        <p className="muted" style={{ marginBottom: 10 }}>
          Set via the ROMS_PATH container variable. One subfolder per platform
          (snes, ps2, gba…).
        </p>
        <div className="secret-code" style={{ textAlign: "left" }}>
          {settings?.roms_path}{" "}
          {settings && (settings.roms_path_exists
            ? <span className="ok-text">✓ mounted</span>
            : <span className="error-text">✗ not found</span>)}
        </div>
      </div>

      <form className="card" style={{ marginBottom: 18 }} onSubmit={save}>
        <h3 style={{ marginBottom: 6 }}>IGDB metadata & artwork</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Create a free application at dev.twitch.tv/console to get credentials.
          Without them, games index with names only.
        </p>
        <div className="field">
          <label>Twitch Client ID</label>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} />
        </div>
        <div className="field">
          <label>
            Twitch Client Secret{" "}
            {settings?.igdb_secret_set && <span className="chip">set</span>}
          </label>
          <input type="password" value={clientSecret}
            placeholder={settings?.igdb_secret_set ? "•••••••• (leave blank to keep)" : ""}
            onChange={(e) => setClientSecret(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn btn-primary" disabled={busy}>Save</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={test}>
            Test connection
          </button>
        </div>
      </form>

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Metadata matching</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          {settings ? `${settings.unmatched} games could not be matched.` : "…"}
          {" "}Retry after fixing filenames or adding IGDB credentials.
        </p>
        <button className="btn" disabled={busy || !settings?.unmatched} onClick={retry}>
          Retry unmatched
        </button>
      </div>

      {msg && (
        <div className={msg.ok ? "ok-text" : "error-text"} style={{ marginTop: 14 }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

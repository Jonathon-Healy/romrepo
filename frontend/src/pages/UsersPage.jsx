import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role_id: "" });
  const [error, setError] = useState(null);

  const refresh = async () => {
    const [u, r] = await Promise.all([api("/api/users"), api("/api/roles")]);
    setUsers(u);
    setRoles(r.roles);
    if (!form.role_id && r.roles.length) {
      setForm((f) => ({ ...f, role_id: r.roles.find((x) => x.name === "Member")?.id || r.roles[0].id }));
    }
  };

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);

  const act = async (fn) => {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const create = (e) => {
    e.preventDefault();
    act(async () => {
      await api("/api/users", { method: "POST", body: { ...form, role_id: +form.role_id } });
      setShowCreate(false);
      setForm({ username: "", password: "", role_id: form.role_id });
    });
  };

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title">Users</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            Accounts and access. All users must enroll in TOTP on first sign-in.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New user
        </button>
      </div>

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>Username</th><th>Role</th><th>MFA</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong>{u.id === me.id && <span className="muted"> (you)</span>}</td>
                <td>
                  <select value={u.role_id} disabled={u.id === me.id}
                    style={{ width: 140 }}
                    onChange={(e) => act(() => api(`/api/users/${u.id}`, {
                      method: "PATCH", body: { role_id: +e.target.value },
                    }))}>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td>
                  {u.totp_enabled
                    ? <span className="chip">Enrolled</span>
                    : <span className="chip chip-dim">Pending</span>}
                </td>
                <td>
                  {u.disabled
                    ? <span className="chip chip-dim">Disabled</span>
                    : <span className="chip">Active</span>}
                </td>
                <td>
                  <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => act(() => api(`/api/users/${u.id}/reset-totp`, { method: "POST" }))}>
                      Reset TOTP
                    </button>
                    {u.id !== me.id && (
                      <>
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => act(() => api(`/api/users/${u.id}`, {
                            method: "PATCH", body: { disabled: !u.disabled },
                          }))}>
                          {u.disabled ? "Enable" : "Disable"}
                        </button>
                        <button className="btn btn-danger btn-sm"
                          onClick={() => confirm(`Delete ${u.username}?`) &&
                            act(() => api(`/api/users/${u.id}`, { method: "DELETE" }))}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <form className="modal-body" onSubmit={create}>
              <h3 style={{ marginBottom: 16 }}>New user</h3>
              <div className="field">
                <label>Username</label>
                <input value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })} autoFocus />
              </div>
              <div className="field">
                <label>Temporary password (min 8 chars)</label>
                <input type="password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={form.role_id}
                  onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <p className="muted" style={{ marginBottom: 14 }}>
                They'll enroll in TOTP on their first sign-in.
              </p>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost"
                  onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

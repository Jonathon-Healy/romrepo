import { useEffect, useState } from "react";
import { api } from "../api";

const PERM_LABELS = {
  "library.view": "View library",
  "library.download": "Download games",
  "scan.run": "Run library scans",
  "users.manage": "Manage users",
  "roles.manage": "Manage roles",
  "settings.manage": "Manage settings",
};

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [perms, setPerms] = useState([]);
  const [editing, setEditing] = useState(null); // {id?, name, permissions}
  const [error, setError] = useState(null);

  const refresh = async () => {
    const r = await api("/api/roles");
    setRoles(r.roles);
    setPerms(r.permissions);
  };

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (editing.id) {
        await api(`/api/roles/${editing.id}`, {
          method: "PATCH",
          body: { name: editing.name, permissions: editing.permissions },
        });
      } else {
        await api("/api/roles", {
          method: "POST",
          body: { name: editing.name, permissions: editing.permissions },
        });
      }
      setEditing(null);
      await refresh();
    } catch (e2) {
      setError(e2.message);
    }
  };

  const remove = async (role) => {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    setError(null);
    try {
      await api(`/api/roles/${role.id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const togglePerm = (p) => {
    setEditing((ed) => ({
      ...ed,
      permissions: ed.permissions.includes(p)
        ? ed.permissions.filter((x) => x !== p)
        : [...ed.permissions, p],
    }));
  };

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title">Roles</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            Control what each account can do.
          </div>
        </div>
        <button className="btn btn-primary"
          onClick={() => setEditing({ name: "", permissions: ["library.view"] })}>
          + New role
        </button>
      </div>

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="stat-row" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {roles.map((r) => (
          <div key={r.id} className="stat-card">
            <div className="row spread">
              <strong>{r.name}</strong>
              {r.builtin
                ? <span className="chip chip-dim">Built-in</span>
                : <span className="chip">{r.user_count} users</span>}
            </div>
            <div style={{ margin: "12px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {r.permissions.map((p) => (
                <span key={p} className="chip chip-dim">{PERM_LABELS[p] || p}</span>
              ))}
            </div>
            {!r.builtin && (
              <div className="row">
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setEditing({ id: r.id, name: r.name, permissions: [...r.permissions] })}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(r)}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <form className="modal-body" onSubmit={save}>
              <h3 style={{ marginBottom: 16 }}>{editing.id ? "Edit role" : "New role"}</h3>
              <div className="field">
                <label>Role name</label>
                <input value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
              </div>
              <label>Permissions</label>
              <div style={{ margin: "8px 0 16px", display: "grid", gap: 8 }}>
                {perms.map((p) => (
                  <label key={p} className="row" style={{
                    marginBottom: 0, cursor: "pointer", color: "var(--text)", fontSize: 14,
                  }}>
                    <input type="checkbox" style={{ width: "auto" }}
                      checked={editing.permissions.includes(p)}
                      onChange={() => togglePerm(p)} />
                    {PERM_LABELS[p] || p}
                  </label>
                ))}
              </div>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost"
                  onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={!editing.name}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

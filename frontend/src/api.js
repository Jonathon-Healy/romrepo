export function getToken() {
  return localStorage.getItem("rr_token");
}

export function setToken(t) {
  if (t) localStorage.setItem("rr_token", t);
  else localStorage.removeItem("rr_token");
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event("rr-logout"));
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const msg = data?.detail || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return data;
}

// stable hue per platform slug, for colored chips & art placeholders
export function platformHue(slug) {
  let h = 0;
  for (const c of slug || "") h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export async function downloadGame(id) {
  const { url } = await api(`/api/games/${id}/download-token`, { method: "POST" });
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

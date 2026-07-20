import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const status = await api("/api/auth/status");
        if (status.needs_setup) {
          setNeedsSetup(true);
        } else if (getToken()) {
          try {
            setUser(await api("/api/auth/me"));
          } catch {
            setToken(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
    const onLogout = () => setUser(null);
    window.addEventListener("rr-logout", onLogout);
    return () => window.removeEventListener("rr-logout", onLogout);
  }, []);

  const login = (token, userData) => {
    setToken(token);
    setUser(userData);
    setNeedsSetup(false);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const can = (perm) => user?.permissions?.includes(perm);

  return (
    <AuthContext.Provider value={{ user, needsSetup, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // ✅ FIX: Use lazy initialisers for useState instead of reading localStorage at module level.
  // Module-level reads are stale closures — they capture the value at import time and never update.
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const verifyToken = async () => {
      const currentToken = localStorage.getItem("token");
      if (!currentToken) {
        return;
      }

      try {
        const { data } = await api.get("/auth/me");
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch (error) {
        setToken("");
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    };

    verifyToken();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data.user;
  };

  const googleLoginAction = async (token) => {
    const response = await api.post("/auth/google-login", { token });
    if (response.status === 202) {
      return { requireRole: true, ...response.data };
    }
    setToken(response.data.token);
    setUser(response.data.user);
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("user", JSON.stringify(response.data.user));
    return response.data.user;
  };

  const googleRegisterAction = async (token, role) => {
    const { data } = await api.post("/auth/google-register", { token, role });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const value = useMemo(
    () => ({ token, user, login, register, googleLogin: googleLoginAction, googleRegister: googleRegisterAction, logout, isAuthenticated: Boolean(token) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};

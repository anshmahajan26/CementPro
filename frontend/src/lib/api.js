import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// API Base URL resolution (build-time, not runtime)
//
// ➊ LOCAL DEV  → no VITE_API_URL set → falls back to http://localhost:5000/api
// ➋ PRODUCTION → Render sets VITE_API_URL=https://cementpro-backend.onrender.com
//                Vite inlines this at BUILD time, so no localhost leaks into prod
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, "")}/api`
  : "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL
});

// ✅ Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Response interceptor — handle 401 auto-logout + surface meaningful network errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      const pathname = window.location.pathname;
      if (pathname !== "/login" && pathname !== "/register" && pathname !== "/forgot-password") {
        window.location.href = "/login";
      }
    }

    if (!error.response) {
      error.message = "Network error — check your connection or server status.";
    }

    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };

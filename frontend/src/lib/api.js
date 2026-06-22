import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// API Base URL resolution
//
// ➊ LOCAL DEV  → VITE_API_URL=http://localhost:5000 (set in .env)
//                → resolves to http://localhost:5000/api
// ➋ PRODUCTION → If VITE_API_URL is set on Render, use it.
//                Otherwise fall back to a RELATIVE "/api" URL so the request
//                always goes to the same origin that served the page —
//                no localhost ever leaks into the production bundle.
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, "")}/api`
  : "/api";

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

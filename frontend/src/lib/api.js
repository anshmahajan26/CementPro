import axios from "axios";

let baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
if (baseUrl && !baseUrl.endsWith("/api") && !baseUrl.endsWith("/api/")) {
  baseUrl = baseUrl.replace(/\/$/, "") + "/api";
}

const api = axios.create({
  baseURL: baseUrl
});

// ✅ Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ FIX: Response interceptor — handle 401 auto-logout + surface meaningful network errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear auth state and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Only redirect if not already on auth pages
      const pathname = window.location.pathname;
      if (pathname !== "/login" && pathname !== "/register" && pathname !== "/forgot-password") {
        window.location.href = "/login";
      }
    }

    // Normalise network errors so components get a readable message
    if (!error.response) {
      error.message = "Network error — check your connection or server status.";
    }

    return Promise.reject(error);
  }
);

export default api;

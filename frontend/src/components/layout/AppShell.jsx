import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { useAuth } from "@/context/AuthContext";

const AppShell = () => {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen md:flex">
      <Sidebar role={user?.role} />
      <main className="flex-1">
        <Header user={user} theme={theme} onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} onLogout={logout} />
        <div className="animate-fade-up p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;

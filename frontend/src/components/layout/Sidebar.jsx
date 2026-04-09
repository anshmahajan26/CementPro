import { NavLink } from "react-router-dom";
import { ChartColumn, Factory, FileSpreadsheet, Leaf, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Dashboard", icon: ChartColumn },
  { to: "/forecast", label: "Forecast", icon: Sparkles },
  { to: "/procurement", label: "Procurement", icon: Factory },
  { to: "/carbon", label: "Carbon", icon: Leaf },
  { to: "/reports", label: "Reports", icon: FileSpreadsheet },
  { to: "/admin", label: "Admin Panel", icon: UploadCloud, roles: ["Admin", "Manager"] }
];

const Sidebar = ({ role }) => (
  <aside className="grid-overlay w-full border-b border-border bg-card/80 backdrop-blur-md md:min-h-screen md:w-72 md:border-b-0 md:border-r">
    <div className="border-b border-border p-4">
      <p className="font-heading text-xl tracking-wide text-primary">Smart RMC</p>
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">AI Operations Suite</p>
    </div>

    <nav className="flex gap-1 overflow-x-auto p-3 md:block md:space-y-1 md:overflow-visible">
      {links
        .filter((item) => !item.roles || item.roles.includes(role))
        .map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition",
                  isActive ? "bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(14,165,233,0.25)]" : "text-foreground hover:bg-muted"
                )
              }
            >
              <Icon size={16} />
              {item.label}
            </NavLink>
          );
        })}
    </nav>

    <div className="mt-auto hidden border-t border-border p-4 text-xs text-muted-foreground md:block">
      <p className="flex items-center gap-2">
        <ShieldCheck size={14} /> JWT secured role-based access
      </p>
    </div>
  </aside>
);

export default Sidebar;

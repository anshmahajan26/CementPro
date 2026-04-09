import { MoonStar, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const Header = ({ user, theme, onToggleTheme, onLogout }) => (
  <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-md md:px-6">
    <div>
      <p className="font-heading text-xl tracking-wide">Operational Intelligence</p>
      <p className="text-xs text-muted-foreground md:text-sm">
        Logged in as {user?.name} ({user?.role})
      </p>
    </div>

    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onToggleTheme}>
        {theme === "dark" ? <Sun size={16} /> : <MoonStar size={16} />}
      </Button>
      <Button variant="outline" onClick={onLogout}>
        <LogOut size={16} className="mr-2" />
        Logout
      </Button>
    </div>
  </header>
);

export default Header;

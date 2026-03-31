import { Home, ClipboardList, Users, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const allTabs = [
  { path: "/", icon: Home, label: "Cadastro", roles: ["admin", "recepcao"] },
  { path: "/visitas", icon: ClipboardList, label: "Visitas", roles: ["admin", "recepcao"] },
  { path: "/pessoas", icon: Users, label: "Pessoas", roles: ["admin"] },
  { path: "/config", icon: Settings, label: "Configurações", roles: ["admin", "recepcao"] },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  const tabs = allTabs.filter(t => !role || t.roles.includes(role));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="max-w-2xl mx-auto flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-2 transition-colors active:scale-95",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
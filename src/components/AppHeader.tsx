import { Bell } from "lucide-react";
import candidataImg from "@/assets/candidata.jpg";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border">
      <div className="h-[1.5px] gradient-header" />
      <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <img
            src={candidataImg}
            alt="Dra. Fernanda Sarelli"
            className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20"
          />
          <h1 className="text-base font-bold">Recepção do Comitê</h1>
        </div>
        <button className="p-2 rounded-full hover:bg-muted transition-colors active:scale-95">
          <Bell size={20} className="text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
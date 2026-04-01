import { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

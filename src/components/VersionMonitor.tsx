import { useEffect } from "react";

export default function VersionMonitor() {
  const version = import.meta.env.VITE_APP_VERSION || "DEV";

  useEffect(() => {
    // Monitor de atualização silenciosa - Auto update loop
    const checkUpdate = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.update();
          }
        } catch (err) {
          console.error("SW Update check error", err);
        }
      }
    };

    // Checa a cada 5 horas para atualizar, além do autoUpdate do VitePWA
    const interval = setInterval(checkUpdate, 5 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null;
}

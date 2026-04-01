import { useState, useRef, useEffect, useCallback } from "react";
import { supabaseExterno } from "@/integrations/supabase/clientExterno";
import { X, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Suplente {
  id: string;
  nome: string;
  numero_urna: string | null;
  partido: string | null;
}

interface Lideranca {
  id: string;
  nome: string;
  regiao: string | null;
  whatsapp: string | null;
}

interface SelectedIndicador {
  nome: string;
  tipo: "suplente" | "lideranca";
  id: string;
}

interface QuemIndicouSelectorProps {
  value: string;
  onChange: (nome: string, tipo: "suplente" | "lideranca" | null, id: string | null) => void;
}

export default function QuemIndicouSelector({ value, onChange }: QuemIndicouSelectorProps) {
  const [inputValue, setInputValue] = useState(value);
  const [selected, setSelected] = useState<SelectedIndicador | null>(null);
  const [suplentes, setSuplentes] = useState<Suplente[]>([]);
  const [liderancas, setLiderancas] = useState<Lideranca[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    if (!selected && value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSuplentes([]);
      setLiderancas([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const [supRes, lidRes] = await Promise.all([
        supabaseExterno
          .from("suplentes")
          .select("id, nome, numero_urna, partido")
          .ilike("nome", `%${term}%`)
          .limit(5),
        supabaseExterno
          .from("liderancas")
          .select("id, nome, regiao, whatsapp")
          .ilike("nome", `%${term}%`)
          .limit(5),
      ]);
      setSuplentes((supRes.data as Suplente[]) || []);
      setLiderancas((lidRes.data as Lideranca[]) || []);
      setOpen(true);
    } catch {
      setSuplentes([]);
      setLiderancas([]);
    }
    setLoading(false);
  }, []);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    setSelected(null);
    onChange(val, null, null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val.trim()), 400);
  };

  const handleSelect = (nome: string, tipo: "suplente" | "lideranca", id: string) => {
    setSelected({ nome, tipo, id });
    setInputValue(nome);
    onChange(nome, tipo, id);
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setInputValue("");
    onChange("", null, null);
    setSuplentes([]);
    setLiderancas([]);
  };

  const hasResults = suplentes.length > 0 || liderancas.length > 0;

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="text-xs font-bold text-foreground">Quem indicou</label>
      <div className="relative">
        {selected ? (
          <div className="w-full h-12 rounded-lg bg-background border border-border px-4 flex items-center gap-2">
            <span className="text-sm font-semibold truncate flex-1">{selected.nome}</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0",
                selected.tipo === "suplente"
                  ? "bg-blue-500/15 text-blue-600"
                  : "bg-green-500/15 text-green-600"
              )}
            >
              {selected.tipo === "suplente" ? "Suplente" : "Liderança"}
            </span>
            <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground p-0.5">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => { if (hasResults) setOpen(true); }}
              placeholder="Buscar suplente ou liderança..."
              className="w-full h-12 rounded-lg bg-background border border-border pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50"
            />
            {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
          </div>
        )}

        {/* Dropdown */}
        {open && hasResults && !selected && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-[280px] overflow-y-auto">
            {suplentes.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-3 py-1.5 font-semibold sticky top-0 bg-card">
                  Suplentes
                </div>
                {suplentes.map((s) => (
                  <button
                    key={`sup-${s.id}`}
                    type="button"
                    onClick={() => handleSelect(s.nome, "suplente", s.id)}
                    className="w-full px-3 py-2.5 hover:bg-muted cursor-pointer flex items-center justify-between text-left"
                  >
                    <div>
                      <span className="text-sm font-semibold">{s.nome}</span>
                      {(s.numero_urna || s.partido) && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {[s.numero_urna, s.partido].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                    <span className="bg-blue-500/15 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                      Suplente
                    </span>
                  </button>
                ))}
              </>
            )}
            {liderancas.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-3 py-1.5 font-semibold sticky top-0 bg-card">
                  Lideranças
                </div>
                {liderancas.map((l) => (
                  <button
                    key={`lid-${l.id}`}
                    type="button"
                    onClick={() => handleSelect(l.nome, "lideranca", l.id)}
                    className="w-full px-3 py-2.5 hover:bg-muted cursor-pointer flex items-center justify-between text-left"
                  >
                    <div>
                      <span className="text-sm font-semibold">{l.nome}</span>
                      {l.regiao && (
                        <span className="text-xs text-muted-foreground ml-2">{l.regiao}</span>
                      )}
                    </div>
                    <span className="bg-green-500/15 text-green-600 text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                      Liderança
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

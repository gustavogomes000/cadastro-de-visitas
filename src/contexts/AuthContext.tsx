import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "recepcao";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  nomeUsuario: string;
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setNomeUsuario("");
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserData(userId: string) {
    // Busca nome da tabela usuarios usando user_id (coluna correta do schema)
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("nome_usuario")
      .eq("user_id", userId)
      .maybeSingle();

    if (usuario) {
      setNomeUsuario(usuario.nome_usuario || "");
    }

    // Busca role via RPC (tabela user_roles)
    // Observacao: se o RPC nao estiver disponivel no projeto, fazemos fallback na tabela.
    setRole(null);
    const { data: userRole, error: roleError } = await supabase.rpc("get_user_role", { _user_id: userId });
    if (!roleError && userRole) {
      setRole(userRole as AppRole);
      return;
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleRow?.role) {
      setRole(roleRow.role as AppRole);
    }
  }

  const signIn = async (username: string, password: string): Promise<{ error: string | null }> => {
    const identifier = username.trim();
    const looksLikeEmail = identifier.includes("@");

    // 1) Tenta buscar por nome_usuario (o que a tela pede)
    const { data: usuarioByNome } = await supabase
      .from("usuarios")
      .select("user_id, email")
      .ilike("nome_usuario", identifier)
      .maybeSingle();

    // 2) Se nao achou e o usuario digitou um email, tenta por email
    const { data: usuarioByEmail } = !usuarioByNome && looksLikeEmail
      ? await supabase
        .from("usuarios")
        .select("user_id, email")
        .eq("email", identifier)
        .maybeSingle()
      : { data: null };

    const usuario = usuarioByNome ?? usuarioByEmail;

    // Se for email, tentamos login direto (independe da tabela "usuarios")
    // Se nao for email, geramos o email padrao baseado no nome de usuario.
    const baseForEmail = identifier
      .toLowerCase()
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9.]/g, "");

    const emailToUse =
      usuario?.email ||
      (looksLikeEmail ? identifier : `${baseForEmail}@sistema.local`);

    // 3) Login principal
    let { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (error && !looksLikeEmail) {
      // Fallback: tenta a versão legacy se for o e-mail padrão
      const emailLegacy = `${baseForEmail}@interno.app`;
      const legacyAttempt = await supabase.auth.signInWithPassword({
        email: emailLegacy,
        password,
      });
      error = legacyAttempt.error;
    }

    if (error) {
      return { error: "Senha incorreta ou usuário não encontrado" };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null,
      nomeUsuario, role, loading,
      isAdmin: role === "admin",
      signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

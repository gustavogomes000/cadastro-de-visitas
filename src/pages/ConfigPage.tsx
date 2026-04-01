import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  LogOut, Moon, Sun, UserPlus, Loader2, Shield, Headset,
  Pencil, X, Check, Key, ChevronDown, ChevronUp, Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UsuarioComRole {
  id: string;
  auth_user_id: string; // mapeado de user_id
  nome: string;         // mapeado de nome_usuario
  tipo: string;         // mapeado de user_roles.role
}

export default function ConfigPage() {
  const { user, nomeUsuario, role, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const [darkMode, setDarkMode] = useState(false);

  // User management (admin only)
  const [usuarios, setUsuarios] = useState<UsuarioComRole[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ nome: "", senha: "", tipo: "recepcao" });
  const [creatingUser, setCreatingUser] = useState(false);

  // Editing role
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  // Password change
  const [changingPasswordUserId, setChangingPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Expanded user
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
    if (isAdmin) loadUsuarios();
  }, [isAdmin]);

  async function loadUsuarios() {
    // Fetch usuarios and roles separately (no FK between them)
    const { data: usuariosData } = await supabase
      .from("usuarios")
      .select("id, user_id, nome_usuario, criado_em")
      .order("criado_em", { ascending: false });

    if (!usuariosData) return;

    // Fetch all roles
    const userIds = usuariosData.map(u => u.user_id);
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const roleMap = new Map<string, string>();
    rolesData?.forEach(r => roleMap.set(r.user_id, r.role));

    const mapped: UsuarioComRole[] = usuariosData.map((u) => ({
      id: u.id,
      auth_user_id: u.user_id,
      nome: u.nome_usuario,
      tipo: roleMap.get(u.user_id) ?? "recepcao",
    }));
    setUsuarios(mapped);
  }

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDarkMode(!darkMode);
    localStorage.setItem("theme", !darkMode ? "dark" : "light");
  };

  const handleCreateUser = async () => {
    const nome = newUser.nome.trim();
    const senha = newUser.senha;

    if (!nome || !senha) {
      toast({ title: "Preencha nome e senha", variant: "destructive" });
      return;
    }

    if (senha.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    setCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('criar-usuario', {
        body: { nome, senha, tipo: newUser.tipo },
      });
      
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro desconhecido");
      }

      setNewUser({ nome: "", senha: "", tipo: "recepcao" });
      setShowAddUser(false);
      toast({ title: "Sucesso!", description: `Usuário "${nome}" criado com sucesso.` });
      loadUsuarios();
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    }
    setCreatingUser(false);
  };

  const handleUpdateRole = async (authUserId: string) => {
    setSavingRole(true);
    try {
      // user_roles não tem policy UPDATE — fazemos DELETE + INSERT
      await supabase.from("user_roles").delete().eq("user_id", authUserId);
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: authUserId, role: editRole as "admin" | "recepcao" });
      if (error) throw error;

      toast({ title: "Sucesso!", description: "Perfil atualizado." });
      setEditingUserId(null);
      loadUsuarios();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSavingRole(false);
  };

  const handleChangePassword = async (userNome: string) => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      // Usa a Edge Function criar-usuario: se usuário já existe, atualiza a senha
      const { data, error } = await supabase.functions.invoke("criar-usuario", {
        body: { nome: userNome, senha: newPassword },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      toast({ title: "Sucesso!", description: "Senha atualizada com sucesso." });
      setChangingPasswordUserId(null);
      setNewPassword("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSavingPassword(false);
  };

  const roleLabel = (r: string) => {
    switch (r) {
      case "admin": return "Administrador";
      case "recepcao": return "Recepção";
      default: return r;
    }
  };

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const handleDeleteUser = async (authUserId: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingUserId(authUserId);
    try {
      const { data, error } = await supabase.functions.invoke("criar-usuario", {
        body: { action: "delete", user_id: authUserId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Sucesso!", description: `Usuário "${nome}" deletado.` });
      loadUsuarios();
    } catch (err: any) {
      toast({ title: "Erro ao deletar", description: err.message, variant: "destructive" });
    }
    setDeletingUserId(null);
  };
  const RoleIcon = ({ r }: { r: string }) => {
    if (r === "admin") return <Shield size={14} className="text-primary" />;
    return <Headset size={14} className="text-muted-foreground" />;
  };

  const toggleExpand = (authUserId: string) => {
    if (expandedUserId === authUserId) {
      setExpandedUserId(null);
      setEditingUserId(null);
      setChangingPasswordUserId(null);
    } else {
      setExpandedUserId(authUserId);
      setEditingUserId(null);
      setChangingPasswordUserId(null);
    }
  };

  return (
    <AppLayout>
      <h2 className="text-xl font-bold mb-6">Configurações</h2>

      <div className="space-y-4">
        <div className="card-section">
          <p className="section-title">Conta</p>
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Usuário</span>
            <span className="font-medium">{nomeUsuario || "–"}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Perfil</span>
            <span className="font-medium flex items-center gap-1">
              <RoleIcon r={role || ""} />
              {roleLabel(role || "")}
            </span>
          </div>
        </div>

        {/* User Management - Admin Only */}
        {isAdmin && (
          <div className="card-section">
            <div className="flex items-center justify-between mb-3">
              <p className="section-title text-[10px] uppercase tracking-wider text-muted-foreground/60">Usuários do Sistema</p>
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="text-xs font-bold text-primary flex items-center gap-1 active:scale-95 transition-all"
              >
                {showAddUser ? (
                  <>
                    <X size={14} /> Cancelar
                  </>
                ) : (
                  <>
                    <UserPlus size={14} /> Novo
                  </>
                )}
              </button>
            </div>

            {showAddUser && (
              <div className="space-y-4 p-4 rounded-xl bg-card border border-border/50 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Novo Usuário</p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Nome do usuário *</label>
                  <input
                    type="text"
                    placeholder="Ex: Ana Paula"
                    value={newUser.nome}
                    onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })}
                    className="w-full h-11 rounded-xl bg-muted/30 border border-border/20 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Senha *</label>
                  <input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newUser.senha}
                    onChange={(e) => setNewUser({ ...newUser, senha: e.target.value })}
                    className="w-full h-11 rounded-xl bg-muted/30 border border-border/20 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ml-1">Nível de Acesso *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewUser({ ...newUser, tipo: "recepcao" })}
                      className={cn(
                        "h-11 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-2",
                        newUser.tipo === "recepcao"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/50 text-muted-foreground/40 bg-transparent"
                      )}
                    >
                      <Headset size={14} /> Recepção
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUser({ ...newUser, tipo: "admin" })}
                      className={cn(
                        "h-11 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-2",
                        newUser.tipo === "admin"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/50 text-muted-foreground/40 bg-transparent"
                      )}
                    >
                      <Shield size={14} /> Admin
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCreateUser}
                  disabled={creatingUser}
                  className="w-full h-12 rounded-xl gradient-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 mt-1 shadow-lg shadow-primary/20"
                >
                  {creatingUser ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Criando...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} /> Criar usuário
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="space-y-1">
              {usuarios.map((u) => {
                const isExpanded = expandedUserId === u.auth_user_id;
                const isEditingRole = editingUserId === u.auth_user_id;
                const isChangingPw = changingPasswordUserId === u.auth_user_id;
                const isSelf = u.auth_user_id === user?.id;

                return (
                  <div key={u.id} className="rounded-xl border border-border/50 overflow-hidden transition-all">
                    <button
                      onClick={() => toggleExpand(u.auth_user_id)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {u.nome?.charAt(0).toUpperCase() || "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {u.nome}
                            {isSelf && <span className="text-[10px] text-primary ml-1">(você)</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <RoleIcon r={u.tipo || "recepcao"} />
                            {roleLabel(u.tipo || "recepcao")}
                          </p>
                        </div>
                      </div>
                      {isExpanded
                        ? <ChevronUp size={16} className="text-muted-foreground shrink-0" />
                        : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2 animate-fade-in border-t border-border/30 pt-2">
                        {/* Edit Role */}
                        {!isEditingRole ? (
                          <button
                            onClick={() => { setEditingUserId(u.auth_user_id); setEditRole(u.tipo || "recepcao"); setChangingPasswordUserId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 text-sm transition-colors"
                          >
                            <Pencil size={13} className="text-muted-foreground" />
                            <span>Alterar perfil</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                              className="flex-1 h-9 rounded-lg bg-card border border-border px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 appearance-none">
                              <option value="recepcao">Recepção</option>
                              <option value="admin">Administrador</option>
                            </select>
                            <button onClick={() => handleUpdateRole(u.auth_user_id)} disabled={savingRole}
                              className="h-9 w-9 rounded-lg bg-green-500 text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform disabled:opacity-60">
                              {savingRole ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            <button onClick={() => setEditingUserId(null)}
                              className="h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 active:scale-90 transition-transform">
                              <X size={14} />
                            </button>
                          </div>
                        )}

                        {/* Change password */}
                        {!isChangingPw ? (
                          <button
                            onClick={() => { setChangingPasswordUserId(u.auth_user_id); setNewPassword(""); setEditingUserId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 text-sm transition-colors"
                          >
                            <Key size={13} className="text-muted-foreground" />
                            <span>Redefinir senha</span>
                          </button>
                        ) : (
                          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                            <p className="text-xs text-muted-foreground">
                              Digite a nova senha para <strong>{u.nome}</strong>.
                            </p>
                            <input
                              type="password"
                              placeholder="Nova senha (mín. 6 caracteres)"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full h-9 rounded-lg bg-card border border-border px-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                            />
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleChangePassword(u.nome)} disabled={savingPassword}
                                className="flex-1 h-9 rounded-lg gradient-primary text-white text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-60">
                                {savingPassword ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
                                Salvar senha
                              </button>
                              <button onClick={() => { setChangingPasswordUserId(null); setNewPassword(""); }}
                                className="h-9 px-3 rounded-lg bg-muted text-muted-foreground text-xs font-medium active:scale-90 transition-transform">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {usuarios.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum usuário registrado</p>
              )}
            </div>
          </div>
        )}

        <div className="card-section">
          <p className="section-title">Aparência</p>
          <button onClick={toggleDark} className="w-full flex items-center justify-between py-2">
            <span className="text-sm">Modo escuro</span>
            <div className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors ${darkMode ? "bg-primary" : "bg-muted"}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm flex items-center justify-center transition-transform ${darkMode ? "translate-x-5" : ""}`}>
                {darkMode ? <Moon size={12} /> : <Sun size={12} />}
              </div>
            </div>
          </button>
        </div>

        <button onClick={signOut}
          className="w-full h-12 rounded-xl border border-destructive/30 text-destructive font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </AppLayout>
  );
}

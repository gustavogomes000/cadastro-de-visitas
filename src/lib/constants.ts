export const ASSUNTOS = [
  "Doação",
  "Voluntariado",
  "Reclamação",
  "Indicação de emprego",
  "Filiação",
  "Solicitação de apoio",
  "Informação",
  "Outro",
];

export const ORIGENS_VISITA = [
  "Indicação de liderança",
  "Redes sociais",
  "Evento",
  "Espontâneo",
  "Convite da candidata",
  "Outro",
];

export const STATUS_OPTIONS = [
  "Aguardando",
  "Em andamento",
  "Resolvido",
  "Sem solução",
];

export const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function getStatusColor(status: string) {
  switch (status) {
    case "Aguardando": return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400";
    case "Em andamento": return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
    case "Resolvido": return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "Sem solução": return "bg-red-500/15 text-red-600 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}
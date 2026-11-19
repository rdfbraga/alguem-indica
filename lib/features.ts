export const FEATURES = ["plans", "showcase", "replies", "ads"] as const;
export type Feature = (typeof FEATURES)[number];
export type Flags = Record<Feature, boolean>;
export type PremiumFeature = "showcase" | "replies";

export const NO_FLAGS: Flags = { plans: false, showcase: false, replies: false, ads: false };

export const FEATURE_INFO: Record<Feature, { icon: string; label: string; description: string }> = {
  plans: {
    icon: "⭐",
    label: "Plano Destaque",
    description: "Liga o plano: os recursos premium passam a exigir plano ativo, e o dono pode testar 30 dias grátis. Com ele desligado, os recursos premium que estiverem ligados ficam liberados para todos.",
  },
  showcase: {
    icon: "🛍️",
    label: "Vitrine, fotos e horários",
    description: "Serviços com preços, horário de atendimento e galeria de até 6 fotos no perfil.",
  },
  replies: {
    icon: "💬",
    label: "Respostas às avaliações",
    description: "O dono do perfil responde publicamente às avaliações dos vizinhos.",
  },
  ads: {
    icon: "📢",
    label: "Anunciantes locais",
    description: "Espaço de anúncio na página inicial, com relatório de visualizações e cliques.",
  },
};

export function parseFlags(rows: { feature: string; enabled: boolean }[] | null | undefined): Flags {
  const flags = { ...NO_FLAGS };
  for (const r of rows ?? []) if ((FEATURES as readonly string[]).includes(r.feature)) flags[r.feature as Feature] = r.enabled === true;
  return flags;
}

/** Mesma regra do banco (can_use_premium): chave ligada e, se o plano estiver ligado, perfil com plano ativo. */
export function premiumAvailable(flags: Flags, planActive: boolean, feature: PremiumFeature): boolean {
  return flags[feature] && (!flags.plans || planActive);
}

/** Mostrar o convite ao plano: recurso ligado, plano ligado e o perfil ainda sem plano ativo. */
export function premiumTeaser(flags: Flags, planActive: boolean, feature: PremiumFeature): boolean {
  return flags[feature] && flags.plans && !planActive;
}

export type PlanRow = { current_period_end: string | null; trial_used: boolean; source: "trial" | "manual" | "payment"; note: string | null };
export type PlanState =
  | { kind: "none"; trialAvailable: boolean }
  | { kind: "active"; endsAt: string; daysLeft: number; trial: boolean }
  | { kind: "expired"; endedAt: string; trialAvailable: boolean };

export function planState(plan: PlanRow | null | undefined, now: Date = new Date()): PlanState {
  if (!plan || !plan.current_period_end) return { kind: "none", trialAvailable: !plan?.trial_used };
  const end = new Date(plan.current_period_end);
  if (end.getTime() > now.getTime()) {
    return { kind: "active", endsAt: plan.current_period_end, daysLeft: Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86_400_000)), trial: plan.source === "trial" };
  }
  return { kind: "expired", endedAt: plan.current_period_end, trialAvailable: !plan.trial_used };
}

/** Anúncio vigente hoje (data de São Paulo, no formato AAAA-MM-DD). */
export function adIsLive(ad: { active: boolean; starts_on: string | null; ends_on: string | null }, today: string): boolean {
  return ad.active && (!ad.starts_on || ad.starts_on <= today) && (!ad.ends_on || ad.ends_on >= today);
}

export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

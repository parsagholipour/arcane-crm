export type AiFact = {
  id: string;
  label: string;
  value: string;
};

export type AiNavigationAction = {
  id: string;
  label: string;
  href: string;
};

export type AiEmailDraft = {
  subject: string;
  body: string;
  to?: string;
  recipientIds: string[];
};

export type AgentforceMessageMetadata = {
  kind: "general" | "summary" | "pipeline" | "cases" | "leads" | "draft";
  facts: AiFact[];
  actions: AiNavigationAction[];
  draft?: AiEmailDraft;
  model?: string;
  generatedAt?: string;
};

export type AiHomeRecommendation = {
  title: string;
  rationale: string;
  priority: "high" | "medium" | "low";
  action?: AiNavigationAction;
};

export type AiHomeInsight = {
  summary: string;
  facts: AiFact[];
  recommendations: AiHomeRecommendation[];
};

export type AiActivityInsight = {
  activityId: string;
  summary: string;
  signal: "attention" | "positive" | "neutral";
  nextStep?: string;
};

export type AiActivityInsightPayload = {
  summary: string;
  insights: AiActivityInsight[];
};

export type AiInsightResponse<T> = {
  surface: "home" | "activity";
  payload: T;
  cached: boolean;
  stale: boolean;
  generatedAt: string;
  model: string;
  warning?: string;
};

export type AiApiError = {
  error: string;
  code?: string;
  retryable?: boolean;
};

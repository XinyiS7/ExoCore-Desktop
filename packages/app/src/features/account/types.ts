/**
 * Account feature types (Plan §3 D4, D6, §7.3, §7.4).
 */

/** Allowlisted writable fields for user preset PATCH. */
export interface UpdateUserPresetInput {
  name?: string;
  description?: string;
  default_model?: string;
  system_prompt?: string;
}

export interface TelemetryModelUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  conversation_count: number;
}

export interface TelemetryDayUsage {
  date: string;
  models: TelemetryModelUsage[];
}

export interface TelemetryUsageResponse {
  daily: TelemetryDayUsage[];
  from: string;
  to: string;
  is_current: boolean;
}

export interface UsageTotals {
  totalInput: number;
  totalOutput: number;
  totalCached: number;
  totalConversations: number;
}

export type UsageMode = 'week' | 'month';

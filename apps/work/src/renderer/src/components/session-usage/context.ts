import type { InjectionKey, Ref } from "vue";
import type { SessionUsageSummary } from "./session-usage";

export const SESSION_USAGE_KEY: InjectionKey<Readonly<Ref<SessionUsageSummary>>> =
  Symbol("session-usage");

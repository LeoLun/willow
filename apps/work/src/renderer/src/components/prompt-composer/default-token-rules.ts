import PromptFileToken from "./PromptFileToken.vue";
import PromptSkillToken from "./PromptSkillToken.vue";
import type { ComposerTokenRule } from "./types";

export const vueFileTokenRule: ComposerTokenRule = {
  id: "vue-file",
  pattern: /\[([^\]\r\n]+\.vue)\]\(([^)\r\n]+\.vue)\)/g,
  component: PromptFileToken,
  createProps: (match) => ({ fileName: match[1] ?? "", path: match[2] ?? "" }),
};

export const skillTokenRule: ComposerTokenRule = {
  id: "skill",
  pattern: /\[!skill\]\(([^)\r\n]*skill\.md)\)/g,
  component: PromptSkillToken,
  createProps: (match) => ({ path: match[1] ?? "" }),
};

export const defaultComposerTokenRules = [vueFileTokenRule, skillTokenRule] as const;

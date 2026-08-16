import { unescapeBoardNodeValue } from "./board-node-reference";
import { unescapeFileTokenValue } from "./file-token";
import PromptBoardNodeToken from "./PromptBoardNodeToken.vue";
import PromptFileToken from "./PromptFileToken.vue";
import PromptSkillToken from "./PromptSkillToken.vue";
import type { ComposerTokenRule } from "./types";

export const fileTokenRule: ComposerTokenRule = {
  id: "file",
  pattern: /\[((?:\\.|[^\]\\\r\n])*)\]\(<((?![a-z][a-z0-9+.-]*:\/\/)(?:\\.|[^>\\\r\n])+)>\)/gi,
  component: PromptFileToken,
  createProps: (match) => ({
    fileName: unescapeFileTokenValue(match[1] ?? ""),
    path: unescapeFileTokenValue(match[2] ?? ""),
  }),
};

export const vueFileTokenRule: ComposerTokenRule = {
  id: "vue-file",
  pattern: /\[([^\]\r\n]+\.vue)\]\(([^)\r\n]+\.vue)\)/g,
  component: PromptFileToken,
  createProps: (match) => ({ fileName: match[1] ?? "", path: match[2] ?? "" }),
};

export const skillTokenRule: ComposerTokenRule = {
  id: "skill",
  pattern: /\[!([^\]\r\n]+)\]\(([^)\r\n]*skill\.md)\)/gi,
  component: PromptSkillToken,
  createProps: (match) => ({ skillName: match[1] ?? "", path: match[2] ?? "" }),
};

export const boardNodeTokenRule: ComposerTokenRule = {
  id: "board-node",
  pattern:
    /<board-node path="([^"\r\n]*)" selector="([^"\r\n]*)" tag="([^"\r\n]*)" label="([^"\r\n]*)">([^<\r\n]*)<\/board-node>/g,
  component: PromptBoardNodeToken,
  createProps: (match) => ({
    path: unescapeBoardNodeValue(match[1] ?? ""),
    selector: unescapeBoardNodeValue(match[2] ?? ""),
    tag: unescapeBoardNodeValue(match[3] ?? ""),
    label: unescapeBoardNodeValue(match[4] ?? ""),
    summary: unescapeBoardNodeValue(match[5] ?? ""),
  }),
};

export const defaultComposerTokenRules = [
  fileTokenRule,
  vueFileTokenRule,
  skillTokenRule,
  boardNodeTokenRule,
] as const;

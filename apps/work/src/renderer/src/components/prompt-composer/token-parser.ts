import type { ComposerSegment, ComposerTokenRule } from "./types";

type LocatedMatch = {
  index: number;
  match: RegExpMatchArray;
  rule: ComposerTokenRule;
  ruleIndex: number;
};

function findRuleMatch(
  source: string,
  rule: ComposerTokenRule,
  ruleIndex: number,
): LocatedMatch | undefined {
  const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
  const pattern = new RegExp(rule.pattern.source, flags);
  const match = pattern.exec(source);
  if (!match || match[0].length === 0) return undefined;
  return { index: match.index, match, rule, ruleIndex };
}

export function parseComposerContent(
  source: string,
  rules: readonly ComposerTokenRule[],
): ComposerSegment[] {
  if (source === "") return [];

  const segments: ComposerSegment[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const remaining = source.slice(cursor);
    const located = rules
      .map((rule, ruleIndex) => findRuleMatch(remaining, rule, ruleIndex))
      .filter((candidate): candidate is LocatedMatch => candidate !== undefined)
      .sort((left, right) => left.index - right.index || left.ruleIndex - right.ruleIndex)[0];

    if (!located) {
      segments.push({ type: "text", content: remaining });
      break;
    }

    if (located.index > 0) {
      segments.push({ type: "text", content: remaining.slice(0, located.index) });
    }

    const tokenSource = located.match[0];
    segments.push({
      type: "token",
      ruleId: located.rule.id,
      source: tokenSource,
      component: located.rule.component,
      props: located.rule.createProps(located.match),
    });
    cursor += located.index + tokenSource.length;
  }

  return segments;
}

export function serializeComposerSegments(segments: readonly ComposerSegment[]): string {
  return segments
    .map((segment) => (segment.type === "text" ? segment.content : segment.source))
    .join("");
}

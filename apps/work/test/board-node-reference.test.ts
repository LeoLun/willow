// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  createBoardNodeReference,
  createBoardNodeSelector,
  findBoardNodeCandidate,
  parseComposerContent,
  serializeBoardNodeReference,
  defaultComposerTokenRules,
} from "../src/renderer/src/components/prompt-composer";

function mountBoard(markup: string): HTMLElement {
  document.body.innerHTML = markup;
  const element = document.body.firstElementChild;
  if (!(element instanceof HTMLElement)) throw new Error("board fixture is missing");
  return element;
}

describe("board node references", () => {
  it("prefers stable data attributes and ids when creating selectors", () => {
    const root = mountBoard(`
      <main>
        <section data-board-node="project-status"><p>Status</p></section>
        <section id="milestones"><p>Milestones</p></section>
      </main>
    `);
    const sections = root.querySelectorAll("section");
    expect(createBoardNodeSelector(sections[0]!)).toBe('[data-board-node="project-status"]');
    expect(createBoardNodeSelector(sections[1]!)).toBe("#milestones");
  });

  it("falls back to a unique nth-of-type path", () => {
    const root = mountBoard(`
      <main><section><article>One</article><article>Two</article></section></main>
    `);
    const target = root.querySelectorAll("article")[1]!;
    const selector = createBoardNodeSelector(target);
    expect(document.querySelector(selector)).toBe(target);
    expect(selector).toContain("article:nth-of-type(2)");
  });

  it("chooses the nearest meaningful content node and skips inline fragments", () => {
    const root = mountBoard(`<div><span><strong>Project status</strong></span></div>`);
    const strong = root.querySelector("strong");
    expect(findBoardNodeCandidate(strong)).toBe(root);
    expect(findBoardNodeCandidate(document.body)).toBeUndefined();
  });

  it("escapes, parses, and renders a concise board token without losing source", () => {
    const root = mountBoard(
      `<section data-board-node="status" aria-label='Status &amp; risks'></section>`,
    );
    root.textContent = "Long <text> ".repeat(30);
    const reference = createBoardNodeReference(root);
    const source = serializeBoardNodeReference(reference);
    const segments = parseComposerContent(source, defaultComposerTokenRules);

    expect(reference.summary.length).toBeLessThanOrEqual(180);
    expect(source).toContain("Status &amp; risks");
    expect(source).toContain("&lt;text&gt;");
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      type: "token",
      ruleId: "board-node",
      source,
      props: {
        label: "Status & risks",
        path: ".agents/panel/index.html",
        selector: '[data-board-node="status"]',
        tag: "section",
      },
    });
  });
});

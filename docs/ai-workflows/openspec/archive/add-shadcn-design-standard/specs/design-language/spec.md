# Design Language Spec

## ADDED Requirements

### Requirement: Provide A Project-Level Renderer Design Standard

The repository SHALL provide a project-level `DESIGN.md` for Willow renderer work.

#### Scenario: Use a single design entrypoint

- **GIVEN** the repository contains renderer UI work built with Vue and `shadcn-vue`
- **WHEN** an engineer or AI agent starts a renderer or page-design task
- **THEN** the repository provides a root-level `DESIGN.md`
- **AND** that document acts as the default long-lived UI design standard for the project

### Requirement: Ground The Design Standard In Existing Project Facts

The design standard SHALL be based on the repository's current `shadcn-vue` configuration and renderer theme tokens.

#### Scenario: Use current shadcn-vue baseline

- **GIVEN** `app/work/components.json` defines the project `shadcn-vue` setup
- **WHEN** `DESIGN.md` describes the design system baseline
- **THEN** it reflects the current `new-york` style
- **AND** reflects the current `neutral` base color
- **AND** treats CSS variables as the theme source of truth

#### Scenario: Use current renderer tokens

- **GIVEN** `app/work/src/renderer/index.css` defines renderer theme variables
- **WHEN** `DESIGN.md` defines visual rules
- **THEN** it describes the roles of existing tokens such as `background`, `card`, `primary`, `muted`, `border`, and `sidebar`
- **AND** it does not require a separate token system that does not exist in the codebase

### Requirement: Cover Core Desktop UI Patterns

The design standard SHALL define the default design approach for Willow desktop workbench interfaces.

#### Scenario: Describe desktop workbench intent

- **GIVEN** Willow renderer work primarily targets an Electron desktop application
- **WHEN** `DESIGN.md` defines product UI intent
- **THEN** it describes the interface as calm, focused, and tool-oriented
- **AND** it explicitly avoids marketing-page styling as the default

#### Scenario: Define common page patterns

- **GIVEN** teams need to create common business UI surfaces
- **WHEN** they consult `DESIGN.md`
- **THEN** the document includes guidance for page headers, content containers, list pages, settings forms, empty states, and dialog or sheet-based flows

### Requirement: Define shadcn-vue Component Recipes

The design standard SHALL specify recommended usage patterns for the project's core `shadcn-vue` components.

#### Scenario: Use component-specific guidance

- **GIVEN** the renderer already exposes reusable UI components
- **WHEN** `DESIGN.md` defines component recipes
- **THEN** it includes guidance for `Button`, `Card`, `Dialog`, `Sheet`, `Input`, `Textarea`, `Select`, `Badge`, `Separator`, `Skeleton`, and `Sidebar`
- **AND** it describes recommended use cases, hierarchy, and misuse to avoid

### Requirement: Define Interaction, State, And Prompt Guidance

The design standard SHALL help both human implementers and AI agents produce consistent UI.

#### Scenario: Standardize state rendering

- **GIVEN** a renderer page needs to represent loading, empty, error, disabled, success, or destructive states
- **WHEN** implementers follow `DESIGN.md`
- **THEN** they can apply a consistent treatment for those states
- **AND** they can keep motion and emphasis aligned with the project's restrained desktop style

#### Scenario: Reuse AI prompt guidance

- **GIVEN** an AI agent is asked to generate or revise a renderer page
- **WHEN** it follows `DESIGN.md`
- **THEN** the document provides prompt-style guidance and reusable prompt templates
- **AND** those prompts are specific enough to guide list pages, settings pages, or dialog forms without inventing a new visual language

### Requirement: Preserve OpenSpec As Feature-Level Source Of Truth

The project SHALL keep `DESIGN.md` as a long-lived UI standard without replacing feature-specific OpenSpec behavior.

#### Scenario: Clarify workflow responsibilities

- **GIVEN** the repository already uses `docs/ai-workflows/openspec/` as the product source of truth
- **WHEN** the project adds `DESIGN.md`
- **THEN** `AGENTS.md` and the design standard clarify that `DESIGN.md` guides renderer visual design
- **AND** feature requirements and behavior remain defined by OpenSpec changes

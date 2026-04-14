# Shadcn Package Spec

## ADDED Requirements

### Requirement: Provide A Workspace-Level Shadcn Package

The repository SHALL provide a workspace package named `@willow/shadcn` for shared shadcn-based foundational UI components.

#### Scenario: Use a single shared package for foundational components

- **GIVEN** the repository contains multiple apps and packages that may need shadcn-based UI primitives
- **WHEN** teams add or reuse foundational UI components
- **THEN** those shared components are provided from `@willow/shadcn`
- **AND** they are not primarily sourced from an individual app's private component directory

### Requirement: Separate Foundational Components From Product-Level UI

The system SHALL keep foundational shadcn components separate from product-level and renderer-specific UI components.

#### Scenario: Keep `@willow/ui` focused on higher-level UI

- **GIVEN** `@willow/ui` already exposes message rendering and other product-level UI components
- **WHEN** the project introduces `@willow/shadcn`
- **THEN** foundational primitives such as `Button`, `Card`, `Dialog`, `Input`, and similar UI building blocks belong to `@willow/shadcn`
- **AND** higher-level components such as message renderers, Markdown blocks, and tool renderers remain outside that package unless explicitly generalized later

### Requirement: Support Gradual Migration From `app/work`

The repository SHALL support a gradual migration path from `app/work` local shadcn components to `@willow/shadcn`.

#### Scenario: Migrate without a one-shot page rewrite

- **GIVEN** `app/work/src/renderer/src/components/ui/` currently contains many foundational components
- **WHEN** the implementation introduces `@willow/shadcn`
- **THEN** the migration may proceed in phases
- **AND** `app/work` may temporarily keep compatibility layers or re-exports
- **AND** new shared foundational components default to the workspace package rather than the app-local directory

### Requirement: Use A Stable And Predictable Export Structure

`@willow/shadcn` SHALL expose a stable export structure for shared foundational UI components.

#### Scenario: Import from package root or component folders

- **GIVEN** consumers need to adopt the shared package incrementally
- **WHEN** they import components from `@willow/shadcn`
- **THEN** the package provides a predictable public API
- **AND** that API supports the repository's component-oriented organization pattern

### Requirement: Preserve Existing Visual Contract

The shared shadcn package SHALL remain aligned with the repository's existing visual contract.

#### Scenario: Stay aligned with current design baseline

- **GIVEN** the repository root `DESIGN.md` defines the long-lived renderer design standard
- **AND** `components.json` defines the current `shadcn-vue` baseline
- **WHEN** foundational components are moved into `@willow/shadcn`
- **THEN** they remain compatible with the existing `new-york` and `neutral` baseline
- **AND** they do not introduce a conflicting visual system or separate token contract

# Tool Permissions Spec

## ADDED Requirements

### Requirement: Allow Write Tool Inside Current Workspace

The `write` tool SHALL NOT require permission confirmation when its target path resolves inside the current workspace directory.

#### Scenario: Write relative path inside workspace

- **GIVEN** the `write` tool is created with `cwd=/workspace/project`
- **WHEN** the tool is called with `path="src/file.ts"`
- **THEN** its permission decision is `allow`

#### Scenario: Write absolute path inside workspace

- **GIVEN** the `write` tool is created with `cwd=/workspace/project`
- **WHEN** the tool is called with `path="/workspace/project/src/file.ts"`
- **THEN** its permission decision is `allow`

#### Scenario: Write path escaping workspace

- **GIVEN** the `write` tool is created with `cwd=/workspace/project`
- **WHEN** the tool is called with `path="../outside.ts"`
- **THEN** its permission decision is `ask`

#### Scenario: Write outside absolute path

- **GIVEN** the `write` tool is created with `cwd=/workspace/project`
- **WHEN** the tool is called with `path="/tmp/outside.ts"`
- **THEN** its permission decision is `ask`

### Requirement: Allow Edit Tool Inside Current Workspace

The `edit` tool SHALL NOT require permission confirmation when its target path resolves inside the current workspace directory.

#### Scenario: Edit relative path inside workspace

- **GIVEN** the `edit` tool is created with `cwd=/workspace/project`
- **WHEN** the tool is called with `path="src/file.ts"`
- **THEN** its permission decision is `allow`

#### Scenario: Edit absolute path inside workspace

- **GIVEN** the `edit` tool is created with `cwd=/workspace/project`
- **WHEN** the tool is called with `path="/workspace/project/src/file.ts"`
- **THEN** its permission decision is `allow`

#### Scenario: Edit path escaping workspace

- **GIVEN** the `edit` tool is created with `cwd=/workspace/project`
- **WHEN** the tool is called with `path="../outside.ts"`
- **THEN** its permission decision is `ask`

#### Scenario: Edit outside absolute path

- **GIVEN** the `edit` tool is created with `cwd=/workspace/project`
- **WHEN** the tool is called with `path="/tmp/outside.ts"`
- **THEN** its permission decision is `ask`

### Requirement: Use Path Boundary Aware Workspace Containment

The system SHALL determine workspace containment using normalized absolute paths and path boundaries, not naive string prefix matching.

#### Scenario: Sibling path with same prefix remains outside

- **GIVEN** a tool is created with `cwd=/workspace/project`
- **WHEN** the tool is called with `path="/workspace/project-other/file.ts"`
- **THEN** its permission decision is `ask`

#### Scenario: Nested path remains inside

- **GIVEN** a tool is created with `cwd=/workspace/project`
- **WHEN** the tool is called with `path="nested/../src/file.ts"`
- **THEN** its permission decision is `allow`

### Requirement: Preserve Existing Write And Edit Execution Semantics

The system SHALL change only the permission decision for `write` and `edit`, not their execution semantics.

#### Scenario: Write execution still creates parent directories

- **GIVEN** the `write` tool is allowed for a workspace path whose parent directory does not exist
- **WHEN** the tool executes
- **THEN** it creates the parent directory as before
- **AND** writes the requested content

#### Scenario: Edit execution still requires unique oldText

- **GIVEN** the `edit` tool is allowed for a workspace file
- **WHEN** `oldText` does not appear exactly once
- **THEN** execution fails with the existing unique-match error behavior

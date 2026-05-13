# Sender Resource Picker Spec

## MODIFIED Requirements

### Requirement: Use Slash As The Unified Sender Resource Trigger

`@willow/sender` SHALL use `/` as the unified trigger for selecting current-message resources, including skills and workspace files.

#### Scenario: Open unified resource picker from typed slash

- **GIVEN** the sender editor is focused
- **WHEN** the user types `/`
- **THEN** the sender opens one resource picker panel above the input container
- **AND** the panel can display plugins, skills, and files in grouped sections
- **AND** no separate skill-only or file-only panel is shown

#### Scenario: Filter all resource groups by slash query

- **GIVEN** the unified resource picker is open from a slash trigger
- **WHEN** the user continues typing a query after `/`
- **THEN** the picker filters skills by name and description
- **AND** filters files by file name and workspace-relative path
- **AND** filters plugins by name and description when plugin options are provided
- **AND** the query does not mutate host-provided option data

#### Scenario: Open unified resource picker from toolbar

- **GIVEN** the sender is rendered
- **WHEN** the user activates the toolbar `/` resource button
- **THEN** the sender opens the same unified resource picker with an empty query
- **AND** editor focus remains available for continued input

### Requirement: Remove At Sign As A Sender File Picker Trigger

`@willow/sender` SHALL NOT use `@` as a file picker trigger.

#### Scenario: Type at sign as plain text

- **GIVEN** the sender editor is focused
- **WHEN** the user types `@`
- **THEN** no file picker panel opens
- **AND** the `@` character remains part of the editable message text

#### Scenario: Type an email-like token

- **GIVEN** the sender editor is focused
- **WHEN** the user types text such as `name@example.com`
- **THEN** the sender does not open a file picker
- **AND** the text remains editable as normal message content

### Requirement: Render One Grouped Resource Picker Panel

The sender SHALL render plugin, skill, and file choices in one grouped panel that matches the provided sender UI reference.

#### Scenario: Show grouped resources

- **GIVEN** plugin, skill, and file options are available
- **WHEN** the user opens the slash resource picker
- **THEN** the panel shows groups labeled `插件`, `技能`, and `文件`
- **AND** each visible option shows an icon, primary label, and secondary description or path
- **AND** the panel uses one shared surface, border, and shadow

#### Scenario: Hide empty groups

- **GIVEN** one resource category has no available options and is not loading or errored
- **WHEN** the unified picker is rendered
- **THEN** that category does not render a misleading empty group
- **AND** other categories remain visible and selectable

#### Scenario: Show unified empty search state

- **GIVEN** resource options exist
- **WHEN** the user enters a slash query that matches no visible plugin, skill, or file option
- **THEN** the panel shows a concise empty state
- **AND** normal message editing remains available

#### Scenario: Match the work.pen slash reference

- **GIVEN** the slash resource picker is open
- **WHEN** the sender is visually inspected against `ui/work.pen` `Willow / Sender Component States` `03 输入 / 后效果`
- **THEN** the panel appears as a single command palette above the sender
- **AND** group order is `插件`, `技能`, `文件`
- **AND** the active row uses a subtle light background
- **AND** the sender remains a single rounded input container with an internal bottom toolbar

### Requirement: Share Keyboard Navigation Across Resource Types

The unified picker SHALL use one keyboard navigation model across all visible resource rows.

#### Scenario: Navigate unified results with arrow keys

- **GIVEN** the unified resource picker is open and contains visible results from multiple groups
- **WHEN** the user presses ArrowDown or ArrowUp
- **THEN** the active option moves within the flattened visible result list
- **AND** navigation can move across group boundaries
- **AND** the browser does not move the editor caret for that key press

#### Scenario: Select active unified result with Enter

- **GIVEN** the unified resource picker is open and a resource option is active
- **WHEN** the user presses Enter
- **THEN** the sender selects the active resource option
- **AND** removes the active `/query` trigger text from the editor
- **AND** closes the picker

#### Scenario: Close unified picker with Escape

- **GIVEN** the unified resource picker is open
- **WHEN** the user presses Escape
- **THEN** the sender closes the picker
- **AND** resets active picker navigation state

### Requirement: Preserve Structured Skill And File References

Selecting resources from the unified slash picker SHALL preserve the existing structured tag and send payload semantics.

#### Scenario: Select skill from unified picker

- **GIVEN** the unified picker contains a skill option
- **WHEN** the user selects that skill
- **THEN** the sender inserts the existing compact skill tag
- **AND** duplicate skill selection follows the existing `scope:filePath` de-duplication rule
- **AND** sending the message includes that skill in `selectedSkills`

#### Scenario: Select file from unified picker

- **GIVEN** the unified picker contains a file option
- **WHEN** the user selects that file
- **THEN** the sender inserts the existing compact file tag
- **AND** duplicate file selection follows the existing `path` de-duplication rule
- **AND** sending the message includes that file in `selectedFiles`

#### Scenario: Preserve system file picker behavior

- **GIVEN** the unified slash picker has replaced the previous `@` file picker
- **WHEN** the user activates the toolbar `+` button
- **THEN** the application still opens the system file picker through the host-owned file selection flow
- **AND** selected system files still insert the existing file tag
- **AND** this action does not open the slash resource picker

### Requirement: Keep Sender Host Boundaries

`@willow/sender` SHALL remain reusable and SHALL NOT read workspace files, plugin data, or app/work runtime state directly.

#### Scenario: Receive files and skills from host props

- **GIVEN** a host application renders `Sender`
- **WHEN** it wants slash resource selection to include skills and files
- **THEN** it provides skill options and file options through sender props
- **AND** sender does not scan the workspace file system directly

#### Scenario: Receive plugin options from host when available

- **GIVEN** a host application has plugin options available
- **WHEN** it wants the unified picker to show the `插件` group
- **THEN** it provides plugin options or an equivalent host-owned selection API
- **AND** sender does not import plugin runtime modules directly

#### Scenario: Sender remains independent from app/work runtime

- **GIVEN** `@willow/sender` is built or reused outside `app/work`
- **WHEN** its source dependencies are inspected
- **THEN** it does not import Electron
- **AND** it does not import `app/work` source modules
- **AND** it does not depend on Pinia or Vue Router for resource picker behavior

### Requirement: Preserve Existing Sender Controls

The unified resource picker SHALL NOT regress existing sender controls.

#### Scenario: Existing send controls still work

- **GIVEN** the editor contains normal text, skills, files, or any combination of them
- **WHEN** the user sends a non-empty message
- **THEN** model selection, web search state, usage display, send action, and stop action continue to behave as before
- **AND** the editor clears after successful send

#### Scenario: Empty and error states do not block normal sending

- **GIVEN** plugin, skill, or file options are empty, loading, or failed
- **WHEN** the user writes a normal text message
- **THEN** the user can still send the message
- **AND** the unified picker displays concise state feedback only when opened

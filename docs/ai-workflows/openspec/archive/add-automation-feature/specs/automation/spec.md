# Automation Spec

## ADDED Requirements

### Requirement: Persist Automation Definitions

The system SHALL persist automation definitions in the local database.

#### Scenario: Create automation with workspace, prompt, and schedule trigger

- **GIVEN** the user selects an existing workspace
- **AND** may optionally provide a custom automation name
- **AND** provides a custom AI prompt
- **AND** chooses a supported schedule input mode
- **AND** provides a valid standard cron expression directly or through UI-generated conversion
- **WHEN** the user creates an automation
- **THEN** the system stores the automation definition
- **AND** uses the provided automation name when present, otherwise derives a default title
- **AND** stores a schedule trigger linked to that automation
- **AND** marks the automation as enabled by default unless the user explicitly disables it

#### Scenario: Preserve extensibility for future trigger types

- **GIVEN** the current release only supports schedule triggers
- **WHEN** the automation data model is persisted
- **THEN** trigger data is stored in a way that distinguishes trigger type from automation definition
- **AND** future non-schedule triggers can be added without redefining the automation concept

### Requirement: Support Preset Schedule Inputs In UI

The system SHALL let the user configure common schedule patterns from the automation form without manually writing cron unless they choose custom mode.

#### Scenario: Configure daily schedule

- **GIVEN** the user is creating or editing an automation
- **WHEN** the user selects the daily schedule mode and chooses a time
- **THEN** the form shows a daily schedule summary
- **AND** the system derives the matching standard cron expression for persistence and scheduling

#### Scenario: Configure hourly schedule

- **GIVEN** the user is creating or editing an automation
- **WHEN** the user selects the hourly schedule mode
- **THEN** the form shows that the automation runs once every hour
- **AND** the system derives the matching standard cron expression for persistence and scheduling

#### Scenario: Configure weekly schedule

- **GIVEN** the user is creating or editing an automation
- **WHEN** the user selects the weekly schedule mode, chooses one or more weekdays, and chooses a time
- **THEN** the form shows a weekly schedule summary
- **AND** the system derives the matching standard cron expression for persistence and scheduling

#### Scenario: Configure custom cron schedule

- **GIVEN** the user is creating or editing an automation
- **WHEN** the user selects custom schedule mode
- **THEN** the form provides a standard cron expression input
- **AND** the user can save only after the cron expression passes validation

### Requirement: Render Automation Management Page

The system SHALL provide an automation management page at the existing automation route.

#### Scenario: Show empty-state guidance

- **GIVEN** no automation definitions exist
- **WHEN** the user opens the automation page
- **THEN** the page shows an empty-state explanation
- **AND** the page offers a primary action to create the first automation

#### Scenario: Show localized template examples in empty state

- **GIVEN** no automation definitions exist
- **WHEN** the user opens the automation page
- **THEN** the page shows localized (Chinese) example template cards under the empty-state guidance
- **AND** each template card includes a short use-case description
- **AND** the template area is hidden once the automation list is no longer empty

#### Scenario: Show list with create entry point

- **GIVEN** one or more automations exist
- **WHEN** the user opens the automation page
- **THEN** the page shows the automation list
- **AND** the top-right area shows an add-automation button
- **AND** each list item shows workspace, trigger summary, prompt summary, status, and latest run summary

### Requirement: Follow Project Design Standard For Automation UI

The system SHALL implement automation renderer UI in accordance with the repository root `DESIGN.md`.

#### Scenario: Render automation page with project-standard layout hierarchy

- **GIVEN** the user opens the automation management page
- **WHEN** the automation UI is rendered
- **THEN** the page uses the project-standard workbench layout hierarchy defined in `DESIGN.md`
- **AND** the page header keeps a title, a concise description, and one stable primary action area
- **AND** the page does not use marketing-style hero sections, oversized decorative empty space, or competing primary actions

#### Scenario: Render creation dialog with project-standard component usage

- **GIVEN** the user opens the automation creation dialog
- **WHEN** the dialog content is rendered
- **THEN** the dialog uses `DESIGN.md`-aligned shadcn-vue component patterns for fields, preview, and footer actions
- **AND** the visual structure remains compact, readable, and desktop-tool oriented
- **AND** destructive or secondary actions remain visually subordinate to the primary confirm action

### Requirement: Create Automation With Preview

The system SHALL let the user create an automation from a shadcn-vue dialog workflow.

#### Scenario: Open creation dialog

- **GIVEN** the user is on the automation page
- **WHEN** the user clicks the add-automation button
- **THEN** the system opens a creation dialog implemented with shadcn-vue components
- **AND** the dialog contains inputs for automation name, workspace selection, schedule mode, schedule details, and AI prompt

#### Scenario: Open creation dialog from empty-state template

- **GIVEN** the user is on the automation page empty state
- **WHEN** the user clicks an example template card
- **THEN** the system opens the creation dialog
- **AND** the dialog pre-fills the template prompt, schedule mode, schedule details, and cron expression
- **AND** the user can edit any pre-filled fields before confirming creation

#### Scenario: Show preview before creation

- **GIVEN** the user has filled enough fields to define an automation
- **WHEN** the creation dialog updates
- **THEN** the system shows a preview summarizing the workspace, trigger, prompt summary, and final title
- **AND** the preview includes the final cron expression that will be persisted
- **AND** the preview matches what will be stored if the user confirms creation

### Requirement: Schedule Automations With node-cron

The system SHALL use `node-cron` as the automation scheduler.

#### Scenario: Register cron task for enabled automation

- **GIVEN** an enabled automation uses a valid schedule trigger
- **WHEN** the application starts or the automation is created or updated
- **THEN** the system registers a `node-cron` task for that automation
- **AND** the task uses the persisted standard cron expression

#### Scenario: Do not use custom in-memory timer logic

- **GIVEN** the application needs recurring automation execution
- **WHEN** scheduling is implemented
- **THEN** the system uses `node-cron`
- **AND** does not depend on custom `setTimeout` / `setInterval` orchestration as the source of truth

### Requirement: Catch Up Missed Executions

The system SHALL compensate for missed schedule executions after the process was not running.

#### Scenario: Execute only the latest missed occurrence

- **GIVEN** an enabled automation did not run while the application process was closed
- **AND** the trigger schedule would have matched multiple times during the downtime
- **WHEN** the application restarts and restores automation schedules
- **THEN** the system identifies the most recent missed scheduled occurrence
- **AND** executes the automation once for that occurrence
- **AND** does not replay older missed occurrences

#### Scenario: Resume normal scheduling after catch-up

- **GIVEN** a missed occurrence was compensated
- **WHEN** catch-up execution finishes or is skipped
- **THEN** the automation remains registered for future cron-based execution

### Requirement: Execute Automations In Workspace Context

The system SHALL execute automations against the selected workspace using the stored AI prompt.

#### Scenario: Trigger automation run

- **GIVEN** an automation is due to run
- **WHEN** the scheduler fires
- **THEN** the system uses the automation's workspace as the execution context
- **AND** sends the stored prompt to the AI runtime
- **AND** records the scheduled time and execution status

### Requirement: Expose Automation CRUD To AI Tools

The system SHALL expose automation management tools to the AI runtime.

#### Scenario: Create automation from tool

- **GIVEN** the AI invokes the automation create tool
- **WHEN** the tool request includes a workspace, supported trigger type, valid cron expression, prompt, and optionally a title
- **THEN** the system creates the automation
- **AND** returns a structured result describing the created automation and trigger summary

#### Scenario: Read, update, and delete automation from tools

- **GIVEN** one or more automations exist
- **WHEN** the AI invokes list, get, update, or delete automation tools
- **THEN** the system performs the requested CRUD action
- **AND** returns structured results suitable for conversational confirmation
- **AND** rejects unsupported trigger types or invalid cron expressions

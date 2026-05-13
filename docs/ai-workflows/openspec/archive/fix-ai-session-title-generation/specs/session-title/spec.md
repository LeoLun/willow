# session-title Specification

## ADDED Requirements

### Requirement: Use Only User Input For Automatic Title Content

The system SHALL generate automatic session titles from the first user input only, not from assistant response content or model reasoning content.

#### Scenario: Title prompt excludes assistant response

- **GIVEN** the user has submitted the first message in an empty session
- **WHEN** the system invokes the title generation agent
- **THEN** the title prompt includes the user's first input or its extracted readable text
- **AND** the title prompt does not include the assistant's first response
- **AND** the system does not wait for assistant text before invoking the title generation agent

#### Scenario: Fallback when generated title is empty

- **GIVEN** title generation returns an empty or invalid result
- **WHEN** the system prepares the title to persist
- **THEN** it falls back to a sanitized summary of the user's first input
- **AND** if that fallback is also empty, it uses `新会话`

### Requirement: Disable Reasoning For Automatic Title Generation

The system SHALL run the automatic title generation agent with reasoning / thinking mode disabled, even when the default chat model configuration has reasoning enabled.

#### Scenario: Default model has reasoning enabled

- **GIVEN** the default model configuration has reasoning enabled
- **WHEN** the system creates the title generation agent
- **THEN** the title generation agent uses the same default model identity and provider settings
- **AND** the title generation agent sets reasoning to disabled for this title generation request
- **AND** the persisted default model configuration is not changed

#### Scenario: Main chat agent keeps its reasoning setting

- **GIVEN** the default model configuration has reasoning enabled
- **WHEN** the user sends a chat message
- **THEN** the main chat agent continues to use the configured reasoning setting
- **AND** only the auxiliary title generation agent disables reasoning

### Requirement: Ignore Thinking Content In Generated Title Results

The system SHALL derive automatic session titles only from the title agent's ordinary assistant text output.

#### Scenario: Title agent returns thinking and text

- **GIVEN** the title generation agent response contains a `thinking` block and a `text` block
- **WHEN** the system extracts the generated title
- **THEN** it uses only the `text` block content
- **AND** it does not include any `thinking` block content in the persisted title

#### Scenario: Title agent returns only thinking

- **GIVEN** the title generation agent response contains reasoning or thinking content but no ordinary assistant text
- **WHEN** the system extracts the generated title
- **THEN** the generated title is treated as empty
- **AND** the system falls back to the sanitized first user input or `新会话`

#### Scenario: Reasoning provider ignores disabled reasoning setting

- **GIVEN** the title generation request has disabled reasoning
- **AND** the provider still returns reasoning or thinking content
- **WHEN** the system extracts the generated title
- **THEN** the thinking content is ignored
- **AND** no reasoning content is persisted as the session title

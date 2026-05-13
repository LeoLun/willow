# Session Title Spec

## ADDED Requirements

### Requirement: Generate Title Immediately From First User Input

The system SHALL start automatic session title generation after the first user message is submitted in an empty session, without waiting for the first assistant response to finish.

The system SHALL implement this by moving the existing session title generation flow earlier in `SessionService`, rather than adding a separate parallel title generation mechanism.

#### Scenario: Start title generation before assistant response completes

- **GIVEN** a session has no persisted chat messages before sending
- **WHEN** the user submits the first message
- **THEN** the system starts automatic title generation using that user message
- **AND** the title generation does not wait for the assistant `agent_end` event
- **AND** the main assistant response continues streaming independently

#### Scenario: Existing agent_end trigger no longer gates title generation

- **GIVEN** the first user message has been submitted in an empty session
- **WHEN** the assistant is still streaming and has not emitted `agent_end`
- **THEN** automatic title generation is still allowed to run
- **AND** receiving the later first `agent_end` event does not start a duplicate automatic title generation task for the same first message

#### Scenario: Do not trigger title generation for later messages

- **GIVEN** a session already has prior chat messages
- **WHEN** the user submits another message
- **THEN** the system does not start a new automatic title generation task for that message

### Requirement: Use Only User Input For Automatic Title Content

The system SHALL generate automatic session titles from the first user input only, not from assistant response content.

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

### Requirement: Preserve Manual Title Changes

The system SHALL NOT overwrite a non-empty session title with an automatic title result.

#### Scenario: User renames while automatic title is pending

- **GIVEN** automatic title generation has started for an empty session
- **AND** the user manually renames the session before automatic title generation completes
- **WHEN** the automatic title result becomes available
- **THEN** the system keeps the user's manual title
- **AND** it does not emit a session title update for the automatic result

#### Scenario: Emit title update when automatic write succeeds

- **GIVEN** automatic title generation completes successfully
- **AND** the session title is still empty
- **WHEN** the generated or fallback title is persisted
- **THEN** the system emits `SESSION_TITLE_UPDATED` with the updated session

### Requirement: Keep Chat Send Flow Independent From Title Generation

The system SHALL treat automatic title generation as a non-blocking auxiliary task.

#### Scenario: Title generation failure does not fail message send

- **GIVEN** the user submits the first message in an empty session
- **AND** automatic title generation fails because the title model errors or is unavailable
- **WHEN** the chat message is being sent to the main assistant agent
- **THEN** the main chat send flow continues
- **AND** assistant stream events and message persistence are not failed by the title generation error

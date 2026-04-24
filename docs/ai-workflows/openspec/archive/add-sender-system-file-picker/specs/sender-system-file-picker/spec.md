# Sender System File Picker Spec

## ADDED Requirements

### Requirement: Provide System File Picker Entry In Sender

The chat sender SHALL provide a compact `+` button in the lower-left toolbar of the input box for adding files through the operating system file picker.

#### Scenario: Open system file picker from plus button

- **GIVEN** the chat sender is rendered in `app/work`
- **WHEN** the user clicks the lower-left `+` button
- **THEN** the application opens the operating system file picker
- **AND** the existing workspace file picker opened by `@` is not shown for this action

#### Scenario: Cancel system file selection

- **GIVEN** the system file picker is open
- **WHEN** the user cancels selection
- **THEN** the current sender draft remains unchanged
- **AND** no file tag is inserted

#### Scenario: Select multiple files

- **GIVEN** the system file picker is open
- **WHEN** the user selects multiple files and confirms
- **THEN** the sender inserts each selected file as a file reference tag
- **AND** duplicate paths already present in the current draft are not inserted again

### Requirement: Reuse Existing File Reference Semantics

Files selected through the system file picker SHALL behave the same as files added through the existing `@` file mention flow after selection completes.

#### Scenario: Insert selected system file as file tag

- **GIVEN** the user selects a file from the system file picker
- **WHEN** the selection result is returned to the sender
- **THEN** the sender inserts the file using the existing file tag behavior
- **AND** the tag stores at least `name`, `path`, `relativePath`, and optional `extension`
- **AND** the editor remains focused for continued typing

#### Scenario: Send system-selected files

- **GIVEN** the editor contains file tags created from the system file picker
- **WHEN** the user sends the message
- **THEN** the send payload contains those files in `selectedFiles`
- **AND** the message text contains each file reference in `[文件名](文件路径)` markdown link format
- **AND** the host does not parse the message text to reconstruct the selected files

#### Scenario: Match @-added file visual result

- **GIVEN** one file is added through `@` and another is added through the system file picker
- **WHEN** both appear in the sender editor
- **THEN** both are displayed with the same compact file tag component and styling

### Requirement: Keep System File Selection Host-Owned

`@willow/sender` SHALL NOT directly invoke Electron or browser file system APIs for this feature.

#### Scenario: Sender requests host file selection

- **GIVEN** the user activates the sender `+` file button
- **WHEN** sender needs files from the operating system
- **THEN** sender emits a host-facing request or uses an equivalent host-provided callback
- **AND** `app/work` performs the actual Electron system file selection

#### Scenario: Sender remains reusable outside app/work

- **GIVEN** `@willow/sender` is inspected or built independently
- **WHEN** its dependencies are checked
- **THEN** it does not import Electron
- **AND** it does not import `app/work` source modules
- **AND** it does not depend on Pinia or Vue Router for system file selection

### Requirement: Preserve Existing Sender File And Skill Flows

Adding the system file picker SHALL NOT regress the existing sender interactions.

#### Scenario: @ workspace file picker still works

- **GIVEN** the system file picker entry has been added
- **WHEN** the user types `@` in the editor
- **THEN** the existing workspace file picker still opens, filters, navigates, selects, and inserts file tags as before

#### Scenario: Slash skill picker still works

- **GIVEN** the system file picker entry has been added
- **WHEN** the user types `/` in the editor
- **THEN** the existing skill picker still opens, filters, navigates, selects, and inserts skill tags as before

#### Scenario: Toolbar actions remain distinguishable

- **GIVEN** the sender toolbar contains the new `+` file button and existing manual picker actions
- **WHEN** the user scans or tabs through the toolbar
- **THEN** each action has a distinct accessible label
- **AND** activating `+` adds files through the system picker
- **AND** activating the workspace file action still opens the workspace file picker if that action remains visible

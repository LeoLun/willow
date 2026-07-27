# Dependency patches

## `@earendil-works/pi-agent-core@0.80.6`

Adds `AgentHarness.continue()` by running the existing `runAgentLoopContinue` path through the
harness lifecycle. Willow uses it to resume a persisted session after a tool approval interrupted
the original Electron process.

Remove the patch once the upstream `AgentHarness` exposes an equivalent continuation API.

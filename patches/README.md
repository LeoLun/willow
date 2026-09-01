# Dependency patches

## `@earendil-works/pi-agent-core@0.80.6`

Adds `AgentHarness.continue()` by running the existing `runAgentLoopContinue` path through the
harness lifecycle. Willow uses it to resume a persisted session after a tool approval interrupted
the original Electron process.

Remove the patch once the upstream `AgentHarness` exposes an equivalent continuation API.

Willow intentionally keeps `pi-agent-core` on `0.80.6` while using `pi-ai@0.84.4`. The
workspace override aligns the agent core's transitive `pi-ai` runtime with the direct dependency;
`pi-ai/compat` and the model runtime APIs used by this harness remain available in `0.84.4`.

---
name: sdk-feature
description: Implement a new feature for the frontend monitoring SDK with minimal changes, validation, and documentation updates.
---

# When to use
Use this skill when adding new SDK capabilities such as a plugin, event model, transport enhancement, or public API.

# Instructions
1. Read the existing architecture before coding.
2. Prefer extending current abstractions instead of replacing them.
3. Keep runtime overhead low.
4. Use strict TypeScript types.
5. Add or update tests when behavior changes.
6. Update docs or README if public usage changes.
7. Return:
   - implementation summary
   - modified files
   - validation results
   - risks and next steps

# Resources
- docs/architecture.md
- packages/core/src
- packages/shared/src

# Optional scripts
- pnpm test
- pnpm typecheck
- pnpm lint
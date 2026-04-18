---
name: sdk-release
description: Prepare the SDK for release with build validation, package checks, and release notes updates.
---

# When to use
Use this skill before publishing or tagging a new SDK version.

# Instructions
1. Verify package exports and entry points.
2. Check build artifacts.
3. Confirm public types are exposed correctly.
4. Review README examples.
5. Summarize release scope.
6. Report any publishing risks.

# Resources
- package.json
- tsup.config.ts
- README.md
- packages/*/package.json

# Optional scripts
- pnpm build
- pnpm test
- pnpm typecheck
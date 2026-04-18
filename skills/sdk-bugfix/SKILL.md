---
name: sdk-bugfix
description: Diagnose and fix bugs in the monitoring SDK with root-cause analysis and minimal-risk changes.
---

# When to use
Use this skill for runtime issues, reporting failures, typing bugs, plugin regressions, and demo integration bugs.

# Instructions
1. Reproduce or reason through the failure path.
2. Identify the minimal root cause.
3. Avoid unrelated refactors.
4. Prefer the safest fix with clear explanation.
5. Add a regression test when feasible.
6. Return:
   - root cause
   - fix summary
   - modified files
   - validation steps

# Resources
- packages/core/src
- packages/plugin-*/src
- tests/

# Optional scripts
- pnpm test
- pnpm typecheck
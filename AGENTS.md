# AGENTS.md

## Project overview
This repository contains a frontend observability SDK built with TypeScript.
The main goal is to build a lightweight, extensible monitoring SDK for web apps.

## Architecture goals
- Keep the SDK lightweight and modular
- Prefer plugin-based design
- Avoid coupling data collection with transport details
- Preserve clean event modeling and stable public APIs

## Tech stack
- TypeScript
- pnpm workspace
- tsup for bundling
- vitest for tests
- Vite + React for demo app

## Coding conventions
- Use strict TypeScript
- Avoid `any`
- Keep public APIs stable and well typed
- Prefer small focused modules
- Reuse shared types and utilities
- Do not introduce unnecessary abstractions

## Performance constraints
- SDK code should minimize runtime overhead
- Avoid heavy synchronous work on page load
- Prefer batching and deferred work when reasonable
- Never let monitoring logic block the main experience

## Task workflow
Before implementing:
1. inspect existing project structure
2. identify affected files
3. propose a minimal implementation plan

After implementing:
1. run typecheck
2. run tests if relevant
3. summarize changed files
4. explain tradeoffs and risks

## Output expectations
When finishing a task, always provide:
- summary of changes
- files modified
- validation results
- follow-up suggestions
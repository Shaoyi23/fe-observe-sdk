# Repo-local Agent Skills

This directory stores repository-local agent skills that are intended to travel with the codebase.

## Purpose

- keep reusable project guidance versioned with the repository
- make future iterations easier for both humans and agents
- allow the team to review skill changes like normal code changes

## Current skills

- `.agents/skills/web-design-guidelines/SKILL.md`: UI and UX review guidance based on Vercel's Web Interface Guidelines workflow

## Lock file

`skills-lock.json` records the skills that are actually vendored into this repository together with their source metadata.

When adding or removing a repo-local skill:

1. add or remove the actual skill files under `.agents/skills`
2. update `skills-lock.json` to match what is really present in the repo
3. review the skill text like any other project artifact before merging

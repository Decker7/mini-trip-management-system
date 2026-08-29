# Mini Trip Management System

## Agent skills

### Issue tracker

GitHub Issues — `Decker7/mini-trip-management-system`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Branch workflow

`development` is the working branch (branched off `main`). Every change goes through a pull request — never commit or push directly to `development` or `main`:

- For every change, create a feature branch off `development`, commit there, push it, and open a pull request targeting `development`.
- Wait for the repo's CI checks (`.github/workflows/ci.yml`: typecheck, lint, format check, test, build) to finish on the PR. Fix and push again if any fail.
- Once CI is green, merge the PR into `development` — no need to wait for a separate human approval each round.
- `main` stays the one branch to be more careful with — merging into `main` still needs the user's explicit go-ahead in that specific conversation.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Mini Trip Management System

## Agent skills

### Issue tracker

GitHub Issues — `Decker7/mini-trip-management-system`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Branch workflow

`development` is the working branch (branched off `main`). Every change goes through a pull request — never commit or push directly to `development` or `main`. Run the whole cycle yourself via the `gh` CLI — the user does not need to open GitHub or click anything:

1. Create a feature branch off `development`, commit there, push it: `git checkout -b <type>/<slug> && git push -u origin <type>/<slug>`.
2. Open the PR against `development` (this is the CLI equivalent of the "Compare & pull request" button — GitHub computes the diff automatically, there's no separate manual compare step): `gh pr create --base development --title "..." --body "..."`.
3. Wait for CI to finish: `gh pr checks <number> --watch`. The repo's checks (`.github/workflows/ci.yml`: typecheck, lint, format check, test, build) plus the Greptile review bot both must pass. If anything fails, fix it, push again, and re-watch.
4. Once every check is green, merge it yourself — no need to wait for a separate human approval each round: `gh pr merge <number> --merge --delete-branch`.
5. Discard any stray uncommitted diffs to `convex/_generated/api.d.ts` / `server.d.ts` before each of the steps above if `git status` shows them — they're harmless codegen noise from the `convex dev` watcher running in another terminal, not real changes (`git checkout -- convex/_generated/api.d.ts convex/_generated/server.d.ts`).

`main` stays the one branch to be more careful with — merging into `main` still needs the user's explicit go-ahead in that specific conversation.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

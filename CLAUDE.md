# Mini Trip Management System

## Agent skills

### Issue tracker

GitHub Issues — `Decker7/mini-trip-management-system`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Branch workflow

`development` is the working branch (branched off `main`). Server-side branch protection is unavailable on this repo (private repo on a free GitHub plan), so this is enforced by convention, not by GitHub:

- Never commit or push directly to `development` or `main`.
- For every change, create a feature branch off `development`, commit there, push it, and open a pull request targeting `development`.
- Never merge the pull request. Stop after opening it — Decker7 reviews and merges it themselves in GitHub.
- Only merge into `development` (or `main`) if explicitly told to in that specific conversation — a past approval does not carry forward to later changes.

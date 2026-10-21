# GitHub Project #7 — Chat Planning Bridge

This is an isolated repository for syncing chat-created GitHub Issues into [GitHub Project #7](https://github.com/users/yongshengchen0615/projects/7/views/1).

## Required one-time setup

1. Create a **classic GitHub Personal Access Token** with `project` scope at https://github.com/settings/tokens (and `repo` if this repository becomes private). Never paste credentials into ChatGPT.
2. Save it in this repository's **Settings → Secrets and variables → Actions → New repository secret** with the exact name `PROJECTS_V2_TOKEN`.
3. Enable GitHub Actions if they are disabled.
4. In ChatGPT, ask the connected GitHub tool to create Issues with the marker below. When the secret is configured, the workflow adds/updates those Issues in Project #7.

## Planning card format

```markdown
<!-- project7-managed -->
<!-- project7:Status=Todo -->
<!-- project7:Priority=Low -->

## Goal
Describe a goal.

## Acceptance criteria
- [ ] Confirm the card is in Project #7
- [ ] Confirm correct Status/Priority in Project #7
```

Optional: `<!-- project7:Due Date=2026-11-01 -->` (only applies if an actual Project date field named `Due Date` exists).

Update an Issue's title or body from ChatGPT while preserving the marker to re-sync. The workflow runs only for eligible issues authored and updated by repository owner `yongshengchen0615` and only targets Project #7. Missing fields or option names are logged and not fabricated.

**Verification:** Check repository **Actions → Sync GitHub Project 7**, then refresh Project #7. Issue creation is not proof of Project card creation. Repository is PUBLIC: do not include sensitive data in planning cards.

Unit tests: `node --test .github/scripts/project7-core.test.mjs`.

## Verified live status (2026-10-21)

- Project #7 item for [Issue #1](https://github.com/yongshengchen0615/test1111/issues/1): `PVTI_lAHOAY1fWs4BoDd7zhCY0Os`
- [GitHub Actions verification](https://github.com/yongshengchen0615/test1111/actions/runs/39591816097): success; field write and readback confirm `Status=Todo`.
- Project #7 currently has **no field named Priority**. The workflow now fails explicitly if card metadata references missing fields/options, rather than silently claiming full success.
- For priority, first add a **single-select** field named `Priority` to Project #7 with options `Low`, `Medium`, `High` (or adjust the metadata to the actual field options). Then restore a standalone `<!-- project7:Priority=Low -->` line in the Issue body.
- A new issue edit triggers resync. Do **not** paste a GitHub token into the issue body or ChatGPT.

### Scope and verification troubleshooting

- For a user-owned Project, use a **Personal Access Token (classic)** with the `project` scope in Actions secret `PROJECTS_V2_TOKEN`. `read:project` alone is insufficient for writing.
- Authorization errors from `gh project ...` are reported with actionable guidance; simply running `gh auth refresh` inside Actions cannot change the stored token.
- Synchronization checks actual item existence, then reads the requested fields again and fails if a written value is absent or different. Workflow Success now means the requested supported field values were verified, not only that the Issue exists.
- The GitHub CLI version on Actions does not allow `gh project item-list --field ... --format json` together; the implementation uses the standard JSON view to perform readback.

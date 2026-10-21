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
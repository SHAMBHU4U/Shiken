---
name: GitHub CLI authentication
description: Troubleshooting rejected HTTPS pushes from the workspace shell.
---

The GitHub account connected in Replit's Git UI may not provide usable credentials to the shell's `git` command. When `git push` returns “Invalid username or token,” authenticate GitHub CLI for HTTPS and configure it as Git's credential helper.

**Why:** A linked account in the UI and the credentials used by Git CLI can be separate; merge conflicts and authentication failures are different problems.

**How to apply:** First finish any active merge, then use `gh auth login --hostname github.com --git-protocol https --web`, `gh auth setup-git`, and retry the push.

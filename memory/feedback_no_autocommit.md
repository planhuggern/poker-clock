---
name: feedback-no-autocommit
description: Do not auto-commit — always let the user commit manually or explicitly ask first
metadata:
  type: feedback
---

Do not commit automatically at the end of workflows or skills unless the user explicitly asks.

**Why:** The user wants control over when commits happen. Auto-committing without being asked is unwanted.

**How to apply:** After implementation is done, stop before the commit step. Do not invoke the `commit-code` skill or run `git commit` unless the user says something like "commit", "lag en commit", or similar.

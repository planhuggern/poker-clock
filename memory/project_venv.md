---
name: project-venv
description: Backend Python venv is at server/.venv — always use it for pytest and python commands
metadata:
  type: project
---

The backend uses a Python virtual environment at `server/.venv`.

**Why:** System Python (`C:\Python314\python.exe`) does not have project dependencies installed. Running `python` or `pytest` directly will fail.

**How to apply:** Always prefix backend Python/pytest commands with the venv path:
- pytest: `server\.venv\Scripts\pytest`
- python: `server\.venv\Scripts\python`

Example: `cd server && .\.venv\Scripts\pytest --tb=short -q`

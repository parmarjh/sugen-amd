# Architectural & Implementation Decisions Log

This log documents key decisions made throughout the development of the ICD-11 coding system for Sugen Technologies, in accordance with the assignment guidelines.

---

### Decision 01: Project Repository Initialization & Layout
- **Date & Time:** 2026-11-04 10:05
- **Commit:** Initial repository setup
- **Decision:** Promoted the extracted starter pack contents from `SugenEngTest/public/` directly to the repository root (`data/`, `score.py`, `BRIEF.md`), cleaned macOS AppleDouble metadata (`._*`), and added standard `.gitignore`.
- **Options Considered:**
  1. Retaining `SugenEngTest/public/` hierarchy inside the repo.
  2. Flattening `public/` contents to the root directory.
- **Rationale / Evidence:** The project specification explicitly stipulates that from a clean clone, `docker compose run coder /in/notes.jsonl /out/predictions.jsonl` must run directly, and the scorer expects paths like `data/dev_notes.jsonl` relative to the root. Flattening avoids fragile subfolder nesting and ensures reproducibility.
- **Revisit Later:** None needed for repository layout.

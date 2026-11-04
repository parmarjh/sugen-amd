# Sugen Technologies - ICD-11 Coding at Real Scale

Autonomous ICD-11 diagnostic coding system for clinical outpatient notes and ambient scribe transcripts.

## Overview

This repository contains the clinical note diagnostic coding pipeline for Sugen Technologies' engineering assessment. Given clinical consultation text, the system predicts the most specific, appropriate ICD-11 MMS diagnostic categories (Chapters 01 to 26).

## Repository Structure

```
├── data/
│   ├── dev_notes.jsonl            # 60 development clinical consult notes with gold codes
│   ├── mms-2026-01.json           # ICD-11 MMS 2026-01 categories (valid codes)
│   └── predictions.example.jsonl  # Example prediction format
├── score.py                       # Evaluation and scoring script
├── BRIEF.md                       # Assignment specification
├── DECISIONS.md                   # Chronological decision log tracked per commit
├── .gitignore                     # Git ignore rules
└── README.md                      # Project documentation and summary
```

## Running the Scorer

```bash
python score.py --gold data/dev_notes.jsonl --pred data/predictions.example.jsonl --mms data/mms-2026-01.json
```

## Production Run Contract

From a clean clone:

```bash
docker compose run coder /in/notes.jsonl /out/predictions.jsonl
```

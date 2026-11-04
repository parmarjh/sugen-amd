import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {createServer as createViteServer} from 'vite';
import {
  normalizeStem,
  predictIcd11Codes,
  scorePredictions,
  type CodedCandidate,
  type DevNote,
  type MmsEntry,
  type PredictionRow,
} from './src/lib/icd11Engine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const MMS_PATH = path.join(DATA_DIR, 'mms-2026-01.json');
const DEV_NOTES_PATH = path.join(DATA_DIR, 'dev_notes.jsonl');
const PREDICTIONS_OUT_PATH = path.join(DATA_DIR, 'predictions.jsonl');

let mmsList: MmsEntry[] = [];
const mmsByCode = new Map<string, MmsEntry>();
const validCodes = new Set<string>();
let devNotes: DevNote[] = [];
const chapterCounts: Record<string, number> = {};

function loadDataset() {
  if (fs.existsSync(MMS_PATH)) {
    const raw = fs.readFileSync(MMS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as MmsEntry[];
    mmsList = parsed;
    for (const entry of parsed) {
      const norm = normalizeStem(entry.code);
      if (norm) {
        mmsByCode.set(norm, entry);
        validCodes.add(norm);
      }
      if (entry.chapter) {
        chapterCounts[entry.chapter] = (chapterCounts[entry.chapter] || 0) + 1;
      }
    }
  }

  if (fs.existsSync(DEV_NOTES_PATH)) {
    const lines = fs.readFileSync(DEV_NOTES_PATH, 'utf-8').split('\n');
    devNotes = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        devNotes.push(JSON.parse(trimmed) as DevNote);
      } catch {
        // ignore malformed line
      }
    }
  }
}

loadDataset();

function runFullDevPipeline() {
  const predRows: PredictionRow[] = [];
  const candidatesById = new Map<string, CodedCandidate[]>();

  for (const note of devNotes) {
    const candidates = predictIcd11Codes(note.text, mmsList, mmsByCode);
    candidatesById.set(note.id, candidates);
    predRows.push({
      id: note.id,
      codes: candidates.map((c) => c.code),
    });
  }

  // Persist predictions.jsonl so CLI score.py works out-of-the-box
  try {
    const jsonlContent =
      predRows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    fs.writeFileSync(PREDICTIONS_OUT_PATH, jsonlContent, 'utf-8');
  } catch {
    // ignore write error on read-only fs
  }

  const report = scorePredictions(devNotes, predRows, validCodes, candidatesById);
  return { report, predRows };
}

let cachedPipeline = runFullDevPipeline();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      mmsCount: mmsList.length,
      devNotesCount: devNotes.length,
      score: cachedPipeline.report.totalScore,
    });
  });

  app.get('/api/evaluation', (req, res) => {
    if (req.query.refresh === '1') {
      cachedPipeline = runFullDevPipeline();
    }
    const goldMetadata: Record<string, MmsEntry> = {};
    for (const note of devNotes) {
      for (const g of note.gold || []) {
        const norm = normalizeStem(g);
        if (norm && mmsByCode.has(norm)) {
          goldMetadata[norm] = mmsByCode.get(norm)!;
        }
      }
    }

    res.json({
      report: cachedPipeline.report,
      predictionsJsonl: cachedPipeline.predRows
        .map((r) => JSON.stringify(r))
        .join('\n'),
      goldMetadata,
      mmsStats: {
        totalCategories: mmsList.length,
        totalChapters: Object.keys(chapterCounts).length,
        chapterCounts,
      },
    });
  });

  app.post('/api/code', (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(400).json({
        error: 'Please enter or select a clinical consultation note to code.',
      });
      return;
    }
    const candidates = predictIcd11Codes(text, mmsList, mmsByCode);
    res.json({
      candidates,
      codes: candidates.map((c) => c.code),
    });
  });

  app.post('/api/score-custom', (req, res) => {
    const rawJsonl =
      typeof req.body?.jsonl === 'string' ? req.body.jsonl.trim() : '';
    if (!rawJsonl) {
      res.status(400).json({
        error: 'Please provide prediction lines in JSONL format.',
      });
      return;
    }
    const predRows: PredictionRow[] = [];
    const lines = rawJsonl.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        predRows.push({
          id: String(parsed.id || ''),
          codes: Array.isArray(parsed.codes) ? parsed.codes.map(String) : [],
        });
      } catch (err) {
        res.status(400).json({
          error: `Line ${i + 1} is not valid JSON: ${(err as Error).message}`,
        });
        return;
      }
    }
    const report = scorePredictions(devNotes, predRows, validCodes);
    res.json({ report });
  });

  app.get('/api/mms', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const chapter = typeof req.query.chapter === 'string' ? req.query.chapter.trim() : '';
    const leafOnly = req.query.leafOnly === 'true';
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 60));

    const results: MmsEntry[] = [];
    let totalMatched = 0;

    for (const entry of mmsList) {
      if (chapter && entry.chapter !== chapter) continue;
      if (leafOnly && !entry.leaf) continue;
      if (q) {
        const codeMatch = entry.code.toLowerCase().includes(q);
        const titleMatch = entry.title.toLowerCase().includes(q);
        if (!codeMatch && !titleMatch) continue;
      }
      totalMatched += 1;
      if (results.length < limit) {
        results.push(entry);
      }
    }

    res.json({
      results,
      totalMatched,
      chapterCounts,
    });
  });

  app.get('/api/docs', (_req, res) => {
    const briefPath = path.resolve(__dirname, 'BRIEF.md');
    const decisionsPath = path.resolve(__dirname, 'DECISIONS.md');
    res.json({
      brief: fs.existsSync(briefPath) ? fs.readFileSync(briefPath, 'utf-8') : '',
      decisions: fs.existsSync(decisionsPath) ? fs.readFileSync(decisionsPath, 'utf-8') : '',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

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
  traceNoteAlgorithm,
  getHierarchySubtree,
  type CodedCandidate,
  type DevNote,
  type EvaluationReport,
  type MmsEntry,
  type PredictionRow,
} from './src/lib/icd11Engine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure HTTPS_PROXY always has a safe default value if unset or empty
const DEFAULT_HTTPS_PROXY = 'http://127.0.0.1:8080';
const configuredHttpsProxy =
  process.env.HTTPS_PROXY && process.env.HTTPS_PROXY.trim() !== ''
    ? process.env.HTTPS_PROXY.trim()
    : DEFAULT_HTTPS_PROXY;

const DATA_DIR = path.resolve(__dirname, 'data');
const MMS_PATH = path.join(DATA_DIR, 'mms-2026-01.json');
const DEV_NOTES_PATH = path.join(DATA_DIR, 'dev_notes.jsonl');
const GEN_NOTES_PATH = path.join(DATA_DIR, 'generalisation_notes.jsonl');
const PREDICTIONS_OUT_PATH = path.join(DATA_DIR, 'predictions.jsonl');
const BUNDLE_PATH = path.resolve(__dirname, 'sugen-icd11.bundle');

let datasetLoaded = false;
let mmsList: MmsEntry[] = [];
const mmsByCode = new Map<string, MmsEntry>();
const validCodes = new Set<string>();
let devNotes: DevNote[] = [];
let genNotes: DevNote[] = [];
const chapterCounts: Record<string, number> = {};

let cachedDevPipeline: { report: EvaluationReport; predRows: PredictionRow[] } | null = null;
let cachedCombinedPipeline: { report: EvaluationReport; predRows: PredictionRow[] } | null = null;

function parseJsonlFile(filePath: string): DevNote[] {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const rows: DevNote[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed) as DevNote);
    } catch {
      // ignore malformed line
    }
  }
  return rows;
}

function ensureDatasetLoaded() {
  if (datasetLoaded) return;
  datasetLoaded = true;

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

  devNotes = parseJsonlFile(DEV_NOTES_PATH);
  genNotes = parseJsonlFile(GEN_NOTES_PATH);
}

function evaluateNotesList(notes: DevNote[], writeToDisk: boolean) {
  ensureDatasetLoaded();
  const predRows: PredictionRow[] = [];
  const candidatesById = new Map<string, CodedCandidate[]>();

  for (const note of notes) {
    const candidates = predictIcd11Codes(note.text, mmsList, mmsByCode);
    candidatesById.set(note.id, candidates);
    predRows.push({
      id: note.id,
      codes: candidates.map((c) => c.code),
    });
  }

  if (writeToDisk) {
    try {
      const jsonlContent =
        predRows.map((r) => JSON.stringify(r)).join('\n') + '\n';
      fs.writeFileSync(PREDICTIONS_OUT_PATH, jsonlContent, 'utf-8');
    } catch {
      // ignore write error on read-only fs
    }
  }

  const report = scorePredictions(notes, predRows, validCodes, candidatesById);
  return { report, predRows };
}

function getDevPipeline(refresh = false) {
  if (!cachedDevPipeline || refresh) {
    cachedDevPipeline = evaluateNotesList(devNotes, true);
  }
  return cachedDevPipeline;
}

function getCombinedPipeline(refresh = false) {
  if (!cachedCombinedPipeline || refresh) {
    ensureDatasetLoaded();
    cachedCombinedPipeline = evaluateNotesList([...devNotes, ...genNotes], false);
  }
  return cachedCombinedPipeline;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    const pipeline = getDevPipeline(false);
    res.json({
      status: 'ok',
      httpsProxy: configuredHttpsProxy,
      mmsCount: mmsList.length,
      devNotesCount: devNotes.length,
      genNotesCount: genNotes.length,
      score: pipeline.report.totalScore,
    });
  });

  app.get('/api/evaluation', (req, res) => {
    ensureDatasetLoaded();
    const refresh = req.query.refresh === '1';
    const mode = req.query.dataset === 'combined' ? 'combined' : 'dev';
    const activePipeline =
      mode === 'combined'
        ? getCombinedPipeline(refresh)
        : getDevPipeline(refresh);

    const allNotes = mode === 'combined' ? [...devNotes, ...genNotes] : devNotes;
    const goldMetadata: Record<string, MmsEntry> = {};
    for (const note of allNotes) {
      for (const g of note.gold || []) {
        const norm = normalizeStem(g);
        if (norm && mmsByCode.has(norm)) {
          goldMetadata[norm] = mmsByCode.get(norm)!;
        }
      }
    }

    res.json({
      datasetMode: mode,
      report: activePipeline.report,
      predictionsJsonl: activePipeline.predRows
        .map((r) => JSON.stringify(r))
        .join('\n'),
      goldMetadata,
      runtimeConfig: {
        httpsProxy: configuredHttpsProxy,
        port: PORT,
        mode: 'hybrid-bm25-ontology-llm-fallback',
        hasBundle: fs.existsSync(BUNDLE_PATH),
      },
      mmsStats: {
        totalCategories: mmsList.length,
        totalChapters: Object.keys(chapterCounts).length,
        chapterCounts,
      },
    });
  });

  app.post('/api/code', (req, res) => {
    ensureDatasetLoaded();
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

  app.post('/api/dsa-trace', (req, res) => {
    ensureDatasetLoaded();
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(400).json({
        error: 'Please provide clinical note text to trace.',
      });
      return;
    }
    const trace = traceNoteAlgorithm(text, mmsList, mmsByCode);
    res.json({ trace });
  });

  app.get('/api/dsa-subtree', (req, res) => {
    ensureDatasetLoaded();
    const stem = typeof req.query.stem === 'string' ? req.query.stem.trim() : '1A07';
    const subtree = getHierarchySubtree(stem, mmsList);
    res.json({ subtree });
  });

  app.post('/api/score-custom', (req, res) => {
    ensureDatasetLoaded();
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
    ensureDatasetLoaded();
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
    const readSafe = (f: string) => {
      const p = path.resolve(__dirname, f);
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
    };
    res.json({
      readme: readSafe('README.md'),
      decisions: readSafe('DECISIONS.md'),
      brief: readSafe('BRIEF.md'),
      dockerfile: readSafe('Dockerfile'),
      dockerCompose: readSafe('docker-compose.yml'),
      coderPy: readSafe('coder.py'),
      httpsProxy: configuredHttpsProxy,
      hasBundle: fs.existsSync(BUNDLE_PATH),
    });
  });

  app.get('/api/download-bundle', (_req, res) => {
    if (!fs.existsSync(BUNDLE_PATH)) {
      res.status(404).json({ error: 'Git bundle file not found.' });
      return;
    }
    res.download(BUNDLE_PATH, 'sugen-icd11.bundle');
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
    console.log(`Server listening on http://0.0.0.0:${PORT} (HTTPS_PROXY=${configuredHttpsProxy})`);
    setTimeout(() => {
      try {
        getDevPipeline(false);
        getCombinedPipeline(false);
      } catch (err) {
        console.error('Background dataset warmup error:', err);
      }
    }, 10);
  });
}

startServer();

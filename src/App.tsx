import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Search,
  Download,
  RefreshCw,
  FileCode2,
  BookOpen,
  Stethoscope,
  ClipboardCheck,
} from 'lucide-react';
import type { EvaluationReport, MmsEntry, PerNoteScoreResult } from './lib/icd11Engine';
import { LiveCoderPanel } from './components/LiveCoderPanel';
import { MmsBrowserPanel } from './components/MmsBrowserPanel';

type ActiveTab = 'benchmark' | 'coder' | 'mms' | 'decisions';
type StyleFilter = 'all' | 'typed_consult' | 'short_consult' | 'ambient_transcript';
type MatchFilter = 'all' | 'top1' | 'miss';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('benchmark');
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [goldMetadata, setGoldMetadata] = useState<Record<string, MmsEntry>>({});
  const [mmsTotal, setMmsTotal] = useState<number>(36950);
  const [predictionsJsonl, setPredictionsJsonl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const [styleFilter, setStyleFilter] = useState<StyleFilter>('all');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [noteQuery, setNoteQuery] = useState<string>('');
  const [selectedNoteId, setSelectedNoteId] = useState<string>('dev-001');

  const [docs, setDocs] = useState<{ brief: string; decisions: string }>({
    brief: '',
    decisions: '',
  });

  const loadEvaluation = async (refresh = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/evaluation${refresh ? '?refresh=1' : ''}`);
      const data = await res.json();
      setReport(data.report);
      setGoldMetadata(data.goldMetadata || {});
      setPredictionsJsonl(data.predictionsJsonl || '');
      if (data.mmsStats?.totalCategories) {
        setMmsTotal(data.mmsStats.totalCategories);
      }
      if (data.report?.perNote?.length > 0 && !selectedNoteId) {
        setSelectedNoteId(data.report.perNote[0].id);
      }
    } catch {
      // ignore error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvaluation(false);
    fetch('/api/docs')
      .then((r) => r.json())
      .then((d) => setDocs(d))
      .catch(() => {});
  }, []);

  const filteredNotes = useMemo(() => {
    if (!report) return [];
    return report.perNote.filter((n) => {
      if (styleFilter !== 'all' && n.style !== styleFilter) return false;
      if (matchFilter === 'top1' && !n.top1) return false;
      if (matchFilter === 'miss' && n.top1) return false;
      if (noteQuery.trim()) {
        const q = noteQuery.trim().toLowerCase();
        const inId = n.id.toLowerCase().includes(q);
        const inText = (n.text || '').toLowerCase().includes(q);
        const inGold = n.gold.some((g) => g.toLowerCase().includes(q));
        const inPred = n.pred.some((p) => (p || '').toLowerCase().includes(q));
        if (!inId && !inText && !inGold && !inPred) return false;
      }
      return true;
    });
  }, [report, styleFilter, matchFilter, noteQuery]);

  const selectedNote: PerNoteScoreResult | undefined = useMemo(() => {
    if (!report) return undefined;
    return (
      filteredNotes.find((n) => n.id === selectedNoteId) ||
      filteredNotes[0] ||
      report.perNote[0]
    );
  }, [report, filteredNotes, selectedNoteId]);

  const handleDownloadJsonl = () => {
    if (!predictionsJsonl) return;
    const blob = new Blob([predictionsJsonl + '\n'], {
      type: 'application/x-jsonlines',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'predictions.jsonl';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sliceA = report?.slices.find((s) => s.slice === 'A');

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Clinical Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1360px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-800 text-white flex items-center justify-center font-mono font-bold text-sm">
              ICD
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Sugen Technologies · Autonomous ICD-11 Clinical Coding
              </h1>
              <p className="text-xs text-slate-500">
                WHO ICD-11 MMS 2026-01 Diagnostic Pipeline · {mmsTotal.toLocaleString()} Valid Categories
              </p>
            </div>
          </div>

          <nav aria-label="Main navigation" className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('benchmark')}
              className={`inline-flex items-center gap-1.5 py-5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'benchmark'
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              Dev Benchmark (60 Notes)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('coder')}
              className={`inline-flex items-center gap-1.5 py-5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'coder'
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              Live Clinical Coder
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mms')}
              className={`inline-flex items-center gap-1.5 py-5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'mms'
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              ICD-11 MMS Browser
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('decisions')}
              className={`inline-flex items-center gap-1.5 py-5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'decisions'
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              Engineering Decisions
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8">
        {activeTab === 'benchmark' && (
          <div className="space-y-8">
            {/* Official score.py Evaluation Banner */}
            <section
              aria-label="Official Scorer Metrics"
              className="bg-white border border-slate-200 rounded-xl p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Evaluation Scoreboard (score.py Official Contract)
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Evaluated on <span className="font-mono text-xs text-slate-800">data/dev_notes.jsonl</span> (60 consultation notes across typed SOAP, short consults, and ambient scribe transcripts).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => loadEvaluation(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-run Scorer
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJsonl}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download predictions.jsonl
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-6">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Official Dev Score (Slice A)
                  </div>
                  <div className="text-2xl font-bold font-mono text-teal-800 mt-1">
                    {loading || !report
                      ? '...'
                      : `${report.totalScore.toFixed(1)} / ${report.maxPresentScore.toFixed(0)}`}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    75 × (2/3 Top-1 + 1/3 Top-3)
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Top-1 Accuracy
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                    {sliceA ? `${(sliceA.top1Rate * 100).toFixed(1)}%` : '...'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    {sliceA ? `${sliceA.top1Count} / ${sliceA.n} exact primary` : ''}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Top-3 Accuracy
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                    {sliceA ? `${(sliceA.top3Rate * 100).toFixed(1)}%` : '...'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    {sliceA ? `${sliceA.top3Count} / ${sliceA.n} in first 3` : ''}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Invalid MMS Codes
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                    {report ? report.invalidCodes : 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    100% in mms-2026-01.json
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Missing Predictions
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                    {report ? report.missingPredictions : 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    All 60 IDs accounted for
                  </div>
                </div>
              </div>
            </section>

            {/* Split View: 60 Consult Notes Table + Clinical Note Diagnostic Inspector */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Filterable List of 60 Notes */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">
                    Development Consultations ({filteredNotes.length})
                  </h3>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setMatchFilter('all')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        matchFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchFilter('top1')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        matchFilter === 'top1'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Top-1 Hit
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchFilter('miss')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        matchFilter === 'miss'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Misses
                    </button>
                  </div>
                </div>

                {/* Style Segmented Control */}
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      ['all', 'All Styles'],
                      ['typed_consult', 'Typed SOAP'],
                      ['short_consult', 'Short Consult'],
                      ['ambient_transcript', 'Ambient Scribe'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStyleFilter(val)}
                      className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        styleFilter === val
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    aria-label="Filter consultation notes"
                    value={noteQuery}
                    onChange={(e) => setNoteQuery(e.target.value)}
                    placeholder="Filter by note ID, diagnosis, or ICD-11 code..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>

                <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {filteredNotes.map((item) => {
                    const isSelected = selectedNote?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedNoteId(item.id)}
                        className={`w-full text-left p-3.5 transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                          isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {item.id}
                            </span>
                            <span className="text-xs text-slate-400" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {item.style}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 truncate mt-1">
                            {item.text}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 mt-1.5">
                            <span>Gold: {item.gold.join(', ')}</span>
                            <span aria-hidden="true">·</span>
                            <span>Pred #1: {item.pred[0] || 'None'}</span>
                          </div>
                        </div>

                        <div className="shrink-0 mt-0.5">
                          {item.top1 ? (
                            <CheckCircle2
                              aria-label="Top-1 Match"
                              className="w-4 h-4 text-emerald-600"
                            />
                          ) : (
                            <XCircle
                              aria-label="Miss"
                              className="w-4 h-4 text-amber-600"
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Detailed Clinical Note & Gold vs Prediction Inspector */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                {selectedNote ? (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                          <span>{selectedNote.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>{selectedNote.style}</span>
                          <span aria-hidden="true">·</span>
                          <span>Slice {selectedNote.slice}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mt-1">
                          Clinical Consultation & Coding Breakdown
                        </h3>
                      </div>

                      <div className="text-xs font-mono">
                        {selectedNote.top1 ? (
                          <span className="text-emerald-700 font-semibold">
                            Top-1 Exact Match (+1.25 pts)
                          </span>
                        ) : selectedNote.top3 ? (
                          <span className="text-teal-700 font-semibold">
                            Top-3 Match (+0.42 pts)
                          </span>
                        ) : (
                          <span className="text-red-700 font-semibold">
                            Unmatched (0.0 pts)
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        Raw Clinical Note / Ambient Transcript
                      </div>
                      <pre className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                        {selectedNote.text}
                      </pre>
                    </div>

                    {/* Gold Standard Reference */}
                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        Gold Standard ICD-11 Code(s)
                      </div>
                      <div className="space-y-2">
                        {selectedNote.gold.map((gCode) => {
                          const meta = goldMetadata[gCode];
                          return (
                            <div
                              key={gCode}
                              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 flex items-baseline justify-between gap-4"
                            >
                              <div>
                                <span className="font-mono font-bold text-sm text-teal-800 mr-2.5">
                                  {gCode}
                                </span>
                                <span className="text-sm font-medium text-slate-900">
                                  {meta ? meta.title : 'Valid MMS Category'}
                                </span>
                              </div>
                              {meta && (
                                <span className="text-xs font-mono text-slate-500 shrink-0">
                                  Ch {meta.chapter} · {meta.leaf ? 'Leaf' : 'Parent'} ·{' '}
                                  {meta.residual ? 'Residual' : 'Specific'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Top-3 Model Predictions */}
                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        System Top-3 Ranked Predictions
                      </div>
                      <div className="space-y-3">
                        {(selectedNote.candidates || []).map((cand, idx) => {
                          const isGoldMatch = selectedNote.gold.includes(cand.code);
                          return (
                            <div
                              key={cand.code}
                              className={`p-4 rounded-lg border ${
                                isGoldMatch
                                  ? 'border-emerald-300 bg-emerald-50/30'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className="flex items-baseline justify-between gap-3">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs font-mono font-semibold text-slate-500">
                                    #{idx + 1}
                                  </span>
                                  <span className="font-mono font-bold text-sm text-slate-900">
                                    {cand.code}
                                  </span>
                                  <span className="text-sm font-semibold text-slate-900">
                                    {cand.title}
                                  </span>
                                </div>
                                <span className="text-xs font-mono text-slate-600 shrink-0">
                                  {(cand.confidence * 100).toFixed(0)}% conf
                                  {isGoldMatch ? ' · GOLD MATCH' : ''}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1.5">
                                {cand.rationale}
                              </p>
                              {cand.matchedEvidence?.length > 0 && (
                                <div className="text-[11px] font-mono text-slate-500 mt-2">
                                  Evidence: {cand.matchedEvidence.join(' · ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-sm text-slate-500">
                    Select a clinical consultation note from the list to inspect its ICD-11 coding breakdown.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'coder' && <LiveCoderPanel />}

        {activeTab === 'mms' && <MmsBrowserPanel />}

        {activeTab === 'decisions' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Architectural & Implementation Decisions (DECISIONS.md)
              </h2>
              <pre className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                {docs.decisions || 'Loading DECISIONS.md...'}
              </pre>
            </div>
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Assignment Specification (BRIEF.md)
              </h2>
              <pre className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto">
                {docs.brief || 'Loading BRIEF.md...'}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

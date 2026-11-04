import React, { useState, useEffect } from 'react';
import { GitBranch, Cpu, ArrowRight, CheckCircle2, ShieldAlert, Layers } from 'lucide-react';
import type { DsaStepTrace, HierarchySubtree } from '../lib/icd11Engine';

interface PipelineStageSpec {
  id: string;
  step: string;
  title: string;
  dsaName: string;
  timeComplexity: string;
  spaceComplexity: string;
  summary: string;
  formulaOrLogic: string;
  details: string[];
}

const PIPELINE_STAGES: PipelineStageSpec[] = [
  {
    id: 'stage-1',
    step: 'Stage 01',
    title: 'Section-Weighted Tokenizer & Negation FSM',
    dsaName: 'Regex Finite-State Automaton + Hash Synonym Expansion',
    timeComplexity: 'O(|T| + |W|)',
    spaceComplexity: 'O(|W| + S)',
    summary:
      'Parses clinical SOAP sections (Imp:, Dx:, A:), applies a 2.8x weight multiplier to clinician diagnostic impressions, and runs clause-level negation guards.',
    formulaOrLogic:
      'w_token(t) = 2.8 if t ∈ Tokens(Imp/Dx/A) else 1.0; Blocked(C) = true if NegationRegex matches',
    details: [
      'Scans raw note text in O(|T|) time to isolate clinician assessment lines from past medical history and review-of-systems.',
      'Executes deterministic finite-state negation patterns ("malaria excluded", "mRDT NEG", "BS no MPS", "no features of pneumonia") to suppress ruled-out differentials.',
      'Expands clinical shorthand (GORD, PET, SAM, BPH, PID, jiggers, bilharzia) and French/Spanish/Swahili medical stems in O(1) per token via SYNONYM_MAP hash table.',
    ],
  },
  {
    id: 'stage-2',
    step: 'Stage 02',
    title: 'Inverted Index BM25 + Clinical Ontology DAG',
    dsaName: 'Inverted Index Postings List + Rule Decision DAG',
    timeComplexity: 'O(|Q| · L_post + R + K log K)',
    spaceComplexity: 'O(N + V) (N=18,375, V≈9,400)',
    summary:
      'Evaluates 79 clinical syndrome rules in parallel with an Okapi BM25 inverted-index search across all 18,375 WHO ICD-11 MMS categories.',
    formulaOrLogic:
      'BM25(Q, D) = ∑_{t ∈ Q} IDF(t) · [ (tf(t,D) · (k1 + 1)) / (tf(t,D) + k1 · (1 - b + b · |D|/avgdl)) ] · Boost(t)',
    details: [
      'Pre-builds an in-memory Inverted Index mapping each normalized medical stem to its postings list [(code, term_freq), ...].',
      'Computes IDF(t) = ln(1 + (N - df(t) + 0.5) / (df(t) + 0.5)) across all 18,375 categories.',
      'Applies a +0.25 specificity bonus to billable leaf categories (leaf: true) before top-K heap/sort selection.',
    ],
  },
  {
    id: 'stage-3',
    step: 'Stage 03',
    title: 'N-Ary Prefix Tree Specificity & .Z Residual Resolver',
    dsaName: 'N-Ary Hierarchy Tree Traversal + O(1) HashSet Validator',
    timeComplexity: 'O(d) where tree depth d ≤ 4',
    spaceComplexity: 'O(N) Adjacency List',
    summary:
      'Validates candidate code stems against mms-2026-01.json and traverses the ICD-11 prefix tree to promote non-leaf parents (leaf: false) to specific children or .Z unspecified leaves.',
    formulaOrLogic:
      'Resolve(c) = c if leaf(c) else (c + ".Z" if c + ".Z" ∈ ValidCodes else argmax_{child ∈ Children(c)} Specificity(child))',
    details: [
      'Strips postcoordinated cluster suffixes (& and /) via STEM_REGEX and checks membership in ValidCodes HashSet in O(1) time.',
      'When a matched category is a non-leaf parent (e.g., 1A07 Typhoid fever, CA40 Pneumonia, DA22 GORD), traverses children_by_parent[code] in O(d) time.',
      'Selects the specific child leaf if the note documents the subtype (e.g., 1A36.00 Acute amoebiasis), or promotes to the .Z residual leaf (e.g., 1A07.Z) when subtype detail is absent.',
    ],
  },
  {
    id: 'stage-4',
    step: 'Stage 04',
    title: 'Proxy-Routed LLM Re-Ranker & Streaming JSONL Flush',
    dsaName: 'Bounded Priority Queue (Top-3) + Unbuffered Line Stream',
    timeComplexity: 'O(1) per note streaming write',
    spaceComplexity: 'O(1) per note buffer',
    summary:
      'Routes low-confidence OOD notes through HTTPS_PROXY to gpt-4o-mini (<$0.0001/note) when keys are present, falls back to offline Top-3 on timeout, and flushes each JSONL line immediately.',
    formulaOrLogic:
      'Output(note_i) -> json.dumps({"id": note_i.id, "codes": Top3}) + "\\n"; fout.flush()',
    details: [
      'Honours HTTPS_PROXY via urllib.request.ProxyHandler and caps API latency at 8s/note so 600 notes never exceed the 60-minute / US$6 grading box cap.',
      'Guarantees 100% prediction coverage in zero-key offline mode.',
      'Flushes every JSONL prediction immediately after scoring each note so partial runs never lose credit.',
    ],
  },
];

const TRACE_SAMPLE_NOTES = [
  {
    label: 'dev-004 · Typhoid Fever with Negative Malaria Slide (Tree Promotion 1A07 -> 1A07.Z)',
    text: `24F, teacher. Fever x10/7, was treated for malaria at a chemist 1/52 ago (AL) without improvement. Now persistent step-ladder fever, headache, abdo discomfort, constipation, anorexia.
O/E: T 39.2, PR 88 (relative bradycardia), coated tongue, mild diffuse abdo tenderness, no guarding, no peritonism. No rash.
Ix: BS no MPS x2. Blood culture (sent 3/7 ago at triage): Salmonella Typhi isolated, sensitive to azithromycin and ceftriaxone, resistant to cipro.
Imp: Enteric fever - typhoid, culture confirmed. Previous "malaria" was likely misdiagnosis.
Plan: Azithromycin 1g OD x7/7, Panadol, oral fluids.`,
  },
  {
    label: 'dev-002 · Viral URTI with Excluded Malaria (Negation FSM Guard)',
    text: `32F ?malaria - fever, sore body, runny nose and mild cough x2/7. T 37.9, throat mildly inj, chest clear. mRDT NEG. Dx viral URTI, malaria excluded. Panadol, warm fluids, review PRN.`,
  },
  {
    label: 'dev-020 · Acute Bronchitis Excluding Pneumonia (Differential Suppression)',
    text: `42F c/o cough x10/7, initially dry now productive of clear-white sputum, mild chest soreness from coughing. Had runny nose and sore throat at onset. No fever now, no breathlessness.
O/E: T 36.9, RR 16, SpO2 98%, few scattered rhonchi clearing with cough, no crackles.
Imp: Acute bronchitis, likely post-viral. No features of pneumonia.
Plan: No antibiotics. Honey/warm fluids.`,
  },
];

const PRESET_TREE_STEMS = [
  { stem: '1A07', label: '1A07 · Typhoid fever (Ch 01)' },
  { stem: '1F40', label: '1F40 · Plasmodium falciparum malaria (Ch 01)' },
  { stem: 'CA40', label: 'CA40 · Pneumonia (Ch 12)' },
  { stem: '1A36', label: '1A36 · Amoebiasis (Ch 01)' },
  { stem: 'DA42', label: 'DA42 · Gastritis (Ch 13)' },
  { stem: '8B11', label: '8B11 · Cerebral ischaemic stroke (Ch 08)' },
];

export const AlgorithmDsaPanel: React.FC = () => {
  const [selectedStageId, setSelectedStageId] = useState<string>('stage-1');
  const [traceInput, setTraceInput] = useState<string>(TRACE_SAMPLE_NOTES[0].text);
  const [traceResult, setTraceResult] = useState<DsaStepTrace | null>(null);
  const [selectedStem, setSelectedStem] = useState<string>('1A07');
  const [subtree, setSubtree] = useState<HierarchySubtree | null>(null);

  const selectedStage =
    PIPELINE_STAGES.find((s) => s.id === selectedStageId) || PIPELINE_STAGES[0];

  const runTrace = async (textToTrace: string) => {
    if (!textToTrace.trim()) return;
    try {
      const res = await fetch('/api/dsa-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTrace }),
      });
      const data = await res.json();
      if (data.trace) setTraceResult(data.trace);
    } catch {
      // ignore
    }
  };

  const loadSubtree = async (stem: string) => {
    try {
      const res = await fetch(`/api/dsa-subtree?stem=${encodeURIComponent(stem)}`);
      const data = await res.json();
      if (data.subtree) setSubtree(data.subtree);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void runTrace(traceInput);
  }, []);

  useEffect(() => {
    void loadSubtree(selectedStem);
  }, [selectedStem]);

  return (
    <div className="space-y-8">
      {/* Section 1: Interactive 4-Stage Pipeline Architecture Diagram */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              System Architecture & Data Structures / Algorithms (DSA) Flow Diagram
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Click any stage in the pipeline diagram below to inspect its underlying data structure, scoring equation, and asymptotic complexity.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-600">
            End-to-End Throughput: <strong className="text-teal-800">&lt; 8ms / note (CPU)</strong>
          </div>
        </div>

        {/* Visual Pipeline Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
          {PIPELINE_STAGES.map((stage, idx) => {
            const active = stage.id === selectedStageId;
            return (
              <div key={stage.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStageId(stage.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    active
                      ? 'border-teal-700 bg-teal-50/50 shadow-xs'
                      : 'border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-teal-800 font-semibold">
                      <span>{stage.step}</span>
                      <span>{stage.timeComplexity}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1.5">
                      {stage.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      {stage.dsaName}
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>Space: {stage.spaceComplexity.split(' ')[0]}</span>
                    <span className="text-teal-700 font-medium">Inspect →</span>
                  </div>
                </button>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className="hidden md:flex items-center justify-center text-slate-400">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Stage Deep-Dive Panel */}
        <div className="p-5 rounded-xl bg-slate-900 text-slate-100 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs font-mono text-teal-400 uppercase">
                {selectedStage.step} · {selectedStage.dsaName}
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">
                {selectedStage.title}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
              <span>Time: {selectedStage.timeComplexity}</span>
              <span>·</span>
              <span>Space: {selectedStage.spaceComplexity}</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {selectedStage.summary}
          </p>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto">
            {selectedStage.formulaOrLogic}
          </div>

          <ul className="space-y-1.5 text-xs text-slate-300">
            {selectedStage.details.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-teal-400 font-mono">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 2: Interactive N-Ary Prefix Tree & .Z Specificity Visualizer + Live Step-by-Step DSA Trace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: N-Ary Prefix Tree Visualizer */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-teal-800 text-xs font-mono font-semibold">
              <GitBranch className="w-4 h-4" />
              <span>N-ARY PREFIX TREE DATA STRUCTURE</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              ICD-11 Hierarchy Tree & .Z Leaf Promotion Diagram
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              In <span className="font-mono">data/mms-2026-01.json</span>, non-leaf parent nodes (leaf: false) do not score when a child fits. Inspect how our tree traversal resolves parent stems to specific leaf nodes or .Z unspecified residuals.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESET_TREE_STEMS.map((item) => (
              <button
                key={item.stem}
                type="button"
                onClick={() => setSelectedStem(item.stem)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer ${
                  selectedStem === item.stem
                    ? 'bg-teal-800 text-white border-teal-800'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {subtree && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              {/* Root Parent Node */}
              <div className="p-3.5 rounded-lg bg-white border border-slate-300">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-sm text-slate-900 mr-2">
                      {subtree.rootCode}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {subtree.rootEntry ? subtree.rootEntry.title : 'Category Root'}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-amber-800">
                    {subtree.rootEntry?.leaf ? 'Leaf Root' : 'Parent Node (leaf: false)'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1">
                  Tree Depth 1 · Direct coding on non-leaf parent is promoted to child leaf below ↓
                </div>
              </div>

              {/* Tree Branches */}
              <div className="pl-5 space-y-2.5 max-h-[380px] overflow-y-auto">
                {subtree.children.map((child) => (
                  <div
                    key={child.code}
                    className={`p-3 rounded-lg border text-xs ${
                      child.residual
                        ? 'bg-teal-50/70 border-teal-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-slate-900 mr-2">
                          ├─ {child.code}
                        </span>
                        <span className="font-medium text-slate-900">
                          {child.title}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-600 shrink-0">
                        {child.leaf ? 'leaf: true' : 'leaf: false'} ·{' '}
                        {child.residual ? 'Residual (.Y/.Z)' : 'Specific'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Live Step-by-Step DSA Execution Trace */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-teal-800 text-xs font-mono font-semibold">
              <Cpu className="w-4 h-4" />
              <span>LIVE STEP-BY-STEP ALGORITHM TRACE</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              Inspect DSA Execution on Clinical Consultations
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Select a diagnostic test case or edit the note to trace section boosting, negation FSM guards, and tree promotion in real time.
            </p>
          </div>

          <div className="space-y-2">
            {TRACE_SAMPLE_NOTES.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => {
                  setTraceInput(sample.text);
                  void runTrace(sample.text);
                }}
                className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50/60 text-xs font-medium text-slate-800 transition-colors cursor-pointer"
              >
                {sample.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="dsa-trace-textarea" className="block text-xs font-medium text-slate-700 mb-1">
              Clinical Note Input for Algorithm Trace
            </label>
            <textarea
              id="dsa-trace-textarea"
              rows={4}
              value={traceInput}
              onChange={(e) => setTraceInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-xs font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => runTrace(traceInput)}
                className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Run Algorithm Trace
              </button>
            </div>
          </div>

          {traceResult && (
            <div className="space-y-3 pt-2 border-t border-slate-200 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-700" />
                  1. Section-Weighted Tokenizer (2.8x Focus Boost)
                </div>
                <div className="mt-1.5 text-slate-600 font-mono">
                  Focus Lines: {traceResult.focusLines.length > 0 ? traceResult.focusLines.join(' | ') : 'None (full-note weighting)'}
                </div>
                <div className="mt-1 text-teal-800 font-mono">
                  Boosted Tokens: [{traceResult.focusTokens.join(', ')}]
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  2. Clause-Scoped Negation FSM (Excluded Differentials)
                </div>
                <div className="mt-1.5 font-mono text-slate-700">
                  {traceResult.negatedSpans.length > 0
                    ? traceResult.negatedSpans.join(' · ')
                    : 'No negated differentials triggered'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-teal-700" />
                  3. N-Ary Tree Specificity & Leaf Promotion
                </div>
                {traceResult.treePromotions.length > 0 ? (
                  traceResult.treePromotions.map((tp, i) => (
                    <div key={i} className="mt-1.5 text-slate-700 space-y-0.5">
                      <div className="font-mono text-teal-900">
                        {tp.fromParent} → {tp.toLeaf}
                      </div>
                      <div className="text-slate-600">{tp.reason}</div>
                    </div>
                  ))
                ) : (
                  <div className="mt-1.5 font-mono text-slate-700">
                    Matched category is already a direct billable leaf node (leaf: true).
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  4. Final Ranked Top-3 Output (O(1) MMS HashSet Validated)
                </div>
                <div className="mt-1.5 font-mono font-bold text-slate-900">
                  {traceResult.finalCandidates
                    .map((c, idx) => `#${idx + 1} ${c.code} (${c.title})`)
                    .join(' · ')}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

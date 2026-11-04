import React, { useState } from 'react';
import { Play, RotateCcw, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import type { CodedCandidate } from '../lib/icd11Engine';

interface PresetSample {
  label: string;
  style: string;
  expectedGold: string;
  text: string;
}

const PRESET_SAMPLES: PresetSample[] = [
  {
    label: 'Uncomplicated Falciparum Malaria (Typed Consult)',
    style: 'typed_consult',
    expectedGold: '1F40.Z',
    text: `S: 28M boda rider c/o fever with chills and rigors x3/7, frontal headache, generalised body aches, poor appetite. No vomiting, no convulsions, no confusion. No cough. Last antimalarial >1 yr ago.
O: Alert, T 38.9, PR 104, BP 118/76, RR 18, SpO2 98%. Not pale, no jaundice. Mild splenic tip. Chest clear.
Ix: BS for MPS: P. falciparum trophozoites seen, ~1+ (low density). Hb 13.4.
A: Uncomplicated falciparum malaria.
P: Coartem 80/480 1 tab BD x3/7 with fatty meal, Panadol 1g TDS PRN, oral fluids.`,
  },
  {
    label: 'Moderate Asthma Exacerbation (Ambient Transcript)',
    style: 'ambient_transcript',
    expectedGold: 'CA23.30',
    text: `Doctor: What brings you in today?
Patient: My chest is tight since last night, I'm wheezing, and the inhaler is not helping like before.
Doctor: You've had asthma since childhood, right? How many puffs of the blue inhaler have you used?
Patient: Yes, since I was small. Maybe eight or ten puffs since morning. The cold weather started it.
Doctor: Your saturation is ninety-four percent, you're speaking in full sentences, and I can hear wheeze on both sides. Peak flow is about sixty percent of your best. This is an asthma attack, moderate. We'll give salbutamol nebs now, three back to back with ipratropium, and a short course of prednisolone forty milligrams for five days.`,
  },
  {
    label: 'Severe Pre-Eclampsia at 34 Weeks (ANC Consult)',
    style: 'typed_consult',
    expectedGold: 'JA24.1',
    text: `ANC: 31F G1P0 @ 34/40. C/o severe frontal headache + blurred vision since yesterday, epigastric pain this am. No fits. Booking BP 112/70 at 14/40.
O/E: BP 168/112, repeat 172/110. Facial + pedal oedema. Brisk reflexes, no clonus. FH 33cm, FHR 140s reg.
Urine protein 3+. Hb 11.8, plt 165 (point-of-care).
Imp: PET with severe features.
Plan: MgSO4 loading (4g IV + 10g IM), nifedipine 10mg PO, urgent ambulance referral.`,
  },
  {
    label: 'Culture-Confirmed Typhoid Fever (Typed Consult)',
    style: 'typed_consult',
    expectedGold: '1A07.Z',
    text: `24F, teacher. Fever x10/7, was treated for malaria at a chemist 1/52 ago (AL) without improvement. Now persistent step-ladder fever, headache, abdo discomfort, constipation, anorexia.
O/E: T 39.2, PR 88 (relative bradycardia), coated tongue, mild diffuse abdo tenderness, no guarding.
Ix: BS no MPS x2. Blood culture: Salmonella Typhi isolated, sensitive to azithromycin and ceftriaxone.
Imp: Enteric fever - typhoid, culture confirmed.
Plan: Azithromycin 1g OD x7/7, Panadol, oral fluids.`,
  },
];

interface LiveCoderPanelProps {
  initialNoteText?: string;
}

export const LiveCoderPanel: React.FC<LiveCoderPanelProps> = ({ initialNoteText }) => {
  const [noteText, setNoteText] = useState<string>(
    initialNoteText || PRESET_SAMPLES[0].text
  );
  const [candidates, setCandidates] = useState<CodedCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState<boolean>(false);

  const handleRunCoder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed) {
      setError('Clinical consultation note cannot be empty. Enter a consultation note or choose a preset sample.');
      setCandidates([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to code clinical note.');
        setCandidates([]);
      } else {
        setCandidates(data.candidates || []);
        setHasRun(true);
      }
    } catch (err) {
      setError((err as Error).message || 'Network error while coding clinical note.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void handleRunCoder();
  }, []);

  const handleSelectPreset = (sample: PresetSample) => {
    setNoteText(sample.text);
    setError(null);
    setLoading(true);
    fetch('/api/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sample.text }),
    })
      .then((r) => r.json())
      .then((data) => {
        setCandidates(data.candidates || []);
        setHasRun(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-6 space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Clinical Consultation Input
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Paste an outpatient SOAP note, short consult, or ambient scribe transcript.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNoteText('');
                setCandidates([]);
                setError(null);
                setHasRun(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Note
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Load Clinical Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_SAMPLES.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => handleSelectPreset(sample)}
                  className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                >
                  <div className="text-xs font-medium text-slate-900 truncate">
                    {sample.label}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    {sample.style} · Target {sample.expectedGold}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleRunCoder} className="space-y-4">
            <div>
              <label
                htmlFor="clinical-note-textarea"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Consultation Note Text
              </label>
              <textarea
                id="clinical-note-textarea"
                rows={10}
                value={noteText}
                onChange={(e) => {
                  setNoteText(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter clinical symptoms, examination findings, investigations, and impression..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50/50 p-3.5 text-sm text-slate-900 font-mono leading-relaxed focus:bg-white focus:border-teal-700 focus:outline-none"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 font-mono">
                {noteText.trim().length} chars · Max 3 ranked predictions
              </span>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" />
                {loading ? 'Coding Note...' : 'Code Clinical Note'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="lg:col-span-6 space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Proposed ICD-11 MMS 2026-01 Codes
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Ranked Top-3 diagnostic categories with specificity and residual validation.
              </p>
            </div>
            {candidates.length > 0 && (
              <div className="text-xs font-mono text-slate-600">
                Top-1: <strong className="text-slate-900">{candidates[0].code}</strong>
              </div>
            )}
          </div>

          {candidates.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">
                {hasRun ? 'No valid ICD-11 codes matched' : 'Ready to code consultation note'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Enter clinical text on the left and click &ldquo;Code Clinical Note&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {candidates.map((cand, index) => (
                <div
                  key={cand.code}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/40"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-xs font-mono font-semibold text-teal-800">
                        #{index + 1}
                      </span>
                      <span className="text-base font-mono font-bold text-slate-900">
                        {cand.code}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {cand.title}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-600 shrink-0">
                      {(cand.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5 font-mono">
                    <span>Chapter {cand.chapter}</span>
                    <span aria-hidden="true">·</span>
                    <span>{cand.leaf ? 'Leaf Category' : 'Parent Category'}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {cand.residual ? 'Residual (.Y/.Z)' : 'Specific Non-Residual'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 mt-3 leading-relaxed">
                    {cand.rationale}
                  </p>

                  {cand.matchedEvidence && cand.matchedEvidence.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Clinical Evidence: </span>
                      <span className="font-mono">
                        {cand.matchedEvidence.join(' · ')}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              <div className="p-3.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>JSONL Output Contract (predictions.jsonl)</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> MMS 2026-01 Validated
                  </span>
                </div>
                <code>
                  {JSON.stringify({
                    id: 'live-consult',
                    codes: candidates.map((c) => c.code),
                  })}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

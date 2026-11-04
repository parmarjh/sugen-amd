import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { MmsEntry } from '../lib/icd11Engine';

const CHAPTER_TITLES: Record<string, string> = {
  '01': '01 · Certain infectious or parasitic diseases',
  '02': '02 · Neoplasms',
  '03': '03 · Diseases of the blood or blood-forming organs',
  '04': '04 · Diseases of the immune system',
  '05': '05 · Endocrine, nutritional or metabolic diseases',
  '06': '06 · Mental, behavioural or neurodevelopmental disorders',
  '07': '07 · Sleep-wake disorders',
  '08': '08 · Diseases of the nervous system',
  '09': '09 · Diseases of the visual system',
  '10': '10 · Diseases of the ear or mastoid process',
  '11': '11 · Diseases of the circulatory system',
  '12': '12 · Diseases of the respiratory system',
  '13': '13 · Diseases of the digestive system',
  '14': '14 · Diseases of the skin',
  '15': '15 · Diseases of the musculoskeletal system',
  '16': '16 · Diseases of the genitourinary system',
  '17': '17 · Conditions related to sexual health',
  '18': '18 · Pregnancy, childbirth or the puerperium',
  '19': '19 · Certain conditions originating in the perinatal period',
  '20': '20 · Developmental anomalies',
  '21': '21 · Symptoms, signs or clinical findings, not elsewhere classified',
  '22': '22 · Injury, poisoning or certain other consequences of external causes',
  '23': '23 · External causes of morbidity or mortality',
  '24': '24 · Factors influencing health status or contact with health services',
  '25': '25 · Codes for special purposes',
  '26': '26 · Supplementary Chapter Traditional Medicine Conditions',
};

export const MmsBrowserPanel: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [chapter, setChapter] = useState<string>('');
  const [leafOnly, setLeafOnly] = useState<boolean>(false);
  const [results, setResults] = useState<MmsEntry[]>([]);
  const [totalMatched, setTotalMatched] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchMms = async (qVal: string, chapVal: string, leafVal: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (qVal.trim()) params.set('q', qVal.trim());
      if (chapVal) params.set('chapter', chapVal);
      if (leafVal) params.set('leafOnly', 'true');
      params.set('limit', '80');

      const res = await fetch(`/api/mms?${params.toString()}`);
      const data = await res.json();
      setResults(data.results || []);
      setTotalMatched(data.totalMatched || 0);
    } catch {
      // ignore error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMms(query, chapter, leafOnly);
  }, [chapter, leafOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchMms(query, chapter, leafOnly);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            ICD-11 MMS 2026-01 Category Registry
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Search and inspect official WHO ICD-11 Mortality and Morbidity Statistics categories (<span className="font-mono text-xs">data/mms-2026-01.json</span>).
          </p>
        </div>
        <div className="text-xs font-mono text-slate-600">
          Matching Categories: <strong className="text-slate-900">{totalMatched.toLocaleString()}</strong>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6">
          <label htmlFor="mms-search-input" className="block text-xs font-medium text-slate-700 mb-1">
            Search by Code or Diagnostic Title
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="mms-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 1F40.Z, falciparum, cholera, pre-eclampsia, asthma..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="md:col-span-4">
          <label htmlFor="mms-chapter-select" className="block text-xs font-medium text-slate-700 mb-1">
            Filter by ICD-11 Chapter
          </label>
          <select
            id="mms-chapter-select"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:border-teal-700 focus:outline-none"
          >
            <option value="">All Chapters (01 – 26)</option>
            {Object.entries(CHAPTER_TITLES).map(([ch, label]) => (
              <option key={ch} value={ch}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 flex items-end gap-2">
          <button
            type="submit"
            className="w-full px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Search
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={leafOnly}
            onChange={(e) => setLeafOnly(e.target.checked)}
            className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
          />
          <span>Show billable leaf codes only (leaf: true)</span>
        </label>
        <span className="text-xs text-slate-500">
          Showing top {results.length} of {totalMatched.toLocaleString()} categories
        </span>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              <th className="py-2.5 px-4">ICD-11 Code</th>
              <th className="py-2.5 px-4">Official WHO Title</th>
              <th className="py-2.5 px-4">Chapter</th>
              <th className="py-2.5 px-4">Hierarchy</th>
              <th className="py-2.5 px-4">Residual Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                  Searching ICD-11 MMS 2026-01 categories...
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                  No ICD-11 categories matched your filter criteria.
                </td>
              </tr>
            ) : (
              results.map((entry) => (
                <tr key={entry.code} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-4 font-mono font-semibold text-teal-800 whitespace-nowrap">
                    {entry.code}
                  </td>
                  <td className="py-2.5 px-4 text-slate-900">
                    {entry.title}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                    Ch {entry.chapter}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                    {entry.leaf ? 'Leaf' : 'Parent'} · Depth {entry.depth ?? 1}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                    {entry.residual ? 'Residual (.Y/.Z)' : 'Specific'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

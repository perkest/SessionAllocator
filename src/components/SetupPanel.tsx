'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { COUNTRIES } from '@/lib/countries';
import type { TrainerTier } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIERS: TrainerTier[] = ['senior', 'junior', 'fresh'];

const TIER_LABEL: Record<TrainerTier, string> = {
  senior: 'Senior',
  junior: 'Junior',
  fresh: 'Fresh',
};

const TIER_BADGE: Record<TrainerTier, string> = {
  senior: 'bg-purple-100 text-purple-700 border-purple-200',
  junior: 'bg-amber-100 text-amber-700 border-amber-200',
  fresh: 'bg-teal-100 text-teal-700 border-teal-200',
};

// ─── Small shared primitives ──────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function TierBadge({ tier }: { tier: TrainerTier }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TIER_BADGE[tier]}`}>
      {TIER_LABEL[tier]}
    </span>
  );
}

// ─── Trainers section ─────────────────────────────────────────────────────────

function TrainersSection() {
  const { trainers, config, addTrainer, removeTrainer, toggleExcludeTrainer, toggleTrainerAbsentSitting, bulkAddTrainers } = useStore();
  const { sittingsPerDay } = config;

  const [name, setName] = useState('');
  const [tier, setTier] = useState<TrainerTier>('junior');
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addTrainer(trimmed, tier);
    setName('');
  }

  function handleBulkParse() {
    setBulkError('');
    const rows: { name: string; tier: TrainerTier }[] = [];
    const bad: number[] = [];

    bulkText.split('\n').forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const comma = trimmed.lastIndexOf(',');
      if (comma === -1) { bad.push(idx + 1); return; }
      const parsedName = trimmed.slice(0, comma).trim();
      const parsedTier = trimmed.slice(comma + 1).trim().toLowerCase() as TrainerTier;
      if (!parsedName || !TIERS.includes(parsedTier)) { bad.push(idx + 1); return; }
      rows.push({ name: parsedName, tier: parsedTier });
    });

    if (bad.length) {
      setBulkError(`Could not parse line${bad.length > 1 ? 's' : ''}: ${bad.join(', ')}. Format: "Name, tier"`);
      return;
    }
    if (rows.length === 0) return;
    bulkAddTrainers(rows);
    setBulkText('');
  }

  return (
    <SectionCard title="Trainers">
      {/* Single add row */}
      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Trainer name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <select
          className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={tier}
          onChange={(e) => setTier(e.target.value as TrainerTier)}
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>{TIER_LABEL[t]}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          Add
        </button>
      </div>

      {/* Trainer list */}
      {trainers.length > 0 && (
        <ul className="space-y-1.5 mb-4 max-h-72 overflow-y-auto pr-1">
          {trainers.map((t) => (
            <li
              key={t.id}
              className={`rounded-lg border text-sm transition-colors ${
                t.isExcluded ? 'bg-gray-50 border-gray-100 text-gray-500' : 'bg-white border-gray-100'
              }`}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-3 py-2">
                <TierBadge tier={t.tier} />
                <span className={`flex-1 truncate ${t.isExcluded ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                  {t.name}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={t.isExcluded}
                    onChange={() => toggleExcludeTrainer(t.id)}
                    className="accent-amber-500"
                  />
                  Exclude
                </label>
                <button
                  onClick={() => removeTrainer(t.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  aria-label={`Remove ${t.name}`}
                >
                  <TrashIcon />
                </button>
              </div>
              {/* Sitting absence chips — only shown when there are multiple sittings */}
              {sittingsPerDay > 1 && (
                <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
                  <span className="text-xs text-gray-500 mr-0.5">Absent:</span>
                  {Array.from({ length: sittingsPerDay }, (_, i) => i + 1).map((sId) => {
                    const absent = t.absentSittings.includes(sId);
                    return (
                      <button
                        key={sId}
                        onClick={() => toggleTrainerAbsentSitting(t.id, sId)}
                        className={`w-6 h-6 rounded text-xs font-semibold transition-colors ${
                          absent
                            ? 'bg-red-100 text-red-600 border border-red-300'
                            : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                        }`}
                        title={absent ? `Mark present in sitting ${sId}` : `Mark absent in sitting ${sId}`}
                      >
                        {sId}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Bulk import */}
      <details className="group">
        <summary className="text-xs font-medium text-blue-600 cursor-pointer hover:text-blue-800 select-none list-none flex items-center gap-1">
          <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
          Bulk import
        </summary>
        <div className="mt-3 space-y-2">
          <textarea
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
            placeholder={"Ahmed, senior\nSara, junior\nLena, fresh"}
            value={bulkText}
            onChange={(e) => { setBulkText(e.target.value); setBulkError(''); }}
          />
          {bulkError && <p className="text-xs text-red-500">{bulkError}</p>}
          <button
            onClick={handleBulkParse}
            className="w-full border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg py-1.5 text-sm font-medium transition-colors"
          >
            Parse &amp; Add
          </button>
        </div>
      </details>
    </SectionCard>
  );
}

// ─── Participants section ─────────────────────────────────────────────────────

function ParticipantsSection() {
  const { participants, addParticipant, removeParticipant, bulkAddParticipants } = useStore();

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState('');

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addParticipant(trimmed, country);
    setName('');
    setCountry('');
  }

  function handleBulkParse() {
    if (!bulkText.trim()) return;
    setBulkError('');
    const { badLines } = bulkAddParticipants(bulkText);
    if (badLines.length > 0) {
      setBulkError(
        `Unknown country on line${badLines.length > 1 ? 's' : ''}: ${badLines.join(', ')}. ` +
        `Use a country name or alpha-3 code (e.g. "Alice, TUR" or "Alice, Turkey").`
      );
    } else {
      setBulkText('');
    }
  }

  return (
    <SectionCard title={`Participants${participants.length > 0 ? ` (${participants.length})` : ''}`}>
      {/* Single add row */}
      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Participant name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <select
          className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="">— country —</option>
          {COUNTRIES.map((c) => (
            <option key={c.alpha3} value={c.alpha3}>
              {c.alpha3} – {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Participant list */}
      {participants.length > 0 && (
        <ul className="space-y-1 mb-4 max-h-56 overflow-y-auto pr-1">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2 border border-gray-100 text-sm bg-white text-gray-800">
              <span className="truncate">{p.name}</span>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                {p.country && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                    {p.country}
                  </span>
                )}
                <button
                  onClick={() => removeParticipant(p.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${p.name}`}
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {participants.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-3 mb-4">No participants added</p>
      )}

      {/* Bulk paste */}
      <details className="group">
        <summary className="text-xs font-medium text-blue-600 cursor-pointer hover:text-blue-800 select-none list-none flex items-center gap-1">
          <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
          Bulk paste
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500">
            One entry per line. Optionally append <span className="font-mono">, CountryCode</span> or <span className="font-mono">, Full Name</span>.
          </p>
          <textarea
            rows={5}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
            placeholder={"Alice, TUR\nBob, Germany\nCarol"}
            value={bulkText}
            onChange={(e) => { setBulkText(e.target.value); setBulkError(''); }}
          />
          {bulkError && <p className="text-xs text-red-500">{bulkError}</p>}
          <button
            onClick={handleBulkParse}
            className="w-full border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg py-1.5 text-sm font-medium transition-colors"
          >
            Parse &amp; Add
          </button>
        </div>
      </details>
    </SectionCard>
  );
}

// ─── Config section ───────────────────────────────────────────────────────────

function ConfigSection() {
  const { trainers, config, setConfig } = useStore();

  const active = trainers.filter((t) => !t.isExcluded);
  const seniors = active.filter((t) => t.tier === 'senior').length;
  const juniors = active.filter((t) => t.tier === 'junior').length;
  const freshes = active.filter((t) => t.tier === 'fresh').length;

  return (
    <SectionCard title="Event Config">
      <div className="space-y-4 mb-5">
        <label className="block">
          <span className="text-sm text-gray-700 font-medium">Number of sessions</span>
          <input
            type="number"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            inputMode="numeric"
            value={config.sessionCount}
            onChange={(e) => setConfig({ sessionCount: Number(e.target.value) })}
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700 font-medium">Participants per session</span>
          <input
            type="number"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            inputMode="numeric"
            value={config.participantsPerSession}
            onChange={(e) => setConfig({ participantsPerSession: Number(e.target.value) })}
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700 font-medium">Sittings per day</span>
          <input
            type="number"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            inputMode="numeric"
            value={config.sittingsPerDay}
            onChange={(e) => setConfig({ sittingsPerDay: Number(e.target.value) })}
          />
        </label>
      </div>

      {/* Live summary */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-600 leading-relaxed">
        <span className="font-semibold text-gray-800">{active.length}</span> active trainer{active.length !== 1 ? 's' : ''}{' '}
        <span className="text-gray-500">
          ({seniors} senior{seniors !== 1 ? 's' : ''},{' '}
          {juniors} junior{juniors !== 1 ? 's' : ''},{' '}
          {freshes} fresh{freshes !== 1 ? 'es' : ''})
        </span>
        {' '}across{' '}
        <span className="font-semibold text-gray-800">{config.sessionCount}</span> session{config.sessionCount !== 1 ? 's' : ''},{' '}
        <span className="font-semibold text-gray-800">{config.sittingsPerDay}</span> sitting{config.sittingsPerDay !== 1 ? 's' : ''} per day
      </div>
    </SectionCard>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

interface SetupPanelProps {
  onGenerate?: () => void;
}

export function SetupPanel({ onGenerate }: SetupPanelProps) {
  const { config, runAllocation } = useStore();
  const [error, setError] = useState('');

  function handleGenerate() {
    if (config.sessionCount < 1) {
      setError('Number of sessions must be at least 1.');
      return;
    }
    if (config.participantsPerSession < 1) {
      setError('Participants per session must be at least 1.');
      return;
    }
    if (config.sittingsPerDay < 1) {
      setError('Sittings per day must be at least 1.');
      return;
    }
    setError('');
    runAllocation();
    onGenerate?.();
  }

  return (
    <div className="space-y-5">
      <TrainersSection />
      <ParticipantsSection />
      <ConfigSection />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        onClick={handleGenerate}
        className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold text-base py-3.5 rounded-2xl shadow-sm transition-colors"
      >
        Generate groups
      </button>
    </div>
  );
}

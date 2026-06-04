'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import type { Session, Sitting, SittingAssignment, Trainer, TrainerTier } from '@/types';

// ─── Tier display config ──────────────────────────────────────────────────────

const TIER_BADGE: Record<TrainerTier, string> = {
  senior: 'bg-purple-100 text-purple-700 border-purple-200',
  junior: 'bg-amber-100 text-amber-700 border-amber-200',
  fresh: 'bg-teal-100 text-teal-700 border-teal-200',
};

const TIER_ROLE_LABEL: Record<TrainerTier, string> = {
  senior: 'senior',
  junior: 'junior',
  fresh: 'fresh co-trainer',
};

// ─── Plain-text formatter ────────────────────────────────────────────────────

function formatAsText(sittings: Sitting[]): string {
  return sittings
    .map((sitting) => {
      const sessionBlocks = sitting.assignments
        .map((a) => {
          const trainerLine = a.trainers.length
            ? a.trainers.map((t) => `${t.name} (${TIER_ROLE_LABEL[t.tier]})`).join(', ')
            : 'None';
          const participantLine = a.participants.length
            ? a.participants.map((p) => p.name).join(', ')
            : 'None';
          return (
            `Sitting ${sitting.id} - Session ${a.sessionId}\n` +
            `Trainers: ${trainerLine}\n` +
            `Participants: ${participantLine}`
          );
        })
        .join('\n---\n');

      const vacantLine =
        sitting.vacantTrainers.length > 0
          ? `\nVacant: ${sitting.vacantTrainers.map((t) => t.name).join(', ')}`
          : '';

      return sessionBlocks + vacantLine;
    })
    .join('\n===\n');
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ assignment }: { assignment: SittingAssignment }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <h4 className="font-semibold text-gray-800 text-sm">Session {assignment.sessionId}</h4>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Trainers</p>
        {assignment.trainers.length === 0 ? (
          <p className="text-sm text-red-600">No trainer assigned</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assignment.trainers.map((t) => (
              <span
                key={t.id}
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${TIER_BADGE[t.tier]}`}
              >
                {t.name}
                <span className="ml-1 opacity-75">({TIER_ROLE_LABEL[t.tier]})</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Participants
          <span className="ml-1.5 font-normal normal-case text-gray-400">
            {assignment.participants.length}
          </span>
        </p>
        {assignment.participants.length === 0 ? (
          <p className="text-sm text-gray-500">No participants assigned</p>
        ) : (
          <ol className="list-decimal list-inside space-y-0.5">
            {assignment.participants.map((p) => (
              <li key={p.id} className="text-sm text-gray-800">
                {p.name}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ─── Vacant trainers strip ────────────────────────────────────────────────────

function VacantStrip({ trainers }: { trainers: Trainer[] }) {
  if (trainers.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">
        Vacant
      </span>
      {trainers.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-50 text-gray-600 border-gray-200"
        >
          {t.name}
          <span className="opacity-75">({TIER_ROLE_LABEL[t.tier]})</span>
        </span>
      ))}
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyAllButton({ sittings }: { sittings: Sitting[] }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(formatAsText(sittings));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      {copied ? <CheckIcon /> : <ClipboardIcon />}
      {copied ? 'Copied!' : 'Copy all'}
    </button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ClipboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function ResultsPanel() {
  const { result, runAllocation, clearResult } = useStore();

  if (!result) return null;

  const { sittings, warnings } = result;

  return (
    <section className="mt-10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={clearResult}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors mr-auto"
        >
          <ArrowLeftIcon />
          Back to setup
        </button>

        <CopyAllButton sittings={sittings} />

        <button
          onClick={runAllocation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <RefreshIcon />
          Regenerate
        </button>
      </div>

      {/* Warning banners */}
      {warnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
              <p className="text-sm text-amber-800">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sittings */}
      <div className="space-y-10">
        {sittings.map((sitting) => (
          <div key={sitting.id}>
            <h3 className="text-base font-semibold text-gray-800 mb-3">
              Sitting {sitting.id}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sitting.assignments.map((assignment) => (
                <SessionCard key={assignment.sessionId} assignment={assignment} />
              ))}
            </div>

            <VacantStrip trainers={sitting.vacantTrainers} />
          </div>
        ))}
      </div>
    </section>
  );
}

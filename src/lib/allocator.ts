import type { Trainer, Participant, EventConfig, AllocationResult, Session, Sitting } from '@/types';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Allocates trainers and participants across sessions and sittings.
 *
 * **Trainer assignment** (re-evaluated each sitting):
 * - Per-sitting availability: trainers with the sitting ID in `absentSittings` are skipped.
 * - Senior + Fresh pairing: each session gets 1 senior as lead. Freshes are co-assigned
 *   only to senior-led sessions — pairing fresh with juniors only is forbidden.
 *   Extras stack round-robin over senior-led sessions.
 * - Junior pairing: juniors fill the least-loaded sessions first, up to the 2-trainer
 *   cap per session (so a senior-led session can only receive 1 junior).
 * - Vacant trainers: active trainers present for a sitting but not placed in any session
 *   are recorded in `Sitting.vacantTrainers`.
 *
 * **Participant assignment** (reshuffled each sitting):
 * - Greedy placement into the session with the most remaining capacity.
 * - Constraint: no participant shares a session with the same trainer more than twice
 *   across all sittings. When unavoidable the constraint is overridden with a warning.
 *
 * Pure function — no side effects.
 */
export function allocate(
  trainers: Trainer[],
  participants: Participant[],
  config: EventConfig
): AllocationResult {
  const { sessionCount } = config;

  // Sessions are label-only; all assignment data lives in Sittings
  const sessions: Session[] = Array.from({ length: sessionCount }, (_, i) => ({ id: i + 1 }));

  // Active = not globally excluded; per-sitting absence handled inside allocateSittings
  const active = trainers.filter((t) => !t.isExcluded);

  const { sittings, warnings } = allocateSittings(sessions, active, participants, config);

  return { sessions, sittings, warnings };
}

function allocateSittings(
  sessions: Session[],
  activeTrainers: Trainer[],
  participants: Participant[],
  config: EventConfig
): { sittings: Sitting[]; warnings: string[] } {
  const warnings: string[] = [];
  const { sittingsPerDay, participantsPerSession } = config;

  // participantId → trainerId → encounter count across all sittings
  const encounters = new Map<string, Map<string, number>>();

  function getCount(pid: string, tid: string): number {
    return encounters.get(pid)?.get(tid) ?? 0;
  }

  function record(pid: string, trainers: Trainer[]): void {
    if (!encounters.has(pid)) encounters.set(pid, new Map());
    const map = encounters.get(pid)!;
    for (const t of trainers) map.set(t.id, (map.get(t.id) ?? 0) + 1);
  }

  function wouldViolate(pid: string, trainers: Trainer[]): boolean {
    return trainers.some((t) => getCount(pid, t.id) >= 2);
  }

  function countryCountIn(slot: { participants: Participant[] }, country: string): number {
    if (!country) return 0;
    return slot.participants.filter((p) => p.country === country).length;
  }

  const sittings: Sitting[] = [];

  for (let si = 0; si < sittingsPerDay; si++) {
    const sittingId = si + 1;

    // ── Trainer assignment ───────────────────────────────────────────────────

    const available = activeTrainers.filter((t) => !(t.absentSittings ?? []).includes(sittingId));
    const shuffledTrainers = shuffle(available);

    const seniors = shuffledTrainers.filter((t) => t.tier === 'senior');
    const juniors = shuffledTrainers.filter((t) => t.tier === 'junior');
    const freshes = shuffledTrainers.filter((t) => t.tier === 'fresh');

    const slots = sessions.map((session) => ({
      session,
      trainers: [] as Trainer[],
      participants: [] as Participant[],
      remaining: participantsPerSession,
    }));

    // Seniors: 1 per session
    for (let s = 0; s < sessions.length; s++) {
      if (s < seniors.length) slots[s].trainers.push(seniors[s]);
    }

    // Freshes: only to senior-led slots; extras stack round-robin (capped at 2 trainers per slot)
    const seniorSlots = slots.filter((s) => s.trainers.some((t) => t.tier === 'senior'));
    if (freshes.length > 0 && seniorSlots.length === 0) {
      warnings.push(
        `Sitting ${sittingId}: ${freshes.length} fresh trainer${freshes.length === 1 ? '' : 's'} ` +
        `could not be assigned — no session has a senior.`
      );
    } else {
      for (let f = 0; f < freshes.length; f++) {
        const target = seniorSlots[f % seniorSlots.length];
        if (target.trainers.length < 2) target.trainers.push(freshes[f]);
      }
    }

    // Juniors: fill least-loaded slots first (capped at 2 trainers per slot)
    const slotsByLoad = [...slots].sort((a, b) => a.trainers.length - b.trainers.length);
    let jIdx = 0;
    for (const slot of slotsByLoad) {
      const capacity = Math.max(0, 2 - slot.trainers.length);
      const take = Math.min(capacity, 2, juniors.length - jIdx);
      for (let k = 0; k < take; k++) slot.trainers.push(juniors[jIdx++]);
    }

    // Warn about sessions with no trainers this sitting
    slots.forEach((slot) => {
      if (slot.trainers.length === 0) {
        warnings.push(`Sitting ${sittingId}, Session ${slot.session.id} has no trainers assigned.`);
      }
    });

    // Vacant: available this sitting but not placed in any session
    const assignedIds = new Set(slots.flatMap((s) => s.trainers.map((t) => t.id)));
    const vacantTrainers = available.filter((t) => !assignedIds.has(t.id));

    // ── Participant assignment ────────────────────────────────────────────────

    const shuffledParticipants = shuffle(participants);
    let trainerOverrideCount = 0;
    let countryOverrideCount = 0;

    for (const p of shuffledParticipants) {
      // Tier 1: satisfies both trainer-encounter AND country ≤ 3
      const tier1 = slots.filter(
        (s) => s.remaining > 0 && !wouldViolate(p.id, s.trainers) && countryCountIn(s, p.country) < 3
      );

      // Tier 2: satisfies trainer-encounter but country would exceed 3
      const tier2 = slots.filter(
        (s) => s.remaining > 0 && !wouldViolate(p.id, s.trainers)
      );

      // Tier 3: any open slot (full override)
      const tier3 = slots.filter((s) => s.remaining > 0);

      let chosen: typeof slots[number] | null = null;

      if (tier1.length > 0) {
        chosen = tier1.reduce((best, s) => (s.remaining > best.remaining ? s : best));
      } else if (tier2.length > 0) {
        chosen = tier2.reduce((best, s) => (s.remaining > best.remaining ? s : best));
        if (p.country) countryOverrideCount++;
      } else if (tier3.length > 0) {
        chosen = tier3.reduce((best, s) => (s.remaining > best.remaining ? s : best));
        trainerOverrideCount++;
        if (p.country) countryOverrideCount++;
      }

      if (chosen) {
        chosen.participants.push(p);
        chosen.remaining--;
        record(p.id, chosen.trainers);
      }
    }

    if (trainerOverrideCount > 0) {
      warnings.push(
        `Sitting ${sittingId}: ${trainerOverrideCount} participant${trainerOverrideCount === 1 ? '' : 's'} ` +
        `could not avoid repeating a trainer — constraint overridden.`
      );
    }
    if (countryOverrideCount > 0) {
      warnings.push(
        `Sitting ${sittingId}: ${countryOverrideCount} participant${countryOverrideCount === 1 ? '' : 's'} ` +
        `could not avoid the 3-per-country limit — constraint overridden.`
      );
    }

    sittings.push({
      id: sittingId,
      assignments: slots.map((slot) => ({
        sessionId: slot.session.id,
        trainers: slot.trainers,
        participants: slot.participants,
      })),
      vacantTrainers,
    });
  }

  return { sittings, warnings };
}

import { allocate } from './allocator';
import type { Trainer, Participant, EventConfig } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _id = 0;
const nextId = () => String(++_id);

function makeTrainer(tier: Trainer['tier'], overrides: Partial<Trainer> = {}): Trainer {
  return { id: nextId(), name: `Trainer-${_id}`, tier, isExcluded: false, absentSittings: [], ...overrides };
}

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return { id: nextId(), name: `Participant-${_id}`, country: '', ...overrides };
}

function makeConfig(overrides: Partial<EventConfig> = {}): EventConfig {
  return { sessionCount: 2, participantsPerSession: 5, sittingsPerDay: 1, ...overrides };
}

function allTrainersIn(result: ReturnType<typeof allocate>, sittingIdx = 0): Trainer[] {
  return result.sittings[sittingIdx]?.assignments.flatMap((a) => a.trainers) ?? [];
}

// Returns all participants assigned in a given sitting (default: sitting 0)
function participantsInSitting(result: ReturnType<typeof allocate>, sittingIdx = 0): Participant[] {
  return result.sittings[sittingIdx]?.assignments.flatMap((a) => a.participants) ?? [];
}

// ─── Excluded trainers ───────────────────────────────────────────────────────

describe('excluded trainers', () => {
  it('never appears in any session', () => {
    const excluded = makeTrainer('senior', { isExcluded: true });
    const active = makeTrainer('senior');
    const result = allocate([excluded, active], [], makeConfig({ sessionCount: 1 }));
    const ids = allTrainersIn(result).map((t) => t.id);
    expect(ids).not.toContain(excluded.id);
    expect(ids).toContain(active.id);
  });

  it('produces correct session count even when all trainers are excluded', () => {
    const trainers = [makeTrainer('senior', { isExcluded: true })];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 3 }));
    expect(result.sessions).toHaveLength(3);
    result.sittings[0].assignments.forEach((a) => expect(a.trainers).toHaveLength(0));
  });
});

// ─── Senior assignment ───────────────────────────────────────────────────────

describe('senior assignment', () => {
  it('assigns exactly 1 senior per session when supply matches session count', () => {
    const trainers = [
      makeTrainer('senior'), makeTrainer('senior'),
      makeTrainer('junior'), makeTrainer('junior'), makeTrainer('junior'), makeTrainer('junior'),
    ];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    result.sittings[0].assignments.forEach((a) => {
      expect(a.trainers.filter((t) => t.tier === 'senior')).toHaveLength(1);
    });
    expect(result.warnings).toHaveLength(0);
  });

  it('assigns senior only to first N sessions when supply < session count', () => {
    const trainers = [makeTrainer('senior')];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 3 }));
    const seniorsPerSession = result.sittings[0].assignments.map(
      (a) => a.trainers.filter((t) => t.tier === 'senior').length
    );
    expect(seniorsPerSession[0]).toBe(1);
    expect(seniorsPerSession[1]).toBe(0);
    expect(seniorsPerSession[2]).toBe(0);
  });

  it('does not warn when a session without a senior is covered by juniors', () => {
    const trainers = [makeTrainer('senior'), makeTrainer('junior'), makeTrainer('junior')];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when a session ends up with zero trainers', () => {
    const trainers = [makeTrainer('senior')];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    expect(result.warnings.some((w) => w.includes('Session 2') && w.includes('no trainers'))).toBe(true);
  });
});

// ─── Fresh assignment ────────────────────────────────────────────────────────

describe('fresh assignment', () => {
  it('assigns 1 fresh per session when supply matches session count', () => {
    const trainers = [makeTrainer('senior'), makeTrainer('senior'), makeTrainer('fresh'), makeTrainer('fresh')];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    result.sittings[0].assignments.forEach((a) => {
      expect(a.trainers.filter((t) => t.tier === 'fresh')).toHaveLength(1);
    });
  });

  it('stacks extra freshes round-robin onto senior-led sessions when supply > session count', () => {
    // With max 2 trainers per session and 1 senior already placed, each senior-led slot
    // can hold at most 1 fresh. With 2 senior slots and 3 freshes, only 2 can be placed.
    const trainers = [
      makeTrainer('senior'), makeTrainer('senior'),
      makeTrainer('fresh'), makeTrainer('fresh'), makeTrainer('fresh'),
    ];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    const freshCounts = result.sittings[0].assignments.map((a) => a.trainers.filter((t) => t.tier === 'fresh').length);
    expect(freshCounts.reduce((a, b) => a + b)).toBe(2);
    expect(freshCounts.every((c) => c <= 1)).toBe(true);
  });

  it('leaves some senior-led sessions without a fresh when supply < session count', () => {
    const trainers = [makeTrainer('senior'), makeTrainer('senior'), makeTrainer('senior'), makeTrainer('fresh')];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 3 }));
    const freshCounts = result.sittings[0].assignments.map((a) => a.trainers.filter((t) => t.tier === 'fresh').length);
    expect(freshCounts.reduce((a, b) => a + b)).toBe(1);
    expect(freshCounts.filter((c) => c === 0)).toHaveLength(2);
  });

  it('never places a fresh in a session that has no senior', () => {
    const trainers = [makeTrainer('senior'), makeTrainer('fresh')];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    result.sittings[0].assignments.forEach((a) => {
      const hasFresh = a.trainers.some((t) => t.tier === 'fresh');
      const hasSenior = a.trainers.some((t) => t.tier === 'senior');
      if (hasFresh) expect(hasSenior).toBe(true);
    });
  });

  it('warns and assigns no freshes when there are no senior-led sessions', () => {
    const trainers = [makeTrainer('fresh'), makeTrainer('fresh')];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    const allFreshCount = allTrainersIn(result).filter((t) => t.tier === 'fresh').length;
    expect(allFreshCount).toBe(0);
    expect(result.warnings.some((w) => w.includes('fresh'))).toBe(true);
  });

  it('produces no warning for fresh shortage when seniors are available', () => {
    const trainers = [makeTrainer('senior'), makeTrainer('senior'), makeTrainer('fresh')];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    expect(result.warnings.every((w) => !w.includes('fresh'))).toBe(true);
  });
});

// ─── Junior assignment ───────────────────────────────────────────────────────

describe('junior assignment', () => {
  it('assigns exactly 2 juniors per session when supply is even and sufficient', () => {
    // No seniors — each session slot is empty so both junior slots fill up to the 2-trainer cap.
    const trainers = [
      makeTrainer('junior'), makeTrainer('junior'),
      makeTrainer('junior'), makeTrainer('junior'),
    ];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    result.sittings[0].assignments.forEach((a) => {
      expect(a.trainers.filter((t) => t.tier === 'junior')).toHaveLength(2);
    });
    expect(result.warnings).toHaveLength(0);
  });

  it('gives one session a single junior when total is odd', () => {
    // No seniors — 3 juniors across 2 sessions: one session gets 2, the other gets 1.
    const trainers = [
      makeTrainer('junior'), makeTrainer('junior'), makeTrainer('junior'),
    ];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    const juniorCounts = result.sittings[0].assignments.map((a) => a.trainers.filter((t) => t.tier === 'junior').length);
    expect(juniorCounts).toContain(2);
    expect(juniorCounts).toContain(1);
    expect(result.warnings).toHaveLength(0);
  });

  it('fills least-covered sessions first so uncovered sessions get juniors before staffed ones', () => {
    const trainers = [makeTrainer('senior'), makeTrainer('junior'), makeTrainer('junior')];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    const assignments = result.sittings[0].assignments;
    const withSenior = assignments.find((a) => a.trainers.some((t) => t.tier === 'senior'))!;
    const withoutSenior = assignments.find((a) => !a.trainers.some((t) => t.tier === 'senior'))!;
    expect(withoutSenior.trainers.filter((t) => t.tier === 'junior')).toHaveLength(2);
    expect(withSenior.trainers.filter((t) => t.tier === 'junior')).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('produces no warnings for the canonical 1-senior 2-junior 1-fresh 2-session case', () => {
    const trainers = [
      makeTrainer('senior'),
      makeTrainer('junior'), makeTrainer('junior'),
      makeTrainer('fresh'),
    ];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    expect(result.warnings).toHaveLength(0);
    const assignments = result.sittings[0].assignments;
    const withSenior = assignments.find((a) => a.trainers.some((t) => t.tier === 'senior'))!;
    expect(withSenior.trainers.some((t) => t.tier === 'fresh')).toBe(true);
    const withoutSenior = assignments.find((a) => !a.trainers.some((t) => t.tier === 'senior'))!;
    expect(withoutSenior.trainers.filter((t) => t.tier === 'junior')).toHaveLength(2);
  });

  it('all juniors are assigned exactly once', () => {
    const juniors = Array.from({ length: 5 }, () => makeTrainer('junior'));
    const result = allocate(juniors, [], makeConfig({ sessionCount: 3 }));
    const assignedIds = allTrainersIn(result).map((t) => t.id);
    juniors.forEach((j) => expect(assignedIds).toContain(j.id));
    expect(new Set(assignedIds).size).toBe(assignedIds.length);
  });
});

// ─── Participant distribution ────────────────────────────────────────────────

describe('participant distribution', () => {
  it('splits evenly across sessions in a sitting', () => {
    const participants = Array.from({ length: 6 }, () => makeParticipant());
    const result = allocate([], participants, makeConfig({ sessionCount: 3 }));
    const counts = result.sittings[0].assignments.map((a) => a.participants.length);
    expect(counts.every((c) => c === 2)).toBe(true);
  });

  it('distributes roughly evenly when count does not divide exactly', () => {
    const participants = Array.from({ length: 7 }, () => makeParticipant());
    const result = allocate([], participants, makeConfig({ sessionCount: 3 }));
    const counts = result.sittings[0].assignments.map((a) => a.participants.length);
    expect(counts.reduce((a, b) => a + b)).toBe(7);
    counts.forEach((c) => {
      expect(c).toBeGreaterThanOrEqual(Math.floor(7 / 3));
      expect(c).toBeLessThanOrEqual(Math.ceil(7 / 3));
    });
  });

  it('assigns all participants in the sitting', () => {
    const participants = Array.from({ length: 10 }, () => makeParticipant());
    const result = allocate([], participants, makeConfig({ sessionCount: 4, participantsPerSession: 5 }));
    const assigned = participantsInSitting(result, 0);
    expect(assigned).toHaveLength(participants.length);
    expect(new Set(assigned.map((p) => p.id)).size).toBe(participants.length);
  });

  it('handles more sessions than participants', () => {
    const participants = Array.from({ length: 2 }, () => makeParticipant());
    const result = allocate([], participants, makeConfig({ sessionCount: 5 }));
    expect(participantsInSitting(result).length).toBe(2);
    expect(result.sessions).toHaveLength(5);
  });

  it('handles zero participants', () => {
    const result = allocate([], [], makeConfig({ sessionCount: 3 }));
    result.sittings[0].assignments.forEach((a) => expect(a.participants).toHaveLength(0));
  });
});

// ─── Session structure ───────────────────────────────────────────────────────

describe('session structure', () => {
  it('always returns exactly sessionCount sessions', () => {
    [1, 2, 5].forEach((sessionCount) => {
      const result = allocate([], [], makeConfig({ sessionCount }));
      expect(result.sessions).toHaveLength(sessionCount);
    });
  });

  it('assigns sequential ids starting from 1', () => {
    const result = allocate([], [], makeConfig({ sessionCount: 4 }));
    result.sessions.forEach((s, i) => expect(s.id).toBe(i + 1));
  });

  it('returns empty warnings array when everything is perfectly covered', () => {
    const trainers = [
      makeTrainer('senior'), makeTrainer('senior'),
      makeTrainer('junior'), makeTrainer('junior'), makeTrainer('junior'), makeTrainer('junior'),
    ];
    const participants = Array.from({ length: 4 }, () => makeParticipant());
    const result = allocate(trainers, participants, makeConfig({ sessionCount: 2, participantsPerSession: 4 }));
    expect(result.warnings).toEqual([]);
  });
});

// ─── Sittings ────────────────────────────────────────────────────────────────

describe('sittings', () => {
  it('produces exactly sittingsPerDay sittings', () => {
    const result = allocate([], [], makeConfig({ sessionCount: 2, sittingsPerDay: 4 }));
    expect(result.sittings).toHaveLength(4);
  });

  it('each sitting has an assignment for every session', () => {
    const result = allocate([], [], makeConfig({ sessionCount: 3, sittingsPerDay: 2 }));
    result.sittings.forEach((sitting) => {
      expect(sitting.assignments).toHaveLength(3);
      expect(sitting.assignments.map((a) => a.sessionId).sort()).toEqual([1, 2, 3]);
    });
  });

  it('assigns all participants in every sitting', () => {
    const participants = Array.from({ length: 6 }, () => makeParticipant());
    const result = allocate([], participants, makeConfig({
      sessionCount: 2, participantsPerSession: 5, sittingsPerDay: 3,
    }));
    result.sittings.forEach((sitting) => {
      const count = sitting.assignments.flatMap((a) => a.participants).length;
      expect(count).toBe(6);
    });
  });

  it('sitting ids are sequential from 1', () => {
    const result = allocate([], [], makeConfig({ sessionCount: 1, sittingsPerDay: 3 }));
    result.sittings.forEach((s, i) => expect(s.id).toBe(i + 1));
  });

  it('does not warn when participants can satisfy the ≤2 encounters constraint', () => {
    // 4 participants, 2 sessions (2 per session), 2 sittings
    // After 2 sittings max encounters per trainer = 2; no violation needed
    const trainers = [makeTrainer('senior'), makeTrainer('junior'), makeTrainer('junior')];
    const participants = Array.from({ length: 4 }, () => makeParticipant());
    const result = allocate(trainers, participants, makeConfig({
      sessionCount: 2, participantsPerSession: 2, sittingsPerDay: 2,
    }));
    expect(result.warnings.every((w) => !w.includes('constraint overridden'))).toBe(true);
  });

  it('warns when the constraint cannot be avoided', () => {
    // 1 session means every participant sits with the same trainer every sitting
    // After 2 sittings, sitting 3 must violate the ≤2 constraint
    const trainers = [makeTrainer('senior')];
    const participants = Array.from({ length: 2 }, () => makeParticipant());
    const result = allocate(trainers, participants, makeConfig({
      sessionCount: 1, participantsPerSession: 5, sittingsPerDay: 3,
    }));
    expect(result.warnings.some((w) => w.includes('constraint overridden'))).toBe(true);
  });
});

// ─── Junior + fresh constraint ───────────────────────────────────────────────

describe('junior + fresh without senior constraint', () => {
  it('never produces a session with both a junior and a fresh but no senior', () => {
    const trainers = [
      makeTrainer('senior'), makeTrainer('senior'),
      makeTrainer('junior'), makeTrainer('junior'), makeTrainer('junior'), makeTrainer('junior'),
      makeTrainer('fresh'), makeTrainer('fresh'), makeTrainer('fresh'),
    ];
    const participants = Array.from({ length: 12 }, () => makeParticipant());
    for (let i = 0; i < 30; i++) {
      const result = allocate(trainers, participants, makeConfig({ sessionCount: 3 }));
      result.sittings[0].assignments.forEach((a) => {
        const hasJunior = a.trainers.some((t) => t.tier === 'junior');
        const hasFresh = a.trainers.some((t) => t.tier === 'fresh');
        const hasSenior = a.trainers.some((t) => t.tier === 'senior');
        if (hasJunior && hasFresh) expect(hasSenior).toBe(true);
      });
    }
  });

  it('allows juniors to share a session without a senior', () => {
    const trainers = [
      makeTrainer('senior'),
      makeTrainer('junior'), makeTrainer('junior'), makeTrainer('junior'), makeTrainer('junior'),
    ];
    const result = allocate(trainers, [], makeConfig({ sessionCount: 2 }));
    const assignments = result.sittings[0].assignments;
    const juniorOnlyAssignments = assignments.filter(
      (a) => a.trainers.some((t) => t.tier === 'junior') && !a.trainers.some((t) => t.tier === 'senior')
    );
    expect(result.warnings.every((w) => !w.includes('fresh'))).toBe(true);
    juniorOnlyAssignments.forEach((a) => {
      expect(a.trainers.every((t) => t.tier === 'junior')).toBe(true);
    });
  });
});

// ─── Sitting absence ─────────────────────────────────────────────────────────

describe('sitting absence', () => {
  it('excludes an absent trainer from their marked sitting but includes them in others', () => {
    const absentTrainer = makeTrainer('senior', { absentSittings: [1] });
    const presentTrainer = makeTrainer('senior');
    const result = allocate([absentTrainer, presentTrainer], [], makeConfig({ sessionCount: 2, sittingsPerDay: 2 }));
    const sitting1Ids = allTrainersIn(result, 0).map((t) => t.id);
    const sitting2Ids = allTrainersIn(result, 1).map((t) => t.id);
    expect(sitting1Ids).not.toContain(absentTrainer.id);
    expect(sitting2Ids).toContain(absentTrainer.id);
  });

  it('lists unassigned-but-present trainers as vacant', () => {
    // 3 seniors for 2 sessions → 2 placed, 1 vacant
    const seniors = [makeTrainer('senior'), makeTrainer('senior'), makeTrainer('senior')];
    const result = allocate(seniors, [], makeConfig({ sessionCount: 2, sittingsPerDay: 1 }));
    expect(result.sittings[0].vacantTrainers).toHaveLength(1);
    expect(result.sittings[0].vacantTrainers[0].tier).toBe('senior');
  });

  it('does not list absent trainers as vacant', () => {
    const absent = makeTrainer('senior', { absentSittings: [1] });
    const present = makeTrainer('senior');
    const result = allocate([absent, present], [], makeConfig({ sessionCount: 1, sittingsPerDay: 1 }));
    const vacantIds = result.sittings[0].vacantTrainers.map((t) => t.id);
    expect(vacantIds).not.toContain(absent.id);
  });
});

// ─── Country constraint ───────────────────────────────────────────────────────

describe('country constraint (max 3 per session)', () => {
  it('places at most 3 participants from the same country in one session', () => {
    // 4 participants from TUR, 2 sessions with capacity 5 each
    const participants = [
      makeParticipant({ country: 'TUR' }),
      makeParticipant({ country: 'TUR' }),
      makeParticipant({ country: 'TUR' }),
      makeParticipant({ country: 'TUR' }),
    ];
    const result = allocate([], participants, makeConfig({ sessionCount: 2, participantsPerSession: 5 }));
    result.sittings[0].assignments.forEach((a) => {
      const turCount = a.participants.filter((p) => p.country === 'TUR').length;
      expect(turCount).toBeLessThanOrEqual(3);
    });
  });

  it('warns when the country limit cannot be avoided', () => {
    // 4 participants from TUR but only 1 session — impossible to satisfy the limit
    const participants = [
      makeParticipant({ country: 'TUR' }),
      makeParticipant({ country: 'TUR' }),
      makeParticipant({ country: 'TUR' }),
      makeParticipant({ country: 'TUR' }),
    ];
    const result = allocate([], participants, makeConfig({ sessionCount: 1, participantsPerSession: 10 }));
    expect(result.warnings.some((w) => w.includes('3-per-country limit'))).toBe(true);
  });

  it('does not warn when participants have no country', () => {
    const participants = Array.from({ length: 8 }, () => makeParticipant({ country: '' }));
    const result = allocate([], participants, makeConfig({ sessionCount: 2, participantsPerSession: 5 }));
    expect(result.warnings.every((w) => !w.includes('country'))).toBe(true);
  });

  it('allows up to 3 from the same country without warning', () => {
    const participants = [
      makeParticipant({ country: 'TUR' }),
      makeParticipant({ country: 'TUR' }),
      makeParticipant({ country: 'TUR' }),
    ];
    const result = allocate([], participants, makeConfig({ sessionCount: 1, participantsPerSession: 5 }));
    expect(result.warnings.every((w) => !w.includes('country'))).toBe(true);
  });
});

// ─── Purity ──────────────────────────────────────────────────────────────────

describe('purity', () => {
  it('does not mutate the input trainers array', () => {
    const trainers = [makeTrainer('senior'), makeTrainer('junior')];
    const original = trainers.map((t) => ({ ...t }));
    allocate(trainers, [], makeConfig({ sessionCount: 1 }));
    expect(trainers).toEqual(original);
  });

  it('does not mutate the input participants array', () => {
    const participants = Array.from({ length: 4 }, () => makeParticipant());
    const original = participants.map((p) => ({ ...p }));
    allocate([], participants, makeConfig({ sessionCount: 2 }));
    expect(participants).toEqual(original);
  });

  it('returns a different object on each call (no shared state)', () => {
    const trainers = [makeTrainer('senior')];
    const participants = [makeParticipant()];
    const config = makeConfig({ sessionCount: 1 });
    const r1 = allocate(trainers, participants, config);
    const r2 = allocate(trainers, participants, config);
    expect(r1).not.toBe(r2);
    expect(r1.sessions).not.toBe(r2.sessions);
    expect(r1.sittings).not.toBe(r2.sittings);
  });
});

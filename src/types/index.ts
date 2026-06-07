export type TrainerTier = 'senior' | 'junior' | 'fresh';

export interface Trainer {
  id: string;
  name: string;
  tier: TrainerTier;
  isExcluded: boolean;
  absentSittings: number[]; // 1-based sitting IDs the trainer will not attend
}

export interface Participant {
  id: string;
  name: string;
  country: string; // ISO 3166-1 alpha-3 code, empty string if not specified
}

// Sessions are label-only; trainer + participant data lives in SittingAssignment
export interface Session {
  id: number;
}

export interface SittingAssignment {
  sessionId: number;
  trainers: Trainer[];
  participants: Participant[];
}

export interface Sitting {
  id: number;
  assignments: SittingAssignment[];
  vacantTrainers: Trainer[]; // active, non-absent trainers not assigned to any session
}

export interface EventConfig {
  sessionCount: number;
  participantsPerSession: number;
  sittingsPerDay: number;
}

export interface AllocationResult {
  sessions: Session[];
  sittings: Sitting[];
  warnings: string[];
}

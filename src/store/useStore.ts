import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { allocate } from '@/lib/allocator';
import type { Trainer, Participant, EventConfig, AllocationResult, TrainerTier } from '@/types';

interface StoreState {
  trainers: Trainer[];
  participants: Participant[];
  config: EventConfig;
  result: AllocationResult | null;

  addTrainer: (name: string, tier: TrainerTier) => void;
  removeTrainer: (id: string) => void;
  toggleExcludeTrainer: (id: string) => void;
  toggleTrainerAbsentSitting: (id: string, sittingId: number) => void;
  bulkAddTrainers: (rows: { name: string; tier: TrainerTier }[]) => void;

  addParticipant: (name: string) => void;
  removeParticipant: (id: string) => void;
  bulkAddParticipants: (raw: string) => void;

  setConfig: (updates: Partial<EventConfig>) => void;
  runAllocation: () => void;
  clearResult: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      trainers: [],
      participants: [],
      config: {
        sessionCount: 3,
        participantsPerSession: 10,
        sittingsPerDay: 1,
      },
      result: null,

      addTrainer: (name, tier) =>
        set((state) => ({
          trainers: [
            ...state.trainers,
            { id: crypto.randomUUID(), name, tier, isExcluded: false, absentSittings: [] },
          ],
        })),

      removeTrainer: (id) =>
        set((state) => ({
          trainers: state.trainers.filter((t) => t.id !== id),
        })),

      toggleExcludeTrainer: (id) =>
        set((state) => ({
          trainers: state.trainers.map((t) =>
            t.id === id ? { ...t, isExcluded: !t.isExcluded } : t
          ),
        })),

      toggleTrainerAbsentSitting: (id, sittingId) =>
        set((state) => ({
          trainers: state.trainers.map((t) =>
            t.id === id
              ? {
                  ...t,
                  absentSittings: t.absentSittings.includes(sittingId)
                    ? t.absentSittings.filter((s) => s !== sittingId)
                    : [...t.absentSittings, sittingId],
                }
              : t
          ),
        })),

      bulkAddTrainers: (rows) =>
        set((state) => ({
          trainers: [
            ...state.trainers,
            ...rows.map((r) => ({
              id: crypto.randomUUID(),
              name: r.name,
              tier: r.tier,
              isExcluded: false,
              absentSittings: [],
            })),
          ],
        })),

      addParticipant: (name) =>
        set((state) => ({
          participants: [
            ...state.participants,
            { id: crypto.randomUUID(), name },
          ],
        })),

      removeParticipant: (id) =>
        set((state) => ({
          participants: state.participants.filter((p) => p.id !== id),
        })),

      bulkAddParticipants: (raw) => {
        const names = raw
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        const incoming: Participant[] = names.map((name) => ({
          id: crypto.randomUUID(),
          name,
        }));
        set((state) => ({
          participants: [...state.participants, ...incoming],
        }));
      },

      setConfig: (updates) =>
        set((state) => ({ config: { ...state.config, ...updates } })),

      runAllocation: () => {
        const { trainers, participants, config } = get();
        const result = allocate(trainers, participants, config);
        set({ result });
      },

      clearResult: () => set({ result: null }),
    }),
    {
      name: 'session-allocator',
      partialize: (state) => ({
        trainers: state.trainers,
        participants: state.participants,
        config: state.config,
      }),
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<StoreState>;
        return {
          ...current,
          ...p,
          trainers: (p.trainers ?? []).map((t) => ({
            ...t,
            absentSittings: t.absentSittings ?? [],
          })),
        };
      },
    }
  )
);

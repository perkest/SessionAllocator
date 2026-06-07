import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { allocate } from '@/lib/allocator';
import { resolveCountry } from '@/lib/countries';
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

  addParticipant: (name: string, country: string) => void;
  removeParticipant: (id: string) => void;
  bulkAddParticipants: (raw: string) => { badLines: number[] };

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

      addParticipant: (name, country) =>
        set((state) => ({
          participants: [
            ...state.participants,
            { id: crypto.randomUUID(), name, country },
          ],
        })),

      removeParticipant: (id) =>
        set((state) => ({
          participants: state.participants.filter((p) => p.id !== id),
        })),

      bulkAddParticipants: (raw) => {
        const badLines: number[] = [];
        const incoming: Participant[] = [];

        raw.split('\n').forEach((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return;

          const comma = trimmed.lastIndexOf(',');
          if (comma === -1) {
            // No comma — name only, no country
            incoming.push({ id: crypto.randomUUID(), name: trimmed, country: '' });
            return;
          }

          const parsedName = trimmed.slice(0, comma).trim();
          const rawCountry = trimmed.slice(comma + 1).trim();

          if (!parsedName) { badLines.push(idx + 1); return; }

          const resolved = resolveCountry(rawCountry);
          if (!resolved) {
            badLines.push(idx + 1);
            return;
          }

          incoming.push({ id: crypto.randomUUID(), name: parsedName, country: resolved.alpha3 });
        });

        if (incoming.length > 0) {
          set((state) => ({
            participants: [...state.participants, ...incoming],
          }));
        }

        return { badLines };
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
      storage: createJSONStorage(() => sessionStorage),
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
          participants: (p.participants ?? []).map((pt) => ({
            ...pt,
            country: pt.country ?? '',
          })),
        };
      },
    }
  )
);

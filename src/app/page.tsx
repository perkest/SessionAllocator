'use client';

import { useStore } from '@/store/useStore';
import { SetupPanel } from '@/components/SetupPanel';
import { ResultsPanel } from '@/components/ResultsPanel';

export default function Home() {
  const result = useStore((s) => s.result);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <span className="text-lg font-bold text-gray-800">Session Allocator</span>
          <span className="ml-2 text-sm text-gray-500">training group generator</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {result ? <ResultsPanel /> : <SetupPanel />}
      </main>
    </div>
  );
}

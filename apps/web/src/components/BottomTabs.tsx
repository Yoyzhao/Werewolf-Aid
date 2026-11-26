import { BookOpen, Home, UserRound } from 'lucide-react';

import { useGameStore } from '../stores/game-store';

export interface BottomTabsProps {
  readonly active: 'home' | 'assistant' | 'rules';
}

const TABS = [
  { id: 'home', label: '主持', icon: Home },
  { id: 'assistant', label: '助手', icon: UserRound },
  { id: 'rules', label: '规则', icon: BookOpen },
] as const;

export function BottomTabs({ active }: BottomTabsProps) {
  const setView = useGameStore((state) => state.setView);
  const goHome = useGameStore((state) => state.goHome);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label="主导航"
    >
      <div className="mx-auto flex max-w-[1200px] items-stretch justify-around px-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
                isActive ? 'text-gold' : 'text-faint'
              }`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (tab.id === 'home') goHome();
                if (tab.id === 'assistant') setView('assistant');
                if (tab.id === 'rules') setView('rules');
              }}
            >
              <Icon size={19} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

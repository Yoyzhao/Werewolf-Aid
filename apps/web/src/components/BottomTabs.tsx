import { BookOpen, Home, UserRound } from 'lucide-react';
import { toast } from 'sonner';

export interface BottomTabsProps {
  readonly active: 'home' | 'assistant' | 'rules';
}

const TABS = [
  { id: 'home', label: '主持', icon: Home },
  { id: 'assistant', label: '助手', icon: UserRound },
  { id: 'rules', label: '规则', icon: BookOpen },
] as const;

export function BottomTabs({ active }: BottomTabsProps) {
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
                if (tab.id === 'assistant') toast('个人助手将在 T-018 接入');
                if (tab.id === 'rules') toast('规则页将在 T-032 接入');
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

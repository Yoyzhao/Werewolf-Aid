import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from 'sonner';

import { GuideDialog } from './components/GuideDialog';
import { TopBar } from './components/TopBar';
import { HomeScreen } from './features/home/HomeScreen';
import { releaseWakeLock, requestWakeLock } from './lib/wake-lock';
import { useGameStore } from './stores/game-store';

const AssistantScreen = lazy(() =>
  import('./features/assistant/AssistantScreen').then((module) => ({
    default: module.AssistantScreen,
  })),
);
const RulesScreen = lazy(() =>
  import('./features/rules/RulesScreen').then((module) => ({ default: module.RulesScreen })),
);
const SetupScreen = lazy(() =>
  import('./features/setup/SetupScreen').then((module) => ({ default: module.SetupScreen })),
);
const DealScreen = lazy(() =>
  import('./features/deal/DealScreen').then((module) => ({ default: module.DealScreen })),
);
const NightScreen = lazy(() =>
  import('./features/night/NightScreen').then((module) => ({ default: module.NightScreen })),
);
const SheriffScreen = lazy(() =>
  import('./features/sheriff/SheriffScreen').then((module) => ({
    default: module.SheriffScreen,
  })),
);
const DawnScreen = lazy(() =>
  import('./features/dawn/DawnScreen').then((module) => ({ default: module.DawnScreen })),
);
const SpeechScreen = lazy(() =>
  import('./features/speech/SpeechScreen').then((module) => ({
    default: module.SpeechScreen,
  })),
);
const VoteScreen = lazy(() =>
  import('./features/vote/VoteScreen').then((module) => ({ default: module.VoteScreen })),
);
const ResultScreen = lazy(() =>
  import('./features/result/ResultScreen').then((module) => ({
    default: module.ResultScreen,
  })),
);

const ACTIVE_GAME_VIEWS = new Set(['deal', 'night', 'sheriff', 'dawn', 'speech', 'vote']);

export default function App() {
  const initialized = useGameStore((state) => state.initialized);
  const view = useGameStore((state) => state.view);
  const guideOpen = useGameStore((state) => state.guideOpen);
  const storageError = useGameStore((state) => state.storageError);
  const init = useGameStore((state) => state.init);
  const dismissGuide = useGameStore((state) => state.dismissGuide);
  const retrySave = useGameStore((state) => state.retrySave);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!ACTIVE_GAME_VIEWS.has(view)) return;

    void requestWakeLock();
    const handleVisible = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
      releaseWakeLock();
    };
  }, [view]);

  return (
    <>
      <TopBar view={view} />
      <main className="shell">
        {storageError ? (
          <div className="warn-strip strong mt-3" role="alert">
            <span className="flex-1">本机保存失败，刷新可能丢失。请勿关闭页面。</span>
            <button type="button" className="btn ghost" onClick={retrySave}>
              重试
            </button>
          </div>
        ) : null}

        {!initialized ? (
          <div className="screen-body">
            <div className="placeholder-card">
              <p className="text-sm text-muted">正在读取本局…</p>
            </div>
          </div>
        ) : (
          <>
            {view === 'home' ? <HomeScreen /> : null}
            <Suspense
              fallback={
                <div className="screen-body">
                  <div className="placeholder-card">
                    <p className="text-sm text-muted">正在加载页面…</p>
                  </div>
                </div>
              }
            >
              {view === 'assistant' ? <AssistantScreen /> : null}
              {view === 'rules' ? <RulesScreen /> : null}
              {view === 'setup' ? <SetupScreen /> : null}
              {view === 'deal' ? <DealScreen /> : null}
              {view === 'night' ? <NightScreen /> : null}
              {view === 'sheriff' ? <SheriffScreen /> : null}
              {view === 'dawn' ? <DawnScreen /> : null}
              {view === 'speech' ? <SpeechScreen /> : null}
              {view === 'vote' ? <VoteScreen /> : null}
              {view === 'result' ? <ResultScreen /> : null}
            </Suspense>
          </>
        )}
      </main>

      <GuideDialog open={guideOpen} onDismiss={dismissGuide} />
      <Toaster theme="dark" position="top-center" richColors />
    </>
  );
}

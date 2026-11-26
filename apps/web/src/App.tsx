import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

import { GuideDialog } from './components/GuideDialog';
import { TopBar } from './components/TopBar';
import { AssistantScreen } from './features/assistant/AssistantScreen';
import { DawnScreen } from './features/dawn/DawnScreen';
import { DealScreen } from './features/deal/DealScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { HostRoomScreen } from './features/host/HostRoomScreen';
import { NightScreen } from './features/night/NightScreen';
import { PlayerRoot } from './features/player/PlayerRoot';
import { ResultScreen } from './features/result/ResultScreen';
import { RulesScreen } from './features/rules/RulesScreen';
import { SetupScreen } from './features/setup/SetupScreen';
import { SheriffScreen } from './features/sheriff/SheriffScreen';
import { SpeechScreen } from './features/speech/SpeechScreen';
import { VoteScreen } from './features/vote/VoteScreen';
import { primeAiSession } from './lib/ai-client';
import { releaseWakeLock, requestWakeLock } from './lib/wake-lock';
import { useGameStore } from './stores/game-store';
import { startHostSync, useHostRoomStore } from './stores/host-room-store';

const ACTIVE_GAME_VIEWS = new Set(['deal', 'night', 'sheriff', 'dawn', 'speech', 'vote']);

type JoinRoute =
  | { readonly kind: 'entry' }
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'invalid'; readonly code: string };

function readJoinRoute(pathname: string): JoinRoute | null {
  if (pathname === '/join' || pathname === '/join/') return { kind: 'entry' };
  if (!pathname.startsWith('/join/')) return null;
  const code = decodeURIComponent(pathname.slice('/join/'.length)).replace(/\/$/, '');
  if (/^\d{6}$/.test(code)) return { kind: 'code', code };
  return { kind: 'invalid', code };
}

export default function App() {
  const initialized = useGameStore((state) => state.initialized);
  const view = useGameStore((state) => state.view);
  const guideOpen = useGameStore((state) => state.guideOpen);
  const storageError = useGameStore((state) => state.storageError);
  const init = useGameStore((state) => state.init);
  const dismissGuide = useGameStore((state) => state.dismissGuide);
  const retrySave = useGameStore((state) => state.retrySave);
  const initHostRoom = useHostRoomStore((state) => state.init);

  const [joinRoute, setJoinRoute] = useState<JoinRoute | null>(() =>
    readJoinRoute(window.location.pathname),
  );

  useEffect(() => {
    const onPopState = (): void => setJoinRoute(readJoinRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (joinRoute) return;
    void initHostRoom();
    return startHostSync();
  }, [joinRoute, initHostRoom]);

  useEffect(() => {
    void primeAiSession();
  }, []);

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

  if (joinRoute) {
    const navigateJoin = (code: string): void => {
      window.history.pushState({}, '', `/join/${code}`);
      setJoinRoute({ kind: 'code', code });
    };
    const exitJoin = (): void => {
      window.history.pushState({}, '', '/');
      setJoinRoute(null);
    };

    return (
      <>
        <PlayerRoot
          code={joinRoute.kind === 'code' ? joinRoute.code : null}
          invalidCode={joinRoute.kind === 'invalid' ? joinRoute.code : null}
          onNavigate={navigateJoin}
          onExit={exitJoin}
        />
        <Toaster theme="dark" position="top-center" richColors />
      </>
    );
  }

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
            {view === 'assistant' ? <AssistantScreen /> : null}
            {view === 'rules' ? <RulesScreen /> : null}
            {view === 'host-room' ? <HostRoomScreen /> : null}
            {view === 'setup' ? <SetupScreen /> : null}
            {view === 'deal' ? <DealScreen /> : null}
            {view === 'night' ? <NightScreen /> : null}
            {view === 'sheriff' ? <SheriffScreen /> : null}
            {view === 'dawn' ? <DawnScreen /> : null}
            {view === 'speech' ? <SpeechScreen /> : null}
            {view === 'vote' ? <VoteScreen /> : null}
            {view === 'result' ? <ResultScreen /> : null}
          </>
        )}
      </main>

      <GuideDialog open={guideOpen} onDismiss={dismissGuide} />
      <Toaster theme="dark" position="top-center" richColors />
    </>
  );
}

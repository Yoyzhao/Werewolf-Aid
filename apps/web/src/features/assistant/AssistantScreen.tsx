import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ROLE_DEFINITIONS } from '@lrs/game-engine';
import { getRoleGuide, ROLE_GUIDES } from '@lrs/rules-content';
import { toast } from 'sonner';

import { BottomTabs } from '../../components/BottomTabs';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RoleAvatar } from '../../components/RoleAvatar';
import {
  ASSISTANT_CONTEXT_LIMIT,
  ASSISTANT_FREE_TEXT_LIMIT,
  ASSISTANT_MAX_ROUND,
  ASSISTANT_SEAT_COUNT,
  createEmptyPlayerRecord,
} from '../../lib/assistant';
import { buildAssistantContext } from '../../lib/assistant-context';
import { useAiStore } from '../../stores/ai-store';
import { useAssistantStore } from '../../stores/assistant-store';
import { useGameStore } from '../../stores/game-store';
import { AIConfigForm } from './AIConfigForm';
import { AIPanel } from './AIPanel';
import { AssistantPlayerRow } from './AssistantPlayerRow';
import { NotesPanel } from './NotesPanel';

const SEATS = Array.from({ length: ASSISTANT_SEAT_COUNT }, (_, index) => index + 1);

const TEXTAREA_CLASS =
  'mt-1 w-full resize-y rounded-xl border border-line-strong bg-surface-2 p-2.5 text-sm leading-6 text-parchment placeholder:text-faint focus:border-gold focus:outline-none';

export function AssistantScreen() {
  const initialized = useAssistantStore((state) => state.initialized);
  const record = useAssistantStore((state) => state.record);
  const storageError = useAssistantStore((state) => state.storageError);
  const init = useAssistantStore((state) => state.init);
  const setRole = useAssistantStore((state) => state.setRole);
  const setRound = useAssistantStore((state) => state.setRound);
  const toggleAlive = useAssistantStore((state) => state.toggleAlive);
  const toggleTag = useAssistantStore((state) => state.toggleTag);
  const setInfo = useAssistantStore((state) => state.setInfo);
  const setSpeech = useAssistantStore((state) => state.setSpeech);
  const setPublicEvents = useAssistantStore((state) => state.setPublicEvents);
  const setFreeText = useAssistantStore((state) => state.setFreeText);
  const flushSave = useAssistantStore((state) => state.flushSave);
  const clearRecord = useAssistantStore((state) => state.clearRecord);
  const retrySave = useAssistantStore((state) => state.retrySave);
  const goHome = useGameStore((state) => state.goHome);
  const aiConfigLoaded = useAiStore((state) => state.configLoaded);
  const aiStatus = useAiStore((state) => state.status);
  const aiConfig = useAiStore((state) => state.config);
  const aiHasKey = useAiStore((state) => state.hasKey);
  const aiResult = useAiStore((state) => state.result);
  const aiErrorCode = useAiStore((state) => state.errorCode);
  const aiErrorMessage = useAiStore((state) => state.errorMessage);
  const initAi = useAiStore((state) => state.init);
  const saveAiConfig = useAiStore((state) => state.saveConfig);
  const clearAiConfig = useAiStore((state) => state.clearConfig);
  const analyzeAi = useAiStore((state) => state.analyze);
  const cancelAi = useAiStore((state) => state.cancel);

  const [clearOpen, setClearOpen] = useState(false);
  const [tab, setTab] = useState<'record' | 'notes'>('record');

  useEffect(() => {
    void init();
    void initAi();
  }, [init, initAi]);

  useEffect(
    () => () => {
      void flushSave();
    },
    [flushSave],
  );

  const preview = useMemo(() => buildAssistantContext(record), [record]);
  const role = record.roleId ? ROLE_DEFINITIONS[record.roleId] : null;
  const guide = record.roleId ? getRoleGuide(record.roleId) : null;

  if (!initialized) {
    return (
      <div className="screen-body">
        <div className="placeholder-card">
          <p className="text-sm text-muted">正在读取助手记录…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-body pb-32">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">我的助手 · 独立模式</p>
          <h1>我的身份档案</h1>
          <p className="lead">只存在本机；不加入房间也能用。切换页面或刷新后仍保留。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn ghost" onClick={goHome}>
            <ArrowLeft size={16} />
            返回大厅
          </button>
          <button type="button" className="btn danger" onClick={() => setClearOpen(true)}>
            清空当前记录
          </button>
        </div>
      </div>

      {storageError ? (
        <div className="warn-strip strong mt-3" role="alert">
          <span className="flex-1">本机保存失败，刷新可能丢失。请勿关闭页面。</span>
          <button type="button" className="btn ghost" onClick={retrySave}>
            重试
          </button>
        </div>
      ) : null}

      <div className="mt-6 flex gap-2" role="tablist" aria-label="助手视图">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'record'}
          className={`btn ${tab === 'record' ? 'primary' : 'ghost'}`}
          onClick={() => setTab('record')}
        >
          记录
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notes'}
          className={`btn ${tab === 'notes' ? 'primary' : 'ghost'}`}
          onClick={() => setTab('notes')}
        >
          笔记
        </button>
      </div>

      {tab === 'notes' ? (
        <div className="mt-4 max-w-3xl">
          <NotesPanel />
        </div>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div className="min-w-0">
            <section className="card">
              <div className="card-head">
                <h3>我的身份</h3>
                <span className="hint">可自选</span>
              </div>

              {role ? (
                <div className="identity-card" data-camp={role.camp}>
                  <div className="flex items-center gap-3">
                    <RoleAvatar roleId={role.id} size={52} />
                    <div>
                      <p className="role-name">{role.name}</p>
                      <span className="camp">{role.camp === 'wolf' ? '狼人阵营' : '好人阵营'}</span>
                    </div>
                  </div>
                  <p className="skill">{role.skill}</p>
                </div>
              ) : (
                <p className="text-sm text-muted">尚未选择身份。选择后显示技能与身份攻略。</p>
              )}

              <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="选择我的身份">
                {ROLE_GUIDES.map((item) => {
                  const definition = ROLE_DEFINITIONS[item.roleId];
                  const selected = record.roleId === item.roleId;
                  return (
                    <button
                      key={item.roleId}
                      type="button"
                      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11.5px] ${
                        selected
                          ? 'border-gold bg-gold/10 text-gold-soft'
                          : 'border-line bg-surface-2 text-muted'
                      }`}
                      aria-pressed={selected}
                      onClick={() => setRole(selected ? null : item.roleId)}
                    >
                      <RoleAvatar roleId={item.roleId} size={26} />
                      <span>{definition.name}</span>
                    </button>
                  );
                })}
              </div>

              {guide ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-gold-soft">常见打法</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-6 text-muted">
                      {guide.tactics.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gold-soft">易错点</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-6 text-muted">
                      {guide.mistakes.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="card">
              <div className="card-head">
                <h3>局势</h3>
                <span className="hint">手动录入</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-parchment">轮次</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="btn ghost"
                    aria-label="上一轮"
                    disabled={record.round <= 1}
                    onClick={() => setRound(record.round - 1)}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="min-w-16 text-center font-mono text-sm text-gold-soft">
                    第 {record.round} 轮
                  </span>
                  <button
                    type="button"
                    className="btn ghost"
                    aria-label="下一轮"
                    disabled={record.round >= ASSISTANT_MAX_ROUND}
                    onClick={() => setRound(record.round + 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="divider" />

              <div className="card-head">
                <h3>存活</h3>
                <span className="hint">
                  {record.aliveSeats.length} / {ASSISTANT_SEAT_COUNT}
                </span>
              </div>
              <div
                className="grid grid-cols-4 gap-1.5 min-[390px]:grid-cols-6"
                role="group"
                aria-label="存活座位"
              >
                {SEATS.map((seatNo) => {
                  const alive = record.aliveSeats.includes(seatNo);
                  return (
                    <button
                      key={seatNo}
                      type="button"
                      className={`min-h-11 rounded-lg border font-mono text-sm ${
                        alive
                          ? 'border-good/40 bg-good/10 text-[#9fe0c4]'
                          : 'border-line bg-surface-2 text-faint line-through'
                      }`}
                      aria-pressed={alive}
                      aria-label={`${seatNo} 号${alive ? '存活' : '出局'}`}
                      onClick={() => toggleAlive(seatNo)}
                    >
                      {seatNo}
                    </button>
                  );
                })}
              </div>

              <label className="mt-3 block text-[11.5px] text-faint">
                公开事件
                <textarea
                  aria-label="公开事件"
                  value={record.publicEvents}
                  onChange={(event) => setPublicEvents(event.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="死讯、放逐、自爆、警徽等公开信息"
                  className={TEXTAREA_CLASS}
                />
              </label>
            </section>
          </div>

          <div>
            <section className="card">
              <div className="card-head">
                <h3>玩家标签与记录</h3>
                <span className="hint">1–12 号</span>
              </div>
              <div className="space-y-3">
                {SEATS.map((seatNo) => (
                  <AssistantPlayerRow
                    key={seatNo}
                    seatNo={seatNo}
                    player={record.players[seatNo] ?? createEmptyPlayerRecord()}
                    round={record.round}
                    onToggleTag={(tag) => toggleTag(seatNo, tag)}
                    onInfoChange={(value) => setInfo(seatNo, value)}
                    onSpeechChange={(value) => setSpeech(seatNo, value)}
                  />
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h3>AI 上下文预览</h3>
                <span className="hint">{preview.length} 字</span>
              </div>
              <p className="text-xs text-faint">将发送以下内容</p>
              <div
                role="region"
                aria-label="AI 上下文预览内容"
                className="mt-2 max-h-80 overflow-auto rounded-xl border border-line bg-surface-2 p-3 text-xs leading-6 whitespace-pre-wrap text-muted"
              >
                {preview.text}
              </div>
              {preview.truncated ? (
                <p className="mt-2 text-xs text-danger">
                  内容超过 {ASSISTANT_CONTEXT_LIMIT} 字，发送时将截断。
                </p>
              ) : null}

              <label className="mt-3 block text-[11.5px] text-faint">
                自由描述
                <textarea
                  aria-label="自由描述"
                  value={record.freeText}
                  onChange={(event) => setFreeText(event.target.value)}
                  rows={3}
                  maxLength={ASSISTANT_FREE_TEXT_LIMIT}
                  placeholder="补充你想让军师关注的信息"
                  className={TEXTAREA_CLASS}
                />
              </label>

              <p className="mt-2 text-[11.5px] text-faint">
                上下文将发往你自配的第三方模型；Key 默认仅本次会话使用。
              </p>
            </section>

            <AIConfigForm
              config={aiConfig}
              hasKey={aiHasKey}
              onSave={saveAiConfig}
              onClear={clearAiConfig}
            />

            <AIPanel
              status={aiStatus}
              configLoaded={aiConfigLoaded}
              result={aiResult}
              errorCode={aiErrorCode}
              errorMessage={aiErrorMessage}
              onAnalyze={() => void analyzeAi(preview.text)}
              onCancel={cancelAi}
            />
          </div>
        </div>
      )}

      <BottomTabs active="assistant" />

      <ConfirmDialog
        open={clearOpen}
        title="清空当前记录"
        description="将清除本机的身份、标签、信息与发言要点；规则内容不受影响。"
        confirmLabel="清除"
        danger
        onConfirm={() => {
          clearRecord();
          toast('已清空助手记录');
        }}
        onOpenChange={setClearOpen}
      />
    </div>
  );
}

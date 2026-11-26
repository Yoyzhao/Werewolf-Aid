import { CheckCircle2, ShieldOff, Target, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSeat, type Ballot } from '@lrs/game-engine';
import { toast } from 'sonner';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DaySubFlow } from '../../components/DaySubFlow';
import { FlowBar } from '../../components/FlowBar';
import { SeatGrid, type SeatItem } from '../../components/SeatGrid';
import { UndoButton } from '../../components/UndoButton';
import { useGameStore } from '../../stores/game-store';

type VoteMode = 'single' | 'quick';

function tallyBallots(ballots: readonly Ballot[]): { target: number; total: number }[] {
  const totals = new Map<number, number>();
  for (const ballot of ballots) {
    if (ballot.target === null) continue;
    totals.set(ballot.target, (totals.get(ballot.target) ?? 0) + ballot.weight);
  }
  return [...totals.entries()]
    .map(([target, total]) => ({ target, total }))
    .sort((left, right) => right.total - left.total || left.target - right.target);
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function VoteScreen() {
  const game = useGameStore((state) => state.game);
  const dispatch = useGameStore((state) => state.dispatch);

  const [mode, setMode] = useState<VoteMode>('single');
  const [activeVoter, setActiveVoter] = useState<number | null>(null);
  const [quickTarget, setQuickTarget] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hunterTarget, setHunterTarget] = useState<number | null>(null);
  const [badgeTarget, setBadgeTarget] = useState<number | null>(null);
  const [destroyOpen, setDestroyOpen] = useState(false);

  const voteRound = game?.voteRound;

  useEffect(() => {
    setActiveVoter(null);
    setQuickTarget(null);
  }, [voteRound]);

  if (!game || (game.phase !== 'VOTE' && game.phase !== 'SETTLE')) {
    return (
      <div className="screen-body">
        <div className="placeholder-card">
          <h2>当前不在投票阶段</h2>
          <p className="mt-2 text-sm text-muted">请从首页继续上一局，或重新开局。</p>
        </div>
      </div>
    );
  }

  const firstDay = game.round === 1 && game.options.sheriffElection;

  if (game.phase === 'SETTLE') {
    const exiledSeat = game.exiledSeat === null ? undefined : getSeat(game, game.exiledSeat);
    const idiotRevealed = Boolean(exiledSeat && exiledSeat.alive && exiledSeat.idiotRevealed);
    const blocked = game.pendingHunterNo !== null || game.pendingBadge;
    const aliveItems: SeatItem[] = game.seats.map((seat) => ({
      no: seat.no,
      label: seat.alive ? '在场' : '出局',
      dead: !seat.alive,
      current:
        (game.pendingHunterNo !== null && hunterTarget === seat.no) ||
        (game.pendingBadge && badgeTarget === seat.no),
    }));

    return (
      <>
        <div className="screen-body">
          <p className="eyebrow">第 {game.round} 天 · 放逐结算</p>
          <h1>放逐结果</h1>
          <p className="lead">白痴翻牌、猎人开枪、警徽流转处理完成后检查胜负。</p>

          <FlowBar view="vote" />
          <DaySubFlow view="vote" firstDay={firstDay} />

          <section className="dawn-banner">
            <p className="eyebrow">本轮放逐</p>
            {!exiledSeat ? (
              <>
                <h2>本轮无人出局</h2>
                <p>平票再平或全票弃票，直接进入下一夜。</p>
              </>
            ) : (
              <>
                <h2>{exiledSeat.no} 号被放逐</h2>
                {idiotRevealed ? (
                  <p className="text-gold">白痴翻牌：免死、保留发言、失去投票权。</p>
                ) : (
                  <p>身份将在结算页统一揭晓。</p>
                )}
              </>
            )}
          </section>

          {!game.exileResolved && exiledSeat ? (
            <section className="card">
              <div className="card-head">
                <h3>放逐结算</h3>
                <span className="hint">待确认</span>
              </div>
              <p className="sub-line mb-3">确认放逐结果后处理技能与警徽。</p>
              <button
                type="button"
                className="btn primary w-full"
                onClick={() => dispatch({ type: 'RESOLVE_EXILE' })}
              >
                结算放逐
              </button>
            </section>
          ) : null}

          {game.pendingHunterNo !== null ? (
            <section className="card">
              <div className="card-head">
                <h3 className="flex items-center gap-2">
                  <Target size={16} /> 猎人开枪
                </h3>
                <span className="hint">{game.pendingHunterNo} 号被放逐</span>
              </div>
              <p className="sub-line mb-2">选择一名存活玩家带走，或跳过。</p>
              <SeatGrid
                items={aliveItems}
                onSelect={(seatNo) => setHunterTarget(seatNo)}
                ariaLabel="猎人开枪目标"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn primary flex-1"
                  disabled={hunterTarget === null}
                  onClick={() => {
                    if (hunterTarget === null) return;
                    dispatch({ type: 'HUNTER_SHOOT', target: hunterTarget });
                    setHunterTarget(null);
                  }}
                >
                  确认开枪
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => dispatch({ type: 'HUNTER_SHOOT', target: null })}
                >
                  跳过
                </button>
              </div>
            </section>
          ) : null}

          {game.pendingBadge ? (
            <section className="card">
              <div className="card-head">
                <h3>警徽处理</h3>
                <span className="hint">警长已出局</span>
              </div>
              <p className="sub-line mb-2">选择一名存活玩家继任，或撕毁警徽。</p>
              <SeatGrid
                items={aliveItems}
                onSelect={(seatNo) => setBadgeTarget(seatNo)}
                ariaLabel="警徽继任目标"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn primary flex-1"
                  disabled={badgeTarget === null}
                  onClick={() => {
                    if (badgeTarget === null) return;
                    dispatch({ type: 'BADGE_TRANSFER', target: badgeTarget });
                    setBadgeTarget(null);
                  }}
                >
                  移交警徽
                </button>
                <button type="button" className="danger-link" onClick={() => setDestroyOpen(true)}>
                  <ShieldOff size={15} className="mr-1 inline" />
                  撕毁
                </button>
              </div>
            </section>
          ) : null}

          <p className="mt-3 text-xs text-faint">
            放逐后先处理技能与警徽；胜负成立时直接进入结算页。
          </p>
        </div>

        <div className="actionbar">
          <div className="actionbar-in">
            <UndoButton />
            <button
              type="button"
              className="btn primary"
              disabled={blocked}
              onClick={() => dispatch({ type: 'SETTLE_DONE' })}
            >
              {blocked ? '先处理技能与警徽' : '结束放逐，检查胜负'}
            </button>
          </div>
        </div>

        <ConfirmDialog
          open={destroyOpen}
          title="撕毁警徽"
          description="撕毁后本局不再有警长，放逐票不再有 1.5 权重。确定吗？"
          confirmLabel="确认撕毁"
          danger
          onConfirm={() => dispatch({ type: 'BADGE_DESTROY' })}
          onOpenChange={setDestroyOpen}
        />
      </>
    );
  }

  const voters = game.seats.filter((seat) => seat.alive && !seat.idiotRevealed);
  const aliveTargets = game.seats.filter((seat) => seat.alive && !seat.idiotRevealed);
  const voteTargets =
    game.voteRound === 2
      ? aliveTargets.filter((seat) => game.pkCandidates.includes(seat.no))
      : aliveTargets;
  const recorded = new Map(game.ballots.map((ballot) => [ballot.voter, ballot.target]));
  const missing = voters.filter((voter) => !recorded.has(voter.no));
  const active =
    activeVoter !== null && voters.some((voter) => voter.no === activeVoter)
      ? activeVoter
      : (missing[0]?.no ?? voters[0]?.no ?? null);
  const activeTarget = active === null ? undefined : recorded.get(active);
  const tallies = tallyBallots(game.ballots);
  const abstain = game.ballots.filter((ballot) => ballot.target === null).length;
  const maxTotal = Math.max(0, ...tallies.map((item) => item.total));
  const canClose = voters.length === 0 || missing.length === 0;

  const assign = (target: number | null): void => {
    if (active === null) return;
    const result = dispatch({ type: 'RECORD_BALLOT', voter: active, target });
    if (!result.ok) return;
    const nextRecorded = new Set(result.state.ballots.map((ballot) => ballot.voter));
    const nextVoter = voters.find((voter) => voter.no !== active && !nextRecorded.has(voter.no));
    setActiveVoter(nextVoter?.no ?? active);
  };

  const fillMissing = (target: number | null): void => {
    for (const voter of missing) {
      dispatch({ type: 'RECORD_BALLOT', voter: voter.no, target });
    }
  };

  const submitVote = (): void => {
    const result = dispatch({ type: 'VOTE_CLOSE' });
    if (result.ok && result.state.phase === 'VOTE' && result.state.voteRound === 2) {
      toast.info('平票，进入 PK 复投');
    }
  };

  return (
    <>
      <div className="screen-body">
        <p className="eyebrow">
          第 {game.round} 天 · 投票 · 第 {game.voteRound} 轮
        </p>
        <h1>放逐投票</h1>
        <p className="lead">
          逐票录入或快速归票；警长 1.5 票，弃票不计入最高票，平票进入 PK 复投。
        </p>

        <FlowBar view="vote" />
        <DaySubFlow view="vote" firstDay={firstDay} />

        {game.voteRound === 2 ? (
          <section className="dawn-banner">
            <p className="eyebrow">平票 PK</p>
            <h2>平票：{game.pkCandidates.join(' 号、')} 号 → 进入 PK 复投</h2>
            <p>仅平票候选人可被投；再平则本轮无人出局。</p>
          </section>
        ) : null}

        <section className="card">
          <div className="card-head">
            <h3>录票方式</h3>
            <span className="hint">
              已录 {game.ballots.length} / {voters.length}
            </span>
          </div>
          <div className="pick-row" role="group" aria-label="录票方式">
            <button
              type="button"
              className="pick-btn"
              aria-pressed={mode === 'single'}
              onClick={() => setMode('single')}
            >
              逐票录入
            </button>
            <button
              type="button"
              className="pick-btn"
              aria-pressed={mode === 'quick'}
              onClick={() => setMode('quick')}
            >
              快速归票
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs text-faint">
            <Users size={14} /> 存活且未翻牌白痴的玩家各一票；警长票按 1.5 计。
          </p>
        </section>

        {mode === 'quick' ? (
          <section className="card">
            <div className="card-head">
              <h3>快速归票</h3>
              <span className="hint">{missing.length} 位未录</span>
            </div>
            <p className="sub-line mb-2">选择目标后，把未录选民一次性归给该目标。</p>
            <div className="flex flex-wrap gap-2">
              {voteTargets.map((seat) => (
                <button
                  key={seat.no}
                  type="button"
                  className="pick-btn"
                  aria-pressed={quickTarget === seat.no}
                  onClick={() => setQuickTarget(seat.no)}
                >
                  {seat.no} 号
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn primary flex-1"
                disabled={quickTarget === null || missing.length === 0}
                onClick={() => {
                  if (quickTarget === null) return;
                  fillMissing(quickTarget);
                }}
              >
                <Zap size={16} />
                {quickTarget === null
                  ? '先选择归票目标'
                  : `归票给 ${quickTarget} 号（${missing.length} 人）`}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={missing.length === 0}
                onClick={() => {
                  fillMissing(null);
                  setQuickTarget(null);
                }}
              >
                未录选民弃票
              </button>
            </div>
          </section>
        ) : (
          <section className="card">
            <div className="card-head">
              <h3>逐票录入</h3>
              <span className="hint">{active === null ? '无选民' : `当前 ${active} 号`}</span>
            </div>
            <p className="sub-line mb-2">按选民顺序点选目标；点选民行可修改已录票。</p>
            <div>
              {voters.map((voter) => {
                const hasBallot = recorded.has(voter.no);
                const target = recorded.get(voter.no);
                const isSheriff = voter.no === game.sheriffNo;
                return (
                  <button
                    key={voter.no}
                    type="button"
                    className="ballot-row ballot-pick"
                    data-active={voter.no === active}
                    onClick={() => setActiveVoter(voter.no)}
                  >
                    <span className="ballot-voter">
                      {voter.no} 号
                      {isSheriff ? <span className="badge-mini ml-1">警长</span> : null}
                    </span>
                    <span className="grow text-left text-xs">
                      {hasBallot ? (
                        target === null ? (
                          <span className="text-faint">弃票</span>
                        ) : (
                          <span className="text-good">投 {target} 号</span>
                        )
                      ) : (
                        <span className="text-faint">未录票</span>
                      )}
                    </span>
                    <span className="text-xs text-faint">{isSheriff ? '1.5 票' : '1 票'}</span>
                  </button>
                );
              })}
            </div>

            <div className="divider" />

            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs text-faint">
                {active === null ? '没有可录票的选民' : `${active} 号投给`}
              </span>
              {activeTarget !== undefined ? (
                <span className="text-xs text-good">
                  {activeTarget === null ? '已记弃票' : `已记 ${activeTarget} 号`}
                </span>
              ) : null}
            </div>
            <div className="ballot-targets" role="group" aria-label="投票目标">
              {voteTargets.map((seat) => (
                <button
                  key={seat.no}
                  type="button"
                  className="ballot-chip"
                  aria-pressed={activeTarget === seat.no}
                  disabled={active === null}
                  onClick={() => assign(seat.no)}
                >
                  投 {seat.no}
                </button>
              ))}
              <button
                type="button"
                className="ballot-chip"
                aria-pressed={activeTarget === null}
                disabled={active === null}
                onClick={() => assign(null)}
              >
                弃票
              </button>
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <h3>票数汇总</h3>
            <span className="hint">{game.ballots.length} 票已录</span>
          </div>
          {tallies.length === 0 ? (
            <p className="text-sm text-faint">尚未产生有效票；弃票不计入最高票。</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tallies.map((item) => (
                <span key={item.target} className="chip" data-leader={item.total === maxTotal}>
                  {item.target} 号 · {formatWeight(item.total)} 票
                </span>
              ))}
              {abstain > 0 ? (
                <span className="chip">
                  <CheckCircle2 size={12} className="mr-1 inline" />
                  弃票 {abstain}
                </span>
              ) : null}
            </div>
          )}
          {game.voteRound === 2 ? (
            <p className="mt-2 text-xs text-faint">PK 轮仅统计平票候选人得票。</p>
          ) : null}
        </section>
      </div>

      <div className="actionbar">
        <div className="actionbar-in">
          <UndoButton />
          <button
            type="button"
            className="btn primary"
            disabled={!canClose}
            onClick={() => setConfirmOpen(true)}
          >
            {canClose ? '放逐并检查胜负' : `还有 ${missing.length} 位未录票`}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="放逐并检查胜负"
        description="提交后将统计票数并放逐最高票；平票进入 PK 复投。确定提交吗？"
        confirmLabel="放逐并检查胜负"
        danger
        onConfirm={submitVote}
        onOpenChange={setConfirmOpen}
      />
    </>
  );
}

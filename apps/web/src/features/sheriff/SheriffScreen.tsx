import { Flame, Megaphone, Vote } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getBoard } from '@lrs/game-engine';

import { DaySubFlow } from '../../components/DaySubFlow';
import { FlowBar } from '../../components/FlowBar';
import { SeatGrid, type SeatItem } from '../../components/SeatGrid';
import { UndoButton } from '../../components/UndoButton';
import { useGameStore } from '../../stores/game-store';

import { SelfExplodeDialog, SelfExplodePanel } from '../shared/SelfExplode';

const STAGE_LABELS = {
  signup: '上警报名',
  speech: '竞选发言',
  withdraw: '退水',
  vote: '警下投票',
  pk: '平票 PK',
  done: '竞选结果',
} as const;

export function SheriffScreen() {
  const game = useGameStore((state) => state.game);
  const boardId = useGameStore((state) => state.boardId);
  const dispatch = useGameStore((state) => state.dispatch);

  const [candidates, setCandidates] = useState<number[]>([]);
  const [withdrawn, setWithdrawn] = useState<number[]>([]);
  const [ballots, setBallots] = useState<Record<number, number | null>>({});
  const [spoken, setSpoken] = useState<number[]>([]);
  const [explodeOpen, setExplodeOpen] = useState(false);

  const stageKey = game?.sheriffElection?.stage;

  useEffect(() => {
    setBallots({});
  }, [stageKey]);

  if (!game || (game.phase !== 'SHERIFF' && game.phase !== 'SELF_EXPLODE')) {
    return (
      <div className="screen-body">
        <div className="placeholder-card">
          <h2>当前不在竞选阶段</h2>
        </div>
      </div>
    );
  }

  if (game.phase === 'SELF_EXPLODE') {
    return <SelfExplodePanel />;
  }

  const election = game.sheriffElection;
  if (!election) return null;
  const stage = election.stage;

  const board = getBoard(boardId);
  const firstDay = game.round === 1 && game.options.sheriffElection;
  const aliveSeats = game.seats.filter((seat) => seat.alive);
  const seatItems: SeatItem[] = game.seats.map((seat) => ({
    no: seat.no,
    label: !seat.alive ? '出局' : '在场',
    current: candidates.includes(seat.no),
    dead: !seat.alive,
  }));

  const remainingCandidates = election.candidates.filter(
    (seatNo) => !election.withdrawn.includes(seatNo),
  );
  const voters = aliveSeats.filter((seat) => !election.candidates.includes(seat.no));
  const voteTargets = stage === 'pk' ? election.pkCandidates : remainingCandidates;

  const toggleCandidate = (seatNo: number): void => {
    setCandidates((current) =>
      current.includes(seatNo)
        ? current.filter((item) => item !== seatNo)
        : [...current, seatNo].sort((left, right) => left - right),
    );
  };

  const toggleWithdrawn = (seatNo: number): void => {
    setWithdrawn((current) =>
      current.includes(seatNo)
        ? current.filter((item) => item !== seatNo)
        : [...current, seatNo].sort((left, right) => left - right),
    );
  };

  const primaryAction = (): void => {
    if (stage === 'signup') {
      dispatch({ type: 'SHERIFF_SIGNUP', candidates });
    } else if (stage === 'speech') {
      dispatch({ type: 'SHERIFF_SPEECH_DONE' });
    } else if (stage === 'withdraw') {
      dispatch({ type: 'SHERIFF_WITHDRAW', withdrawn });
    } else if (stage === 'vote' || stage === 'pk') {
      dispatch({
        type: 'SHERIFF_VOTE',
        ballots: voters.map((seat) => ({
          voter: seat.no,
          target: ballots[seat.no] ?? null,
          weight: 1,
        })),
      });
    } else if (stage === 'done') {
      dispatch({ type: 'SHERIFF_DONE' });
    }
  };

  const primaryLabel =
    stage === 'signup'
      ? `确认上警（${candidates.length} 人）`
      : stage === 'speech'
        ? '完成竞选发言'
        : stage === 'withdraw'
          ? `确认退水（${withdrawn.length} 人）`
          : stage === 'vote' || stage === 'pk'
            ? '提交警下投票'
            : '公布死讯';

  return (
    <>
      <div className="screen-body">
        <p className="eyebrow">首日 · 警长竞选 · {STAGE_LABELS[stage]}</p>
        <h1>警长竞选</h1>
        <p className="lead">
          报名 → 发言 → 退水 → 警下投票 → 平票 PK；再平则本局无警长。警上玩家无投票权。
        </p>

        <FlowBar view="sheriff" />
        <DaySubFlow view="sheriff" firstDay={firstDay} />

        {stage === 'signup' ? (
          <section className="card">
            <div className="card-head">
              <h3>上警报名</h3>
              <span className="hint">已选 {candidates.length} 人</span>
            </div>
            <p className="sub-line mb-2">点选上警玩家；首夜死者已从可选座位排除。</p>
            <SeatGrid items={seatItems} onSelect={toggleCandidate} ariaLabel="上警报名" />
            <button
              type="button"
              className="btn ghost mt-3"
              onClick={() => dispatch({ type: 'SHERIFF_SIGNUP', candidates: [] })}
            >
              无人上警 · 本局无警长
            </button>
          </section>
        ) : null}

        {stage === 'speech' ? (
          <section className="card">
            <div className="card-head">
              <h3>竞选发言</h3>
              <span className="hint">
                {spoken.length} / {election.candidates.length}
              </span>
            </div>
            <p className="sub-line mb-2">按名单依次发言；打卡仅作主持辅助，不阻塞流程。</p>
            {election.candidates.map((seatNo) => {
              const hasSpoken = spoken.includes(seatNo);
              return (
                <div key={seatNo} className="list-row">
                  <div className="grow">
                    <b>{seatNo} 号</b>
                    <div className="text-xs text-faint">{hasSpoken ? '已发言' : '待发言'}</div>
                  </div>
                  <button
                    type="button"
                    className="pick-btn"
                    aria-pressed={hasSpoken}
                    onClick={() =>
                      setSpoken((current) =>
                        current.includes(seatNo)
                          ? current.filter((item) => item !== seatNo)
                          : [...current, seatNo],
                      )
                    }
                  >
                    {hasSpoken ? '已发言' : '标记发言'}
                  </button>
                </div>
              );
            })}
          </section>
        ) : null}

        {stage === 'withdraw' ? (
          <section className="card">
            <div className="card-head">
              <h3>退水</h3>
              <span className="hint">剩余 {remainingCandidates.length - withdrawn.length} 人</span>
            </div>
            <p className="sub-line mb-2">点选要退水的候选人；无人退水可直接确认。</p>
            <div className="flex flex-wrap gap-2">
              {election.candidates.map((seatNo) => (
                <button
                  key={seatNo}
                  type="button"
                  className="pick-btn"
                  aria-pressed={withdrawn.includes(seatNo)}
                  onClick={() => toggleWithdrawn(seatNo)}
                >
                  {seatNo} 号退水
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {(stage === 'vote' || stage === 'pk') && election ? (
          <section className="card">
            <div className="card-head">
              <h3>{stage === 'pk' ? '平票 PK 复投' : '警下投票'}</h3>
              <span className="hint">{voters.length} 位选民</span>
            </div>
            <p className="sub-line mb-2">
              {stage === 'pk'
                ? '仅平票候选人可被投；再平则本局无警长。'
                : '警上玩家无投票权；弃票不计入最高票。'}
            </p>
            <div>
              {voters.map((voter) => (
                <div key={voter.no} className="ballot-row">
                  <span className="ballot-voter">{voter.no} 号</span>
                  <div className="ballot-targets">
                    {voteTargets.map((target) => (
                      <button
                        key={target}
                        type="button"
                        className="ballot-chip"
                        aria-pressed={ballots[voter.no] === target}
                        onClick={() =>
                          setBallots((current) => ({ ...current, [voter.no]: target }))
                        }
                      >
                        投 {target}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="ballot-chip"
                      aria-pressed={ballots[voter.no] === null || ballots[voter.no] === undefined}
                      onClick={() => setBallots((current) => ({ ...current, [voter.no]: null }))}
                    >
                      弃票
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-faint">
              <Vote size={14} /> 警长竞选阶段所有选票权重为 1。
            </p>
          </section>
        ) : null}

        {stage === 'done' ? (
          <section className="dawn-banner">
            <p className="eyebrow">竞选结果</p>
            <h2>{election.elected === null ? '本局无警长' : `${election.elected} 号当选警长`}</h2>
            <p>
              {election.elected === null
                ? '警徽流失；进入死讯阶段。'
                : '警长放逐票按 1.5 计，并负责最后发言与归票。'}
            </p>
          </section>
        ) : null}

        {stage !== 'done' ? (
          <button type="button" className="danger-link mt-3" onClick={() => setExplodeOpen(true)}>
            <Flame size={15} className="mr-1 inline" />
            狼人自爆
          </button>
        ) : null}

        <div className="rail-card mt-4 hidden lg:block">
          <div className="card-head">
            <h3>竞选信息</h3>
            <span className="hint">{board.name}</span>
          </div>
          <p className="text-xs leading-6 text-faint">
            报名 {election.candidates.length} 人 · 退水 {election.withdrawn.length} 人 · 当选{' '}
            {election.elected ?? '无'}
          </p>
        </div>
      </div>

      <div className="actionbar">
        <div className="actionbar-in">
          <UndoButton />
          <button
            type="button"
            className="btn primary"
            disabled={stage === 'signup' && candidates.length === 0}
            onClick={primaryAction}
          >
            <Megaphone size={17} />
            {primaryLabel}
          </button>
        </div>
      </div>

      <SelfExplodeDialog open={explodeOpen} onOpenChange={setExplodeOpen} />
    </>
  );
}

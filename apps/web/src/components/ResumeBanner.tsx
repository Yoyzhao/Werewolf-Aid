import type { StoredGameRecord } from '../lib/types';

const PHASE_TEXT: Record<StoredGameRecord['phase'], string> = {
  SETUP: '设置',
  DEAL: '发牌',
  NIGHT: '夜晚',
  SHERIFF: '竞选',
  DAWN: '死讯',
  SPEECH: '发言',
  SELF_EXPLODE: '自爆结算',
  VOTE: '投票',
  SETTLE: '结算',
  CHECK_WIN: '胜负检查',
  RESULT: '已结束',
};

export interface ResumeBannerProps {
  readonly record: StoredGameRecord | null;
  readonly incompatible: boolean;
  readonly onResume: () => void;
  readonly onDiscard: () => void;
}

export function ResumeBanner({ record, incompatible, onResume, onDiscard }: ResumeBannerProps) {
  if (incompatible) {
    return (
      <div className="resume-card" role="alert">
        <div className="grow">
          <strong>本地对局数据版本不兼容</strong>
          <p>需要重新开局；旧数据不会被静默加载。</p>
        </div>
        <button type="button" className="btn" onClick={onDiscard}>
          重新开局
        </button>
      </div>
    );
  }

  if (!record) return null;

  if (record.status === 'finished') {
    return (
      <div className="resume-card">
        <div className="grow">
          <strong>上一局已结束</strong>
          <p>可查看只读结算；清除后删除本局记录，不影响助手记录与 AI 配置。</p>
        </div>
        <button type="button" className="btn ghost" onClick={onDiscard}>
          清除
        </button>
        <button type="button" className="btn primary" onClick={onResume}>
          查看上一局结果
        </button>
      </div>
    );
  }

  return (
    <div className="resume-card">
      <div className="grow">
        <strong>
          继续上一局 · 第 {record.round} 回合 · {PHASE_TEXT[record.phase]}
        </strong>
        <p>已从本机恢复最近一次落库进度。</p>
      </div>
      <button type="button" className="btn ghost" onClick={onDiscard}>
        放弃并清空
      </button>
      <button type="button" className="btn primary" onClick={onResume}>
        继续
      </button>
    </div>
  );
}

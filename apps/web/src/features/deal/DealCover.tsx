import { Eye, Hand, RotateCcw, ShieldQuestion } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DealMode, RoleId } from '@lrs/game-engine';

import { RoleAvatar } from '../../components/RoleAvatar';
import { roleCamp, roleName, roleSkill } from '../../lib/board';

export interface DealCoverProps {
  readonly mode: Exclude<DealMode, 'C'>;
  readonly seatNo: number;
  readonly roleId: RoleId;
  readonly onAdvance: () => void;
}

export function DealCover({ mode, seatNo, roleId, onAdvance }: DealCoverProps) {
  const [revealed, setRevealed] = useState(false);
  const [remasked, setRemasked] = useState(false);

  useEffect(() => {
    setRevealed(false);
    setRemasked(false);
  }, [seatNo]);

  const isWolf = roleCamp(roleId) === 'wolf';

  return (
    <div className="cover-layer" role="dialog" aria-modal="true" aria-label="身份遮罩">
      <div className="cover-card">
        {!revealed ? (
          <>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-gold">
              <ShieldQuestion size={26} />
            </div>
            <h2>{mode === 'A' ? `请把手机交给 ${seatNo} 号` : `请 ${seatNo} 号确认身份`}</h2>
            <p className="cover-copy">
              {remasked
                ? '已重新遮罩，请交给下一位。'
                : mode === 'A'
                  ? '确认周围无人偷看后，再查看自己的身份。'
                  : '默认遮罩；主持人二次确认后才展示身份。'}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="btn primary w-full"
                onClick={() => setRevealed(true)}
              >
                <Eye size={17} />
                {mode === 'A' ? '查看我的身份' : '显示身份'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">{mode === 'A' ? '仅本人可见' : '主持人二次揭示'}</p>
            <div className="identity-card" data-camp={isWolf ? 'wolf' : 'good'}>
              <RoleAvatar roleId={roleId} size={76} />
              <div className="camp">{isWolf ? '狼人阵营' : '好人阵营'}</div>
              <div className="role-name">{roleName(roleId)}</div>
              <p className="skill">{roleSkill(roleId)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" className="btn primary w-full" onClick={onAdvance}>
                <Hand size={17} />
                {mode === 'A' ? '我已记住，交给下一位' : `${seatNo} 号已确认`}
              </button>
              <button
                type="button"
                className="btn ghost w-full"
                onClick={() => {
                  setRevealed(false);
                  setRemasked(true);
                }}
              >
                <RotateCcw size={15} />
                重新遮罩
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

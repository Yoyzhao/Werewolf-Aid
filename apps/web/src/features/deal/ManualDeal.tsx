import { Eye, Undo2 } from 'lucide-react';
import { useState } from 'react';
import type { BoardId, RoleId } from '@lrs/game-engine';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RoleAvatar } from '../../components/RoleAvatar';
import { SeatGrid, type SeatItem } from '../../components/SeatGrid';
import { assignedCount, remainingRoleCount, roleCamp, roleName, roleSkill } from '../../lib/board';

export interface ManualDealProps {
  readonly boardId: BoardId;
  readonly assignments: Readonly<Record<number, RoleId>>;
  readonly roles: readonly { readonly roleId: RoleId; readonly count: number }[];
  readonly onAssign: (roleId: RoleId) => void;
  readonly onUndo: () => void;
}

export function ManualDeal({ boardId, assignments, roles, onAssign, onUndo }: ManualDealProps) {
  const [peekOpen, setPeekOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const used = assignedCount(assignments);
  const complete = used >= 12;
  const currentSeat = Math.min(used + 1, 12);
  const items: SeatItem[] = Array.from({ length: 12 }, (_, index) => {
    const no = index + 1;
    return {
      no,
      label: assignments[no] ? '已录' : '待录',
      done: Boolean(assignments[no]),
      current: no === currentSeat && !complete,
    };
  });

  const goodRoles = roles.filter((item) => roleCamp(item.roleId) !== 'wolf');
  const wolfRoles = roles.filter((item) => roleCamp(item.roleId) === 'wolf');

  const renderGroup = (label: string, group: typeof roles) => (
    <div>
      <p className="mb-2 text-xs text-faint">{label}</p>
      <div className="tag-grid">
        {group.map((item) => {
          const left = remainingRoleCount(boardId, assignments, item.roleId);
          return (
            <button
              key={item.roleId}
              type="button"
              className="tag"
              data-camp={roleCamp(item.roleId)}
              disabled={left <= 0 || complete}
              title={roleSkill(item.roleId)}
              onClick={() => onAssign(item.roleId)}
            >
              <RoleAvatar roleId={item.roleId} size={22} />
              {roleName(item.roleId)} · 余 {left}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="card">
      <div className="card-head">
        <h3>实体牌录入</h3>
        <span className="hint">{used} / 12</span>
      </div>
      <p className="mb-3 text-[12.5px] text-faint">
        线下发牌后，主持人按 1→12 手动选择身份；玩家不看屏，系统只做主持与判定。
      </p>

      <SeatGrid items={items} ariaLabel="实体牌录入进度" />

      <div className="divider" />

      {complete ? (
        <>
          <p className="role-line">12 位身份已录入完成</p>
          <p className="sub-line">角色构成由余量控制；完成发牌时会再次校验。</p>
        </>
      ) : (
        <>
          <p className="role-line">请为 {currentSeat} 号手动选择身份</p>
          <p className="sub-line">对照实体牌点选；已录明细默认不展示。</p>
          <div className="mt-3 flex flex-col gap-3">
            {renderGroup('好人阵营', goodRoles)}
            {renderGroup('狼人阵营', wolfRoles)}
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn ghost" disabled={used <= 0} onClick={onUndo}>
          <Undo2 size={15} />
          撤销上一位
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => (peekOpen ? setPeekOpen(false) : setConfirmOpen(true))}
        >
          <Eye size={15} />
          {peekOpen ? '收起核对' : '核对已录（防窥）'}
        </button>
      </div>

      {peekOpen ? (
        <div className="peek-list mt-3" aria-label="已录身份核对">
          {used === 0 ? (
            <span className="chip">暂无已录身份</span>
          ) : (
            Object.entries(assignments).map(([seatNo, roleId]) => (
              <span key={seatNo} className="chip">
                {seatNo} 号 {roleName(roleId)}
              </span>
            ))
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="核对已录身份"
        description="将显示 1–12 号已录身份，请先遮挡屏幕，避免玩家看到。"
        confirmLabel="显示"
        onConfirm={() => setPeekOpen(true)}
        onOpenChange={setConfirmOpen}
      />
    </section>
  );
}

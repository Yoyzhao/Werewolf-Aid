import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { useGameStore } from '../stores/game-store';

import { ConfirmDialog } from './ConfirmDialog';

export function UndoButton() {
  const canUndo = useGameStore(
    (state) => state.history.length > 0 && state.game !== null && state.game.phase !== 'RESULT',
  );
  const undoStep = useGameStore((state) => state.undoStep);
  const [open, setOpen] = useState(false);

  if (!canUndo) return null;

  return (
    <>
      <button type="button" className="btn ghost" onClick={() => setOpen(true)}>
        <RotateCcw size={15} />
        回退一步
      </button>
      <ConfirmDialog
        open={open}
        title="回退一步"
        description="撤销上一步并恢复本地状态；不会产生重复记录。确定回退吗？"
        confirmLabel="回退"
        danger
        onConfirm={undoStep}
        onOpenChange={setOpen}
      />
    </>
  );
}

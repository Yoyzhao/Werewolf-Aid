import * as Dialog from '@radix-ui/react-dialog';

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(420px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line-strong bg-surface p-5 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-parchment">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted">
            {description}
          </Dialog.Description>
          <div className="mt-5 flex gap-2.5">
            <Dialog.Close asChild>
              <button type="button" className="btn ghost flex-1">
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={`btn flex-1 ${danger ? 'danger' : 'primary'}`}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

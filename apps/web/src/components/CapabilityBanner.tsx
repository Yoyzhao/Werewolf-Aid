import { AlertTriangle, X } from 'lucide-react';
import { useMemo } from 'react';

import { capabilityWarning, detectCapabilities } from '../lib/capabilities';

export interface CapabilityBannerProps {
  readonly dismissed: boolean;
  readonly onDismiss: () => void;
}

export function CapabilityBanner({ dismissed, onDismiss }: CapabilityBannerProps) {
  const warning = useMemo(() => capabilityWarning(detectCapabilities()), []);

  if (dismissed || !warning) return null;

  return (
    <div className="warn-strip" role="status">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{warning}</span>
      <button
        type="button"
        className="shrink-0 text-faint hover:text-parchment"
        onClick={onDismiss}
        aria-label="知道了"
      >
        <X size={16} />
      </button>
    </div>
  );
}

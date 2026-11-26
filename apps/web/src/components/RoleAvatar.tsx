import type { CSSProperties } from 'react';
import type { RoleId } from '@lrs/game-engine';

import { roleCamp } from '../lib/board';

const ROLE_PATHS: Record<RoleId, string> = {
  SEER: '<path d="M6 24s7-10 18-10 18 10 18 10-7 10-18 10S6 24 6 24Z"/><circle cx="24" cy="24" r="5"/><path d="M24 6v3M38 10l-2 2"/>',
  WITCH:
    '<path d="M20 8h8M22 8v9L15 29a8 8 0 0 0 7 12h4a8 8 0 0 0 7-12l-7-12V8"/><path d="M18 32h12"/><circle cx="24" cy="36" r="1.6" fill="currentColor"/>',
  HUNTER:
    '<path d="M12 10c14 0 26 12 26 26"/><path d="M12 10v26h26"/><path d="m16 32 16-16M28 16h4v4"/>',
  GUARD:
    '<path d="M24 6 40 12v11c0 10-7 16-16 19-9-3-16-9-16-19V12Z"/><path d="M24 17v9M24 30h.01"/>',
  IDIOT:
    '<path d="M12 32c0-9 5-16 12-16s12 7 12 16"/><path d="M11 32h26l-4 7H15Z"/><circle cx="12" cy="18" r="3"/><circle cx="36" cy="18" r="3"/><circle cx="24" cy="12" r="3"/>',
  VILLAGER:
    '<path d="M24 8c-7 0-12 6-12 13v17h24V21c0-7-5-13-12-13Z"/><path d="M18 38c0-4 3-7 6-7s6 3 6 7"/><path d="M20 21h.01M28 21h.01"/>',
  WOLF: '<path d="M12 10 24 20 36 10l-2 12c0 8-4 14-10 18-6-4-10-10-10-18Z"/><circle cx="20" cy="24" r="1.6" fill="currentColor"/><circle cx="28" cy="24" r="1.6" fill="currentColor"/><path d="M21 31c1.8 1.6 4.2 1.6 6 0"/>',
  WOLF_KING:
    '<path d="M12 10 24 20 36 10l-2 12c0 8-4 14-10 18-6-4-10-10-10-18Z"/><path d="M16 8l4 5 4-6 4 6 4-5"/><circle cx="20" cy="24" r="1.6" fill="currentColor"/><circle cx="28" cy="24" r="1.6" fill="currentColor"/><path d="M21 31c1.8 1.6 4.2 1.6 6 0"/>',
};

export interface RoleAvatarProps {
  readonly roleId: RoleId;
  readonly size?: number;
}

export function RoleAvatar({ roleId, size = 40 }: RoleAvatarProps) {
  return (
    <span
      className="role-avatar"
      data-role={roleId}
      data-camp={roleCamp(roleId)}
      style={{ '--sz': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: ROLE_PATHS[roleId] }}
      />
    </span>
  );
}

export interface SeatItem {
  readonly no: number;
  readonly label?: string;
  readonly current?: boolean;
  readonly done?: boolean;
  readonly dead?: boolean;
}

export interface SeatGridProps {
  readonly items: readonly SeatItem[];
  readonly onSelect?: (seatNo: number) => void;
  readonly ariaLabel?: string;
  readonly className?: string;
}

export function SeatGrid({ items, onSelect, ariaLabel, className }: SeatGridProps) {
  return (
    <div
      className={`seat-grid ${className ?? ''}`}
      role={onSelect ? 'group' : undefined}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const content = (
          <>
            <span className="n">{String(item.no).padStart(2, '0')}</span>
            {item.label ? <span className="r">{item.label}</span> : null}
            {item.current ? <span className="badge">当前</span> : null}
          </>
        );

        if (onSelect) {
          return (
            <button
              key={item.no}
              type="button"
              className="seat"
              data-current={item.current ? 'true' : 'false'}
              data-done={item.done ? 'true' : 'false'}
              disabled={item.dead}
              onClick={() => onSelect(item.no)}
            >
              {content}
            </button>
          );
        }

        return (
          <div
            key={item.no}
            className="seat"
            data-current={item.current ? 'true' : 'false'}
            data-done={item.done ? 'true' : 'false'}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

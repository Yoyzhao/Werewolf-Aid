import type { View } from '../lib/types';

const FIRST_DAY_STEPS = ['竞选', '死讯', '发言', '投票'] as const;
const LATER_DAY_STEPS = ['死讯', '发言', '投票'] as const;

export interface DaySubFlowProps {
  readonly view: Extract<View, 'sheriff' | 'dawn' | 'speech' | 'vote'>;
  readonly firstDay: boolean;
}

export function DaySubFlow({ view, firstDay }: DaySubFlowProps) {
  const steps = firstDay ? FIRST_DAY_STEPS : LATER_DAY_STEPS;
  const active = firstDay
    ? view === 'sheriff'
      ? 0
      : view === 'dawn'
        ? 1
        : view === 'speech'
          ? 2
          : 3
    : view === 'dawn'
      ? 0
      : view === 'speech'
        ? 1
        : 2;

  return (
    <div className="subflow" aria-label="白天子步骤">
      {steps.map((step, index) => (
        <span
          key={step}
          className="subflow-step"
          data-state={index === active ? 'active' : index < active ? 'done' : 'pending'}
        >
          {index + 1} {step}
        </span>
      ))}
    </div>
  );
}

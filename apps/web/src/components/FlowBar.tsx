import type { View } from '../lib/types';

const STEPS = ['设置', '发牌', '夜晚', '白天', '结算'] as const;

type FlowView = Exclude<View, 'home' | 'assistant' | 'rules'>;

const ACTIVE_INDEX: Record<FlowView, number> = {
  setup: 0,
  deal: 1,
  night: 2,
  sheriff: 3,
  dawn: 3,
  speech: 3,
  vote: 3,
  result: 4,
};

export function FlowBar({ view }: { readonly view: FlowView }) {
  const active = ACTIVE_INDEX[view];
  return (
    <nav className="flowbar" aria-label="对局流程">
      {STEPS.map((step, index) => (
        <span
          key={step}
          className="flow-step"
          data-state={index === active ? 'active' : index < active ? 'done' : 'pending'}
        >
          <b>{index < active ? '✓' : index + 1}</b>
          {step}
        </span>
      ))}
    </nav>
  );
}

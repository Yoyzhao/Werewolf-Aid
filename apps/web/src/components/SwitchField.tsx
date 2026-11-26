import * as Switch from '@radix-ui/react-switch';

export interface SwitchFieldProps {
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}

export function SwitchField({ label, description, checked, onCheckedChange }: SwitchFieldProps) {
  return (
    <div className="field">
      <div className="flex-1">
        <span className="lab">{label}</span>
        <span className="sub">{description}</span>
      </div>
      <Switch.Root
        className="switch"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      >
        <Switch.Thumb />
      </Switch.Root>
    </div>
  );
}

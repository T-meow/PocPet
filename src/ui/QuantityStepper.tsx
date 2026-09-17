import { Minus, Plus } from 'lucide-react';
import { t } from '../i18n';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onInputChange?: (value: number) => void;
}

export const QuantityStepper = ({
  value,
  min = 1,
  max = 99,
  disabled = false,
  onChange,
  onInputChange,
}: QuantityStepperProps) => {
  const clamp = (next: number) => Math.max(min, Math.min(max, Math.floor(Number.isFinite(next) ? next : min)));
  const update = (next: number) => onChange(clamp(next));

  return (
    <div className="quantity-stepper" aria-label={t('ui.quantity.aria')}>
      <button
        type="button"
        className="quantity-stepper__button"
        disabled={disabled || value <= min}
        onClick={() => update(value - 1)}
        aria-label={t('ui.quantity.decrease')}
        title={t('ui.quantity.decrease')}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        className="quantity-stepper__input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => (onInputChange ?? onChange)(clamp(Number(event.currentTarget.value)))}
        aria-label={t('ui.quantity.value')}
      />
      <button
        type="button"
        className="quantity-stepper__button"
        disabled={disabled || value >= max}
        onClick={() => update(value + 1)}
        aria-label={t('ui.quantity.increase')}
        title={t('ui.quantity.increase')}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

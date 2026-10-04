import { useEffect, useRef, useState } from 'react';
import type { WompiAcceptance } from '../../types';

interface WompiTermsCheckboxesProps {
  acceptance: WompiAcceptance;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function WompiTermsCheckboxes({
  acceptance,
  checked,
  onChange,
  disabled = false,
}: WompiTermsCheckboxesProps) {
  const [boxes, setBoxes] = useState([false, false]);
  const prevChecked = useRef(checked);

  // Reset the individual boxes only when the parent explicitly clears the
  // combined checked state (e.g. closing/reopening the payment flow).
  useEffect(() => {
    if (prevChecked.current && !checked) {
      setBoxes([false, false]);
    }
    prevChecked.current = checked;
  }, [checked]);

  const toggle = (index: number, value: boolean) => {
    const next = [...boxes];
    next[index] = value;
    setBoxes(next);
    onChange(next.every(Boolean));
  };

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={boxes[0]}
          disabled={disabled}
          onChange={(e) => toggle(0, e.target.checked)}
        />
        <span>
          I accept the{' '}
          <a
            href={acceptance.acceptancePermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Wompi terms and conditions
          </a>
          .
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={boxes[1]}
          disabled={disabled}
          onChange={(e) => toggle(1, e.target.checked)}
        />
        <span>
          I authorize the processing of my personal data as described in the{' '}
          <a
            href={acceptance.personalAuthPermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            privacy authorization
          </a>
          .
        </span>
      </label>
    </div>
  );
}

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils.js';
export function Checkbox({ checked, onChange, className, ...props }) {
  return <CheckboxPrimitive.Root checked={checked} onCheckedChange={next => onChange?.({ target: { checked: next } })} className={cn('library-checkbox', className)} {...props}>
    <CheckboxPrimitive.Indicator><Check size={13} /></CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>;
}

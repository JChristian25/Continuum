import * as React from 'react';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// Keep the existing option-based call sites while Base UI owns interaction and focus.
const Select = React.forwardRef(({ className, children, value, defaultValue, onChange, disabled, required, name, ...props }, ref) => {
  const options = React.Children.toArray(children).filter(React.isValidElement).map(child => ({
    value: child.props.value ?? child.props.children,
    label: child.props.children,
    disabled: child.props.disabled
  }));
  return <SelectPrimitive.Root value={value} defaultValue={defaultValue} disabled={disabled} required={required} name={name} items={options}
    onValueChange={next => onChange?.({ target: { value: next, name }, currentTarget: { value: next, name } })}>
    <SelectPrimitive.Trigger ref={ref} className={cn('select library-select-trigger', className)} {...props}>
      <SelectPrimitive.Value /><SelectPrimitive.Icon><ChevronDown size={14} /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal ><SelectPrimitive.Positioner sideOffset={4} className="library-select-positioner">
      <SelectPrimitive.Popup className="library-select-popup"><SelectPrimitive.List>
        {options.map(option => <SelectPrimitive.Item key={option.value} value={option.value} disabled={option.disabled} className="library-select-item">
          <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
          <SelectPrimitive.ItemIndicator><Check size={14} /></SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>)}
      </SelectPrimitive.List></SelectPrimitive.Popup>
    </SelectPrimitive.Positioner></SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
});
Select.displayName = 'Select';
export { Select };

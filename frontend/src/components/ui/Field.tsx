import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

const CONTROL_BASE =
  'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 transition-colors ' +
  'focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

const CONTROL_NORMAL = 'border-slate-300';
const CONTROL_ERROR = 'border-red-400 focus:border-red-500 focus:ring-red-500/20';

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FieldWrapper({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-500" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-slate-400">Optional</span>
        )}
      </label>
      {children}
      {error ? (
        // role="alert" so the message is announced when validation fails.
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  containerClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, containerClassName, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldWrapper
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(CONTROL_BASE, error ? CONTROL_ERROR : CONTROL_NORMAL, className)}
        {...props}
      />
    </FieldWrapper>
  );
});

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  containerClassName?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, containerClassName, className, id, required, options, placeholder, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldWrapper
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(CONTROL_BASE, error ? CONTROL_ERROR : CONTROL_NORMAL, className)}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
});

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  containerClassName?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField(
    { label, error, hint, containerClassName, className, id, required, rows = 3, ...props },
    ref,
  ) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;

    return (
      <FieldWrapper
        label={label}
        htmlFor={fieldId}
        error={error}
        hint={hint}
        required={required}
        className={containerClassName}
      >
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(CONTROL_BASE, 'resize-y', error ? CONTROL_ERROR : CONTROL_NORMAL, className)}
          {...props}
        />
      </FieldWrapper>
    );
  },
);

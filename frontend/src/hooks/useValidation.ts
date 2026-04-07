/**
 * useValidation Hook - Validación reactiva con Zod
 */

import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { validateForm, getFieldError } from '../schemas/forms';

interface UseValidationOptions<T extends z.ZodTypeAny> {
  schema: T;
  mode?: 'onChange' | 'onBlur' | 'onSubmit';
  reValidateMode?: 'onChange' | 'onBlur';
  defaultValues?: Partial<z.infer<T>>;
}

interface ValidationState<T> {
  data: Partial<T>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isValidating: boolean;
  isDirty: boolean;
}

export function useValidation<T extends z.ZodTypeAny>({
  schema,
  mode = 'onSubmit',
  reValidateMode = 'onChange',
  defaultValues = {},
}: UseValidationOptions<T>) {
  type FormData = z.infer<T>;
  
  const [state, setState] = useState<ValidationState<FormData>>({
    data: defaultValues as Partial<FormData>,
    errors: {},
    touched: {},
    isValid: false,
    isValidating: false,
    isDirty: false,
  });

  // Validate entire form
  const validate = useCallback(
    (data: Partial<FormData> = state.data): boolean => {
      const result = validateForm(data, schema);
      
      if (result.success) {
        setState(prev => ({ ...prev, errors: {}, isValid: true }));
        return true;
      }
      
      setState(prev => ({ ...prev, errors: result.errors, isValid: false }));
      return false;
    },
    [schema, state.data]
  );

  // Validate single field
  const validateField = useCallback(
    (name: string, value: unknown): string | undefined => {
      try {
        // Get field schema if available
        if (schema instanceof z.ZodObject) {
          const fieldSchema = schema.shape[name];
          if (fieldSchema) {
            fieldSchema.parse(value);
            return undefined;
          }
        }
        
        // Fallback: validate entire form and extract field error
        const result = validateForm({ ...state.data, [name]: value }, schema);
        if (!result.success) {
          return result.errors[name];
        }
        
        return undefined;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return error.errors[0]?.message || 'Valor inválido';
        }
        return 'Error de validación';
      }
    },
    [schema, state.data]
  );

  // Set field value
  const setValue = useCallback(
    (name: string, value: unknown, shouldValidate = mode === 'onChange') => {
      setState(prev => {
        const newData = { ...prev.data, [name]: value };
        const newTouched = { ...prev.touched, [name]: true };
        const isDirty = JSON.stringify(newData) !== JSON.stringify(defaultValues);
        
        let errors = prev.errors;
        
        if (shouldValidate || (prev.touched[name] && reValidateMode === 'onChange')) {
          const error = validateField(name, value);
          errors = error
            ? { ...prev.errors, [name]: error }
            : Object.fromEntries(
                Object.entries(prev.errors).filter(([key]) => key !== name)
              );
        }
        
        return {
          ...prev,
          data: newData,
          touched: newTouched,
          errors,
          isDirty,
        };
      });
    },
    [mode, reValidateMode, validateField, defaultValues]
  );

  // Set multiple values
  const setValues = useCallback(
    (values: Partial<FormData>, shouldValidate = false) => {
      setState(prev => {
        const newData = { ...prev.data, ...values };
        const isDirty = JSON.stringify(newData) !== JSON.stringify(defaultValues);
        
        return {
          ...prev,
          data: newData,
          isDirty,
          ...(shouldValidate ? { isValid: validate(newData) } : {}),
        };
      });
    },
    [validate, defaultValues]
  );

  // Mark field as touched
  const setTouched = useCallback(
    (name: string, shouldValidate = mode === 'onBlur') => {
      setState(prev => {
        const newTouched = { ...prev.touched, [name]: true };
        
        let errors = prev.errors;
        if (shouldValidate) {
          const error = validateField(name, prev.data[name as keyof FormData]);
          errors = error
            ? { ...prev.errors, [name]: error }
            : Object.fromEntries(
                Object.entries(prev.errors).filter(([key]) => key !== name)
              );
        }
        
        return { ...prev, touched: newTouched, errors };
      });
    },
    [mode, validateField]
  );

  // Handle submit
  const handleSubmit = useCallback(
    (onValid: (data: FormData) => void | Promise<void>) =>
      async (e?: React.FormEvent) => {
        if (e) {
          e.preventDefault();
        }
        
        setState(prev => ({ ...prev, isValidating: true }));
        
        const isValid = validate();
        
        if (isValid) {
          try {
            await onValid(state.data as FormData);
          } catch (error) {
            console.error('Submit error:', error);
          }
        }
        
        setState(prev => ({ ...prev, isValidating: false }));
      },
    [validate, state.data]
  );

  // Reset form
  const reset = useCallback(
    (values: Partial<FormData> = defaultValues) => {
      setState({
        data: values,
        errors: {},
        touched: {},
        isValid: false,
        isValidating: false,
        isDirty: false,
      });
    },
    [defaultValues]
  );

  // Get field props for easy binding
  const getFieldProps = useCallback(
    (name: string) => ({
      name,
      value: state.data[name as keyof FormData] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValue(name, e.target.value);
      },
      onBlur: () => {
        setTouched(name);
      },
      error: state.errors[name],
      touched: state.touched[name],
    }),
    [state.data, state.errors, state.touched, setValue, setTouched]
  );

  // Get error for field
  const getError = useCallback(
    (name: string) => state.errors[name],
    [state.errors]
  );

  // Check if field has error
  const hasError = useCallback(
    (name: string) => Boolean(state.errors[name] && state.touched[name]),
    [state.errors, state.touched]
  );

  return {
    // State
    data: state.data,
    errors: state.errors,
    touched: state.touched,
    isValid: state.isValid,
    isValidating: state.isValidating,
    isDirty: state.isDirty,
    
    // Methods
    setValue,
    setValues,
    setTouched,
    validate,
    validateField,
    handleSubmit,
    reset,
    getFieldProps,
    getError,
    hasError,
  };
}

/**
 * Simple validation hook for single values
 */
export function useFieldValidation<T extends z.ZodTypeAny>(
  schema: T,
  initialValue?: z.infer<T>
) {
  const [value, setValue] = useState<z.infer<T> | undefined>(initialValue);
  const [error, setError] = useState<string>();
  const [touched, setTouched] = useState(false);

  const validate = useCallback(
    (val: unknown = value) => {
      const result = schema.safeParse(val);
      if (result.success) {
        setError(undefined);
        return true;
      }
      setError(result.error.errors[0]?.message || 'Valor inválido');
      return false;
    },
    [schema, value]
  );

  const handleChange = useCallback(
    (newValue: z.infer<T>) => {
      setValue(newValue);
      if (touched) {
        validate(newValue);
      }
    },
    [touched, validate]
  );

  const handleBlur = useCallback(() => {
    setTouched(true);
    validate();
  }, [validate]);

  return {
    value,
    error,
    touched,
    setValue: handleChange,
    setTouched: handleBlur,
    validate,
    isValid: !error && touched,
  };
}

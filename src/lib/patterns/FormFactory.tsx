/**
 * Form Factory Pattern
 * =====================
 * 
 * Generate type-safe forms from Zod schemas with consistent styling and validation.
 * 
 * Benefits:
 * - Less boilerplate
 * - Consistent validation
 * - Type-safe forms
 * - Reusable field components
 * 
 * Usage:
 * ```typescript
 * import { createForm } from '@/lib/patterns/FormFactory'
 * import { z } from 'zod'
 * 
 * const schema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * })
 * 
 * const LoginForm = createForm(schema, {
 *   onSubmit: async (data) => {
 *     await api.auth.login(data)
 *   },
 * })
 * ```
 */

import { useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { cn } from '@/lib/cn'
import { Loader2 } from 'lucide-react'

/**
 * Field configuration for form generation
 */
export interface FieldConfig {
  label?: string
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'checkbox'
  description?: string
  className?: string
}

/**
 * Form configuration
 */
export interface FormConfig<T extends z.ZodType> {
  schema: T
  onSubmit: (data: z.infer<T>) => Promise<void> | void
  defaultValues?: Partial<z.infer<T>>
  fields?: Partial<Record<keyof z.infer<T>, FieldConfig>>
  submitLabel?: string
  className?: string
}

/**
 * Create a form component from a Zod schema
 */
export function createForm<T extends z.ZodType>(config: FormConfig<T>) {
  return function Form() {
    const {
      register,
      handleSubmit,
      formState: { errors, isSubmitting },
      reset,
    } = useForm<z.infer<T>>({
      resolver: zodResolver(config.schema),
      defaultValues: config.defaultValues as any,
    })

    const onSubmit = async (data: z.infer<T>) => {
      await config.onSubmit(data)
      reset()
    }

    const fields = Object.keys(config.schema.shape) as Array<keyof z.infer<T>>

    return (
      <form onSubmit={handleSubmit(onSubmit)} className={cn('space-y-4', config.className)}>
        {fields.map((fieldName) => {
          const fieldConfig = config.fields?.[fieldName] || {}
          const fieldType = fieldConfig.type || 'text'
          const fieldError = errors[fieldName as string]

          return (
            <div key={String(fieldName)} className="space-y-1">
              {fieldConfig.label && (
                <label htmlFor={String(fieldName)} className="text-sm font-medium">
                  {fieldConfig.label}
                </label>
              )}

              {fieldType === 'textarea' ? (
                <textarea
                  id={String(fieldName)}
                  {...register(String(fieldName) as any)}
                  rows={4}
                  className={cn(
                    'w-full px-3 py-2 rounded-md border bg-background resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-ring',
                    fieldError && 'border-destructive',
                    fieldConfig.className
                  )}
                  placeholder={fieldConfig.placeholder}
                />
              ) : fieldType === 'checkbox' ? (
                <input
                  id={String(fieldName)}
                  type="checkbox"
                  {...register(String(fieldName) as any)}
                  className={cn('rounded', fieldConfig.className)}
                />
              ) : (
                <input
                  id={String(fieldName)}
                  type={fieldType}
                  {...register(String(fieldName) as any)}
                  className={cn(
                    'w-full px-3 py-2 rounded-md border bg-background',
                    'focus:outline-none focus:ring-2 focus:ring-ring',
                    fieldError && 'border-destructive',
                    fieldConfig.className
                  )}
                  placeholder={fieldConfig.placeholder}
                />
              )}

              {fieldConfig.description && (
                <p className="text-xs text-muted-foreground">{fieldConfig.description}</p>
              )}

              {fieldError && <p className="text-sm text-destructive">{fieldError.message as string}</p>}
            </div>
          )
        })}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full px-4 py-2 rounded-md bg-primary text-primary-foreground',
            'hover:bg-primary/90 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-2'
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {config.submitLabel || 'Submitting...'}
            </>
          ) : (
            config.submitLabel || 'Submit'
          )}
        </button>
      </form>
    )
  }
}

/**
 * Reusable form field components
 */
export function FormField({
  label,
  error,
  description,
  required,
  children,
}: {
  label: string
  error?: string
  description?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export function TextField({
  register,
  name,
  type = 'text',
  placeholder,
  error,
  className,
}: {
  register: UseFormReturn<any>['register']
  name: string
  type?: 'text' | 'email' | 'password' | 'number'
  placeholder?: string
  error?: string
  className?: string
}) {
  return (
    <input
      type={type}
      {...register(name)}
      placeholder={placeholder}
      className={cn(
        'w-full px-3 py-2 rounded-md border bg-background',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        error && 'border-destructive',
        className
      )}
    />
  )
}

export function TextAreaField({
  register,
  name,
  rows = 4,
  placeholder,
  error,
  className,
}: {
  register: UseFormReturn<any>['register']
  name: string
  rows?: number
  placeholder?: string
  error?: string
  className?: string
}) {
  return (
    <textarea
      {...register(name)}
      rows={rows}
      placeholder={placeholder}
      className={cn(
        'w-full px-3 py-2 rounded-md border bg-background resize-none',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        error && 'border-destructive',
        className
      )}
    />
  )
}

/**
 * Example Usage
 */
import { z } from 'zod'

// Define schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
})

// Create form component
export const LoginForm = createForm({
  schema: loginSchema,
  onSubmit: async (data) => {
    console.log('Login:', data)
    // await api.auth.login(data)
  },
  fields: {
    email: {
      label: 'Email',
      type: 'email',
      placeholder: 'you@example.com',
    },
    password: {
      label: 'Password',
      type: 'password',
      placeholder: '••••••••',
    },
    rememberMe: {
      label: 'Remember me',
      type: 'checkbox',
    },
  },
  submitLabel: 'Sign In',
})

// Use in component
// <LoginForm />

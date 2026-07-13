import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

// =============================================================================
// Form Schema - Define your validation rules here
// =============================================================================

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

type ContactFormData = z.infer<typeof contactSchema>

// =============================================================================
// Example Form Component
// =============================================================================

interface ExampleFormProps {
  onSubmit?: (data: ContactFormData) => Promise<void>
}

/**
 * Example contact form using react-hook-form + Zod validation
 * Copy and modify this pattern for your own forms
 */
export function ExampleForm({ onSubmit }: ExampleFormProps) {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
  })

  const handleFormSubmit = async (data: ContactFormData) => {
    if (onSubmit) {
      await onSubmit(data)
    } else {
      // Default behavior - just log
      console.log('Form submitted:', data)
      await new Promise((r) => setTimeout(r, 1000)) // Simulate API call
    }
    reset()
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Name Field */}
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          type="text"
          {...register('name')}
          className={cn(
            'w-full px-3 py-2 rounded-md border bg-background',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            errors.name && 'border-destructive'
          )}
          placeholder="Your name"
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      {/* Email Field */}
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className={cn(
            'w-full px-3 py-2 rounded-md border bg-background',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            errors.email && 'border-destructive'
          )}
          placeholder="you@example.com"
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      {/* Message Field */}
      <div className="space-y-1">
        <label htmlFor="message" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          {...register('message')}
          rows={4}
          className={cn(
            'w-full px-3 py-2 rounded-md border bg-background resize-none',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            errors.message && 'border-destructive'
          )}
          placeholder="Your message..."
        />
        {errors.message && <p className="text-sm text-destructive">{errors.message.message}</p>}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isHydrated || isSubmitting}
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
            Sending...
          </>
        ) : (
          'Send Message'
        )}
      </button>
    </form>
  )
}

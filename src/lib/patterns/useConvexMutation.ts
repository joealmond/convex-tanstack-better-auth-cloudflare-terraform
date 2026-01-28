/**
 * Enhanced Convex Mutation Hook
 * ==============================
 * 
 * Wraps Convex mutations with toast notifications, loading states, and error handling.
 * 
 * Benefits:
 * - Consistent UX across all mutations
 * - Centralized error handling
 * - Automatic toast notifications
 * - Loading state management
 * 
 * Usage:
 * ```typescript
 * import { useConvexMutation } from '@/lib/patterns/useConvexMutation'
 * import { api } from '@/convex/_generated/api'
 * 
 * function MyComponent() {
 *   const sendMessage = useConvexMutation(api.messages.send)
 * 
 *   const handleSubmit = async (content: string) => {
 *     await sendMessage.execute({ content })
 *   }
 * 
 *   return <button disabled={sendMessage.isLoading}>Send</button>
 * }
 * ```
 */

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FunctionReference, FunctionArgs } from 'convex/server'
import { useConvexMutation as useConvexBaseMutation } from '@convex-dev/react-query'

export interface UseMutationOptions {
  /** Custom success message (default: "Success!") */
  successMessage?: string
  /** Custom error message (default: error.message) */
  errorMessage?: string
  /** Show toast on success (default: true) */
  showSuccessToast?: boolean
  /** Show toast on error (default: true) */
  showErrorToast?: boolean
  /** Callback on success */
  onSuccess?: (data: any) => void
  /** Callback on error */
  onError?: (error: Error) => void
}

/**
 * Enhanced mutation hook with automatic toast notifications
 */
export function useConvexMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
  options: UseMutationOptions = {}
) {
  const {
    successMessage = 'Success!',
    errorMessage,
    showSuccessToast = true,
    showErrorToast = true,
    onSuccess,
    onError,
  } = options

  const convexMutation = useConvexBaseMutation(mutation)

  const { mutateAsync, isPending, isError, error } = useMutation({
    mutationFn: async (args: FunctionArgs<Mutation>) => {
      return await convexMutation(args)
    },
    onSuccess: (data) => {
      if (showSuccessToast) {
        toast.success(successMessage)
      }
      onSuccess?.(data)
    },
    onError: (err: Error) => {
      if (showErrorToast) {
        const message = errorMessage ?? err.message ?? 'Something went wrong'
        toast.error(message)
      }
      onError?.(err)
    },
  })

  return {
    execute: mutateAsync,
    isLoading: isPending,
    isError,
    error,
  }
}

/**
 * Enhanced query hook with loading states
 */
import { useQuery as useConvexQuery } from 'convex/react'

export function useConvexQueryWithLoading<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query>
) {
  const data = useConvexQuery(query, args)
  const isLoading = data === undefined

  return {
    data,
    isLoading,
    isEmpty: data !== undefined && Array.isArray(data) && data.length === 0,
  }
}

/**
 * Optimistic mutation hook
 * Updates UI immediately, then syncs with server
 */
import { useState } from 'react'

export function useOptimisticMutation<Mutation extends FunctionReference<'mutation'>, T>(
  mutation: Mutation,
  options: UseMutationOptions & {
    /** Optimistic update function */
    onOptimisticUpdate: (args: FunctionArgs<Mutation>) => T
    /** Current data to update optimistically */
    currentData?: T
  }
) {
  const [optimisticData, setOptimisticData] = useState<T | undefined>(options.currentData)
  const { execute, isLoading, isError, error } = useConvexMutation(mutation, {
    ...options,
    onSuccess: (data) => {
      setOptimisticData(undefined) // Clear optimistic update
      options.onSuccess?.(data)
    },
    onError: (err) => {
      setOptimisticData(undefined) // Revert optimistic update
      options.onError?.(err)
    },
  })

  const executeOptimistic = async (args: FunctionArgs<Mutation>) => {
    // Apply optimistic update immediately
    const optimisticResult = options.onOptimisticUpdate(args)
    setOptimisticData(optimisticResult)

    try {
      return await execute(args)
    } catch (error) {
      // Error handling is done in useConvexMutation
      throw error
    }
  }

  return {
    execute: executeOptimistic,
    isLoading,
    isError,
    error,
    data: optimisticData ?? options.currentData,
  }
}

/**
 * Debounced mutation hook
 * Debounces mutation calls to avoid excessive requests
 */
import { useCallback, useRef } from 'react'

export function useDebouncedMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
  delay: number = 500,
  options: UseMutationOptions = {}
) {
  const { execute, isLoading, isError, error } = useConvexMutation(mutation, options)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const debouncedExecute = useCallback(
    (args: FunctionArgs<Mutation>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      return new Promise((resolve, reject) => {
        timeoutRef.current = setTimeout(async () => {
          try {
            const result = await execute(args)
            resolve(result)
          } catch (err) {
            reject(err)
          }
        }, delay)
      })
    },
    [execute, delay]
  )

  return {
    execute: debouncedExecute,
    isLoading,
    isError,
    error,
  }
}

/**
 * Batch mutation hook
 * Collects multiple mutations and executes them together
 */
export function useBatchMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
  options: UseMutationOptions = {}
) {
  const [batch, setBatch] = useState<Array<FunctionArgs<Mutation>>>([])
  const { execute, isLoading } = useConvexMutation(mutation, options)

  const addToBatch = (args: FunctionArgs<Mutation>) => {
    setBatch((prev) => [...prev, args])
  }

  const executeBatch = async () => {
    const results = await Promise.all(batch.map((args) => execute(args)))
    setBatch([])
    return results
  }

  const clearBatch = () => {
    setBatch([])
  }

  return {
    addToBatch,
    executeBatch,
    clearBatch,
    batchSize: batch.length,
    isLoading,
  }
}

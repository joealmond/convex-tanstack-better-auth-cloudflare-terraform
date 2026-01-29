import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

/**
 * Create Item Form Component
 *
 * Features:
 * - Controlled form inputs
 * - Convex mutation for submission
 * - Loading state during submission
 * - Error handling and display
 * - Form reset on success
 */

interface CreateItemFormProps {
  /** Called after successful creation */
  onSuccess?: () => void;
}

export function CreateItemForm({ onSuccess }: CreateItemFormProps) {
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convex mutation
  const createItem = useMutation(api.items.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      await createItem({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      });

      // Reset form on success
      setName("");
      setDescription("");
      setStatus("draft");

      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create item"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div
          className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Name Field */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter item name"
          required
          disabled={isSubmitting}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      {/* Description Field */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description (optional)"
          rows={3}
          disabled={isSubmitting}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>

      {/* Status Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Status
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="status"
              value="draft"
              checked={status === "draft"}
              onChange={() => setStatus("draft")}
              disabled={isSubmitting}
              className="mr-2"
            />
            <span className="text-sm">Draft</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="status"
              value="published"
              checked={status === "published"}
              onChange={() => setStatus("published")}
              disabled={isSubmitting}
              className="mr-2"
            />
            <span className="text-sm">Published</span>
          </label>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Creating...
            </span>
          ) : (
            "Create Item"
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setName("");
            setDescription("");
            setStatus("draft");
            setError(null);
          }}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Reset
        </button>
      </div>
    </form>
  );
}

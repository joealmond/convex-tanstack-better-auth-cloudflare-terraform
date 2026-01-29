import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";

/**
 * Item List Component
 *
 * Features:
 * - Reactive data with useQuery
 * - Loading skeleton state
 * - Empty state with CTA
 * - Click handler for item selection
 */

interface Item {
  _id: Id<"items">;
  name: string;
  description: string;
  status: "draft" | "published";
  createdAt: number;
}

interface ItemListProps {
  /** Called when an item is clicked */
  onItemClick?: (id: Id<"items">) => void;
  /** Filter by status */
  statusFilter?: "draft" | "published";
  /** Maximum items to display */
  limit?: number;
}

export function ItemList({
  onItemClick,
  statusFilter,
  limit,
}: ItemListProps) {
  const items = useQuery(api.items.list, {
    status: statusFilter,
    limit,
  });

  // Loading state - show skeleton
  if (items === undefined) {
    return <ItemListSkeleton count={limit || 5} />;
  }

  // Empty state
  if (items.length === 0) {
    return <ItemListEmpty statusFilter={statusFilter} />;
  }

  // Render items
  return (
    <ul className="space-y-3" role="list">
      {items.map((item) => (
        <ItemCard
          key={item._id}
          item={item}
          onClick={() => onItemClick?.(item._id)}
        />
      ))}
    </ul>
  );
}

// --- Sub-components ---

interface ItemCardProps {
  item: Item;
  onClick?: () => void;
}

function ItemCard({ item, onClick }: ItemCardProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition"
        aria-label={`View ${item.name}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">
              {item.name}
            </h3>
            {item.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {item.description}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Created {new Date(item.createdAt).toLocaleDateString()}
            </p>
          </div>
          <StatusBadge status={item.status} />
        </div>
      </button>
    </li>
  );
}

interface StatusBadgeProps {
  status: "draft" | "published";
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    draft: "bg-gray-100 text-gray-600",
    published: "bg-green-100 text-green-800",
  };

  return (
    <span
      className={`ml-2 px-2 py-1 text-xs font-medium rounded ${styles[status]}`}
    >
      {status}
    </span>
  );
}

interface ItemListSkeletonProps {
  count: number;
}

function ItemListSkeleton({ count }: ItemListSkeletonProps) {
  return (
    <ul className="space-y-3" aria-label="Loading items">
      {[...Array(count)].map((_, i) => (
        <li key={i} className="p-4 bg-white rounded-lg border border-gray-200">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface ItemListEmptyProps {
  statusFilter?: "draft" | "published";
}

function ItemListEmpty({ statusFilter }: ItemListEmptyProps) {
  const message = statusFilter
    ? `No ${statusFilter} items`
    : "No items yet";

  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
      <p className="mt-4 text-gray-600">{message}</p>
      <a
        href="/items/new"
        className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Create your first item
      </a>
    </div>
  );
}

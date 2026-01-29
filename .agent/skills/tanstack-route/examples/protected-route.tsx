import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

/**
 * Protected Dashboard Page
 *
 * Features:
 * - Located in _authed/ directory (requires authentication)
 * - Loads user-specific data via Convex
 * - Handles loading and empty states
 * - SEO meta tags
 */
export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard | My App" },
      { name: "description", content: "View and manage your items" },
    ],
  }),
});

function DashboardPage() {
  // Reactive data subscription - auto-updates on changes
  const items = useQuery(api.items.list);
  const stats = useQuery(api.stats.getUserStats);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your overview.</p>
      </header>

      {/* Stats Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard label="Total Items" value={stats?.totalItems} />
        <StatsCard label="Published" value={stats?.publishedItems} />
        <StatsCard label="Drafts" value={stats?.draftItems} />
      </section>

      {/* Items List */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Your Items</h2>
        <ItemsList items={items} />
      </section>
    </div>
  );
}

// --- Sub-components ---

interface StatsCardProps {
  label: string;
  value: number | undefined;
}

function StatsCard({ label, value }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      {value === undefined ? (
        <div className="h-8 w-16 bg-gray-100 animate-pulse rounded" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
    </div>
  );
}

interface Item {
  _id: string;
  name: string;
  status: "draft" | "published";
  updatedAt: number;
}

interface ItemsListProps {
  items: Item[] | undefined;
}

function ItemsList({ items }: ItemsListProps) {
  // Loading state
  if (items === undefined) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-gray-100 animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600 mb-4">No items yet</p>
        <a
          href="/items/new"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create your first item
        </a>
      </div>
    );
  }

  // Items list
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item._id}
          className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
        >
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-gray-500">
              Updated {new Date(item.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <span
            className={`px-2 py-1 text-xs rounded ${
              item.status === "published"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {item.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

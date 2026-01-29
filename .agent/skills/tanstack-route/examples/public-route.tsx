import { createFileRoute } from "@tanstack/react-router";

/**
 * Public About Page
 *
 * Features:
 * - SEO meta tags for search engines
 * - No authentication required
 * - Static content (no data loading)
 */
export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About Us | My App" },
      {
        name: "description",
        content:
          "Learn about our company, mission, and the team behind the product.",
      },
      // Open Graph tags for social sharing
      { property: "og:title", content: "About Us | My App" },
      {
        property: "og:description",
        content: "Learn about our company and mission.",
      },
    ],
  }),
});

function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <section className="mb-16 text-center">
        <h1 className="text-4xl font-bold mb-4">About Us</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          We're building the future of real-time applications with modern
          technology.
        </p>
      </section>

      {/* Content Sections */}
      <section className="grid md:grid-cols-2 gap-12 mb-16">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
          <p className="text-gray-600 leading-relaxed">
            To provide developers with the best tools for building fast,
            reliable, and real-time applications that scale.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Our Technology</h2>
          <p className="text-gray-600 leading-relaxed">
            Built on TanStack Start, Convex, and Cloudflare Workers for
            edge-first performance and real-time data sync.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-gray-50 rounded-lg p-8">
        <h2 className="text-2xl font-semibold mb-4">Ready to get started?</h2>
        <a
          href="/signup"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Create an account
        </a>
      </section>
    </div>
  );
}

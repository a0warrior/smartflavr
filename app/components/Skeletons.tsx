"use client"

// Full-page skeleton shown while a page's session/data is loading.
// Mimics the app shell: navbar strip, page header, then a grid of cards.
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar strip */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="skeleton h-7 w-28" />
        <div className="flex items-center gap-3">
          <div className="skeleton h-8 w-8 rounded-full" />
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </div>
      {/* Page header */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
        <div className="skeleton h-8 w-48 mb-2" />
        <div className="skeleton h-4 w-72 mb-6" />
        {/* Card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="skeleton h-32 w-full mb-3 rounded-xl" />
              <div className="skeleton h-4 w-3/4 mb-2" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// In-content skeleton for feed-style lists of posts.
export function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1">
              <div className="skeleton h-3.5 w-32 mb-1.5" />
              <div className="skeleton h-3 w-20" />
            </div>
          </div>
          <div className="skeleton h-40 w-full rounded-xl mb-3" />
          <div className="skeleton h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  )
}

// In-content skeleton for simple row lists (grocery lists, collaborators, etc).
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
          <div className="skeleton h-9 w-9 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <div className="skeleton h-3.5 w-1/2 mb-1.5" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

"use client";

export default function OpeningsSkeleton({ rows = 6 }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden animate-pulse">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-tableHeader">
          <tr>
            {["Title", "Location", "Contract Type", "Posted Date", "Hiring Manager", "Action"].map(
              (h) => (
                <th key={h} className="px-4 py-3 text-left">
                  <div className="h-3 bg-muted rounded w-20" />
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-border">
              <td className="px-4 py-4">
                <div className="h-3 bg-muted rounded w-48" />
              </td>
              <td className="px-4 py-4">
                <div className="h-3 bg-muted rounded w-24" />
              </td>
              <td className="px-4 py-4">
                <div className="h-3 bg-muted rounded w-32" />
              </td>
              <td className="px-4 py-4">
                <div className="h-3 bg-muted rounded w-20" />
              </td>
              <td className="px-4 py-4">
                <div className="h-3 bg-muted rounded w-28" />
              </td>
              <td className="px-4 py-4">
                <div className="h-6 bg-muted rounded w-16" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

export default function HMOpeningsSkeleton({ rows = 6 }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden animate-pulse">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-tableHeader">
          <tr>
            {["Title", "Location", "Contract", "Exp", "Posted", "Profiles", "Pending", "Status", ""].map((h) => (
              <th key={h} className="px-4 py-3 text-left">
                <div className="h-3 bg-muted rounded w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-border">
              <td className="px-4 py-4"><div className="h-3 bg-muted rounded w-44" /></td>
              <td className="px-4 py-4"><div className="h-3 bg-muted rounded w-20" /></td>
              <td className="px-4 py-4"><div className="h-3 bg-muted rounded w-28" /></td>
              <td className="px-4 py-4"><div className="h-3 bg-muted rounded w-12" /></td>
              <td className="px-4 py-4"><div className="h-3 bg-muted rounded w-20" /></td>
              <td className="px-4 py-4"><div className="h-3 bg-muted rounded w-10" /></td>
              <td className="px-4 py-4"><div className="h-5 bg-muted rounded w-20" /></td>
              <td className="px-4 py-4"><div className="h-5 bg-muted rounded w-14" /></td>
              <td className="px-4 py-4"><div className="h-6 bg-muted rounded w-16" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

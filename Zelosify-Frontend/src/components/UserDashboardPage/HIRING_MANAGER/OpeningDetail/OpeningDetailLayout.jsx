"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Clock3, MapPin, Clock, Briefcase } from "lucide-react";
import { FixedSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import ProfileCard from "./ProfileCard";

const VIRTUALIZE_THRESHOLD = 50;
const CARD_HEIGHT = 300; // px — approximate fixed height per card in list mode

function ProfileSkeleton() {
  return (
    <div className="animate-pulse border border-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex justify-between">
        <div className="h-4 bg-muted rounded w-48" />
        <div className="h-5 bg-muted rounded w-20" />
      </div>
      <div className="h-3 bg-muted rounded w-32" />
      <div className="border-t border-border pt-3 flex flex-col gap-2">
        <div className="h-5 bg-muted rounded w-28" />
        <div className="h-2 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-40" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="flex-1 h-7 bg-muted rounded" />
        <div className="flex-1 h-7 bg-muted rounded" />
      </div>
    </div>
  );
}

function FilterBar({ filter, setFilter, counts }) {
  const tabs = [
    { key: "ALL", label: "All", count: counts.all },
    { key: "SUBMITTED", label: "Pending Review", count: counts.submitted },
    { key: "SHORTLISTED", label: "Shortlisted", count: counts.shortlisted },
    { key: "REJECTED", label: "Rejected", count: counts.rejected },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-tableHeader rounded-lg w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setFilter(tab.key)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            filter === tab.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.count > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-border text-foreground text-xs">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function SortBar({ sortBy, setSortBy }) {
  const options = [
    { key: "default", label: "AI Rank" },
    { key: "score_desc", label: "Score ↓" },
    { key: "score_asc", label: "Score ↑" },
    { key: "date_desc", label: "Newest" },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Sort:</span>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function sortProfiles(profiles, sortBy) {
  const copy = [...profiles];
  switch (sortBy) {
    case "score_desc":
      return copy.sort((a, b) => (b.recommendationScore ?? -1) - (a.recommendationScore ?? -1));
    case "score_asc":
      return copy.sort((a, b) => (a.recommendationScore ?? 2) - (b.recommendationScore ?? 2));
    case "date_desc":
      return copy.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    default: {
      // AI rank: Recommended first, then Borderline, then Pending, then Not Recommended
      const rank = { Recommended: 0, Borderline: 1, Pending: 2, "Not Recommended": 3 };
      return copy.sort((a, b) => (rank[a.badge] ?? 4) - (rank[b.badge] ?? 4));
    }
  }
}

export default function OpeningDetailLayout({
  opening,
  profiles,
  loading,
  error,
  actionState,
  onShortlist,
  onReject,
  onDismissError,
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("default");

  const counts = {
    all: profiles.length,
    submitted: profiles.filter((p) => p.status === "SUBMITTED").length,
    shortlisted: profiles.filter((p) => p.status === "SHORTLISTED").length,
    rejected: profiles.filter((p) => p.status === "REJECTED").length,
  };

  const filtered = filter === "ALL" ? profiles : profiles.filter((p) => p.status === filter);
  const sorted = sortProfiles(filtered, sortBy);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-6 bg-muted rounded w-32 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProfileSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-red-500 text-sm">{error}</p>
        <button
          onClick={() => router.back()}
          className="text-xs px-4 py-2 rounded-md bg-foreground text-background"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6 h-full overflow-y-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Openings
      </button>

      {/* Opening header (if available from Redux list cache) */}
      {opening && (
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-foreground">{opening.title}</h1>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {opening.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />{opening.location}
              </span>
            )}
            {opening.contractType && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />{opening.contractType}
              </span>
            )}
            {opening.experienceMin !== undefined && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                {opening.experienceMin}{opening.experienceMax ? `–${opening.experienceMax}` : "+"}+ yrs
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>
            <span className="font-semibold text-foreground">{counts.all}</span> profiles
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock3 className="w-4 h-4" />
          <span>
            <span className="font-semibold text-foreground">{counts.submitted}</span> pending review
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <FilterBar filter={filter} setFilter={setFilter} counts={counts} />
        <SortBar sortBy={sortBy} setSortBy={setSortBy} />
      </div>

      {/* Profile grid / virtualized list */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">
            {filter === "ALL"
              ? "No profiles submitted yet."
              : `No ${filter.toLowerCase()} profiles.`}
          </p>
        </div>
      ) : sorted.length > VIRTUALIZE_THRESHOLD ? (
        /* Virtualized list for large datasets (>50 profiles) */
        <div className="flex-1" style={{ height: "calc(100vh - 340px)", minHeight: 400 }}>
          <AutoSizer>
            {({ height, width }) => (
              <FixedSizeList
                height={height}
                width={width}
                itemCount={sorted.length}
                itemSize={CARD_HEIGHT}
                overscanCount={5}
              >
                {({ index, style }) => (
                  <div style={{ ...style, paddingBottom: 16 }}>
                    <ProfileCard
                      profile={sorted[index]}
                      actionState={actionState}
                      onShortlist={onShortlist}
                      onReject={onReject}
                      onDismissError={onDismissError}
                    />
                  </div>
                )}
              </FixedSizeList>
            )}
          </AutoSizer>
        </div>
      ) : (
        /* Standard grid for ≤50 profiles */
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              actionState={actionState}
              onShortlist={onShortlist}
              onReject={onReject}
              onDismissError={onDismissError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Clock, Briefcase, Calendar } from "lucide-react";
import ProfileUploader from "./ProfileUploader";
import ProfileList from "./ProfileList";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function InfoPill({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-tableHeader px-3 py-1.5 rounded-full">
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-6 p-6">
      <div className="h-6 bg-muted rounded w-64" />
      <div className="flex gap-3">
        <div className="h-6 bg-muted rounded w-24" />
        <div className="h-6 bg-muted rounded w-32" />
        <div className="h-6 bg-muted rounded w-20" />
      </div>
      <div className="h-20 bg-muted rounded" />
      <div className="h-40 bg-muted rounded" />
    </div>
  );
}

export default function OpeningDetailLayout({
  opening,
  profiles,
  loading,
  error,
  uploading,
  uploadError,
  previewUrls,
  previewLoading,
  onUpload,
  onDelete,
  onPreview,
  onDismissError,
}) {
  const router = useRouter();

  // When a preview URL loads, open it automatically
  useEffect(() => {
    Object.entries(previewUrls ?? {}).forEach(([id, url]) => {
      if (url && previewLoading?.[id] === false) {
        // only open if not already opened (tracked by flag is handled in component state)
      }
    });
  }, [previewUrls, previewLoading]);

  if (loading) return <DetailSkeleton />;

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

  if (!opening) return null;

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Openings
      </button>

      {/* Opening header */}
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-foreground">{opening.title}</h1>
        <div className="flex flex-wrap gap-2">
          {opening.location && (
            <InfoPill icon={MapPin} label={opening.location} />
          )}
          {opening.contractType && (
            <InfoPill icon={Clock} label={opening.contractType} />
          )}
          <InfoPill
            icon={Briefcase}
            label={`${opening.experienceMin}${
              opening.experienceMax ? `–${opening.experienceMax}` : "+"
            } yrs experience`}
          />
          <InfoPill
            icon={Calendar}
            label={`Posted ${formatDate(opening.postedDate)}`}
          />
          {opening.hiringManagerName && (
            <InfoPill icon={Briefcase} label={`HM: ${opening.hiringManagerName}`} />
          )}
        </div>

        {opening.description && (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {opening.description}
          </p>
        )}
      </div>

      {/* Upload section */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">
          Submit Candidate Profiles
        </h2>
        <ProfileUploader
          onUpload={onUpload}
          uploading={uploading}
          uploadError={uploadError}
          onDismissError={onDismissError}
        />
      </div>

      {/* Profiles section */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">
          Submitted Profiles
          {profiles.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              ({profiles.length})
            </span>
          )}
        </h2>
        <ProfileList
          profiles={profiles}
          previewUrls={previewUrls}
          previewLoading={previewLoading}
          onDelete={onDelete}
          onPreview={onPreview}
        />
      </div>
    </div>
  );
}

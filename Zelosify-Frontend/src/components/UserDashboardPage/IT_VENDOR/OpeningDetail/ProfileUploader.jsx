"use client";
import { useCallback, useState } from "react";
import { UploadCloud, FileText, X, AlertCircle } from "lucide-react";

const ALLOWED_TYPES = ["application/pdf", "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
const ALLOWED_EXT = /\.(pdf|ppt|pptx)$/i;
const MAX_FILES = 10;
const MAX_SIZE_MB = 10;

function FileRow({ file, onRemove }) {
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-tableHeader rounded-md">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-foreground truncate">{file.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{sizeMB} MB</span>
      </div>
      <button
        onClick={() => onRemove(file.name)}
        className="text-muted-foreground hover:text-red-500 transition-colors ml-2"
        aria-label="Remove file"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ProfileUploader({ onUpload, uploading, uploadError, onDismissError }) {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [validationError, setValidationError] = useState(null);

  const validateAndAdd = useCallback((incoming) => {
    setValidationError(null);
    const valid = [];
    for (const file of incoming) {
      if (!ALLOWED_EXT.test(file.name) && !ALLOWED_TYPES.includes(file.type)) {
        setValidationError(`"${file.name}" is not allowed. Only PDF and PPTX files.`);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setValidationError(`"${file.name}" exceeds ${MAX_SIZE_MB} MB limit.`);
        return;
      }
      valid.push(file);
    }
    setStagedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const merged = [...prev, ...valid.filter((f) => !existing.has(f.name))];
      if (merged.length > MAX_FILES) {
        setValidationError(`You can upload a maximum of ${MAX_FILES} files at once.`);
        return prev;
      }
      return merged;
    });
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      validateAndAdd(Array.from(e.dataTransfer.files));
    },
    [validateAndAdd]
  );

  const handleFileInput = (e) => {
    validateAndAdd(Array.from(e.target.files));
    e.target.value = "";
  };

  const removeFile = (name) => {
    setStagedFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleSubmit = () => {
    if (stagedFiles.length === 0) return;
    onUpload(stagedFiles);
    setStagedFiles([]);
  };

  const error = validationError || uploadError;

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-foreground/40 transition-colors"
        onClick={() => document.getElementById("profile-file-input").click()}
      >
        <UploadCloud className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-foreground font-medium">
          Drag & drop resumes here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          PDF or PPTX only · up to {MAX_FILES} files · max {MAX_SIZE_MB} MB each
        </p>
        <input
          id="profile-file-input"
          type="file"
          multiple
          accept=".pdf,.ppt,.pptx"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span className="text-xs text-red-700 dark:text-red-400 flex-1">{error}</span>
          <button
            onClick={() => {
              setValidationError(null);
              onDismissError?.();
            }}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Staged file list */}
      {stagedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          {stagedFiles.map((f) => (
            <FileRow key={f.name} file={f} onRemove={removeFile} />
          ))}
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="mt-1 self-end px-4 py-2 text-sm rounded-md bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {uploading
              ? "Uploading..."
              : `Submit ${stagedFiles.length} file${stagedFiles.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}

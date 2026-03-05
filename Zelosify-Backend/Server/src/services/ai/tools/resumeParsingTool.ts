import JSZip from "jszip";
import { createStorageService } from "../../storage/storageFactory.js";
import { sanitizeResumeContent } from "../../../utils/ai/promptInjectionSanitizer.js";
import { logger } from "../../../utils/observability/logger.js";

const SERVICE = "resumeParsingTool";

/**
 * Download a file from S3 and return its buffer.
 */
async function downloadFromS3(s3Key: string): Promise<Buffer> {
  const storage = createStorageService();
  const stream = await storage.getObjectStream(s3Key);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Extract raw text from a PDF buffer using pdf-extraction.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid issues with CJS module in ESM context
  const pdfExtraction = await import("pdf-extraction");
  const extract = pdfExtraction.default ?? pdfExtraction;
  const data = await extract(buffer);
  return data.text ?? "";
}

/**
 * Extract raw text from a PPTX buffer.
 * PPTX is a ZIP archive — we unzip and extract text from slide XML files.
 */
export async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
  );

  const slideTexts = await Promise.all(
    slideFiles.map(async (slideFile) => {
      const content = await zip.files[slideFile].async("string");
      // Extract text from <a:t> elements (DrawingML text runs)
      const matches = content.match(/<a:t[^>]*>(.*?)<\/a:t>/g) ?? [];
      return matches
        .map((m) => m.replace(/<[^>]+>/g, ""))
        .join(" ");
    })
  );

  return slideTexts.join("\n");
}

export interface ParsedResumeRaw {
  rawText: string;
  sanitizedText: string;
  fileType: "pdf" | "pptx";
  charCount: number;
}

/**
 * Tool: parse_resume
 *
 * Downloads the file from S3, extracts raw text (PDF or PPTX),
 * sanitizes it against prompt injection, and returns the clean text
 * for the LLM to analyze.
 *
 * The raw text is NEVER injected into the LLM system prompt —
 * it is passed only as the tool call result.
 */
export async function parseResumeTool(s3Key: string): Promise<ParsedResumeRaw> {
  const start = Date.now();

  const ext = s3Key.split(".").pop()?.toLowerCase() ?? "";
  const supportedTypes = ["pdf", "pptx", "ppt"];

  if (!supportedTypes.includes(ext)) {
    throw new Error(`Unsupported file type: .${ext}. Only PDF and PPTX are supported.`);
  }

  logger.info(SERVICE, "Downloading file from S3", { s3Key, ext });
  const buffer = await downloadFromS3(s3Key);

  let rawText: string;
  let fileType: "pdf" | "pptx";

  if (ext === "pdf") {
    rawText = await extractPdfText(buffer);
    fileType = "pdf";
  } else {
    rawText = await extractPptxText(buffer);
    fileType = "pptx";
  }

  const sanitizedText = sanitizeResumeContent(rawText);

  logger.info(SERVICE, "Resume parsed successfully", {
    s3Key,
    fileType,
    rawChars: rawText.length,
    sanitizedChars: sanitizedText.length,
    parseMs: Date.now() - start,
  });

  return {
    rawText,
    sanitizedText,
    fileType,
    charCount: sanitizedText.length,
  };
}

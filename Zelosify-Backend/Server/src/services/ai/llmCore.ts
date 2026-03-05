import Groq from "groq-sdk";
import { logger } from "../../utils/observability/logger.js";

const SERVICE = "llmCore";

// Model with reliable tool-calling support
const MODEL = "llama-3.3-70b-versatile";
const RECOMMENDATION_VERSION = "1.0.0";

// Tool definitions exposed to the LLM.
// Resume parsing now happens before the LLM loop (text pre-fetched from DB),
// so the LLM only needs to normalize skills and calculate the match score.
export const TOOL_DEFINITIONS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "normalize_skills",
      description:
        "Normalizes a raw list of skill strings to canonical lowercase forms " +
        "(e.g. 'Node.js' → 'nodejs', 'ReactJS' → 'react'). " +
        "Call this FIRST with the raw skills you extracted from the resume text above.",
      parameters: {
        type: "object",
        properties: {
          skills: {
            type: "array",
            items: { type: "string" },
            description: "Raw skill strings extracted from the resume.",
          },
        },
        required: ["skills"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_match_score",
      description:
        "Deterministic scoring engine. Calculates skill, experience, and location match scores " +
        "and produces a final weighted score. " +
        "MUST be called after normalize_skills. " +
        "You MUST NOT calculate scores yourself — always delegate to this tool.",
      parameters: {
        type: "object",
        properties: {
          candidate_experience_years: {
            type: "number",
            description: "Years of experience extracted from resume.",
          },
          candidate_normalized_skills: {
            type: "array",
            items: { type: "string" },
            description: "Normalized skills from normalize_skills tool output.",
          },
          candidate_location: {
            type: "string",
            description: "Candidate location extracted from resume.",
          },
          opening_experience_min: {
            type: "number",
            description: "Minimum required experience years for the opening.",
          },
          opening_experience_max: {
            type: ["number", "null"],
            description: "Maximum required experience years (null if no upper limit).",
          },
          opening_required_skills: {
            type: "array",
            items: { type: "string" },
            description: "Normalized required skills for the opening.",
          },
          opening_location: {
            type: "string",
            description: "Opening location (e.g. 'Remote', 'Gotham City').",
          },
        },
        required: [
          "candidate_experience_years",
          "candidate_normalized_skills",
          "candidate_location",
          "opening_experience_min",
          "opening_experience_max",
          "opening_required_skills",
          "opening_location",
        ],
      },
    },
  },
];

export interface LLMCallResult {
  message: Groq.Chat.Completions.ChatCompletionMessage;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY environment variable is not set");
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

/**
 * Make a single LLM call with tool definitions.
 * Returns the response message + token usage + latency.
 */
export async function callLLM(
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[],
  toolChoice: "auto" | "none" = "auto"
): Promise<LLMCallResult> {
  const client = getGroqClient();
  const start = Date.now();

  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    tools: TOOL_DEFINITIONS,
    tool_choice: toolChoice,
    temperature: 0.1, // Low temperature for deterministic, consistent recommendations
    max_tokens: 1024,
  });

  const latencyMs = Date.now() - start;
  const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const message = response.choices[0].message;

  logger.info(SERVICE, "LLM call completed", {
    model: MODEL,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    latencyMs,
    hasToolCalls: (message.tool_calls?.length ?? 0) > 0,
  });

  return {
    message,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    latencyMs,
  };
}

export { MODEL as LLM_MODEL, RECOMMENDATION_VERSION };

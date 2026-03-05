/**
 * Skill Normalizer Tool
 *
 * Normalizes a list of raw skill strings to canonical lowercase forms so
 * that "Node.js", "NodeJS", and "node js" all map to "nodejs" and correctly
 * match against required skills in the opening.
 */

// Common skill aliases → canonical form
const SKILL_ALIASES: Record<string, string> = {
  // JavaScript / TypeScript
  "javascript": "javascript",
  "js": "javascript",
  "es6": "javascript",
  "es2015": "javascript",
  "typescript": "typescript",
  "ts": "typescript",

  // Backend
  "nodejs": "nodejs",
  "node.js": "nodejs",
  "node js": "nodejs",
  "node": "nodejs",
  "express": "expressjs",
  "express.js": "expressjs",
  "expressjs": "expressjs",
  "nestjs": "nestjs",
  "nest.js": "nestjs",
  "fastapi": "fastapi",
  "django": "django",
  "flask": "flask",
  "spring boot": "springboot",
  "springboot": "springboot",

  // Frontend
  "reactjs": "react",
  "react.js": "react",
  "react": "react",
  "nextjs": "nextjs",
  "next.js": "nextjs",
  "vuejs": "vuejs",
  "vue.js": "vuejs",
  "vue": "vuejs",
  "angular": "angular",

  // Databases
  "postgresql": "postgresql",
  "postgres": "postgresql",
  "psql": "postgresql",
  "mysql": "mysql",
  "mongodb": "mongodb",
  "mongo": "mongodb",
  "redis": "redis",
  "sqlite": "sqlite",

  // Cloud / DevOps
  "aws": "aws",
  "amazon web services": "aws",
  "gcp": "gcp",
  "google cloud": "gcp",
  "azure": "azure",
  "kubernetes": "kubernetes",
  "k8s": "kubernetes",
  "docker": "docker",
  "terraform": "terraform",
  "ci/cd": "cicd",
  "github actions": "github-actions",

  // AI / ML
  "machine learning": "machine-learning",
  "ml": "machine-learning",
  "deep learning": "deep-learning",
  "pytorch": "pytorch",
  "tensorflow": "tensorflow",
  "scikit-learn": "scikit-learn",
  "sklearn": "scikit-learn",

  // Languages
  "python": "python",
  "java": "java",
  "golang": "go",
  "go": "go",
  "rust": "rust",
  "c++": "cpp",
  "cpp": "cpp",
  "c#": "csharp",
  "dotnet": "dotnet",
  ".net": "dotnet",

  // Misc
  "rest": "rest-api",
  "rest api": "rest-api",
  "graphql": "graphql",
  "microservices": "microservices",
  "agile": "agile",
  "scrum": "scrum",
  "git": "git",
  "prisma": "prisma",
  "sql": "sql",
};

export function normalizeSkill(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return SKILL_ALIASES[cleaned] ?? cleaned.replace(/\s+/g, "-");
}

export interface NormalizeSkillsResult {
  original: string[];
  normalized: string[];
}

/**
 * Tool: normalize_skills
 *
 * Takes a raw array of skill strings (as extracted by the resume parser)
 * and maps them to canonical forms for consistent matching.
 */
export function normalizeSkillsTool(skills: string[]): NormalizeSkillsResult {
  const normalized = skills.map(normalizeSkill);
  return { original: skills, normalized };
}

import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SECRET_PATTERNS = [
  /sb_secret_[A-Za-z0-9_-]{16,}/g,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?(sb_secret_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9._-]+)/g,
  /SERVICE_ROLE_KEY\s*=\s*["']?eyJ[A-Za-z0-9._-]+/g,
];

function isGitRepository() {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function listTrackedFiles() {
  const output = execSync("git ls-files", { encoding: "utf8", stdio: "pipe" });
  return output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function listSourceFiles(rootDir) {
  const excludedDirectories = new Set([
    ".git",
    ".next",
    "backups",
    "logs",
    "node_modules",
    "dist",
    "coverage",
    "playwright-report",
    "test-results",
  ]);
  const excludedFiles = new Set([
    ".env",
    ".env.local",
    ".env.development.local",
    ".env.test.local",
    ".env.production.local",
  ]);

  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) {
          stack.push(absolutePath);
        }
        continue;
      }

      if (excludedFiles.has(entry.name)) {
        continue;
      }

      files.push(relativePath);
    }
  }

  return files;
}

function isLikelyBinary(filePath) {
  const content = readFileSync(filePath);
  return content.includes(0);
}

function checkEnvLocalIsUntracked() {
  try {
    execSync("git ls-files --error-unmatch .env.local", { stdio: "pipe" });
    return false;
  } catch {
    return true;
  }
}

function checkEnvLocalIsIgnoredByGitignore() {
  const gitignorePath = path.resolve(process.cwd(), ".gitignore");
  try {
    const content = readFileSync(gitignorePath, "utf8");
    return content.split(/\r?\n/).some((line) => line.trim() === ".env.local");
  } catch {
    return false;
  }
}

function checkBackupsDirIsIgnoredByGitignore() {
  const gitignorePath = path.resolve(process.cwd(), ".gitignore");
  try {
    const content = readFileSync(gitignorePath, "utf8");
    return content.split(/\r?\n/).some((line) => line.trim() === "backups/");
  } catch {
    return false;
  }
}

function hasTrackedBackupFiles() {
  try {
    const output = execSync("git ls-files backups", { encoding: "utf8", stdio: "pipe" }).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

function main() {
  const trackedFiles = isGitRepository() ? listTrackedFiles() : listSourceFiles(process.cwd());
  const findings = [];

  for (const relativePath of trackedFiles) {
    const absolutePath = path.resolve(process.cwd(), relativePath);

    try {
      if (isLikelyBinary(absolutePath)) {
        continue;
      }

      const content = readFileSync(absolutePath, "utf8");

      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          findings.push({
            file: relativePath,
            pattern: pattern.toString(),
          });
          break;
        }
      }
    } catch {
      // Ignore unreadable files (deleted/moved during scan).
    }
  }

  if (isGitRepository()) {
    if (!checkEnvLocalIsUntracked()) {
      findings.push({
        file: ".env.local",
        pattern: "must remain untracked",
      });
    }

    if (hasTrackedBackupFiles()) {
      findings.push({
        file: "backups/",
        pattern: "backup artifacts must remain untracked",
      });
    }
  } else if (!checkEnvLocalIsIgnoredByGitignore()) {
    findings.push({
      file: ".gitignore",
      pattern: "missing .env.local ignore rule",
    });
  }

  if (!checkBackupsDirIsIgnoredByGitignore()) {
    findings.push({
      file: ".gitignore",
      pattern: "missing backups/ ignore rule",
    });
  }

  if (findings.length > 0) {
    console.error("[security:scan] Potential secrets detected in tracked files:");
    for (const finding of findings) {
      console.error(` - ${finding.file} (${finding.pattern})`);
    }
    process.exit(1);
  }

  if (isGitRepository()) {
    console.log("[security:scan] OK: no tracked local secrets detected.");
  } else {
    console.log("[security:scan] OK: no local secret signatures detected in source files.");
  }
}

main();

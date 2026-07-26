import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const projectRoot = process.cwd();
const roots = ["src", "scripts"];
const supportedExtensions = new Set([".ts", ".tsx", ".mjs"]);
const ignoredFiles = new Set(["src/lib/crm-metadata.ts"]);
const ignoredPrefixes = ["src/lib/crm-metadata/"];
const maximumLines = 500;
const oversized = [];

async function visit(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(path, entry.name);
    if (entry.isDirectory()) {
      await visit(absolutePath);
      continue;
    }
    if (!supportedExtensions.has(extname(entry.name))) continue;
    const projectPath = relative(projectRoot, absolutePath);
    if (ignoredFiles.has(projectPath) || ignoredPrefixes.some((prefix) => projectPath.startsWith(prefix))) continue;
    const contents = await readFile(absolutePath, "utf8");
    const lines = contents.split(/\r?\n/).length;
    if (lines > maximumLines) oversized.push({ projectPath, lines });
  }
}

for (const root of roots) await visit(join(projectRoot, root));

if (oversized.length === 0) {
  console.log(`All handwritten TypeScript and JavaScript files are within ${maximumLines} lines.`);
} else {
  console.warn(`Files above the ${maximumLines}-line architecture threshold:`);
  for (const file of oversized.sort((left, right) => right.lines - left.lines)) {
    console.warn(`- ${file.projectPath}: ${file.lines}`);
  }
}

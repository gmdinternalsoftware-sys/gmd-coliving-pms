/**
 * Static Hardening & Security Verification Script for GMD Co-living PMS.
 * Checks RLS coverage across migrations, error/loading boundaries, and secret hygiene.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let failures = 0;

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failures++;
}

// 1. Verify every created table has RLS enabled across migrations
const migrationsDir = path.join(root, "supabase", "migrations");
const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const allSql = migrationFiles.map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8")).join("\n");

const tableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)\s*\(/gi;
const tables = [];
let m;
while ((m = tableRegex.exec(allSql)) !== null) {
  tables.push(m[1]);
}

for (const tbl of tables) {
  const rlsRegex = new RegExp(`alter\\s+table\\s+(?:public\\.)?${tbl}\\s+enable\\s+row\\s+level\\s+security`, "i");
  if (rlsRegex.test(allSql)) {
    pass(`RLS enabled on table '${tbl}'`);
  } else {
    fail(`Missing ENABLE ROW LEVEL SECURITY on table '${tbl}'`);
  }
}

// 2. Verify required error and loading UI files exist
const requiredFiles = [
  "app/error.tsx",
  "app/global-error.tsx",
  "app/not-found.tsx",
  "app/(dashboard)/error.tsx",
  "app/(dashboard)/loading.tsx",
  "components/page-loader.tsx",
  ".env.example",
  "supabase/tests/rls_role_tests.sql",
];

for (const rel of requiredFiles) {
  if (fs.existsSync(path.join(root, rel))) {
    pass(`Required hardening file exists: ${rel}`);
  } else {
    fail(`Missing required file: ${rel}`);
  }
}

// 3. Ensure no plaintext Aadhaar console logging in app/ or lib/
function walkTs(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTs(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

const sourceFiles = [...walkTs(path.join(root, "app")), ...walkTs(path.join(root, "lib"))];
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (/console\.(log|info|debug)\([^)]*aadhaar/i.test(content)) {
    fail(`Potential Aadhaar logging in ${path.relative(root, file)}`);
  }
}
pass("Zero console logging of Aadhaar fields detected across app/ and lib/");

// 4. Ensure .env.local is ignored in .gitignore
const gitignore = fs.existsSync(path.join(root, ".gitignore"))
  ? fs.readFileSync(path.join(root, ".gitignore"), "utf8")
  : "";
if (gitignore.includes(".env*.local") || gitignore.includes(".env.local")) {
  pass(".env.local is excluded in .gitignore");
} else {
  fail(".env.local is NOT excluded in .gitignore");
}

if (failures > 0) {
  console.error(`\nSecurity audit failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log("\nAll static hardening checks passed.");

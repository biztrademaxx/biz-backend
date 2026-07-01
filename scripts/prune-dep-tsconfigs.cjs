/**
 * Some npm packages ship dev-only tsconfig.json files that confuse the IDE.
 * Safe to remove — only published JS/types are used at runtime.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

for (const rel of ["node_modules/express-rate-limit/tsconfig.json"]) {
  const abs = path.join(root, rel);
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
}

const path = require("path");

// Automatically enable SWC WASM fallback on Windows environments where native binary has DLL init issues
if (process.platform === "win32") {
  if (!process.env.NEXT_TEST_WASM) {
    process.env.NEXT_TEST_WASM = "1";
  }
  if (!process.env.NEXT_TEST_WASM_DIR) {
    process.env.NEXT_TEST_WASM_DIR = path.join(__dirname, "node_modules/@next/swc-wasm-nodejs");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;

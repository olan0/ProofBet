import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

const inputPath = "src/pages/Documentation.jsx";
const outputPath = "docs/DOCS.md";

console.log("📘 Generating Markdown documentation from:", inputPath);

// Read your Documentation.jsx
const jsx = fs.readFileSync(inputPath, "utf8");

// Very simple sanitization: strip imports & React syntax so JSDOM won’t choke
const cleanHtml = jsx
  .replace(/import[\s\S]*?from\s+['"].*?['"];?/g, "")
  .replace(/export\s+default\s+function.*\{/g, "<div>")
  .replace(/<\/\s*div\s*>\s*}$/g, "</div>")
  .replace(/\{.*?\}/g, ""); // crude JSX braces cleanup for markdown conversion

// Create fake DOM
const dom = new JSDOM(cleanHtml);
const body = dom.window.document.body;

// Use Turndown to convert HTML to Markdown
const td = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced"
});
const markdown = td.turndown(body.innerHTML);

// Ensure directory exists
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

// Write result
fs.writeFileSync(outputPath, markdown);

console.log(`✅ Wrote documentation to ${outputPath} (${markdown.length} chars)`);

#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG_FILE, loadConfig, resolveProjectPaths } from "./core/config.js";
import { validateProject } from "./core/validator.js";
import { assertSafeBuildPaths } from "./core/paths.js";
import { buildResourcePack } from "./core/generator.js";
import { initializeProject } from "./core/initializer.js";

const currentFile = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === currentFile;

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error("Missing value for " + name);
  }
  return args[index + 1];
}

function printHelp() {
  console.log([
    "MTR Resource Packs Creator",
    "",
    "Usage:",
    "  node src/cli.js init [directory]",
    "  node src/cli.js validate [--config file]",
    "  node src/cli.js build [--config file] [--no-archive]",
    "",
    "Commands:",
    "  init       Create a starter resource-pack project",
    "  validate   Check the project configuration and source directory",
    "  build      Generate the resource-pack directory and optional ZIP",
    "",
    "Options:",
    "  --config   Path to the JSON project configuration",
    "  --no-archive  Skip ZIP generation for this build"
  ].join("\n"));
}

async function run() {
  const args = process.argv.slice(2);
  const command = args.shift();

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "init") {
    const target = args.find((value) => !value.startsWith("--")) || ".";
    const result = await initializeProject(target);
    console.log("Project initialized: " + result.projectDir);
    console.log("Configuration: " + result.configPath);
    console.log("Add your files under: " + result.sourceDir);
    return;
  }

  if (command !== "validate" && command !== "build") {
    throw new Error("Unknown command: " + command + ". Run with --help for usage.");
  }

  const configArgument = readOption(args, "--config") || DEFAULT_CONFIG_FILE;
  const configPath = path.resolve(process.cwd(), configArgument);
  const config = await loadConfig(configPath);
  const paths = resolveProjectPaths(config, configPath);

  assertSafeBuildPaths({
    sourceDir: paths.sourceDir,
    outputDir: paths.outputDir,
    archivePath: config.archive.enabled && !args.includes("--no-archive") ? paths.archivePath : null
  });

  if (command === "validate") {
    const warnings = await validateProject(config, paths);
    console.log("Project validation passed.");
    for (const warning of warnings) console.warn("Warning: " + warning);
    return;
  }

  const result = await buildResourcePack({
    config,
    configPath,
    archiveEnabled: config.archive.enabled && !args.includes("--no-archive")
  });

  console.log("Resource pack generated: " + result.outputDir);
  console.log("Files copied: " + result.fileCount);
  if (result.archivePath) console.log("ZIP archive: " + result.archivePath);
  for (const warning of result.warnings) console.warn("Warning: " + warning);
}

if (isDirectRun) {
  run().catch((error) => {
    console.error("Error: " + error.message);
    process.exitCode = 1;
  });
}

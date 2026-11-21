import path from "node:path";
import { spawn } from "node:child_process";
import { downloadFile, ensureDir } from "./download.js";
import { mavenToPath } from "./environment.js";

// Standalone command-line tools that turn compiled jars into readable Java. They
// are fetched from Maven Central into the git-ignored test environment, so the
// repository never carries binaries and no Gradle build is involved.
export const DECOMPILER_TOOLS = {
  vineflower: {
    label: "Vineflower 1.12.0",
    coordinates: "org.vineflower:vineflower:1.12.0",
    sha1: "85570609a0a5941a7d2918b6260b209de810f66f"
  },
  specialSource: {
    label: "SpecialSource 1.11.6",
    coordinates: "net.md-5:SpecialSource:1.11.6:shaded",
    sha1: "00fc68255c887ea9232ad872d59a4504e5d94181"
  }
};

export const MAVEN_CENTRAL_URL = "https://repo1.maven.org/maven2";

export function toolArtifactPath(tool) {
  return mavenToPath(tool.coordinates);
}

export function toolDownloadUrl(tool, repository = MAVEN_CENTRAL_URL) {
  return repository.replace(/\/+$/, "") + "/" + toolArtifactPath(tool);
}

const MAX_CAPTURED_OUTPUT = 4000;

// Runs a tool in the bundled JVM and rejects with the captured output, which is
// what makes a failed remap or decompile diagnosable from the CLI.
function runJavaTool(java, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(java, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";

    const capture = (chunk) => {
      if (output.length < MAX_CAPTURED_OUTPUT) output += chunk.toString();
    };

    child.stdout.on("data", capture);
    child.stderr.on("data", capture);

    child.on("error", (error) => {
      reject(new Error("Failed to start Java (" + java + "): " + error.message));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = output.trim();
      reject(new Error(label + " failed with exit code " + code + (detail ? ":\n" + detail : "")));
    });
  });
}

export async function ensureDecompilerTools(options = {}) {
  const { toolsDir, log = () => {} } = options;
  await ensureDir(toolsDir);

  const tools = {};
  for (const [key, tool] of Object.entries(DECOMPILER_TOOLS)) {
    const fileName = path.basename(toolArtifactPath(tool));
    const dest = path.join(toolsDir, fileName);

    log("Resolving " + tool.label + "...");
    await downloadFile(toolDownloadUrl(tool), dest, { sha1: tool.sha1, label: fileName, log });
    tools[key] = dest;
  }

  return tools;
}

// SpecialSource understands the ProGuard mapping files Mojang publishes, so the
// obfuscated client can be renamed to its official names before decompiling.
export async function remapJar(options) {
  const { java, mapperJar, inJar, outJar, mappingsFile, log = () => {} } = options;

  log("Deobfuscating " + path.basename(inJar) + " with official mappings...");
  await ensureDir(path.dirname(outJar));

  await runJavaTool(java, [
    "-jar", mapperJar,
    "--in-jar", inJar,
    "--out-jar", outJar,
    "--srg-in", mappingsFile,
    "--kill-source",
    "--quiet"
  ], "SpecialSource");
}

// `externals` are the jars the decompiler may read but must not decompile; they
// are what let it resolve supertypes from the Minecraft libraries and produce
// signature-complete output.
export async function decompileJar(options) {
  const { java, decompilerJar, jarPath, outDir, externals = [] } = options;

  const args = ["-jar", decompilerJar, "-s"];
  for (const external of externals) args.push("-e=" + external);
  args.push(jarPath, outDir);

  await ensureDir(outDir);
  await runJavaTool(java, args, "Vineflower");
}

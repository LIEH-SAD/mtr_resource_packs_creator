import fs from "node:fs/promises";
import path from "node:path";
import { downloadFile, ensureDir, pathExists, readJson, setProxy, writeJson } from "./download.js";
import { DEFAULT_GAME_DIR_NAME, MINECRAFT_VERSION, detectPlatform, libraryApplies, mavenToPath } from "./environment.js";
import { resolveJavaCommand } from "./launcher.js";
import { decompileJar, ensureDecompilerTools, remapJar } from "./decompiler.js";

export const DECOMPILED_DIR_NAME = "decompiled";
export const SOURCE_TARGETS = ["minecraft", "mods"];

const MANIFEST_FILE = "decompiled.json";

export function parseSourceTargets(value) {
  if (!value) return [...SOURCE_TARGETS];

  const requested = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item !== "all");

  const unknown = requested.filter((item) => !SOURCE_TARGETS.includes(item));
  if (unknown.length > 0) {
    throw new Error("Unknown source target: " + unknown.join(", ") + ". Available targets: " + SOURCE_TARGETS.join(", "));
  }

  return requested.length > 0 ? requested : [...SOURCE_TARGETS];
}

export function decompiledDirName(jarPath) {
  return path.basename(jarPath).replace(/\.jar$/i, "");
}

async function readManifest(filePath) {
  if (!(await pathExists(filePath))) return {};
  try {
    return await readJson(filePath);
  } catch {
    return {};
  }
}

// Size plus modification time is enough to notice that setup re-downloaded a
// jar, which is what makes re-running the command cheap instead of decompiling
// thousands of classes again.
async function jarSignature(jarPath) {
  const stat = await fs.stat(jarPath);
  return { file: path.basename(jarPath), size: stat.size, modified: Math.round(stat.mtimeMs) };
}

function isFresh(record, signature) {
  return Boolean(record) &&
    record.source?.size === signature.size &&
    record.source?.modified === signature.modified;
}

async function countJavaFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (entry.isDirectory()) count += await countJavaFiles(path.join(dir, entry.name));
    else if (entry.name.toLowerCase().endsWith(".java")) count += 1;
  }

  return count;
}

// The jars the decompiler may read but must not decompile: they resolve
// supertypes and constants from the Minecraft and Fabric libraries.
async function collectClasspathJars({ versionJson, librariesDir, metaDir, platform }) {
  const jars = [];

  for (const library of versionJson.libraries) {
    if (!libraryApplies(library, platform) || !library.downloads?.artifact) continue;
    const jarPath = path.join(librariesDir, ...library.downloads.artifact.path.split("/"));
    if (await pathExists(jarPath)) jars.push(jarPath);
  }

  const fabricProfilePath = path.join(metaDir, "fabric-profile.json");
  if (await pathExists(fabricProfilePath)) {
    const fabricProfile = await readJson(fabricProfilePath);
    for (const library of fabricProfile.libraries || []) {
      const jarPath = path.join(librariesDir, ...mavenToPath(library.name).split("/"));
      if (await pathExists(jarPath)) jars.push(jarPath);
    }
  }

  return jars;
}

async function listModJars(modsDir) {
  let entries = [];

  try {
    entries = await fs.readdir(modsDir);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  return entries
    .filter((name) => name.toLowerCase().endsWith(".jar"))
    .sort()
    .map((name) => path.join(modsDir, name));
}

// Decompiles the test client and its mods into `minecraft-test/decompiled/` so
// Java sources can be read from the IDE without a Gradle project. The Minecraft
// client is first deobfuscated with Mojang's official mappings, otherwise the
// decompiled code would only contain obfuscated names.
export async function generateSources(options = {}) {
  const {
    projectDir = process.cwd(),
    gameDirName = DEFAULT_GAME_DIR_NAME,
    minecraftVersion = MINECRAFT_VERSION,
    targets = [...SOURCE_TARGETS],
    java: javaOption,
    proxy,
    force = false,
    log = console.log
  } = options;

  const activeProxy = setProxy(proxy);
  const platform = detectPlatform();
  const root = path.resolve(projectDir, gameDirName);
  const versionDir = path.join(root, "versions", minecraftVersion);
  const versionJsonPath = path.join(versionDir, minecraftVersion + ".json");
  const clientJar = path.join(versionDir, minecraftVersion + ".jar");

  if (!(await pathExists(versionJsonPath)) || !(await pathExists(clientJar))) {
    throw new Error("Test environment not found in " + root + ". Run the setup command first.");
  }

  const versionJson = await readJson(versionJsonPath);
  const metaDir = path.join(root, ".mtr-test");
  const decompiledRoot = path.join(root, DECOMPILED_DIR_NAME);
  const manifestPath = path.join(metaDir, MANIFEST_FILE);
  const java = resolveJavaCommand(javaOption);

  log("Game directory: " + root);
  if (activeProxy) log("Proxy: " + activeProxy);
  log("Java: " + java);

  const tools = await ensureDecompilerTools({ toolsDir: path.join(metaDir, "tools"), log });
  const classpath = await collectClasspathJars({
    versionJson,
    librariesDir: path.join(root, "libraries"),
    metaDir,
    platform
  });

  const previous = await readManifest(manifestPath);
  const entries = { ...(previous.entries || {}) };
  const modules = [];

  if (targets.includes("minecraft")) {
    const mappings = versionJson.downloads?.client_mappings;
    if (!mappings) throw new Error("Minecraft " + minecraftVersion + " does not publish official mappings.");

    const outDir = path.join(decompiledRoot, "minecraft");
    const signature = await jarSignature(clientJar);

    if (!force && isFresh(entries.minecraft, signature) && (await pathExists(outDir))) {
      log("Minecraft sources are up to date (" + entries.minecraft.files + " files).");
      modules.push(entries.minecraft);
    } else {
      const mappingsPath = path.join(metaDir, minecraftVersion + "-mappings.txt");
      const deobfJar = path.join(metaDir, "minecraft-" + minecraftVersion + "-deobf.jar");

      await downloadFile(mappings.url, mappingsPath, {
        sha1: mappings.sha1,
        size: mappings.size,
        label: minecraftVersion + "-mappings.txt",
        log
      });

      await remapJar({
        java,
        mapperJar: tools.specialSource,
        inJar: clientJar,
        outJar: deobfJar,
        mappingsFile: mappingsPath,
        log
      });

      log("Decompiling the Minecraft client (this can take several minutes)...");
      await fs.rm(outDir, { recursive: true, force: true });
      await decompileJar({ java, decompilerJar: tools.vineflower, jarPath: deobfJar, outDir, externals: classpath });

      entries.minecraft = {
        id: "minecraft",
        kind: "minecraft",
        label: "Minecraft " + minecraftVersion,
        source: signature,
        outputDir: outDir,
        files: await countJavaFiles(outDir)
      };
      modules.push(entries.minecraft);
    }
  }

  if (targets.includes("mods")) {
    const modJars = await listModJars(path.join(root, "mods"));
    if (modJars.length === 0) log("No mod jars found, skipping mods.");

    for (const modJar of modJars) {
      const id = "mod:" + path.basename(modJar);
      const outDir = path.join(decompiledRoot, "mods", decompiledDirName(modJar));
      const signature = await jarSignature(modJar);

      if (!force && isFresh(entries[id], signature) && (await pathExists(outDir))) {
        log("Mod sources are up to date: " + path.basename(modJar));
        modules.push(entries[id]);
        continue;
      }

      log("Decompiling " + path.basename(modJar) + "...");
      await fs.rm(outDir, { recursive: true, force: true });
      await decompileJar({ java, decompilerJar: tools.vineflower, jarPath: modJar, outDir, externals: classpath });

      entries[id] = {
        id,
        kind: "mod",
        label: path.basename(modJar),
        source: signature,
        outputDir: outDir,
        files: await countJavaFiles(outDir)
      };
      modules.push(entries[id]);
    }
  }

  await ensureDir(decompiledRoot);
  await writeJson(manifestPath, { minecraftVersion, entries });

  return {
    gameDir: root,
    decompiledDir: decompiledRoot,
    java,
    targets,
    modules: modules.map((module) => ({
      id: module.id,
      label: module.label,
      outputDir: module.outputDir,
      files: module.files
    }))
  };
}

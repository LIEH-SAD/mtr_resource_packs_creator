import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG, DEFAULT_CONFIG_FILE } from "./config.js";

export async function initializeProject(targetDir = ".") {
  const projectDir = path.resolve(targetDir);
  const configPath = path.join(projectDir, DEFAULT_CONFIG_FILE);
  const sourceDir = path.join(projectDir, DEFAULT_CONFIG.paths.source);

  await fs.mkdir(projectDir, { recursive: true });

  try {
    await fs.access(configPath);
    throw new Error("Configuration already exists: " + configPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  await fs.mkdir(path.join(sourceDir, "assets", DEFAULT_CONFIG.namespace), { recursive: true });
  await fs.writeFile(
    path.join(sourceDir, ".gitkeep"),
    "This folder contains the resource-pack input files.\n",
    { flag: "wx" }
  ).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });

  await fs.writeFile(
    path.join(sourceDir, "assets", DEFAULT_CONFIG.namespace, ".gitkeep"),
    "Place namespace assets in this folder.\n",
    { flag: "wx" }
  );

  await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", { flag: "wx" });

  return { projectDir, configPath, sourceDir };
}

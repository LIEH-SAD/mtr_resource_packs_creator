export { DEFAULT_CONFIG, DEFAULT_CONFIG_FILE, loadConfig, resolveProjectPaths, validateConfig } from "./core/config.js";
export { buildResourcePack } from "./core/generator.js";
export { validateProject } from "./core/validator.js";
export { initializeProject } from "./core/initializer.js";
export { createPackMetadata } from "./core/metadata.js";
export { assertSafeBuildPaths, isSameOrInside } from "./core/paths.js";

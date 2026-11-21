import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildResourcePack,
  createPackMetadata,
  isSameOrInside,
  validateConfig
} from "../src/index.js";

test("configuration validation accepts the starter configuration", () => {
  const errors = validateConfig({
    name: "test-pack",
    namespace: "mtr",
    pack: { packFormat: 15, description: "Test pack" },
    paths: { source: "resource-pack", output: "dist/output", archive: "dist/output.zip" },
    archive: { enabled: true }
  });

  assert.deepEqual(errors, []);
});

test("configuration validation reports an invalid namespace", () => {
  const errors = validateConfig({
    name: "test-pack",
    namespace: "Invalid Namespace",
    pack: { packFormat: 15, description: "Test pack" },
    paths: { source: "resource-pack", output: "dist/output", archive: "dist/output.zip" },
    archive: { enabled: false }
  });

  assert.ok(errors.some((error) => error.includes("namespace")));
});

test("path containment detects equal and nested paths", () => {
  const root = path.resolve("/tmp/mtr-pack-test");
  assert.equal(isSameOrInside(root, root), true);
  assert.equal(isSameOrInside(root, path.join(root, "assets", "mtr")), true);
  assert.equal(isSameOrInside(root, path.resolve(root, "..", "other")), false);
});

test("pack.mcmeta is generated from the configuration", () => {
  const metadata = JSON.parse(createPackMetadata({
    pack: { packFormat: 15, description: "Test pack" }
  }));

  assert.deepEqual(metadata, {
    pack: { pack_format: 15, description: "Test pack" }
  });
});

test("build copies source files and generates pack.mcmeta", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mtr-pack-test-"));
  const configPath = path.join(temporaryRoot, "mtr-resource-pack.config.json");
  const sourceDir = path.join(temporaryRoot, "resource-pack");
  const assetDir = path.join(sourceDir, "assets", "mtr");

  await fs.mkdir(assetDir, { recursive: true });
  await fs.writeFile(path.join(assetDir, "sample.txt"), "sample asset", "utf8");

  const config = {
    name: "test-pack",
    namespace: "mtr",
    pack: { packFormat: 15, description: "Test pack" },
    paths: {
      source: "resource-pack",
      output: "dist/resource-pack",
      archive: "dist/test-pack.zip"
    },
    archive: { enabled: false }
  };

  try {
    const result = await buildResourcePack({ config, configPath, archiveEnabled: false });
    const copiedAsset = await fs.readFile(path.join(result.outputDir, "assets", "mtr", "sample.txt"), "utf8");
    const metadata = JSON.parse(await fs.readFile(path.join(result.outputDir, "pack.mcmeta"), "utf8"));

    assert.equal(copiedAsset, "sample asset");
    assert.equal(metadata.pack.pack_format, 15);
    assert.equal(result.fileCount, 2);
    assert.equal(result.archivePath, null);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

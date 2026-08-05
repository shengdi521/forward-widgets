"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "forward-widgets.fwd"), "utf8"));

assert.equal(manifest.widgets.length, 2);
assert.equal(manifest.widgets.find((entry) => entry.id === "forward.bilibili.tv.search").version, "1.3.1");
assert.equal(manifest.widgets.find((entry) => entry.id === "forward.iqiyi.tv.search").version, "1.3.1");

for (const entry of manifest.widgets) {
  const filename = new URL(entry.url).pathname.split("/").pop();
  const modulePath = path.join(root, "widgets", filename);
  const sandbox = {
    WidgetMetadata: undefined,
    Widget: {
      http: {},
      storage: { get() {}, set() {}, remove() {} },
    },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.createContext(sandbox);
  new vm.Script(fs.readFileSync(modulePath, "utf8"), { filename: modulePath }).runInContext(sandbox);

  const metadata = sandbox.WidgetMetadata;
  assert.ok(metadata, `${filename} 缺少 WidgetMetadata`);
  assert.equal(entry.id, metadata.id);
  assert.equal(entry.title, metadata.title);
  assert.equal(entry.description, metadata.description);
  assert.equal(entry.requiredVersion, metadata.requiredVersion);
  assert.equal(entry.version, metadata.version);
  assert.equal(entry.author, metadata.author);
  assert.ok(Array.isArray(metadata.modules) && metadata.modules.length > 0, `${filename} modules 不能为空`);

  for (const module of metadata.modules) {
    assert.equal(typeof sandbox[module.functionName], "function", `${filename} 缺少 ${module.functionName}`);
  }
  assert.equal(typeof sandbox[metadata.search.functionName], "function", `${filename} 缺少搜索函数`);
}

console.log("OK forward-widgets.fwd", {
  widgets: manifest.widgets.length,
  versions: manifest.widgets.map((entry) => entry.version),
});

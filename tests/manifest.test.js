"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "forward-widgets.fwd"), "utf8"));

assert.equal(manifest.widgets.length, 2);
assert.equal(manifest.widgets.find((entry) => entry.id === "forward.bilibili.tv.search").version, "1.4.2");
assert.equal(manifest.widgets.find((entry) => entry.id === "forward.iqiyi.tv.search").version, "1.4.1");

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
  assert.equal(new URL(entry.url).searchParams.get("v"), metadata.version, `${filename} URL 缺少版本缓存参数`);
  assert.ok(Array.isArray(metadata.modules) && metadata.modules.length > 0, `${filename} modules 不能为空`);

  for (const module of metadata.modules) {
    assert.equal(typeof sandbox[module.functionName], "function", `${filename} 缺少 ${module.functionName}`);
  }
  assert.equal(typeof sandbox[metadata.search.functionName], "function", `${filename} 缺少搜索函数`);
  assert.deepEqual(
    Array.from(metadata.search.params, (param) => param.name),
    ["keyword"],
    `${filename} 全局搜索应只保留稳定的关键词输入框`,
  );
  assert.equal(
    metadata.modules.some((module) => module.functionName === metadata.search.functionName),
    false,
    `${filename} 不得把顶层搜索重复注册成普通模块`,
  );
}

console.log("OK forward-widgets.fwd", {
  widgets: manifest.widgets.length,
  versions: manifest.widgets.map((entry) => entry.version),
});

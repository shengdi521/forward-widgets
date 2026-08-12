"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "forward-widgets.fwd"), "utf8"));

assert.equal(manifest.widgets.length, 2);
assert.equal(manifest.widgets.find((entry) => entry.id === "forward.bilibili.tv.search").version, "1.4.7");
assert.equal(manifest.widgets.find((entry) => entry.id === "forward.iqiyi.tv.search").version, "1.4.4");

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
  assert.match(entry.url, /\.js$/, `${filename} URL 必须以 .js 结尾，避免 Forward 模块类型校验失败`);
  assert.equal(new URL(entry.url).search, "", `${filename} URL 不得携带客户端可能误判的查询参数`);
  assert.ok(Array.isArray(metadata.modules) && metadata.modules.length > 0, `${filename} modules 不能为空`);

  for (const module of metadata.modules) {
    assert.equal(typeof sandbox[module.functionName], "function", `${filename} 缺少 ${module.functionName}`);
  }
  assert.equal(typeof sandbox[metadata.search.functionName], "function", `${filename} 缺少搜索函数`);
  const expectedSearchParams = ["keyword", "page"];
  assert.deepEqual(
    Array.from(metadata.search.params, (param) => param.name),
    expectedSearchParams,
    `${filename} 全局搜索参数不符合稳定输入约定`,
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

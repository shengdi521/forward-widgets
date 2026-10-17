"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const cases = [
  {
    file: "bilibili-rex.js",
    source: "bilibili-tv-search.js",
    marker: "var BILIBILI_SEARCH_API",
    id: "rex.bilibili.tv.search",
    title: "B站影视搜索_Rex",
    cookie: "bilibiliCookie",
  },
  {
    file: "iqiyi-rex.js",
    source: "iqiyi-tv-search.js",
    marker: "var IQIYI_SEARCH_API",
    id: "rex.iqiyi.tv.search",
    title: "爱奇艺影视搜索_Rex",
    cookie: "iqiyiCookie",
  },
];

for (const item of cases) {
  const target = path.resolve(__dirname, "..", "widgets", item.file);
  const source = path.resolve(__dirname, "..", "widgets", item.source);
  const targetText = fs.readFileSync(target, "utf8");
  const sourceText = fs.readFileSync(source, "utf8");
  const targetMarker = targetText.indexOf(item.marker);
  const sourceMarker = sourceText.indexOf(item.marker);
  assert.ok(targetMarker >= 0, `${item.file} 缺少运行时代码标记`);
  assert.ok(sourceMarker >= 0, `${item.source} 缺少运行时代码标记`);
  assert.equal(
    targetText.slice(targetMarker),
    sourceText.slice(sourceMarker),
    `${item.file} 的播放、音视频和字幕逻辑必须与已验证版本一致`,
  );

  const sandbox = {
    WidgetMetadata: undefined,
    console: { log() {}, warn() {}, error() {} },
    Widget: {
      http: { get: async () => ({ data: {} }) },
      storage: { get() {}, set() {}, remove() {} },
    },
  };
  vm.createContext(sandbox);
  new vm.Script(targetText, { filename: target }).runInContext(sandbox);

  assert.equal(sandbox.WidgetMetadata.id, item.id);
  assert.equal(sandbox.WidgetMetadata.title, item.title);
  assert.equal(sandbox.WidgetMetadata.requiredVersion, "0.0.1");
  assert.equal(sandbox.WidgetMetadata.globalParams[0].name, item.cookie);
  assert.deepEqual(
    Array.from(sandbox.WidgetMetadata.search.params, (param) => param.name),
    ["keyword", "page"],
  );
  assert.deepEqual(
    Array.from(sandbox.WidgetMetadata.modules, (module) => module.id),
    ["loadResource", "loadSubtitle"],
  );
  assert.equal(sandbox.WidgetMetadata.modules[0].type, "stream");
  assert.equal(sandbox.WidgetMetadata.modules[1].type, "subtitle");
  assert.equal(typeof sandbox.search, "function");
  assert.equal(typeof sandbox.loadDetail, "function");
  assert.equal(typeof sandbox.loadResource, "function");
  assert.equal(typeof sandbox.loadSubtitle, "function");
}

console.log("OK rex-media-modules", cases.map((item) => item.file).join(", "));

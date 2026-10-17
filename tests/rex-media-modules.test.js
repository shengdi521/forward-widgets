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

const sandboxes = [];

for (const item of cases) {
  const target = path.resolve(__dirname, "..", "widgets", item.file);
  const targetText = fs.readFileSync(target, "utf8");
  const targetMarker = targetText.indexOf(item.marker);
  assert.ok(targetMarker >= 0, `${item.file} 缺少运行时代码标记`);
  assert.equal(targetText.includes('type: "url"'), false, `${item.file} 不得继续使用 Forward 的 url 类型`);

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
    ["searchList", "loadResource", "loadSubtitle"],
  );
  assert.equal(sandbox.WidgetMetadata.modules[0].type, "video");
  assert.equal(sandbox.WidgetMetadata.modules[1].type, "stream");
  assert.equal(sandbox.WidgetMetadata.modules[2].type, "subtitle");
  assert.equal(sandbox.WidgetMetadata.search.functionName, "searchGlobal");
  assert.equal(typeof sandbox.search, "function");
  assert.equal(typeof sandbox.searchList, "function");
  assert.equal(typeof sandbox.searchGlobal, "function");
  assert.equal(typeof sandbox.loadDetail, "function");
  assert.equal(typeof sandbox.loadResource, "function");
  assert.equal(typeof sandbox.loadSubtitle, "function");
  sandboxes.push({ item, sandbox });
}

(async () => {
  for (const { item, sandbox } of sandboxes) {
    const invalidDetail = await sandbox.loadDetail("invalid");
    const invalidResources = await sandbox.loadResource({});
    const invalidSubtitles = await sandbox.loadSubtitle({});
    assert.equal(Array.isArray(invalidDetail), true, `${item.file} 无效详情链接应返回数组`);
    assert.equal(Array.isArray(invalidResources), true, `${item.file} 无效播放参数应返回数组`);
    assert.equal(Array.isArray(invalidSubtitles), true, `${item.file} 无效字幕参数应返回数组`);
    assert.equal(invalidDetail.length, 0, `${item.file} 无效详情链接应返回空数组`);
    assert.equal(invalidResources.length, 0, `${item.file} 无效播放参数应返回空数组`);
    assert.equal(invalidSubtitles.length, 0, `${item.file} 无效字幕参数应返回空数组`);

    if (item.file === "bilibili-rex.js") {
      sandbox.Widget.http.get = async () => ({
        data: {
          code: 0,
          result: {
            title: "测试剧集",
            episodes: [{ id: 1, title: "1", url: "https://www.bilibili.com/bangumi/play/ep1" }],
          },
        },
      });
      const detail = await sandbox.loadDetail("bilibili:123");
      assert.equal(detail.length, 1);
      assert.equal(detail[0].type, "link");
      assert.equal(detail[0].episodeItems[0].type, "link");
    } else {
      sandbox.Widget.http.get = async () => ({
        data: {
          code: "A00000",
          data: {
            epsodelist: [{
              playUrl: "https://www.iqiyi.com/v_test.html",
              tvId: "123",
              vid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              name: "正片",
            }],
          },
        },
      });
      const detail = await sandbox.loadDetail("iqiyi:123");
      assert.equal(detail.length, 1);
      assert.equal(detail[0].type, "link");
      assert.equal(detail[0].episodeItems[0].type, "link");
    }
  }
  console.log("OK rex-media-modules", cases.map((item) => item.file).join(", "));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

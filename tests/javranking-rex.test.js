"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const target = path.resolve(__dirname, "..", "widgets", "javranking-rex.js");
const calls = [];
const rankingMarkdown = [
  "# DMM 本周热销榜",
  "1. [SNOS-421 Here We Go！伊藤舞雪](https://javranking.cc/zh-hans/videos/3318/) · 261 积分",
  "2. [ABC-123 测试条目](https://javranking.cc/zh-hans/videos/4000/) · 198 积分",
].join("\n");
const detailMarkdown = [
  "# Here We Go！伊藤舞雪 S1 震撼出道",
  "番号：SNOS-421",
  "日期：2026年11月10日 · 140 分钟",
  "![海报](https://pics.dmm.co.jp/digital/video/snos00421/snos00421pl.jpg)",
].join("\n");
const playableHtml = '<script>var source = "https://media.example.test/video.m3u8?token=abc";</script>';

const sandbox = {
  WidgetMetadata: undefined,
  console: { log() {}, warn() {}, error() {} },
  Widget: {
    http: {
      get: async (url, options) => {
        calls.push({ url, options });
        if (url.includes("/videos/3318/") && !url.endsWith(".md")) return { status: 200, data: playableHtml };
        if (url.includes("/videos/3318.md")) return { status: 200, data: detailMarkdown };
        if (url.includes("/rankings/") || url.includes("/search/")) return { status: 200, data: rankingMarkdown };
        return { status: 200, data: playableHtml };
      },
    },
    html: {
      load: () => {
        throw new Error("fixture intentionally uses Markdown fallback");
      },
    },
  },
};

vm.createContext(sandbox);
new vm.Script(fs.readFileSync(target, "utf8"), { filename: target }).runInContext(sandbox);

(async () => {
  assert.equal(sandbox.WidgetMetadata.id, "javranking_rex");
  assert.equal(sandbox.WidgetMetadata.version, "1.0");
  assert.equal(sandbox.WidgetMetadata.modules.length, 20);
  assert.equal(sandbox.WidgetMetadata.modules.filter((module) => module.type === "video").length, 19);
  assert.equal(sandbox.WidgetMetadata.modules.find((module) => module.id === "loadResource").type, "stream");
  assert.equal(sandbox.WidgetMetadata.modules[0].title, "DMM 本周热销榜");
  assert.equal(sandbox.WidgetMetadata.modules[0].params[1].type, "constant");
  assert.equal(sandbox.WidgetMetadata.modules[0].params[1].value, "/rankings/dmm-weekly/");
  assert.equal(sandbox.WidgetMetadata.search.functionName, "searchGlobal");
  assert.deepEqual(
    Array.from(sandbox.WidgetMetadata.search.params, (param) => param.name),
    ["keyword", "page"],
  );

  const list = await sandbox.loadRanking({
    ranking: "/rankings/dmm-weekly/",
    format: "censored",
    status: "released",
    sort: "latest",
    page: 2,
  });
  assert.equal(list.length, 2);
  assert.equal(list[0].type, "video");
  assert.equal(list[0].link, "https://javranking.cc/zh-hans/videos/3318/");
  assert.equal(list[0].rating, 261);
  const listCall = calls.find((call) => call.url.includes("/rankings/dmm-weekly/"));
  assert.match(listCall.url, /scope=censored/);
  assert.match(listCall.url, /status=released/);
  assert.match(listCall.url, /sort=latest/);
  assert.match(listCall.url, /page=2/);

  const search = await sandbox.searchList({ keyword: "SNOS-421", page: 3 });
  assert.equal(search.length, 2);
  assert.equal((await sandbox.searchGlobal({ keyword: "SNOS-421" })).length, 2);

  const detail = await sandbox.loadDetail("https://javranking.cc/zh-hans/videos/3318/");
  assert.equal(detail.length, 1);
  assert.equal(detail[0].type, "video");
  assert.equal(detail[0].releaseDate, "2026-11-10");
  assert.equal(detail[0].duration, 140);

  const resources = await sandbox.loadResource({ link: "https://javranking.cc/zh-hans/videos/3318/" });
  assert.equal(resources.length, 1);
  assert.equal(resources[0].url, "https://media.example.test/video.m3u8?token=abc");
  assert.equal(resources[0].playerType, "app");

  console.log("OK javranking-rex", {
    modules: sandbox.WidgetMetadata.modules.length,
    list: list.length,
    search: search.length,
    resources: resources.length,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

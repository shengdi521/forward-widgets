"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const target = path.resolve(__dirname, "..", "widgets", "javranking-rankings.js");
const calls = [];
const markdown = [
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

const sandbox = {
  WidgetMetadata: undefined,
  console: { log() {}, warn() {}, error() {} },
  Widget: {
    http: {
      get: async (url, options) => {
        calls.push({ url, options });
        if (url.includes("blocked.example")) {
          return { status: 403, data: "Just a moment..." };
        }
        if (url.includes("/videos/3318.md")) return { status: 200, data: detailMarkdown };
        if (url.endsWith(".md") || url.includes("/rankings/")) return { status: 200, data: markdown };
        return { status: 200, data: markdown };
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
  assert.equal(sandbox.WidgetMetadata.id, "forward.javranking.rankings");
  assert.equal(sandbox.WidgetMetadata.requiredVersion, "0.0.1");
  assert.equal(sandbox.WidgetMetadata.version, "1.1.0");
  assert.equal(sandbox.WidgetMetadata.modules.length, 18);
  assert.ok(sandbox.WidgetMetadata.modules.every((module) => module.functionName === "loadRanking"));
  assert.deepEqual(
    Array.from(sandbox.WidgetMetadata.modules, (module) => module.title),
    [
      "DMM 本周热销榜",
      "DMM 月度DVD榜 2026.10",
      "JAVDB TOP250",
      "JavLibray TOP250",
      "JAVDB 无码 TOP250",
      "JAVDB FC2 TOP250",
      "JAVDB TOP250 2025",
      "DMM 月度热销榜 2025.12",
      "DMM 月度热销榜 2025.11",
      "JAVDB TOP250 2024",
      "JAVDB TOP250 2023",
      "JAVDB TOP250 2022",
      "JAVDB TOP250 2021",
      "JAVDB TOP250 2020",
      "JAVDB TOP250 2019",
      "JAVDB TOP250 2018",
      "JAVDB TOP250 2017",
      "JAVDB TOP250 2016",
    ],
  );
  assert.equal(sandbox.WidgetMetadata.modules.some((module) => module.params[0].type === "enumeration"), false);
  assert.deepEqual(
    Array.from(sandbox.WidgetMetadata.modules, (module) => module.params[0].type),
    Array(18).fill("constant"),
  );
  assert.deepEqual(
    Array.from(sandbox.WidgetMetadata.modules, (module) => module.params[0].value),
    [
      "/rankings/dmm-weekly/",
      "/rankings/dmm-monthly-2026-10/",
      "/rankings/javdb-top250/",
      "/rankings/javlibrary-top250/",
      "/rankings/javdb-uncensored-top250/",
      "/rankings/javdb-fc2-top250/",
      "/rankings/javdb-top250-2025/",
      "/rankings/dmm-monthly-2025-12/",
      "/rankings/dmm-monthly-2025-11/",
      "/rankings/javdb-top250-2024/",
      "/rankings/javdb-top250-2023/",
      "/rankings/javdb-top250-2022/",
      "/rankings/javdb-top250-2021/",
      "/rankings/javdb-top250-2020/",
      "/rankings/javdb-top250-2019/",
      "/rankings/javdb-top250-2018/",
      "/rankings/javdb-top250-2017/",
      "/rankings/javdb-top250-2016/",
    ],
  );
  assert.equal(sandbox.WidgetMetadata.globalParams[0].name, "javrankingCookie");
  assert.equal(
    sandbox.WidgetMetadata.modules[0].params.slice(1).map((param) => param.name).join(","),
    "format,status,sort,page",
  );
  assert.equal(sandbox.WidgetMetadata.search.params.map((param) => param.name).join(","), "keyword,page");
  await assert.rejects(
    () => sandbox.search({ keyword: "  " }),
    /请输入要搜索的番号、女优名或片商/,
  );

  const list = await sandbox.loadRanking({
    ranking: "/rankings/dmm-weekly/",
    format: "censored",
    status: "released",
    sort: "latest",
    page: 2,
    javrankingCookie: "cf_clearance=test; session=test",
  });
  assert.equal(list.length, 2);
  assert.equal(list[0].type, "url");
  assert.equal(list[0].mediaType, "movie");
  assert.equal(list[0].id, "https://javranking.cc/zh-hans/videos/3318/");
  assert.equal(list[0].rating, 261);
  const listCall = calls.find((call) => call.url.includes("/rankings/dmm-weekly/"));
  assert.match(listCall.url, /scope=censored/);
  assert.match(listCall.url, /status=released/);
  assert.match(listCall.url, /sort=latest/);
  assert.match(listCall.url, /page=2/);
  assert.equal(listCall.options.headers.Cookie, "cf_clearance=test; session=test");

  const results = await sandbox.search({ keyword: "SNOS-421", page: 3 });
  assert.equal(results.length, 2);
  assert.match(calls[calls.length - 1].url, /search\/\?q=SNOS-421&page=3/);

  const detail = await sandbox.loadDetail("https://javranking.cc/zh-hans/videos/3318/");
  assert.equal(detail.title, "Here We Go！伊藤舞雪 S1 震撼出道");
  assert.equal(detail.releaseDate, "2026-11-10");
  assert.equal(detail.duration, 140);
  assert.equal(detail.posterPath, "https://pics.dmm.co.jp/digital/video/snos00421/snos00421pl.jpg");

  sandbox.Widget.http.get = async () => ({ status: 403, data: "Just a moment..." });
  await assert.rejects(
    () => sandbox.search({ keyword: "SNOS-421" }),
    /暂时拒绝了请求.*HTTP 403/,
  );

  console.log("OK javranking-rankings", {
    list: list.length,
    search: results.length,
    detail: detail.title,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});


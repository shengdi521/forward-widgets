"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const target = path.resolve(__dirname, "..", "widgets", "bilibili-rex.js");
const calls = [];
const stored = new Map();
let forceWbiFailure = false;

const tvRow = {
  season_id: 1001,
  title: '<em class="keyword">庆余年</em>',
  season_type: 5,
  season_type_name: "电视剧",
  cover: "//i0.hdslb.com/tv.jpg",
  areas: "中国大陆",
  styles: "剧情",
  index_show: "全46集",
  desc: "电视剧简介",
  goto_url: "https://www.bilibili.com/bangumi/play/ss1001",
  pubtime: 1710000000,
  media_score: { score: 9.1 },
};

const movieRow = {
  season_id: 2002,
  title: '<em class="keyword">流浪地球</em>',
  season_type: 2,
  season_type_name: "电影",
  cover: "http://i0.hdslb.com/movie.jpg",
  areas: "中国大陆",
  styles: "科幻",
  desc: "电影简介",
  goto_url: "https://www.bilibili.com/bangumi/play/ss2002",
  pubtime: 1546300800,
  media_score: { score: 8.7 },
};

function queryValue(url, name) {
  return new URL(url).searchParams.get(name);
}

const sandbox = {
  WidgetMetadata: undefined,
  console: { log() {}, warn() {}, error() {} },
  Widget: {
    html: { load() { throw new Error("搜索不应再解析网页卡片"); } },
    storage: {
      get(key) { return stored.get(key); },
      set(key, value) { stored.set(key, value); },
      remove(key) { stored.delete(key); },
    },
    http: {
      async get(url, options) {
        calls.push({ url, options });
        if (url.includes("/x/web-interface/nav")) {
          return {
            data: {
              code: 0,
              data: {
                wbi_img: {
                  img_url: "https://i0.hdslb.com/bfs/wbi/abcdefghijklmnopqrstuvwxyz123456.png",
                  sub_url: "https://i0.hdslb.com/bfs/wbi/654321zyxwvutsrqponmlkjihgfedcba.png",
                },
              },
            },
          };
        }
        if (url.includes("/wbi/search/type")) {
          if (forceWbiFailure) return { data: { code: -352, message: "风控校验失败" } };
          const row = queryValue(url, "search_type") === "media_ft" ? movieRow : tvRow;
          return { data: { code: 0, message: "OK", data: { result: [row] } } };
        }
        if (url.includes("/x/web-interface/search/type")) {
          const row = queryValue(url, "search_type") === "media_ft" ? movieRow : tvRow;
          return { data: { code: 0, message: "OK", data: { result: [row] } } };
        }
        throw new Error("unmocked URL: " + url);
      },
    },
  },
};

vm.createContext(sandbox);
new vm.Script(fs.readFileSync(target, "utf8"), { filename: target }).runInContext(sandbox);

(async () => {
  assert.equal(sandbox.WidgetMetadata.version, "2.1.0");
  assert.equal(sandbox.WidgetMetadata.search.functionName, "searchGlobal");
  assert.equal(typeof sandbox.searchList, "function");
  assert.equal(typeof sandbox.searchGlobal, "function");

  const empty = await sandbox.searchList({ keyword: "  " });
  assert.equal(empty[0].id, "bilibili-status-empty-search");

  const cookie = "SESSDATA=test-cookie";
  const results = await sandbox.searchList({ keyword: "流浪地球", page: 3, bilibiliCookie: cookie });
  assert.equal(results.length, 2);
  assert.equal(results[0].title, "庆余年");
  assert.equal(results[0].type, "link");
  assert.equal(results[0].mediaType, "tv");
  assert.equal(results[0].link, "https://www.bilibili.com/bangumi/play/ss1001");
  assert.equal(results[0].posterPath, "https://i0.hdslb.com/tv.jpg");
  assert.equal(results[1].title, "流浪地球");
  assert.equal(results[1].mediaType, "movie");
  assert.equal(results[1].releaseDate, "2019-01-01");

  const searchCalls = calls.filter((call) => call.url.includes("/search/type"));
  assert.equal(searchCalls.length, 2);
  assert.ok(searchCalls.every((call) => call.url.includes("/wbi/search/type")));
  assert.ok(searchCalls.every((call) => /^[a-f0-9]{32}$/.test(queryValue(call.url, "w_rid"))));
  assert.ok(searchCalls.every((call) => queryValue(call.url, "page") === "3"));
  assert.ok(searchCalls.every((call) => call.options.headers.Cookie === cookie));
  assert.equal(calls.filter((call) => call.url.includes("search.bilibili.com/all")).length, 0);

  const fallbackStart = calls.length;
  forceWbiFailure = true;
  const fallback = await sandbox.searchGlobal({ keyword: "流浪地球", page: 1, bilibiliCookie: cookie });
  forceWbiFailure = false;
  assert.equal(fallback.length, 2);
  const fallbackCalls = calls.slice(fallbackStart).filter((call) => call.url.includes("/search/type"));
  assert.equal(fallbackCalls.length, 4, "WBI 失败后两个搜索类型都应回退兼容接口");
  assert.equal(fallbackCalls.filter((call) => call.url.includes("/wbi/search/type")).length, 2);
  assert.equal(fallbackCalls.filter((call) => call.url.includes("/x/web-interface/search/type")).length, 2);
  assert.ok(fallbackCalls.every((call) => call.options.headers.Cookie === cookie));

  console.log("OK bilibili-rex-search", { results: results.length, fallback: fallback.length });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

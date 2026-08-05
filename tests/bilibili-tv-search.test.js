"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const target = path.resolve(__dirname, "..", "widgets", "bilibili-tv-search.js");
const calls = [];
const stored = new Map();
const TEST_COOKIE = "test-cookie-bilibili";

const searchRow = {
  season_id: 28747,
  title: '<em class="keyword">凡人修仙传</em>',
  season_type: 4,
  season_type_name: "国创",
  cover: "http://i0.hdslb.com/poster.jpg",
  areas: "中国大陆",
  styles: "玄幻/热血",
  index_show: "更新至第185话",
  desc: "凡人修仙故事",
  goto_url: "https://www.bilibili.com/bangumi/play/ss28747",
  pubtime: 1595606400,
  media_score: { score: 9.7 },
  eps: [{ cover: "http://i0.hdslb.com/episode.jpg" }],
};

const movieRow = {
  season_id: 33133,
  title: '<em class="keyword">霸王别姬</em>',
  season_type: 2,
  season_type_name: "电影",
  cover: "http://i0.hdslb.com/movie-poster.jpg",
  areas: "中国大陆",
  styles: "剧情",
  desc: "经典电影",
  goto_url: "https://www.bilibili.com/bangumi/play/ep317650?theme=movie",
  pubtime: 946656000,
  media_score: { score: 9.9 },
  eps: [{ cover: "http://i0.hdslb.com/movie-backdrop.jpg" }],
};

const sandbox = {
  WidgetMetadata: undefined,
  console: { log() {}, warn() {}, error() {} },
  Widget: {
    http: {
      get: async (url, options) => {
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
        if (url.includes("/search/type")) {
          const result = options.params.search_type === "media_ft" ? [movieRow] : [searchRow];
          return { data: { code: 0, message: "OK", data: { result } } };
        }
        if (url.includes("/pgc/view/web/season")) {
          if (String(options.params.season_id) === "33133") {
            return {
              data: {
                code: 0,
                result: {
                  season_id: 33133,
                  type: 2,
                  title: "霸王别姬",
                  cover: "https://i0.hdslb.com/movie-poster.jpg",
                  evaluate: "经典电影",
                  share_url: "https://www.bilibili.com/bangumi/play/ss33133",
                  publish: { pub_time: "1993-01-01 00:00:00" },
                  rating: { score: 9.9 },
                  episodes: [
                    {
                      id: 317650,
                      title: "正片",
                      long_title: "",
                      link: "https://www.bilibili.com/bangumi/play/ep317650?theme=movie",
                      cover: "https://i0.hdslb.com/movie-backdrop.jpg",
                      badge: "会员",
                    },
                  ],
                },
              },
            };
          }
          return {
            data: {
              code: 0,
              result: {
                season_id: 28747,
                title: "凡人修仙传",
                cover: "https://i0.hdslb.com/poster.jpg",
                square_cover: "https://i0.hdslb.com/square.jpg",
                evaluate: "官方简介",
                share_url: "https://www.bilibili.com/bangumi/play/ss28747",
                publish: { pub_time: "2020-07-25 20:00:00" },
                rating: { score: 9.7 },
                episodes: [
                  {
                    id: 733316,
                    title: "1",
                    long_title: "凡人风起天南",
                    link: "http://www.bilibili.com/bangumi/play/ep733316",
                    cover: "http://i0.hdslb.com/ep1.jpg",
                    pub_time: 1675566000,
                    badge: "限免",
                  },
                ],
              },
            },
          };
        }
        throw new Error("unmocked URL: " + url);
      },
    },
    storage: {
      get: (key) => stored.get(key),
      set: (key, value) => stored.set(key, value),
      remove: (key) => stored.delete(key),
    },
  },
};

vm.createContext(sandbox);
new vm.Script(fs.readFileSync(target, "utf8"), { filename: target }).runInContext(sandbox);

(async () => {
  assert.equal(sandbox.WidgetMetadata.id, "forward.bilibili.tv.search");
  assert.equal(sandbox.WidgetMetadata.title, "B站影视搜索");
  assert.equal(sandbox.WidgetMetadata.version, "1.1.1");
  assert.equal(sandbox.WidgetMetadata.requiredVersion, "0.0.2");
  assert.equal(sandbox.WidgetMetadata.modules.length, 1);
  assert.equal(sandbox.WidgetMetadata.modules[0].id, "searchBilibiliTv");
  assert.equal(sandbox.WidgetMetadata.modules[0].functionName, "search");
  assert.equal(sandbox.WidgetMetadata.globalParams[0].name, "bilibiliCookie");
  assert.equal(sandbox.WidgetMetadata.globalParams[0].placeholders, undefined);
  assert.equal(sandbox.WidgetMetadata.search.functionName, "search");
  assert.equal(sandbox.bilibiliMd5("abc"), "900150983cd24fb0d6963f7d28e17f72");

  const results = await sandbox.search({
    keyword: "凡人修仙传",
    page: 2,
    contentType: "all",
    bilibiliCookie: TEST_COOKIE,
  });

  assert.equal(calls.filter((call) => call.url.includes("/search/type")).length, 2);
  assert.equal(calls.filter((call) => call.url.includes("/x/web-interface/nav")).length, 1);
  assert.ok(calls.filter((call) => call.url.includes("/search/type")).every((call) => call.url.includes("/wbi/")));
  assert.deepEqual(
    calls.filter((call) => call.url.includes("/search/type")).map((call) => call.options.params.search_type),
    ["media_bangumi", "media_ft"],
  );
  const firstSearchCall = calls.find((call) => call.url.includes("/search/type"));
  assert.equal(firstSearchCall.options.params.keyword, "凡人修仙传");
  assert.equal(firstSearchCall.options.params.page, 2);
  assert.equal(firstSearchCall.options.headers.Cookie, TEST_COOKIE);
  assert.match(firstSearchCall.options.params.w_rid, /^[a-f0-9]{32}$/);
  assert.ok(Number(firstSearchCall.options.params.wts) > 0);

  assert.equal(results.length, 2, "应同时返回番剧/国创和电影");
  assert.equal(results[0].title, "凡人修仙传");
  assert.equal(results[0].type, "url");
  assert.equal(results[0].mediaType, "tv");
  assert.equal(results[0].link, "bilibili:28747");
  assert.equal(results[1].title, "霸王别姬");
  assert.equal(results[1].mediaType, "movie");
  assert.equal(results[1].link, "bilibili:33133");
  assert.match(results[0].posterPath, /^https:\/\//);
  assert.equal(results[0].stills, undefined);
  assert.equal(results[0].recommendations, undefined);
  assert.ok(!JSON.stringify(Array.from(stored.values())).includes(TEST_COOKIE), "缓存不得包含 Cookie");

  const detail = await sandbox.loadDetail(results[0].link);
  const detailCall = calls.find((call) => call.url.includes("/pgc/view/web/season"));
  assert.equal(detailCall.options.params.season_id, "28747");
  assert.equal(detailCall.options.headers.Cookie, TEST_COOKIE);
  assert.equal(detail.title, "凡人修仙传");
  assert.equal(detail.episodeItems.length, 1);
  assert.equal(detail.episodeItems[0].title, "第1集 · 凡人风起天南");
  assert.match(detail.episodeItems[0].id, /^https:\/\//);
  assert.equal(detail.stills, undefined);
  assert.equal(await sandbox.loadDetail("iqiyi:1"), null);

  const movieResults = await sandbox.search({
    keyword: "霸王别姬",
    page: 1,
    contentType: "movie",
    bilibiliCookie: TEST_COOKIE,
  });
  const searchCalls = calls.filter((call) => call.url.includes("/search/type"));
  assert.equal(searchCalls.length, 3);
  assert.equal(searchCalls[2].options.params.search_type, "media_ft");
  assert.equal(movieResults.length, 1);
  assert.equal(movieResults[0].mediaType, "movie");

  const legacyMediaResults = await sandbox.search({
    keyword: "霸王别姬",
    page: 1,
    contentType: "media_ft",
    bilibiliCookie: TEST_COOKIE,
  });
  assert.equal(legacyMediaResults.length, 1, "应兼容 1.0.1 保存的影视筛选值");
  assert.equal(calls.filter((call) => call.url.includes("/search/type")).length, 4);
  assert.equal(calls.filter((call) => call.url.includes("/x/web-interface/nav")).length, 1, "WBI 密钥应复用");

  const movieDetail = await sandbox.loadDetail(movieResults[0].link);
  assert.equal(movieDetail.mediaType, "movie");
  assert.equal(movieDetail.episodeItems.length, 1);
  assert.equal(movieDetail.episodeItems[0].mediaType, "movie");
  assert.equal(movieDetail.episodeItems[0].title, "正片");
  assert.equal(movieDetail.episodeItems[0].episode, undefined);

  console.log("OK bilibili-tv-search", {
    searchRequests: 4,
    results: results.length,
    detailChecks: 2,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

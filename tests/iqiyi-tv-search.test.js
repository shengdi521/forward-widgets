"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const target = path.resolve(__dirname, "..", "widgets", "iqiyi-tv-search.js");
const calls = [];
const stored = new Map();
const TEST_COOKIE = "test-cookie-iqiyi";

function album(overrides = {}) {
  return {
    title: "莲花楼",
    img: "http://pic.iqiyipic.com/poster.webp",
    imgH: "http://pic.iqiyipic.com/backdrop.jpg",
    channel: "电视剧,2",
    siteId: "iqiyi",
    siteName: "爱奇艺",
    pageUrl: "https://www.iqiyi.com/v_25ltrdm1rl8.html",
    qipuId: 8077509274258301,
    year: { value: "2023" },
    introduction: "江湖探案故事",
    subscriptContent: "全40集",
    actors: { value: [{ qipuId: 1, title: "成毅" }] },
    directors: { value: [{ qipuId: 2, title: "郭虎" }] },
    videos: [
      {
        title: "莲花楼 第01集",
        number: "1",
        pageUrl: "http://www.iqiyi.com/v_25ltrdm1rl8.html",
        img: "http://pic.iqiyipic.com/ep1.jpg",
      },
    ],
    ...overrides,
  };
}

const sandbox = {
  WidgetMetadata: undefined,
  console: { log() {}, warn() {}, error() {} },
  Widget: {
    http: {
      get: async (url, options) => {
        calls.push({ url, options });
        if (url.includes("/search/homePageV3")) {
          return {
            data: {
              code: 0,
              data: {
                templates: [
                  { template: 101, albumInfo: album() },
                  { template: 101, albumInfo: album({ qipuId: 99, siteId: "qq", siteName: "腾讯" }) },
                  { template: 108, albumInfo: album({ qipuId: 100, channel: "片花,10" }) },
                ],
              },
            },
          };
        }
        if (url.includes("/avlistinfo")) {
          return {
            data: {
              code: "A00000",
              data: {
                epsodelist: [
                  {
                    tvId: 8010127344745600,
                    name: "莲花楼第1集",
                    playUrl: "http://www.iqiyi.com/v_25ltrdm1rl8.html",
                    imageUrl: "http://pic.iqiyipic.com/ep1.jpg",
                    description: "第一集简介",
                    focus: "故人逢江湖梦",
                    period: "2023-07-21",
                    duration: "46:07",
                    order: 1,
                    payMark: 0,
                  },
                  {
                    tvId: 2,
                    name: "莲花楼第2集",
                    playUrl: "https://www.iqiyi.com/v_episode2.html",
                    imageUrl: "https://pic.iqiyipic.com/ep2.jpg",
                    order: 2,
                    payMark: 1,
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
  assert.equal(sandbox.WidgetMetadata.id, "forward.iqiyi.tv.search");
  assert.equal(sandbox.WidgetMetadata.modules.length, 0);
  assert.equal(sandbox.WidgetMetadata.globalParams[0].name, "iqiyiCookie");

  const results = await sandbox.search({
    keyword: "莲花楼",
    page: 3,
    iqiyiCookie: TEST_COOKIE,
  });

  assert.equal(calls[0].options.params.key, "莲花楼");
  assert.equal(calls[0].options.params.pageNum, 3);
  assert.equal(calls[0].options.headers.Cookie, TEST_COOKIE);
  assert.equal(results.length, 1, "只保留爱奇艺站内电视剧");
  assert.equal(results[0].title, "莲花楼");
  assert.equal(results[0].type, "url");
  assert.equal(results[0].mediaType, "tv");
  assert.equal(results[0].link, "iqiyi:8077509274258301");
  assert.equal(results[0].episodeItems.length, 1);
  assert.equal(results[0].peoples.length, 2);
  assert.equal(results[0].albumInfo, undefined);
  assert.equal(results[0].stills, undefined);
  assert.ok(!JSON.stringify(Array.from(stored.values())).includes(TEST_COOKIE), "缓存不得包含 Cookie");

  const detail = await sandbox.loadDetail(results[0].link);
  const detailCall = calls.find((call) => call.url.includes("/avlistinfo"));
  assert.equal(detailCall.options.params.aid, "8077509274258301");
  assert.equal(detailCall.options.params.size, 200);
  assert.equal(detailCall.options.headers.Cookie, TEST_COOKIE);
  assert.equal(detail.title, "莲花楼");
  assert.equal(detail.episodeItems.length, 2);
  assert.equal(detail.episodeItems[0].durationText, "46:07");
  assert.match(detail.episodeItems[0].id, /^https:\/\//);
  assert.match(detail.episodeItems[1].description, /会员内容/);
  assert.equal(detail.recommendations, undefined);
  assert.equal(await sandbox.loadDetail("bilibili:1"), null);

  console.log("OK iqiyi-tv-search", {
    results: results.length,
    filteredNonIqiyi: 2,
    episodes: detail.episodeItems.length,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

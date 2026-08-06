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
  eps: [{
    id: 733316,
    title: "1",
    long_title: "凡人风起天南",
    url: "https://www.bilibili.com/bangumi/play/ep733316",
    cover: "http://i0.hdslb.com/episode.jpg",
  }],
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
  eps: null,
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
                      aid: 93198003,
                      cid: 159116300,
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
                    aid: 478818261,
                    cid: 1022370693,
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
        if (url.includes("/pgc/player/web/playurl")) {
          return {
            data: {
              code: 0,
              message: "success",
              result: {
                code: 0,
                quality: 64,
                format: "mp4",
                accept_quality: [80, 64, 32, 16],
                accept_description: ["1080P", "720P", "480P", "360P"],
                durl: [
                  {
                    url: "http://upos-sz-mirrorcos.bilivideo.com/video.mp4?token=primary",
                    backup_url: ["https://upos-sz-mirrorali.bilivideo.com/video.mp4?token=backup"],
                  },
                ],
              },
            },
          };
        }
        if (url.includes("/x/player/v2")) {
          return {
            data: {
              code: 0,
              data: {
                subtitle: {
                  subtitles: [
                    {
                      id: 101,
                      lan: "zh-Hans",
                      lan_doc: "中文（简体）",
                      subtitle_url: "//aisubtitle.hdslb.com/bfs/ai_subtitle/test.json",
                    },
                    {
                      id: 102,
                      lan: "zh-Hans",
                      lan_doc: "重复字幕",
                      subtitle_url: "https://aisubtitle.hdslb.com/bfs/ai_subtitle/test.json",
                    },
                    {
                      id: 103,
                      lan: "en",
                      lan_doc: "非官方地址",
                      subtitle_url: "https://example.com/subtitle.vtt",
                    },
                  ],
                },
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
  assert.equal(sandbox.WidgetMetadata.version, "1.4.1");
  assert.equal(sandbox.WidgetMetadata.requiredVersion, "0.0.2");
  assert.equal(sandbox.WidgetMetadata.modules.length, 2);
  assert.equal(sandbox.WidgetMetadata.modules[0].id, "loadResource");
  assert.equal(sandbox.WidgetMetadata.modules[0].functionName, "loadResource");
  assert.equal(sandbox.WidgetMetadata.modules[0].type, "stream");
  assert.equal(sandbox.WidgetMetadata.modules[0].cacheDuration, 0);
  assert.equal(sandbox.WidgetMetadata.modules[1].id, "loadSubtitle");
  assert.equal(sandbox.WidgetMetadata.modules[1].functionName, "loadSubtitle");
  assert.equal(sandbox.WidgetMetadata.modules[1].type, "subtitle");
  assert.equal(
    sandbox.WidgetMetadata.modules.some((module) => module.functionName === "search"),
    false,
    "搜索只能通过 WidgetMetadata.search 注册",
  );
  assert.equal(sandbox.WidgetMetadata.globalParams[0].name, "bilibiliCookie");
  assert.equal(sandbox.WidgetMetadata.globalParams[0].placeholders, undefined);
  assert.equal(sandbox.WidgetMetadata.search.functionName, "search");
  assert.deepEqual(
    Array.from(sandbox.WidgetMetadata.search.params, (param) => param.name),
    ["keyword"],
  );
  await assert.rejects(() => sandbox.search({ keyword: "  " }), /请输入要搜索的影视名称/);
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
  assert.equal(results[0].episodeItems.length, 1);
  assert.equal(results[0].episodeItems[0].link, "bilibili-play:28747:733316::");
  assert.equal(results[1].title, "霸王别姬");
  assert.equal(results[1].mediaType, "movie");
  assert.equal(results[1].link, "bilibili:33133");
  assert.match(results[0].posterPath, /^https:\/\//);
  assert.equal(results[0].stills, undefined);
  assert.equal(results[0].recommendations, undefined);
  assert.ok(!JSON.stringify(Array.from(stored.values())).includes(TEST_COOKIE), "缓存不得包含 Cookie");

  const directResources = await sandbox.loadResource({
    link: results[0].episodeItems[0].link,
    bilibiliCookie: TEST_COOKIE,
  });
  assert.equal(directResources.length, 2, "搜索结果中的命中分集应能直接起播");
  assert.match(directResources[0].name, /账号当前最高/);

  const detail = await sandbox.loadDetail(results[0].link);
  const detailCall = calls.find((call) => call.url.includes("/pgc/view/web/season"));
  assert.equal(detailCall.options.params.season_id, "28747");
  assert.equal(detailCall.options.headers.Cookie, TEST_COOKIE);
  assert.equal(detail.title, "凡人修仙传");
  assert.equal(detail.episodeItems.length, 1);
  assert.equal(detail.episodeItems[0].title, "第1集 · 凡人风起天南");
  assert.match(detail.episodeItems[0].id, /^https:\/\//);
  assert.equal(detail.episodeItems[0].link, "bilibili-play:28747:733316:478818261:1022370693");
  assert.equal(detail.stills, undefined);
  assert.equal(await sandbox.loadDetail("iqiyi:1"), null);

  const resources = await sandbox.loadResource({
    link: detail.episodeItems[0].link,
    bilibiliCookie: TEST_COOKIE,
  });
  const playCall = calls.find((call) => call.url.includes("/pgc/player/web/playurl"));
  assert.equal(playCall.options.params.avid, "478818261");
  assert.equal(playCall.options.params.cid, "1022370693");
  assert.equal(playCall.options.params.ep_id, "733316");
  assert.equal(playCall.options.params.qn, 127);
  assert.equal(playCall.options.headers.Cookie, TEST_COOKIE);
  assert.equal(resources.length, 2);
  assert.match(resources[0].name, /720P/);
  assert.match(resources[0].url, /^https:\/\//);
  assert.equal(resources[0].playerType, "app");
  assert.equal(resources[0].customHeaders.Cookie, undefined, "Cookie 不得发送给视频 CDN");
  assert.match(resources[0].name, /账号当前最高/);

  const subtitles = await sandbox.loadSubtitle({
    link: detail.episodeItems[0].link,
    bilibiliCookie: TEST_COOKIE,
  });
  const subtitleCall = calls.find((call) => call.url.includes("/x/player/v2"));
  assert.equal(subtitleCall.options.params.aid, "478818261");
  assert.equal(subtitleCall.options.params.cid, "1022370693");
  assert.equal(subtitleCall.options.headers.Cookie, TEST_COOKIE);
  assert.equal(subtitles.length, 1, "字幕应去重并过滤非官方地址");
  assert.equal(subtitles[0].title, "中文（简体）");
  assert.equal(subtitles[0].lang, "zh-CN");
  assert.match(subtitles[0].url, /^https:\/\/aisubtitle\.hdslb\.com\//);
  assert.equal((await sandbox.loadSubtitle({ link: "iqiyi-play:1:abc:x" })).length, 0);
  assert.equal((await sandbox.loadResource({ link: "iqiyi-play:1:abc:x" })).length, 0);

  const movieResults = await sandbox.search({
    keyword: "霸王别姬",
    page: 1,
    contentType: "movie",
    bilibiliCookie: TEST_COOKIE,
  });
  const searchCalls = calls.filter((call) => call.url.includes("/search/type"));
  assert.equal(searchCalls.length, 3);
  assert.equal(searchCalls[2].options.params.search_type, "media_ft");
  assert.equal(searchCalls[2].options.params.keyword, "霸王别姬", "第二次搜索必须使用新关键词");
  assert.equal(movieResults.length, 1);
  assert.equal(movieResults[0].mediaType, "movie");
  assert.equal(movieResults[0].episodeItems[0].link, "bilibili-play:33133:317650::");

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

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const target = path.resolve(__dirname, "..", "widgets", "bilibili-tv-search.js");
const calls = [];
const stored = new Map();
const TEST_COOKIE = "test-cookie-bilibili";
let forceDashOnly = false;
let forceWbiSearchFailure = false;

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
          if (forceWbiSearchFailure && url.includes("/wbi/")) {
            return { data: { code: -352, message: "风控校验失败" } };
          }
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
          const playParams = options.params || {};
          if (Number(playParams.fnval) === 4048) {
            return {
              data: {
                code: 0,
                message: "success",
                result: {
                  code: 0,
                  quality: 125,
                  support_formats: [
                    { quality: 125, new_description: "HDR 真彩色" },
                    { quality: 120, new_description: "超清 4K" },
                  ],
                  dash: {
                    duration: 1440.5,
                    video: [
                      {
                        id: 125,
                        base_url: "http://upos-sz-mirrorcos.bilivideo.com/hdr.m4s?token=video&deadline=1",
                        backup_url: ["https://upos-sz-mirrorali.bilivideo.com/hdr.m4s?token=backup"],
                        mimeType: "video/mp4",
                        codecs: "hev1.2.4.L153.B0",
                        width: 3840,
                        height: 2160,
                        frameRate: "60",
                        bandwidth: 18000000,
                        codecid: 12,
                        SegmentBase: { Initialization: "0-999", indexRange: "1000-1999" },
                      },
                      {
                        id: 120,
                        baseUrl: "https://upos-sz-mirrorcos.bilivideo.com/4k.m4s?token=video4k",
                        mime_type: "video/mp4",
                        codecs: "avc1.640033",
                        width: 3840,
                        height: 2160,
                        frame_rate: "30",
                        bandwidth: 12000000,
                        codecid: 7,
                        segment_base: { initialization: "0-799", index_range: "800-1599" },
                      },
                    ],
                    audio: [
                      {
                        id: 30280,
                        base_url: "https://upos-sz-mirrorcos.bilivideo.com/audio.m4s?token=audio&deadline=1",
                        mimeType: "audio/mp4",
                        codecs: "mp4a.40.2",
                        bandwidth: 192000,
                        audioSamplingRate: 48000,
                        SegmentBase: { Initialization: "0-599", indexRange: "600-1199" },
                      },
                    ],
                  },
                },
              },
            };
          }
          if (forceDashOnly && playParams.platform === "html5") {
            return {
              data: {
                code: 0,
                message: "success",
                result: {
                  code: 0,
                  quality: 112,
                  accept_quality: [112, 80, 64, 32, 16],
                  accept_description: ["1080P 高码率", "1080P", "720P", "480P", "360P"],
                  dash: { video: [{ id: 112 }], audio: [{ id: 30280 }] },
                },
              },
            };
          }
          const isExactHighMp4 = Number(playParams.fnval) === 1 &&
            playParams.platform === "html5" && Number(playParams.qn) === 112;
          return {
            data: {
              code: 0,
              message: "success",
              result: {
                code: 0,
                quality: isExactHighMp4 ? 112 : 64,
                format: "mp4",
                accept_quality: [112, 80, 64, 32, 16],
                accept_description: ["1080P 高码率", "1080P", "720P", "480P", "360P"],
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
  assert.equal(sandbox.WidgetMetadata.version, "1.4.4");
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
    ["keyword", "page"],
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
  assert.equal(directResources.length, 4, "搜索结果中的命中分集应返回 DASH 与 MP4 线路");
  assert.match(directResources[0].name, /HDR 真彩色.*账号可达最高/);

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
  const dashCall = calls.find((call) =>
    call.url.includes("/pgc/player/web/playurl") && Number(call.options.params.fnval) === 4048
  );
  assert.equal(dashCall.options.params.qn, 127);
  assert.equal(dashCall.options.params.fourk, 1);
  assert.equal(dashCall.options.headers.Cookie, TEST_COOKIE);
  const playCall = calls.find((call) =>
    call.url.includes("/pgc/player/web/playurl") && call.options.params.platform === "html5"
  );
  assert.equal(playCall.options.params.avid, "478818261");
  assert.equal(playCall.options.params.cid, "1022370693");
  assert.equal(playCall.options.params.ep_id, "733316");
  assert.equal(playCall.options.params.qn, 116);
  assert.equal(playCall.options.params.fnval, 1);
  assert.equal(playCall.options.params.type, "");
  assert.equal(playCall.options.params.otype, "json");
  assert.equal(playCall.options.params.platform, "html5");
  assert.equal(playCall.options.params.fourk, 0);
  assert.equal(playCall.options.params.high_quality, 1);
  assert.equal(playCall.options.headers.Cookie, TEST_COOKIE);
  const exactQualityCall = calls.find((call) =>
    call.url.includes("/pgc/player/web/playurl") &&
    Number(call.options.params.fnval) === 1 &&
    call.options.params.platform === "html5" &&
    Number(call.options.params.qn) === 112
  );
  assert.ok(exactQualityCall, "接口公布更高档位时应按最高档精确重试");
  assert.equal(resources.length, 4);
  assert.match(resources[0].name, /HDR 真彩色.*账号可达最高/);
  assert.match(resources[1].name, /超清 4K.*DASH 双轨/);
  assert.match(resources[0].description, /官方 DASH.*视频\+音频/);
  assert.match(resources[0].url, /^data:application\/dash\+xml;base64,/);
  assert.equal(resources[0].playerType, "app");
  assert.equal(resources[0].customHeaders.Cookie, undefined, "Cookie 不得发送给视频 CDN");
  assert.equal(resources[0].customHeaders["X-Forward-Skip-Redirect-Probe"], "1");
  const manifestXml = Buffer.from(resources[0].url.split(",")[1], "base64").toString("utf8");
  assert.ok(!manifestXml.includes(TEST_COOKIE), "DASH MPD 不得包含账号 Cookie");
  assert.match(manifestXml, /<AdaptationSet id="1" contentType="video"/);
  assert.match(manifestXml, /<AdaptationSet id="2" contentType="audio"/);
  assert.match(manifestXml, /id="video-125-12"/);
  assert.match(manifestXml, /token=video&amp;deadline=1/);
  assert.match(manifestXml, /<SegmentBase indexRange="1000-1999">/);
  assert.match(manifestXml, /<Initialization range="0-999"\/>/);
  const mp4Resource = resources.find((resource) => /^https:\/\//.test(resource.url));
  assert.ok(mp4Resource, "应保留单路 MP4 兼容资源");
  assert.match(mp4Resource.name, /1080P 高码率.*最高单路画质/);
  assert.match(mp4Resource.description, /单路 MP4/);

  const fallbackCallStart = calls.length;
  forceDashOnly = true;
  const fallbackResources = await sandbox.loadResource({
    link: detail.episodeItems[0].link,
    bilibiliCookie: TEST_COOKIE,
  });
  forceDashOnly = false;
  const fallbackPlayCalls = calls.slice(fallbackCallStart)
    .filter((call) => call.url.includes("/pgc/player/web/playurl") && Number(call.options.params.fnval) === 1);
  assert.deepEqual(
    fallbackPlayCalls.map((call) => [
      Number(call.options.params.qn),
      Number(call.options.params.fnval),
      call.options.params.platform,
    ]),
    [[116, 1, "html5"], [80, 1, undefined]],
    "HTML5 模式未返回单路时应回退到普通 MP4",
  );
  const fallbackMp4 = fallbackResources.find((resource) => /^https:\/\//.test(resource.url));
  assert.ok(fallbackMp4, "DASH 线路之外应保留普通 MP4 回退");
  assert.match(fallbackMp4.name, /720P/);
  assert.match(fallbackMp4.description, /单路 MP4/);

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

  const largeSearchRow = {
    ...searchRow,
    hit_epids: "50",
    eps: Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      title: String(index + 1),
      long_title: "第" + String(index + 1) + "话",
      url: "https://www.bilibili.com/bangumi/play/ep" + String(index + 1),
      cover: "https://i0.hdslb.com/episode-" + String(index + 1) + ".jpg",
    })),
  };
  const compactSearchItem = sandbox.mapBilibiliSearchItem(largeSearchRow);
  assert.equal(compactSearchItem.episodeItems.length, 3, "搜索结果不得携带完整超长分集列表");
  assert.equal(compactSearchItem.episodeItems[0].link, "bilibili-play:28747:50::");
  assert.equal(compactSearchItem.episodeItems[1].link, "bilibili-play:28747:1::");
  assert.equal(compactSearchItem.episodeItems[2].link, "bilibili-play:28747:100::");

  const fallbackSearchStart = calls.length;
  forceWbiSearchFailure = true;
  const fallbackSearchResults = await sandbox.search({
    keyword: "霸王别姬",
    page: 1,
    contentType: "media_ft",
    bilibiliCookie: TEST_COOKIE,
  });
  forceWbiSearchFailure = false;
  const fallbackSearchCalls = calls.slice(fallbackSearchStart)
    .filter((call) => call.url.includes("/search/type"));
  assert.equal(fallbackSearchResults.length, 1, "WBI 风控失败时仍应返回兼容接口结果");
  assert.equal(fallbackSearchCalls.length, 2);
  assert.match(fallbackSearchCalls[0].url, /\/wbi\/search\/type/);
  assert.doesNotMatch(fallbackSearchCalls[1].url, /\/wbi\//);
  assert.equal(fallbackSearchCalls[1].options.params.w_rid, undefined);

  console.log("OK bilibili-tv-search", {
    searchRequests: calls.filter((call) => call.url.includes("/search/type")).length,
    results: results.length,
    detailChecks: 2,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

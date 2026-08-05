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
        qipuId: 8010127344745600,
        playUrl: "qips://tvid=8010127344745600;vid=0d2705c1ebed7831f58740f5149ceeee;ischarge=false;",
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
                  {
                    template: 103,
                    albumInfo: album({
                      title: "流浪地球2",
                      qipuId: 7292991076670500,
                      channel: "电影,1",
                      pageUrl: null,
                      playUrl: "qips://tvid=7292991076670500;vid=3962ec5ac0f8d8fc449b6a3c089de70a;ischarge=true;",
                      paymark: 1,
                      firstVideoIsVip: true,
                      videos: [],
                      rating: 9.0,
                      releaseTime: { value: "2023-01-22" },
                      timeLength: { value: "02:53:11" },
                    }),
                  },
                  {
                    template: 101,
                    albumInfo: album({
                      title: "航拍中国 第一季",
                      qipuId: 5821016744680001,
                      channel: "纪录片,3",
                      pageUrl: "https://www.iqiyi.com/v_documentary.html",
                    }),
                  },
                  {
                    template: 102,
                    albumInfo: album({
                      title: "奔跑吧第10季",
                      qipuId: 8755339415567901,
                      channel: "综艺,6",
                      pageUrl: "https://www.iqiyi.com/v_variety.html",
                    }),
                  },
                  {
                    template: 101,
                    albumInfo: album({
                      title: "斗罗大陆4终极斗罗",
                      qipuId: 4499849593516501,
                      channel: "动漫,4",
                      pageUrl: "https://www.iqiyi.com/v_anime.html",
                    }),
                  },
                  { template: 101, albumInfo: album() },
                  { template: 101, albumInfo: album({ qipuId: 99, siteId: "qq", siteName: "腾讯" }) },
                  { template: 108, albumInfo: album({ qipuId: 100, channel: "电影,1" }) },
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
                    vid: "0d2705c1ebed7831f58740f5149ceeee",
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
                    vid: "11111111111111111111111111111111",
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
        if (url.includes("/jp/tmts/")) {
          const isCantonese = String(options.params.lid || "") === "2";
          return {
            data: "var tvInfoJs=" + JSON.stringify({
              code: "A00000",
              data: {
                audio: [
                  { lid: 1, name: "国语", ispre: 1 },
                  { lid: 2, name: "粤语", ispre: 0 },
                ],
                dstl: "http://meta.video.iqiyi.com",
                program: {
                  stl: [
                    { lid: 1, _name: "简体中文", webvtt: "/subtitle/test.vtt" },
                    { lid: 3, _name: "非官方字幕", webvtt: "https://example.com/test.vtt" },
                  ],
                },
                vidl: [
                  {
                    vd: 18,
                    screenSize: "1920x1080",
                    fileFormat: "H265",
                    m3utx: isCantonese
                      ? "http://mus.video.iqiyi.com/video-yue-h265.m3u8?token=h265"
                      : "http://mus.video.iqiyi.com/video-h265.m3u8?token=h265",
                  },
                  {
                    vd: 4,
                    screenSize: "1280x720",
                    m3utx: isCantonese
                      ? "https://mus.video.iqiyi.com/video-yue-h264.m3u8?token=h264"
                      : "https://mus.video.iqiyi.com/video-h264.m3u8?token=h264",
                  },
                ],
              },
            }),
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
  assert.equal(sandbox.WidgetMetadata.title, "爱奇艺影视搜索");
  assert.equal(sandbox.WidgetMetadata.version, "1.3.0");
  assert.equal(sandbox.WidgetMetadata.requiredVersion, "0.0.2");
  assert.equal(sandbox.WidgetMetadata.modules.length, 3);
  assert.equal(sandbox.WidgetMetadata.modules[0].id, "loadResource");
  assert.equal(sandbox.WidgetMetadata.modules[0].functionName, "loadResource");
  assert.equal(sandbox.WidgetMetadata.modules[0].type, "stream");
  assert.equal(sandbox.WidgetMetadata.modules[0].cacheDuration, 0);
  assert.equal(sandbox.WidgetMetadata.modules[1].id, "loadSubtitle");
  assert.equal(sandbox.WidgetMetadata.modules[1].functionName, "loadSubtitle");
  assert.equal(sandbox.WidgetMetadata.modules[1].type, "subtitle");
  assert.equal(sandbox.WidgetMetadata.modules[2].id, "searchIqiyiTv");
  assert.equal(sandbox.WidgetMetadata.modules[2].functionName, "search");
  assert.equal(sandbox.WidgetMetadata.globalParams[0].name, "iqiyiCookie");
  assert.equal(sandbox.WidgetMetadata.globalParams[0].placeholders, undefined);

  const results = await sandbox.search({
    keyword: "莲花楼",
    page: 3,
    contentType: "all",
    iqiyiCookie: TEST_COOKIE,
  });

  assert.equal(calls[0].options.params.key, "莲花楼");
  assert.equal(calls[0].options.params.pageNum, 3);
  assert.equal(calls[0].options.headers.Cookie, TEST_COOKIE);
  assert.equal(results.length, 5, "应保留五类爱奇艺站内长视频并去重");
  const tv = results.find((item) => item.link === "iqiyi:8077509274258301");
  const movie = results.find((item) => item.link === "iqiyi:7292991076670500");
  assert.equal(tv.title, "莲花楼");
  assert.equal(tv.type, "url");
  assert.equal(tv.mediaType, "tv");
  assert.equal(tv.episodeItems.length, 1);
  assert.match(tv.episodeItems[0].link, /^iqiyi-play:8010127344745600:/);
  assert.equal(tv.peoples.length, 2);
  assert.equal(tv.albumInfo, undefined);
  assert.equal(tv.stills, undefined);
  assert.equal(movie.title, "流浪地球2");
  assert.equal(movie.id, "iqiyi-album:7292991076670500");
  assert.equal(movie.mediaType, "movie");
  assert.equal(movie.rating, 9.0);
  assert.equal(movie.releaseDate, "2023-01-22");
  assert.equal(movie.durationText, "02:53:11");
  assert.equal(movie.episodeItems.length, 1);
  assert.match(movie.episodeItems[0].link, /^iqiyi-play:7292991076670500:/);
  assert.ok(!JSON.stringify(Array.from(stored.values())).includes(TEST_COOKIE), "缓存不得包含 Cookie");

  const movieOnly = await sandbox.search({
    keyword: "流浪地球",
    page: 1,
    contentType: "movie",
    iqiyiCookie: TEST_COOKIE,
  });
  assert.equal(movieOnly.length, 1);
  assert.equal(movieOnly[0].mediaType, "movie");
  const movieDetail = await sandbox.loadDetail(movieOnly[0].link);
  assert.equal(movieDetail.title, "流浪地球2");
  assert.equal(calls.filter((call) => call.url.includes("/avlistinfo")).length, 0);

  const detail = await sandbox.loadDetail(tv.link);
  const detailCall = calls.find((call) => call.url.includes("/avlistinfo"));
  assert.equal(detailCall.options.params.aid, "8077509274258301");
  assert.equal(detailCall.options.params.size, 200);
  assert.equal(detailCall.options.headers.Cookie, TEST_COOKIE);
  assert.equal(detail.title, "莲花楼");
  assert.equal(detail.episodeItems.length, 2);
  assert.equal(detail.episodeItems[0].durationText, "46:07");
  assert.match(detail.episodeItems[0].id, /^https:\/\//);
  assert.match(detail.episodeItems[0].link, /^iqiyi-play:8010127344745600:/);
  assert.match(detail.episodeItems[1].description, /会员内容/);
  assert.equal(detail.recommendations, undefined);
  assert.equal(await sandbox.loadDetail("bilibili:1"), null);

  const resources = await sandbox.loadResource({
    link: detail.episodeItems[0].link,
    iqiyiCookie: TEST_COOKIE,
  });
  const playCalls = calls.filter((call) => call.url.includes("/jp/tmts/"));
  const playCall = playCalls[0];
  assert.match(playCall.url, /\/8010127344745600\/0d2705c1ebed7831f58740f5149ceeee\/$/);
  assert.equal(playCall.options.params.tvid, "8010127344745600");
  assert.equal(playCall.options.params.vid, "0d2705c1ebed7831f58740f5149ceeee");
  assert.equal(playCall.options.params.src, "76f90cbd92f94a2e925d83e8ccd22cb7");
  assert.equal(
    playCall.options.params.sc,
    sandbox.iqiyiMd5(String(playCall.options.params.t) + "d5fb4bd9d50c4be6948c97edd7254b0e" + "8010127344745600"),
  );
  assert.equal(playCall.options.headers.Cookie, TEST_COOKIE);
  assert.equal(playCalls.length, 2, "多音轨时应按 lid 请求非默认音轨");
  assert.equal(playCalls[0].options.params.lid, undefined);
  assert.equal(playCalls[1].options.params.lid, "2");
  assert.equal(resources.length, 4);
  assert.match(resources[0].name, /国语/);
  assert.match(resources[0].name, /1080P/);
  assert.match(resources[0].name, /H\.265/);
  assert.match(resources[0].name, /账号当前最高/);
  assert.match(resources[2].name, /粤语/);
  assert.match(resources[2].name, /账号当前最高/);
  assert.match(resources[0].url, /^https:\/\//);
  assert.equal(resources[0].playerType, "app");
  assert.equal(resources[0].customHeaders.Cookie, undefined, "Cookie 不得发送给视频 CDN");

  const subtitles = await sandbox.loadSubtitle({
    link: detail.episodeItems[0].link,
    iqiyiCookie: TEST_COOKIE,
  });
  assert.equal(subtitles.length, 1, "字幕应过滤非官方地址");
  assert.equal(subtitles[0].title, "简体中文");
  assert.equal(subtitles[0].lang, "zh-CN");
  assert.equal(subtitles[0].url, "https://meta.video.iqiyi.com/subtitle/test.vtt");
  assert.equal((await sandbox.loadSubtitle({ link: "bilibili-play:1:2:3:4" })).length, 0);
  assert.equal((await sandbox.loadResource({ link: "bilibili-play:1:2:3:4" })).length, 0);

  console.log("OK iqiyi-tv-search", {
    results: results.length,
    categories: 5,
    episodes: detail.episodeItems.length,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

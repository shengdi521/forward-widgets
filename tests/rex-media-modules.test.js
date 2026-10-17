"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadModule(file, widget) {
  const target = path.resolve(__dirname, "..", "widgets", file);
  const sandbox = {
    WidgetMetadata: undefined,
    Widget: widget,
    console: { log() {}, warn() {}, error() {} },
  };
  vm.createContext(sandbox);
  new vm.Script(fs.readFileSync(target, "utf8"), { filename: target }).runInContext(sandbox);
  return sandbox;
}

function checkMetadata(sandbox, id, cookie) {
  assert.equal(sandbox.WidgetMetadata.id, id);
  assert.equal(sandbox.WidgetMetadata.requiredVersion, "0.0.1");
  assert.equal(sandbox.WidgetMetadata.globalParams[0].name, cookie);
  assert.deepEqual(Array.from(sandbox.WidgetMetadata.search.params, (param) => param.name), ["keyword", "page"]);
  assert.deepEqual(Array.from(sandbox.WidgetMetadata.modules, (module) => module.id), ["searchList", "loadResource", "loadSubtitle"]);
  assert.deepEqual(Array.from(sandbox.WidgetMetadata.modules, (module) => module.type), ["video", "stream", "subtitle"]);
  assert.equal(sandbox.WidgetMetadata.search.functionName, "searchGlobal");
  assert.equal(typeof sandbox.searchList, "function");
  assert.equal(typeof sandbox.searchGlobal, "function");
  assert.equal(typeof sandbox.loadDetail, "function");
  assert.equal(typeof sandbox.loadResource, "function");
  assert.equal(typeof sandbox.loadSubtitle, "function");
}

(async () => {
  const bili = loadModule("bilibili-rex.js", {
    storage: { get() { return ""; }, set() {}, remove() {} },
    html: { load() { throw new Error("fixture uses JSON fallback"); } },
    http: {
      async get(url) {
        if (url.indexOf("pgc/view/web/season") >= 0) {
          return { data: { code: 0, result: { title: "测试剧集", cover: "//img.test/cover.jpg", episodes: [{ ep_id: 1, aid: 2, cid: 3, title: "1", long_title: "正片" }] } } };
        }
        if (url.indexOf("pgc/player/web/playurl") >= 0) {
          return { data: { code: 0, result: { quality: 80, accept_quality: [80], accept_description: ["1080P"], durl: [{ url: "http://media.test/bili.mp4", backup_url: [] }] } } };
        }
        if (url.indexOf("x/player/v2") >= 0) {
          return { data: { code: 0, data: { subtitle: { subtitles: [{ id: 1, lan: "zh-CN", lan_doc: "中文", subtitle_url: "//subtitle.test/a.json" }] } } } };
        }
        return { data: "<html>season_id: 123, ep_id: 1</html>" };
      },
    },
  });
  checkMetadata(bili, "rex.bilibili.media", "bilibiliCookie");
  const biliDetail = await bili.loadDetail("https://www.bilibili.com/bangumi/play/ep1");
  assert.equal(biliDetail.length, 1);
  assert.equal(biliDetail[0].type, "link");
  assert.equal(biliDetail[0].episodeItems[0].type, "link");
  assert.equal((await bili.loadResource({ link: "bilibili-play:123:1:2:3" }))[0].url, "https://media.test/bili.mp4");
  assert.equal((await bili.loadSubtitle({ link: "bilibili-play:123:1:2:3" }))[0].lang, "zh-CN");

  const iqiyi = loadModule("iqiyi-rex.js", {
    storage: { get() { return ""; }, set() {}, remove() {} },
    http: {
      async get(url) {
        if (url.indexOf("homePageV3") >= 0) {
          return { data: { code: 0, data: { templates: [{ albumInfo: { qipuId: 100, title: "测试电影", channel: "电影,1", img: "http://img.test/poster.jpg", imgH: "http://img.test/backdrop.jpg", playUrl: "qips://tvid=100;vid=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;ischarge=true;" } }] } } };
        }
        if (url.indexOf("avlistinfo") >= 0) {
          return { data: { code: "A00000", data: { epsodelist: [{ playUrl: "https://www.iqiyi.com/v_test.html", tvId: "100", vid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", name: "正片" }] } } };
        }
        if (url.indexOf("tmts/") >= 0) {
          return { data: "var tvInfoJs={\"code\":\"A00000\",\"data\":{\"audio\":{\"lid\":1,\"name\":\"国语\"},\"vidl\":[{\"m3u\":\"http://mus.video.iqiyi.com/test.m3u8\",\"screenSize\":\"1920x1080\",\"vd\":5}]}}" };
        }
        return { data: {} };
      },
    },
  });
  checkMetadata(iqiyi, "rex.iqiyi.media", "iqiyiCookie");
  const iqiyiSearch = await iqiyi.searchList({ keyword: "测试", page: 1 });
  assert.equal(iqiyiSearch[0].type, "link");
  const iqiyiDetail = await iqiyi.loadDetail("iqiyi:100");
  assert.equal(iqiyiDetail.length, 1);
  assert.equal(iqiyiDetail[0].episodeItems[0].type, "link");
  assert.equal((await iqiyi.loadResource({ link: iqiyiDetail[0].episodeItems[0].link }))[0].url, "https://mus.video.iqiyi.com/test.m3u8");

  console.log("OK rex-media-modules bilibili-rex.js, iqiyi-rex.js");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function parseBody(text) {
  const trimmed = String(text || "").trim();
  const json = trimmed.replace(/^var\s+tvInfoJs\s*=\s*/, "").replace(/;\s*$/, "");
  return JSON.parse(json);
}

function createSandbox(filename) {
  const stored = new Map();
  const sandbox = {
    WidgetMetadata: undefined,
    console,
    Widget: {
      http: {
        get: async (url, options = {}) => {
          const target = new URL(url);
          for (const [key, value] of Object.entries(options.params || {})) {
            target.searchParams.set(key, String(value));
          }
          const response = await fetch(target, { headers: options.headers || {} });
          const text = await response.text();
          if (!response.ok) throw new Error(`HTTP ${response.status} ${target.hostname}${target.pathname}`);
          return { data: parseBody(text) };
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
  const target = path.join(root, "widgets", filename);
  new vm.Script(fs.readFileSync(target, "utf8"), { filename: target }).runInContext(sandbox);
  return sandbox;
}

async function probeResource(resource) {
  const headers = { ...(resource.customHeaders || resource.headers || {}) };
  const isHls = /\.m3u8(?:\?|$)/i.test(resource.url);
  if (!isHls) headers.Range = "bytes=0-1";
  const response = await fetch(resource.url, { headers });
  const contentType = response.headers.get("content-type") || "";
  let valid = response.ok || response.status === 206;
  if (isHls) {
    const body = await response.text();
    valid = valid && body.trimStart().startsWith("#EXTM3U");
  } else if (response.body) {
    await response.body.cancel();
  }
  return { status: response.status, contentType, valid };
}

function firstPlayableEpisode(detail, fallback) {
  return [...(detail?.episodeItems || []), ...(fallback?.episodeItems || [])]
    .find((item) => /^(?:bilibili|iqiyi)-play:/.test(String(item.link || "")));
}

async function runCases(platform, sandbox, cases, cookieName, cookieValue) {
  const rows = [];
  for (const testCase of cases) {
    const params = {
      keyword: testCase.keyword,
      contentType: testCase.contentType,
      page: 1,
      [cookieName]: cookieValue || "",
    };
    const results = await sandbox.search(params);
    if (!results.length) throw new Error(`${platform} ${testCase.contentType}“${testCase.keyword}”无搜索结果`);
    const item = results[0];
    const detail = await sandbox.loadDetail(item.link);
    const episode = firstPlayableEpisode(detail, item);
    if (!episode) throw new Error(`${platform} ${item.title} 没有可播放分集路由`);
    const resources = await sandbox.loadResource({ link: episode.link, [cookieName]: cookieValue || "" });
    if (!resources.length) throw new Error(`${platform} ${item.title} 没有播放线路`);
    const probe = await probeResource(resources[0]);
    if (!probe.valid) throw new Error(`${platform} ${item.title} 播放线路探测失败：HTTP ${probe.status}`);
    rows.push({
      platform,
      type: testCase.contentType,
      keyword: testCase.keyword,
      title: item.title,
      episodes: detail?.episodeItems?.length || item.episodeItems?.length || 0,
      resources: resources.length,
      status: probe.status,
      contentType: probe.contentType,
    });
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return rows;
}

(async () => {
  const bilibili = createSandbox("bilibili-tv-search.js");
  const iqiyi = createSandbox("iqiyi-tv-search.js");
  const bilibiliCases = [
    { contentType: "movie", keyword: "霸王别姬" },
    { contentType: "tv", keyword: "古相思曲" },
    { contentType: "anime", keyword: "凡人修仙传" },
    { contentType: "variety", keyword: "说唱新世代" },
    { contentType: "documentary", keyword: "航拍中国" },
  ];
  const iqiyiCases = [
    { contentType: "movie", keyword: "流浪地球2" },
    { contentType: "tv", keyword: "莲花楼" },
    { contentType: "anime", keyword: "斗罗大陆" },
    { contentType: "variety", keyword: "奔跑吧" },
    { contentType: "documentary", keyword: "航拍中国" },
  ];

  const rows = [
    ...(await runCases("B站", bilibili, bilibiliCases, "bilibiliCookie", process.env.BILIBILI_COOKIE)),
    ...(await runCases("爱奇艺", iqiyi, iqiyiCases, "iqiyiCookie", process.env.IQIYI_COOKIE)),
  ];
  console.table(rows);
  console.log("OK live-smoke", { cases: rows.length, cookies: "optional runtime environment only" });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

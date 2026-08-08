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
  delete headers["X-Forward-Skip-Redirect-Probe"];
  if (/^data:application\/dash\+xml;base64,/i.test(resource.url)) {
    const manifest = Buffer.from(resource.url.split(",")[1], "base64").toString("utf8");
    if (!/<MPD\b/.test(manifest) || !/contentType="video"/.test(manifest) || !/contentType="audio"/.test(manifest)) {
      return { status: 0, contentType: "application/dash+xml", valid: false };
    }
    const baseUrlMatch = manifest.match(/<BaseURL>([^<]+)<\/BaseURL>/);
    if (!baseUrlMatch) return { status: 0, contentType: "application/dash+xml", valid: false };
    const mediaUrl = baseUrlMatch[1]
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    const response = await fetch(mediaUrl, { headers: { ...headers, Range: "bytes=0-1" } });
    const contentType = response.headers.get("content-type") || "";
    if (response.body) await response.body.cancel();
    return { status: response.status, contentType: `application/dash+xml -> ${contentType}`, valid: response.ok || response.status === 206 };
  }
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

async function probeSubtitle(subtitle) {
  const response = await fetch(subtitle.url);
  const contentType = response.headers.get("content-type") || "";
  if (response.body) await response.body.cancel();
  return {
    status: response.status,
    contentType,
    valid: response.ok,
  };
}

function firstPlayableEpisode(primary, fallback) {
  return [...(primary?.episodeItems || []), ...(fallback?.episodeItems || [])]
    .find((item) => /^(?:bilibili|iqiyi)-play:/.test(String(item.link || "")));
}

async function runCases(platform, sandbox, cases, cookieName, cookieValue, expectedSearchParams, topLinePattern) {
  const searchParamNames = Array.from(sandbox.WidgetMetadata.search.params, (param) => param.name);
  if (JSON.stringify(searchParamNames) !== JSON.stringify(expectedSearchParams)) {
    throw new Error(`${platform} 全局搜索参数会触发客户端表单重建`);
  }
  if (sandbox.WidgetMetadata.modules.some((module) => module.functionName === sandbox.WidgetMetadata.search.functionName)) {
    throw new Error(`${platform} 重复注册搜索模块会触发 iPhone/iPad 参数页丢失输入`);
  }
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
    const episode = firstPlayableEpisode(item);
    if (!episode) throw new Error(`${platform} ${item.title} 搜索结果不能直接进入播放`);
    const resources = await sandbox.loadResource({ link: episode.link, [cookieName]: cookieValue || "" });
    if (!resources.length) throw new Error(`${platform} ${item.title} 没有播放线路`);
    if (!topLinePattern.test(String(resources[0].name || ""))) {
      throw new Error(`${platform} ${item.title} 第一条线路不是预期的最高画质`);
    }
    const probe = await probeResource(resources[0]);
    if (!probe.valid) throw new Error(`${platform} ${item.title} 播放线路探测失败：HTTP ${probe.status}`);
    const detail = await sandbox.loadDetail(item.link);
    const detailEpisode = firstPlayableEpisode(detail, item);
    if (!detailEpisode) throw new Error(`${platform} ${item.title} 详情页没有可播放分集路由`);
    const subtitles = await sandbox.loadSubtitle({ link: episode.link, [cookieName]: cookieValue || "" });
    const subtitleProbes = [];
    for (const subtitle of subtitles) {
      const subtitleProbe = await probeSubtitle(subtitle);
      if (!subtitleProbe.valid) {
        throw new Error(`${platform} ${item.title} 字幕探测失败：HTTP ${subtitleProbe.status}`);
      }
      subtitleProbes.push(subtitleProbe.status);
    }
    rows.push({
      platform,
      type: testCase.contentType,
      keyword: testCase.keyword,
      title: item.title,
      directFromSearch: true,
      episodes: detail?.episodeItems?.length || item.episodeItems?.length || 0,
      resources: resources.length,
      subtitles: subtitles.length,
      subtitleStatus: subtitleProbes.join(",") || "-",
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

  const platformFilter = String(process.env.LIVE_PLATFORM || "").toLowerCase();
  const caseLimit = Math.max(1, Number(process.env.LIVE_CASE_LIMIT || 5));
  const caseOffset = Math.max(0, Number(process.env.LIVE_CASE_OFFSET || 0));
  const rows = [];
  if (!platformFilter || platformFilter === "bilibili") rows.push(...(await runCases(
      "B站",
      bilibili,
      bilibiliCases.slice(caseOffset, caseOffset + caseLimit),
      "bilibiliCookie",
      process.env.BILIBILI_COOKIE,
      ["keyword", "page"],
      /账号可达最高/,
    )));
  if (!platformFilter || platformFilter === "iqiyi") rows.push(...(await runCases(
      "爱奇艺",
      iqiyi,
      iqiyiCases.slice(caseOffset, caseOffset + caseLimit),
      "iqiyiCookie",
      process.env.IQIYI_COOKIE,
      ["keyword"],
      /账号当前最高/,
    )));
  console.table(rows);
  console.log("OK live-smoke", { cases: rows.length, cookies: "optional runtime environment only" });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

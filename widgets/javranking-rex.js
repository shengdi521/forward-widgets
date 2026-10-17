/*
 * JavRanking 榜单模块，按 Rex/WidgetMetadata 格式编写。
 * 榜单入口只负责返回影片条目；选择影片后再由 loadDetail/loadResource
 * 请求对应网页和页面中公开的播放地址。模块不代理、不绕过 Cloudflare。
 */

var JAVRANKING_ORIGIN = "https://javranking.cc";
var JAVRANKING_BASE = JAVRANKING_ORIGIN + "/zh-hans";
var JAVRANKING_SEARCH_INDEX = JAVRANKING_BASE + "/search-index.json";
var cachedJavRankingTitles = null;
var cachedJavRankingTitlesAt = 0;
var JAVRANKING_TITLE_CACHE_TTL = 30 * 60 * 1000;

var JAVRANKING_RANKINGS = [
  { title: "DMM 本周热销榜", path: "/rankings/dmm-weekly/" },
  { title: "DMM 月度DVD榜 2026.10", path: "/rankings/dmm-monthly-2026-10/" },
  { title: "JAVDB TOP250", path: "/rankings/javdb-top250/" },
  { title: "JavLibray TOP250", path: "/rankings/javlibrary-top250/" },
  { title: "JAVDB 无码 TOP250", path: "/rankings/javdb-uncensored-top250/" },
  { title: "JAVDB FC2 TOP250", path: "/rankings/javdb-fc2-top250/" },
  { title: "JAVDB TOP250 2025", path: "/rankings/javdb-top250-2025/" },
  { title: "DMM 月度热销榜 2025.12", path: "/rankings/dmm-monthly-2025-12/" },
  { title: "DMM 月度热销榜 2025.11", path: "/rankings/dmm-monthly-2025-11/" },
  { title: "JAVDB TOP250 2024", path: "/rankings/javdb-top250-2024/" },
  { title: "JAVDB TOP250 2023", path: "/rankings/javdb-top250-2023/" },
  { title: "JAVDB TOP250 2022", path: "/rankings/javdb-top250-2022/" },
  { title: "JAVDB TOP250 2021", path: "/rankings/javdb-top250-2021/" },
  { title: "JAVDB TOP250 2020", path: "/rankings/javdb-top250-2020/" },
  { title: "JAVDB TOP250 2019", path: "/rankings/javdb-top250-2019/" },
  { title: "JAVDB TOP250 2018", path: "/rankings/javdb-top250-2018/" },
  { title: "JAVDB TOP250 2017", path: "/rankings/javdb-top250-2017/" },
  { title: "JAVDB TOP250 2016", path: "/rankings/javdb-top250-2016/" },
];

var JAVRANKING_FORMATS = [
  { title: "全部", value: "all" },
  { title: "有码", value: "censored" },
  { title: "无码", value: "uncensored" },
  { title: "FC2", value: "fc2" },
];

var JAVRANKING_STATUS = [
  { title: "全部", value: "all" },
  { title: "已发行", value: "released" },
];

var JAVRANKING_SORTS = [
  { title: "排名优先", value: "rank" },
  { title: "最新发行", value: "latest" },
  { title: "最早发行", value: "earliest" },
];

WidgetMetadata = {
  id: "javranking_rex",
  title: "JavRanking 榜单_Rex",
  author: "Custom",
  description: "JavRanking 18 个榜单分类；选择榜单后获取影片条目、详情和页面公开播放地址。",
  version: "1.0",
  requiredVersion: "0.0.1",
  site: JAVRANKING_ORIGIN + "/zh-hans/rankings/",
  modules: [
    buildRankingModule("DMM 本周热销榜", "/rankings/dmm-weekly/"),
    buildRankingModule("DMM 月度DVD榜 2026.10", "/rankings/dmm-monthly-2026-10/"),
    buildRankingModule("JAVDB TOP250", "/rankings/javdb-top250/"),
    buildRankingModule("JavLibray TOP250", "/rankings/javlibrary-top250/"),
    buildRankingModule("JAVDB 无码 TOP250", "/rankings/javdb-uncensored-top250/"),
    buildRankingModule("JAVDB FC2 TOP250", "/rankings/javdb-fc2-top250/"),
    buildRankingModule("JAVDB TOP250 2025", "/rankings/javdb-top250-2025/"),
    buildRankingModule("DMM 月度热销榜 2025.12", "/rankings/dmm-monthly-2025-12/"),
    buildRankingModule("DMM 月度热销榜 2025.11", "/rankings/dmm-monthly-2025-11/"),
    buildRankingModule("JAVDB TOP250 2024", "/rankings/javdb-top250-2024/"),
    buildRankingModule("JAVDB TOP250 2023", "/rankings/javdb-top250-2023/"),
    buildRankingModule("JAVDB TOP250 2022", "/rankings/javdb-top250-2022/"),
    buildRankingModule("JAVDB TOP250 2021", "/rankings/javdb-top250-2021/"),
    buildRankingModule("JAVDB TOP250 2020", "/rankings/javdb-top250-2020/"),
    buildRankingModule("JAVDB TOP250 2019", "/rankings/javdb-top250-2019/"),
    buildRankingModule("JAVDB TOP250 2018", "/rankings/javdb-top250-2018/"),
    buildRankingModule("JAVDB TOP250 2017", "/rankings/javdb-top250-2017/"),
    buildRankingModule("JAVDB TOP250 2016", "/rankings/javdb-top250-2016/"),
    {
      id: "searchList",
      title: "🔍 搜索影片",
      functionName: "searchList",
      type: "video",
      params: [
        { name: "keyword", title: "番号、女优名或片商", type: "input", value: "" },
        { name: "page", title: "页码", type: "page" },
      ],
    },
    {
      id: "loadResource",
      title: "JavRanking 页面播放源",
      description: "读取影片详情页中公开的 m3u8/mp4 地址；未发现直链时保留网页详情入口。",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 0,
      params: [],
    },
  ],
  search: {
    title: "🌐 全局搜索",
    functionName: "searchGlobal",
    params: [
      { name: "keyword", title: "番号、女优名或片商", type: "input", value: "" },
      { name: "page", title: "页码", type: "page", value: "1" },
    ],
  },
};

function buildRankingParams(path) {
  return [
    { name: "page", title: "页码", type: "page" },
    { name: "ranking", title: "榜单路径", type: "constant", value: path },
    { name: "format", title: "制式分类", type: "enumeration", value: "all", enumOptions: JAVRANKING_FORMATS },
    { name: "status", title: "发行状态", type: "enumeration", value: "all", enumOptions: JAVRANKING_STATUS },
    { name: "sort", title: "排序", type: "enumeration", value: "rank", enumOptions: JAVRANKING_SORTS },
  ];
}

function buildRankingModule(title, path) {
  return {
    id: "ranking-" + path.replace(/^\/rankings\//, "").replace(/\/$/, ""),
    title: title,
    functionName: "loadRanking",
    type: "video",
    params: buildRankingParams(path),
  };
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (text.indexOf("//") === 0) return "https:" + text;
  if (text.charAt(0) === "/") return JAVRANKING_ORIGIN + text;
  return JAVRANKING_ORIGIN + "/" + text;
}

function escapeQuery(value) {
  return encodeURIComponent(String(value || ""));
}

function rankingByPath(path) {
  var text = String(path || "");
  for (var index = 0; index < JAVRANKING_RANKINGS.length; index += 1) {
    if (JAVRANKING_RANKINGS[index].path === text) return JAVRANKING_RANKINGS[index];
  }
  return JAVRANKING_RANKINGS[0];
}

function htmlBody(response, url) {
  var status = Number(response && (response.status || response.statusCode || 0));
  var body = response && response.data;
  if (body === undefined || body === null) body = "";
  body = typeof body === "string" ? body : JSON.stringify(body);
  if (status >= 400 || /Just a moment|cf-chl-|Enable JavaScript and cookies/i.test(body)) {
    var suffix = status ? "（HTTP " + status + "）" : "";
    throw new Error("JavRanking 暂时拒绝了请求" + suffix + "。请先在当前手机/iPad网络中直接打开该地址确认连通性；模块不会代理、改 DNS 或绕过验证：" + url);
  }
  if (!body.trim()) throw new Error("JavRanking 返回了空页面：" + url);
  return body;
}

function sanitizeCookie(value) {
  return String(value || "").replace(/[\r\n]/g, " ").trim();
}

var lastJavRankingCookie = "";

async function requestPage(url, cookie) {
  try {
    var headers = { Accept: "text/html, text/markdown;q=0.9, */*;q=0.8" };
    var safeCookie = sanitizeCookie(cookie || lastJavRankingCookie);
    if (safeCookie) headers.Cookie = safeCookie;
    var response = await Widget.http.get(url, {
      headers: headers,
    });
    return htmlBody(response, url);
  } catch (error) {
    console.error("[JavRanking] 请求失败:", url, error && error.message ? error.message : error);
    throw error;
  }
}

function buildStatusItem(id, title, description) {
  return [{
    id: "javranking-status-" + id,
    type: "video",
    title: title,
    mediaType: "movie",
    description: description || "",
  }];
}

function firstImage($, node) {
  var image = $(node).find("img").first();
  if (!image || !image.length) image = $(node).parent().find("img").first();
  if (!image || !image.length) return "";
  return absoluteUrl(image.attr("src") || image.attr("data-src") || image.attr("data-original"));
}

function itemContainer($, node) {
  var container = $(node).closest("article, li, .card, .video-card, .ranking-item");
  if (container && container.length) return container.first();
  container = $(node).parent();
  for (var index = 0; index < 3 && container && container.length; index += 1) {
    if (cleanText(container.text()).length > cleanText($(node).text()).length + 8) return container;
    container = container.parent();
  }
  return $(node).parent();
}

function parseRank(text) {
  var match = cleanText(text).match(/^#?\s*([0-9]{1,4})(?:[.)]|\s|$)/);
  if (!match) match = cleanText(text).match(/(?:^|\s)#?([0-9]{1,4})(?:\s|$)/);
  return match ? Number(match[1]) : 0;
}

function parseScore(text) {
  var match = cleanText(text).match(/([0-9]+(?:\.[0-9]+)?)\s*(?:分|积分|points?)/i);
  return match ? Number(match[1]) : undefined;
}

function parseCode(text) {
  var match = cleanText(text).match(/\b[A-Z]{2,12}(?:-[A-Z0-9]+)+\b/i);
  return match ? match[0] : "";
}

function videoIdFromUrl(value) {
  var match = String(value || "").match(/\/videos\/(\d+)(?:\/|$)/i);
  return match ? match[1] : "";
}

function isGenericRankingTitle(value) {
  var text = cleanText(value).replace(/[：:|｜·•]+$/g, "").trim();
  if (!text) return true;
  if (/^即将发布(?:无码|有码)?$/i.test(text)) return true;
  if (/^(?:无码|有码|FC2|JAVDB|DMM|排行榜|排名|详情|播放|观看|预览|打开|更多)$/i.test(text)) return true;
  return false;
}

function normalizeRankingTitle(value) {
  var text = cleanText(value);
  if (!text || isGenericRankingTitle(text)) return "";
  text = text.replace(/^\s*(?:#?\d+[.)]?\s*)+/, "").trim();
  text = text.replace(/\s+(?:即将发布(?:无码|有码)?|无码|有码)$/i, "").trim();
  return isGenericRankingTitle(text) ? "" : text;
}

function rankingTitleFromNode($, node, container) {
  var attributes = ["title", "aria-label", "data-title", "data-name", "data-video-title"];
  for (var attributeIndex = 0; attributeIndex < attributes.length; attributeIndex += 1) {
    var value = normalizeRankingTitle($(node).attr(attributes[attributeIndex]));
    if (value) return value;
  }

  var titleSelectors = [
    "h1", "h2", "h3", "h4", ".title", ".video-title", ".video-title-text",
    ".name", ".card-title", "[data-title]", "[data-name]",
  ];
  for (var selectorIndex = 0; selectorIndex < titleSelectors.length; selectorIndex += 1) {
    var titleNode = $(container).find(titleSelectors[selectorIndex]).first();
    if (!titleNode || !titleNode.length) continue;
    var title = normalizeRankingTitle(titleNode.attr("title") || titleNode.attr("data-title") || titleNode.text());
    if (title) return title;
  }

  var image = $(container).find("img").first();
  if (image && image.length) {
    var alt = normalizeRankingTitle(image.attr("alt") || image.attr("title"));
    if (alt) return alt;
  }

  return normalizeRankingTitle($(node).text());
}

async function loadJavRankingTitles() {
  var now = Date.now();
  if (cachedJavRankingTitles && now - cachedJavRankingTitlesAt < JAVRANKING_TITLE_CACHE_TTL) {
    return cachedJavRankingTitles;
  }
  try {
    var response = await Widget.http.get(JAVRANKING_SEARCH_INDEX, {
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
    });
    var data = response && response.data;
    if (typeof data === "string") data = JSON.parse(data);
    var videos = data && Array.isArray(data.videos) ? data.videos : [];
    var titles = {};
    for (var index = 0; index < videos.length; index += 1) {
      var video = videos[index] || {};
      var id = String(video.videoId || video.id || "");
      var title = normalizeRankingTitle(video.title);
      if (id && title) titles[id] = title;
    }
    if (!Object.keys(titles).length) return null;
    cachedJavRankingTitles = titles;
    cachedJavRankingTitlesAt = now;
    return titles;
  } catch (error) {
    console.warn("[JavRanking] 标题索引不可用，回退页面标题:", error && error.message ? error.message : error);
    return null;
  }
}

function rankingItem(link, title, image, cardText, rankingTitle, titleMap) {
  var href = absoluteUrl(link);
  var rank = parseRank(cardText);
  var score = parseScore(cardText);
  var code = parseCode(cardText) || parseCode(title);
  var canonicalTitle = titleMap && titleMap[videoIdFromUrl(href)];
  var displayTitle = normalizeRankingTitle(canonicalTitle) || normalizeRankingTitle(title) || code || (rank ? "第 " + rank + " 名" : "JavRanking 条目");
  var description = [];
  if (code && displayTitle.indexOf(code) < 0) description.push("番号：" + code);
  if (rank) description.push("排名：#" + rank);
  if (score !== undefined) description.push("积分：" + score);
  description.push("榜单：" + rankingTitle);
  return {
    id: href,
    type: "video",
    title: displayTitle,
    coverUrl: image || undefined,
    posterPath: image || undefined,
    backdropPath: image || undefined,
    mediaType: "movie",
    rating: score,
    description: description.join(" · "),
    genreTitle: rankingTitle,
    link: href,
  };
}

function parseRankingHtml(body, rankingTitle, titleMap) {
  var $ = Widget.html.load(body);
  var items = [];
  var seen = {};
  $("a[href*='/zh-hans/videos/']").each(function (_, node) {
    var href = absoluteUrl($(node).attr("href"));
    if (!href || seen[href]) return;
    seen[href] = true;
    var container = itemContainer($, node);
    var cardText = cleanText(container.text());
    var title = rankingTitleFromNode($, node, container);
    var image = firstImage($, container);
    items.push(rankingItem(href, title, image, cardText, rankingTitle, titleMap));
  });
  return items;
}

function parseRankingMarkdown(body, rankingTitle, titleMap) {
  var items = [];
  var seen = {};
  var lines = String(body || "").split(/\r?\n/);
  for (var index = 0; index < lines.length; index += 1) {
    var line = lines[index];
    var match = line.match(/\[([^\]]+)\]\(([^)]*\/zh-hans\/videos\/[^)]+)\)/i);
    if (!match) continue;
    var href = absoluteUrl(match[2]);
    if (seen[href]) continue;
    seen[href] = true;
    items.push(rankingItem(href, match[1], "", line, rankingTitle, titleMap));
  }
  return items;
}

function addPageQuery(url, params) {
  var values = [];
  if (params.format && params.format !== "all") values.push("scope=" + escapeQuery(params.format));
  if (params.status && params.status !== "all") values.push("status=" + escapeQuery(params.status));
  if (params.sort && params.sort !== "rank") values.push("sort=" + escapeQuery(params.sort));
  var page = Number(params.page || 1);
  if (page > 1) values.push("page=" + page);
  return values.length ? url + "?" + values.join("&") : url;
}

async function loadRanking(params) {
  try {
    params = params || {};
    var ranking = rankingByPath(params.ranking);
    var url = addPageQuery(JAVRANKING_BASE + ranking.path, params);
    var body = await requestPage(url);
    var titleMap = await loadJavRankingTitles();
    var items = [];
    try {
      items = parseRankingHtml(body, ranking.title, titleMap);
    } catch (error) {
      console.warn("[JavRanking] HTML 榜单解析失败，尝试 Markdown:", error && error.message ? error.message : error);
    }
    if (!items.length) {
      var markdownUrl = addPageQuery(JAVRANKING_BASE + ranking.path.replace(/\/$/, ".md"), params);
      try {
        items = parseRankingMarkdown(await requestPage(markdownUrl), ranking.title, titleMap);
      } catch (markdownError) {
        if (body) throw markdownError;
      }
    }
    if (!items.length) return buildStatusItem("empty", "榜单为空", "未从“" + ranking.title + "”找到影片条目。");
    return items;
  } catch (error) {
    return buildStatusItem("ranking", "榜单请求失败", error && error.message ? error.message : String(error));
  }
}

// 保留旧函数名，方便已经缓存旧版本模块的客户端平滑升级。
async function loadList(params) {
  return loadRanking(params);
}

function parseDate(text) {
  var match = cleanText(text).match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
  if (!match) {
    match = cleanText(text).match(/(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  }
  if (!match) return undefined;
  return match[1] + "-" + ("0" + match[2]).slice(-2) + "-" + ("0" + match[3]).slice(-2);
}

function parseDuration(text) {
  var match = cleanText(text).match(/([0-9]{1,3})\s*分钟/);
  return match ? Number(match[1]) : undefined;
}

function parseDetailHtml(body, href, titleMap) {
  var $ = Widget.html.load(body);
  var main = $("main").first();
  if (!main || !main.length) main = $("body");
  var title = normalizeRankingTitle(titleMap && titleMap[videoIdFromUrl(href)]) ||
    normalizeRankingTitle(main.find("h1").first().text()) ||
    normalizeRankingTitle($("h1").first().text());
  var text = cleanText(main.text());
  var image = firstImage($, main);
  var backdropPaths = [];
  var imageSeen = {};
  main.find("a[href]").each(function (_, node) {
    var url = absoluteUrl($(node).attr("href"));
    if (/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(url) && !imageSeen[url]) {
      imageSeen[url] = true;
      backdropPaths.push(url);
    }
  });

  var peoples = [];
  var peopleSeen = {};
  main.find("a[href*='/actors/'], a[href*='/directors/'], a[href*='/makers/']").each(function (_, node) {
    var url = absoluteUrl($(node).attr("href"));
    var name = cleanText($(node).text());
    if (!url || !name || peopleSeen[url]) return;
    peopleSeen[url] = true;
    peoples.push({ id: url, title: name });
  });

  var genres = [];
  var genreSeen = {};
  main.find("a[href*='/explore/']").each(function (_, node) {
    var url = absoluteUrl($(node).attr("href"));
    var name = cleanText($(node).text());
    if (!url || !name || genreSeen[url]) return;
    genreSeen[url] = true;
    genres.push({ id: url, title: name });
  });

  var external = [];
  var externalSeen = {};
  main.find("a[href]").each(function (_, node) {
    var url = absoluteUrl($(node).attr("href"));
    var label = cleanText($(node).text());
    if (!url || !label || url.indexOf(JAVRANKING_ORIGIN) === 0 || externalSeen[url]) return;
    if (/^(?:https?:\/\/)?(?:missav|dmm|javbus|javlibrary|javdb)/i.test(url) || /播放|高清|广告/i.test(label)) {
      externalSeen[url] = true;
      external.push(label + "：" + url);
    }
  });

  var code = parseCode(text);
  var rating = parseScore(text);
  var description = [];
  if (code) description.push("番号：" + code);
  if (external.length) description.push("在线播放渠道：" + external.join("；"));
  return {
    id: href,
    type: "video",
    title: title || code || "JavRanking 影片详情",
    coverUrl: image || undefined,
    posterPath: image || undefined,
    detailPoster: image || undefined,
    backdropPath: image || undefined,
    backdropPaths: backdropPaths,
    mediaType: "movie",
    rating: rating,
    releaseDate: parseDate(text),
    duration: parseDuration(text),
    durationText: (text.match(/[0-9]{1,3}\s*分钟/) || [""])[0] || undefined,
    description: description.join("\n"),
    peoples: peoples,
    genreItems: genres,
    link: href,
  };
}

function parseDetailMarkdown(body, href, titleMap) {
  var text = String(body || "");
  var titleMatch = text.match(/^#\s+(.+)$/m);
  var title = normalizeRankingTitle(titleMap && titleMap[videoIdFromUrl(href)]) ||
    (titleMatch ? normalizeRankingTitle(titleMatch[1]) : "") || "JavRanking 影片详情";
  var imageMatch = text.match(/!\[[^\]]*\]\(([^)]+)\)/);
  var code = parseCode(text);
  return {
    id: href,
    type: "video",
    title: title,
    coverUrl: imageMatch ? absoluteUrl(imageMatch[1]) : undefined,
    posterPath: imageMatch ? absoluteUrl(imageMatch[1]) : undefined,
    backdropPath: imageMatch ? absoluteUrl(imageMatch[1]) : undefined,
    mediaType: "movie",
    releaseDate: parseDate(text),
    duration: parseDuration(text),
    description: code ? "番号：" + code : "",
    link: href,
  };
}

async function searchList(params) {
  try {
    params = params || {};
    var keyword = cleanText(params.keyword);
    if (!keyword) return buildStatusItem("empty-search", "请输入关键词", "可输入番号、女优名或片商后搜索。");
    var page = Number(params.page || 1);
    var url = JAVRANKING_BASE + "/search/?q=" + escapeQuery(keyword);
    if (page > 1) url += "&page=" + page;
    var body = await requestPage(url);
    var titleMap = await loadJavRankingTitles();
    var items = [];
    try {
      items = parseRankingHtml(body, "JavRanking 搜索", titleMap);
    } catch (error) {
      console.warn("[JavRanking] HTML 搜索解析失败:", error && error.message ? error.message : error);
    }
    if (!items.length) items = parseRankingMarkdown(body, "JavRanking 搜索", titleMap);
    if (!items.length) return buildStatusItem("no-search-result", "没有搜索结果", "JavRanking 没有返回匹配影片。");
    return items;
  } catch (error) {
    return buildStatusItem("search", "搜索请求失败", error && error.message ? error.message : String(error));
  }
}

async function searchGlobal(params) {
  return searchList(params);
}

async function loadDetail(link) {
  try {
    var href = absoluteUrl(link);
    if (!/\/zh-hans\/videos\/\d+\/?(?:\?.*)?$/i.test(href)) return null;
    var body = await requestPage(href);
    var titleMap = await loadJavRankingTitles();
    try {
      var detail = parseDetailHtml(body, href, titleMap);
      if (detail.title || detail.posterPath || detail.peoples.length) return [detail];
    } catch (error) {
      console.warn("[JavRanking] HTML 详情解析失败，尝试 Markdown:", error && error.message ? error.message : error);
    }
    return [parseDetailMarkdown(await requestPage(href.replace(/\/?(?:\?.*)?$/, ".md")), href, titleMap)];
  } catch (error) {
    return buildStatusItem("detail", "详情请求失败", error && error.message ? error.message : String(error));
  }
}

function extractPlayableUrls(body) {
  var matches = String(body || "").match(/https?:\/\/[^"' \t\r\n<>]+?\.(?:m3u8|mp4)(?:\?[^"' \t\r\n<>]*)?/gi) || [];
  var seen = {};
  var urls = [];
  for (var index = 0; index < matches.length; index += 1) {
    var url = matches[index].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
    if (!seen[url]) {
      seen[url] = true;
      urls.push(url);
    }
  }
  return urls;
}

function buildPlayHeaders(referer) {
  return {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
    Referer: referer || JAVRANKING_ORIGIN + "/",
  };
}

async function loadResource(params) {
  params = params || {};
  var link = absoluteUrl(params.link || params.videoUrl);
  if (!link) return [];
  try {
    var body = await requestPage(link);
    return extractPlayableUrls(body).map(function (url, index) {
      return {
        name: "页面直链 " + (index + 1),
        description: /\.m3u8(?:\?|$)/i.test(url) ? "HLS 页面公开地址" : "MP4 页面公开地址",
        url: url,
        customHeaders: buildPlayHeaders(link),
        playerType: "app",
      };
    });
  } catch (error) {
    console.warn("[JavRanking] 播放源解析失败:", error && error.message ? error.message : error);
    return [];
  }
}

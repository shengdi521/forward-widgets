/*
 * JavRanking public rankings/search adapter.
 * The site exposes a browser-friendly HTML page and a Markdown variant.  The
 * Forward client may receive a Cloudflare denial, so that case is surfaced as
 * an actionable error instead of returning an empty list.
 */

var JAVRANKING_ORIGIN = "https://javranking.cc";
var JAVRANKING_BASE = JAVRANKING_ORIGIN + "/zh-hans";

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
  id: "forward.javranking.rankings",
  title: "JavRanking 排行榜",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "按 JavRanking 中文网站分类浏览公开成人影片排行榜、搜索结果和条目详情。仅限成年人使用。",
  author: "Custom",
  site: JAVRANKING_ORIGIN + "/zh-hans/rankings/",
  detailCacheDuration: 600,
  globalParams: [
    {
      name: "javrankingCookie",
      title: "JavRanking 浏览器 Cookie（可选）",
      type: "input",
      description: "仅填写你自己浏览器中获得的 Cookie；模块只在请求头临时使用，不保存、不上传、不输出。不要填写账号密码。",
    },
  ],
  modules: [
    {
      id: "checkAccess",
      title: "检测 JavRanking 连通性",
      functionName: "checkAccess",
      cacheDuration: 0,
      params: [],
    },
    {
      id: "loadList",
      title: "浏览排行榜",
      functionName: "loadList",
      cacheDuration: 300,
      params: [
        {
          name: "ranking",
          title: "排行榜",
          type: "enumeration",
          enumOptions: JAVRANKING_RANKINGS,
          value: JAVRANKING_RANKINGS[0].path,
        },
        {
          name: "format",
          title: "制式分类",
          type: "enumeration",
          enumOptions: JAVRANKING_FORMATS,
          value: "all",
        },
        {
          name: "status",
          title: "发行状态",
          type: "enumeration",
          enumOptions: JAVRANKING_STATUS,
          value: "all",
        },
        {
          name: "sort",
          title: "排序",
          type: "enumeration",
          enumOptions: JAVRANKING_SORTS,
          value: "rank",
        },
        { name: "page", title: "页码", type: "page" },
      ],
    },
  ],
  search: {
    title: "搜索 JavRanking",
    functionName: "search",
    params: [
      { name: "keyword", title: "番号、女优名或片商", type: "input" },
      { name: "page", title: "页码", type: "page" },
    ],
  },
};

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

async function checkAccess(params) {
  params = params || {};
  if (params.javrankingCookie !== undefined) lastJavRankingCookie = sanitizeCookie(params.javrankingCookie);
  await requestPage(JAVRANKING_BASE + "/rankings/");
  return [{
    id: JAVRANKING_BASE + "/rankings/",
    type: "url",
    title: "JavRanking 网络可访问",
    mediaType: "movie",
    description: "Forward 已通过当前网络直接取得 JavRanking 榜单页面，可继续浏览排行榜或使用搜索。",
    link: JAVRANKING_BASE + "/rankings/",
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

function rankingItem(link, title, image, cardText, rankingTitle) {
  var href = absoluteUrl(link);
  var rank = parseRank(cardText);
  var score = parseScore(cardText);
  var code = parseCode(cardText) || parseCode(title);
  var displayTitle = cleanText(title) || code || (rank ? "第 " + rank + " 名" : "JavRanking 条目");
  var description = [];
  if (code && displayTitle.indexOf(code) < 0) description.push("番号：" + code);
  if (rank) description.push("排名：#" + rank);
  if (score !== undefined) description.push("积分：" + score);
  description.push("榜单：" + rankingTitle);
  return {
    id: href,
    type: "url",
    title: displayTitle,
    posterPath: image || undefined,
    backdropPath: image || undefined,
    mediaType: "movie",
    rating: score,
    description: description.join(" · "),
    genreTitle: rankingTitle,
    link: href,
  };
}

function parseRankingHtml(body, rankingTitle) {
  var $ = Widget.html.load(body);
  var items = [];
  var seen = {};
  $("a[href*='/zh-hans/videos/']").each(function (_, node) {
    var href = absoluteUrl($(node).attr("href"));
    if (!href || seen[href]) return;
    seen[href] = true;
    var container = itemContainer($, node);
    var cardText = cleanText(container.text());
    var title = cleanText($(node).text());
    var image = firstImage($, container);
    items.push(rankingItem(href, title, image, cardText, rankingTitle));
  });
  return items;
}

function parseRankingMarkdown(body, rankingTitle) {
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
    items.push(rankingItem(href, match[1], "", line, rankingTitle));
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

async function loadList(params) {
  params = params || {};
  if (params.javrankingCookie !== undefined) lastJavRankingCookie = sanitizeCookie(params.javrankingCookie);
  var ranking = rankingByPath(params.ranking);
  var url = addPageQuery(JAVRANKING_BASE + ranking.path, params);
  var body = await requestPage(url);
  var items = [];
  try {
    items = parseRankingHtml(body, ranking.title);
  } catch (error) {
    console.warn("[JavRanking] HTML 榜单解析失败，尝试 Markdown:", error && error.message ? error.message : error);
  }
  if (!items.length) {
    var markdownUrl = addPageQuery(JAVRANKING_BASE + ranking.path.replace(/\/$/, ".md"), params);
    try {
      items = parseRankingMarkdown(await requestPage(markdownUrl), ranking.title);
    } catch (markdownError) {
      if (body) throw markdownError;
    }
  }
  if (!items.length) throw new Error("未从 JavRanking 榜单中找到影片条目，可能是网站结构更新或当前请求被拦截。");
  return items;
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

function parseDetailHtml(body, href) {
  var $ = Widget.html.load(body);
  var main = $("main").first();
  if (!main || !main.length) main = $("body");
  var title = cleanText(main.find("h1").first().text()) || cleanText($("h1").first().text());
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
    type: "url",
    title: title || code || "JavRanking 影片详情",
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

function parseDetailMarkdown(body, href) {
  var text = String(body || "");
  var titleMatch = text.match(/^#\s+(.+)$/m);
  var title = titleMatch ? cleanText(titleMatch[1]) : "JavRanking 影片详情";
  var imageMatch = text.match(/!\[[^\]]*\]\(([^)]+)\)/);
  var code = parseCode(text);
  return {
    id: href,
    type: "url",
    title: title,
    posterPath: imageMatch ? absoluteUrl(imageMatch[1]) : undefined,
    backdropPath: imageMatch ? absoluteUrl(imageMatch[1]) : undefined,
    mediaType: "movie",
    releaseDate: parseDate(text),
    duration: parseDuration(text),
    description: code ? "番号：" + code : "",
    link: href,
  };
}

async function search(params) {
  params = params || {};
  if (params.javrankingCookie !== undefined) lastJavRankingCookie = sanitizeCookie(params.javrankingCookie);
  var keyword = cleanText(params.keyword);
  if (!keyword) throw new Error("请输入要搜索的番号、女优名或片商");
  var page = Number(params.page || 1);
  var url = JAVRANKING_BASE + "/search/?q=" + escapeQuery(keyword);
  if (page > 1) url += "&page=" + page;
  var body = await requestPage(url);
  var items = [];
  try {
    items = parseRankingHtml(body, "JavRanking 搜索");
  } catch (error) {
    console.warn("[JavRanking] HTML 搜索解析失败:", error && error.message ? error.message : error);
  }
  if (!items.length) items = parseRankingMarkdown(body, "JavRanking 搜索");
  if (!items.length) throw new Error("JavRanking 没有返回匹配结果，或当前请求被网站防护拦截。");
  return items;
}

async function loadDetail(link) {
  var href = absoluteUrl(link);
  if (!/\/zh-hans\/videos\/\d+\/?(?:\?.*)?$/i.test(href)) return null;
  var body = await requestPage(href);
  try {
    var detail = parseDetailHtml(body, href);
    if (detail.title || detail.posterPath || detail.peoples.length) return detail;
  } catch (error) {
    console.warn("[JavRanking] HTML 详情解析失败，尝试 Markdown:", error && error.message ? error.message : error);
  }
  var markdownUrl = href.replace(/\/?(?:\?.*)?$/, ".md");
  return parseDetailMarkdown(await requestPage(markdownUrl), href);
}


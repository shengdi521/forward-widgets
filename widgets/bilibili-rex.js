/* B站 Rex 模块：使用公开影视搜索页发现条目，再用官方页面/API 获取详情和播放地址。 */
WidgetMetadata = {
  id: "rex.bilibili.media",
  title: "B站影视搜索_Rex",
  author: "Custom",
  description: "B站电影、电视剧、番剧、综艺和纪录片搜索；按账号可达清晰度加载官方播放源。",
  version: "2.1.0",
  requiredVersion: "0.0.1",
  site: "https://www.bilibili.com",
  globalParams: [
    {
      name: "bilibiliCookie",
      title: "B站 Cookie（可选）",
      type: "input",
      description: "填写自己的完整 Cookie；模块只把它发送给 B站官方请求。",
    },
  ],
  modules: [
    {
      id: "searchList",
      title: "搜索 B站影视",
      functionName: "searchList",
      type: "video",
      params: [
        { name: "keyword", title: "影视名称", type: "input" },
        { name: "page", title: "页码", type: "page" },
      ],
    },
    {
      id: "loadResource",
      title: "B站官方播放源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 0,
      params: [],
    },
    {
      id: "loadSubtitle",
      title: "B站官方字幕",
      functionName: "loadSubtitle",
      type: "subtitle",
      cacheDuration: 0,
      params: [],
    },
  ],
  search: {
    title: "全局搜索 B站影视",
    functionName: "searchGlobal",
    params: [
      { name: "keyword", title: "影视名称", type: "input" },
      { name: "page", title: "页码", type: "page" },
    ],
  },
};

var BILI_ORIGIN = "https://www.bilibili.com";
var BILI_SEARCH = "https://search.bilibili.com/all";
var BILI_SEARCH_API = "https://api.bilibili.com/x/web-interface/search/type";
var BILI_WBI_SEARCH_API = "https://api.bilibili.com/x/web-interface/wbi/search/type";
var BILI_NAV_API = "https://api.bilibili.com/x/web-interface/nav";
var BILI_SEASON = "https://api.bilibili.com/pgc/view/web/season";
var BILI_PLAY = "https://api.bilibili.com/pgc/player/web/playurl";
var BILI_PLAYER_V2 = "https://api.bilibili.com/x/player/v2";
var BILI_COOKIE_KEY = "rex.bilibili.cookie:v2";
var lastBilibiliCookie = "";
var cachedBilibiliWbiKeys = null;
var cachedBilibiliWbiKeysAt = 0;
var BILI_WBI_KEY_TTL = 6 * 60 * 60 * 1000;
var BILI_WBI_MIXIN_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function httpsUrl(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  if (text.indexOf("//") === 0) return "https:" + text;
  return text.replace(/^http:\/\//i, "https://");
}

function cookieFrom(params) {
  if (params && params.bilibiliCookie !== undefined) {
    lastBilibiliCookie = String(params.bilibiliCookie || "").replace(/[\r\n]/g, "").trim();
    try { Widget.storage.set(BILI_COOKIE_KEY, lastBilibiliCookie); } catch (error) {}
  }
  if (lastBilibiliCookie) return lastBilibiliCookie;
  try { return String(Widget.storage.get(BILI_COOKIE_KEY) || "").trim(); } catch (error) { return ""; }
}

function biliHeaders(cookie, referer) {
  var headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
    Accept: "text/html,application/json,application/xhtml+xml;q=0.9,*/*;q=0.8",
    Referer: referer || BILI_ORIGIN + "/",
    Origin: BILI_ORIGIN,
  };
  if (cookie) headers.Cookie = cookie;
  return headers;
}

function query(url, values) {
  var parts = [];
  var keys = Object.keys(values || {});
  for (var index = 0; index < keys.length; index += 1) {
    var key = keys[index];
    if (values[key] === undefined || values[key] === null || values[key] === "") continue;
    parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(values[key])));
  }
  return parts.length ? url + (url.indexOf("?") >= 0 ? "&" : "?") + parts.join("&") : url;
}

async function getBody(url, headers) {
  var response = await Widget.http.get(url, { headers: headers || biliHeaders(cookieFrom({}), url) });
  return response && response.data;
}

function bilibiliMd5(value) {
  var bytes = [];
  var text = String(value || "");
  for (var i = 0; i < text.length; i += 1) bytes.push(text.charCodeAt(i) & 255);
  var bitLength = bytes.length * 8;
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (var lengthIndex = 0; lengthIndex < 8; lengthIndex += 1) {
    bytes.push(Math.floor(bitLength / Math.pow(256, lengthIndex)) & 255);
  }

  var shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  var constants = [];
  for (var constantIndex = 0; constantIndex < 64; constantIndex += 1) {
    constants.push(Math.floor(Math.abs(Math.sin(constantIndex + 1)) * 4294967296) >>> 0);
  }

  var a0 = 0x67452301;
  var b0 = 0xefcdab89;
  var c0 = 0x98badcfe;
  var d0 = 0x10325476;
  for (var offset = 0; offset < bytes.length; offset += 64) {
    var words = [];
    for (var wordIndex = 0; wordIndex < 16; wordIndex += 1) {
      var base = offset + wordIndex * 4;
      words[wordIndex] = (bytes[base] |
        (bytes[base + 1] << 8) |
        (bytes[base + 2] << 16) |
        (bytes[base + 3] << 24)) >>> 0;
    }

    var a = a0;
    var b = b0;
    var c = c0;
    var d = d0;
    for (var round = 0; round < 64; round += 1) {
      var f;
      var g;
      if (round < 16) {
        f = (b & c) | ((~b) & d);
        g = round;
      } else if (round < 32) {
        f = (d & b) | ((~d) & c);
        g = (5 * round + 1) % 16;
      } else if (round < 48) {
        f = b ^ c ^ d;
        g = (3 * round + 5) % 16;
      } else {
        f = c ^ (b | (~d));
        g = (7 * round) % 16;
      }
      var sum = (a + (f >>> 0) + constants[round] + words[g]) >>> 0;
      var rotated = ((sum << shifts[round]) | (sum >>> (32 - shifts[round]))) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotated) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  function littleEndianHex(word) {
    var hex = "";
    for (var byteIndex = 0; byteIndex < 4; byteIndex += 1) {
      hex += ("0" + ((word >>> (byteIndex * 8)) & 255).toString(16)).slice(-2);
    }
    return hex;
  }
  return littleEndianHex(a0) + littleEndianHex(b0) + littleEndianHex(c0) + littleEndianHex(d0);
}

function bilibiliWbiFilename(url) {
  var filename = String(url || "").split("/").pop().split("?")[0];
  return filename.split(".")[0];
}

function bilibiliMixinKey(imgKey, subKey) {
  var source = String(imgKey || "") + String(subKey || "");
  return BILI_WBI_MIXIN_TABLE.map(function (index) {
    return source[index] || "";
  }).join("").slice(0, 32);
}

async function loadBilibiliWbiKeys(cookie) {
  var now = Date.now();
  if (cachedBilibiliWbiKeys && now - cachedBilibiliWbiKeysAt < BILI_WBI_KEY_TTL) {
    return cachedBilibiliWbiKeys;
  }
  var body = jsonBody(await getBody(BILI_NAV_API, biliHeaders(cookie, BILI_ORIGIN + "/")));
  var wbi = body && body.data && body.data.wbi_img;
  var imgKey = bilibiliWbiFilename(wbi && wbi.img_url);
  var subKey = bilibiliWbiFilename(wbi && wbi.sub_url);
  if (!imgKey || !subKey) throw new Error("无法取得 WBI 密钥");
  cachedBilibiliWbiKeys = { imgKey: imgKey, subKey: subKey };
  cachedBilibiliWbiKeysAt = now;
  return cachedBilibiliWbiKeys;
}

function signBilibiliWbiParams(params, keys) {
  var signed = {};
  Object.keys(params || {}).forEach(function (key) {
    if (params[key] !== undefined && params[key] !== null) signed[key] = params[key];
  });
  signed.wts = Math.floor(Date.now() / 1000);
  var signedQuery = Object.keys(signed).sort().map(function (key) {
    var value = String(signed[key]).replace(/[!'()*]/g, "");
    return encodeURIComponent(key) + "=" + encodeURIComponent(value);
  }).join("&");
  signed.w_rid = bilibiliMd5(signedQuery + bilibiliMixinKey(keys.imgKey, keys.subKey));
  return signed;
}

function jsonBody(value) {
  if (value && typeof value === "object") return value;
  var text = String(value || "").replace(/^\uFEFF/, "").trim();
  return text ? JSON.parse(text) : null;
}

function statusItem(id, title, subTitle) {
  return [{ id: "bilibili-status-" + id, type: "text", title: title, subTitle: subTitle || "" }];
}

function textOf($, selector, node) {
  var target = $(node).find(selector).first();
  return target && target.length ? cleanText(target.text()) : "";
}

function attrOf($, selector, name, node) {
  var target = $(node).find(selector).first();
  return target && target.length ? String(target.attr(name) || "") : "";
}

function parseBilibiliSearchHtml(html) {
  var $ = Widget.html.load(String(html || ""));
  var items = [];
  var seen = {};
  var cards = $(".bangumi-pgc-list .media-card");
  if (!cards || !cards.length) cards = $(".media-card");
  cards.each(function (_, node) {
    var card = $(node);
    var linkNode = card.find('a[href*="/bangumi/play/"]').first();
    var link = httpsUrl(linkNode.attr("href"));
    if (!link || seen[link]) return;
    seen[link] = true;
    var title = cleanText(linkNode.attr("title") || textOf($, ".media-card-content-head-title a", node));
    var cover = httpsUrl(attrOf($, "img", "src", node) || attrOf($, "img", "data-src", node));
    var kind = textOf($, ".media-card-content-head-title-tag", node);
    var label = textOf($, ".media-card-content-head-label", node);
    var description = textOf($, ".media-card-content-head-desc", node);
    var score = textOf($, ".score-value", node);
    items.push({
      id: link,
      type: "link",
      mediaType: /电影/.test(kind) ? "movie" : "tv",
      title: title || "B站影视",
      coverUrl: cover,
      posterPath: cover,
      backdropPath: cover,
      description: [kind, label, description, score].filter(function (part) { return !!part; }).join(" · "),
      link: link,
    });
  });
  return items;
}

function formatDateFromUnix(value) {
  var timestamp = Number(value || 0);
  if (!timestamp) return "";
  var date = new Date(timestamp * 1000);
  return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function uniqueParts(parts) {
  var seen = {};
  return (parts || []).map(cleanText).filter(function (part) {
    if (!part || seen[part]) return false;
    seen[part] = true;
    return true;
  });
}

function buildSearchDescription(row) {
  return uniqueParts([
    row && row.season_type_name,
    row && row.areas,
    row && row.styles,
    row && row.index_show,
    row && row.desc,
  ]).join(" · ");
}

function bilibiliSearchMediaType(row) {
  var seasonType = Number(row && (row.season_type || row.type) || 0);
  if (seasonType === 2) return "movie";
  return "tv";
}

function mapBilibiliSearchItem(row) {
  if (!row) return null;
  var seasonId = String(row.season_id || row.pgc_season_id || "");
  var pageUrl = httpsUrl(row.goto_url || row.url || row.arcurl);
  if (!seasonId || !pageUrl || !/bilibili\.com\/bangumi\/play\//i.test(pageUrl)) return null;
  var cover = httpsUrl(row.cover);
  var episodeCover = row.eps && row.eps[0] ? httpsUrl(row.eps[0].cover) : "";
  var score = row.media_score && Number(row.media_score.score || 0);
  var item = {
    id: pageUrl,
    type: "link",
    mediaType: bilibiliSearchMediaType(row),
    title: cleanText(row.title || row.org_title) || "B站影视",
    posterPath: cover,
    backdropPath: episodeCover || cover,
    description: buildSearchDescription(row),
    releaseDate: formatDateFromUnix(row.pubtime),
    link: pageUrl,
  };
  if (score) item.rating = score;
  return item;
}

function searchRowsFromBody(body) {
  var parsed = jsonBody(body);
  if (!parsed || Number(parsed.code) !== 0) {
    throw new Error(parsed && parsed.message ? parsed.message : "B站搜索返回空数据");
  }
  return parsed.data && Array.isArray(parsed.data.result) ? parsed.data.result : [];
}

async function requestBilibiliSearchRows(searchType, keyword, page, cookie, wbiKeys) {
  var baseParams = {
    search_type: searchType,
    keyword: keyword,
    page: page,
  };
  if (wbiKeys) {
    try {
      var signedUrl = query(BILI_WBI_SEARCH_API, signBilibiliWbiParams(baseParams, wbiKeys));
      return searchRowsFromBody(await getBody(signedUrl, biliHeaders(cookie, "https://search.bilibili.com/")));
    } catch (wbiError) {
      cachedBilibiliWbiKeys = null;
      cachedBilibiliWbiKeysAt = 0;
      console.warn("[B站搜索] WBI 请求失败，回退兼容接口:", searchType, wbiError.message || wbiError);
    }
  }
  var fallbackUrl = query(BILI_SEARCH_API, baseParams);
  return searchRowsFromBody(await getBody(fallbackUrl, biliHeaders(cookie, "https://search.bilibili.com/")));
}

function regexNumber(text, name) {
  var match = String(text || "").match(new RegExp("(?:\\\"|')?" + name + "(?:\\\"|')?\\s*[:=]\\s*(\\d+)", "i"));
  return match ? match[1] : "";
}

function pageMeta(html, link) {
  var text = String(html || "");
  var $ = null;
  try { $ = Widget.html.load(text); } catch (error) {}
  var title = "";
  var cover = "";
  if ($) {
    title = cleanText($("meta[property='og:title']").attr("content") || $("h1").first().text());
    cover = httpsUrl($("meta[property='og:image']").attr("content") || $("img").first().attr("src"));
  }
  var epMatch = String(link || "").match(/\/ep(\d+)/i);
  return {
    title: title,
    cover: cover,
    epId: epMatch ? epMatch[1] : regexNumber(text, "ep_id"),
    seasonId: regexNumber(text, "season_id"),
    aid: regexNumber(text, "aid"),
    cid: regexNumber(text, "cid"),
  };
}

function playLink(seasonId, epId, aid, cid) {
  if (!/^\d+$/.test(String(seasonId || "")) || !/^\d+$/.test(String(epId || ""))) return "";
  return ["bilibili-play", seasonId, epId, aid || "", cid || ""].join(":");
}

function mapEpisode(episode, index, seasonId, mediaType) {
  var epId = String(episode.ep_id || episode.id || "");
  if (!epId) return null;
  var pageUrl = httpsUrl(episode.share_url || episode.link || episode.url) || BILI_ORIGIN + "/bangumi/play/ep" + epId;
  var rawTitle = cleanText(episode.long_title || episode.show_title || episode.title || episode.index_title);
  var number = cleanText(episode.title || episode.index_title);
  var title = rawTitle || (number && /^\d+(?:\.\d+)?$/.test(number) ? "第" + number + "集" : number) || "第" + (index + 1) + "集";
  var route = playLink(seasonId, epId, String(episode.aid || ""), String(episode.cid || ""));
  return {
    id: pageUrl,
    type: "link",
    mediaType: mediaType || "tv",
    title: title,
    backdropPath: httpsUrl(episode.cover),
    releaseDate: episode.pub_time ? new Date(Number(episode.pub_time) * 1000).toISOString().slice(0, 10) : "",
    description: episode.badge ? "B站官方页面 · " + cleanText(episode.badge) : "B站官方页面",
    link: route || pageUrl,
    episode: /^\d+(?:\.\d+)?$/.test(number) ? Number(number) : undefined,
  };
}

async function searchBilibili(params) {
  params = params || {};
  var keyword = cleanText(params.keyword || params.query || params.title);
  if (!keyword) return statusItem("empty-search", "请输入关键词", "请输入电影、电视剧或综艺名称。");
  var page = Math.max(1, Number(params.page || 1));
  var cookie = cookieFrom(params);
  var wbiKeys = null;
  try {
    wbiKeys = await loadBilibiliWbiKeys(cookie);
  } catch (wbiError) {
    console.warn("[B站搜索] WBI 初始化失败，使用兼容接口:", wbiError.message || wbiError);
  }

  var searchTypes = ["media_bangumi", "media_ft"];
  var responses = await Promise.all(searchTypes.map(async function (searchType) {
    try {
      return { rows: await requestBilibiliSearchRows(searchType, keyword, page, cookie, wbiKeys) };
    } catch (error) {
      return { rows: [], error: error && error.message ? error.message : String(error) };
    }
  }));

  var successful = responses.some(function (response) { return !response.error; });
  if (!successful) {
    var errors = responses.map(function (response, index) {
      return searchTypes[index] + ": " + response.error;
    });
    return statusItem("search", "B站搜索失败", errors.join("；"));
  }

  var seen = {};
  var items = [];
  responses.forEach(function (response) {
    response.rows.forEach(function (row) {
      var item = mapBilibiliSearchItem(row);
      if (!item || seen[item.link]) return;
      seen[item.link] = true;
      items.push(item);
    });
  });
  if (items.length) return items;
  return statusItem("no-result", "没有找到影视", "B站搜索接口没有返回可播放的影视条目。");
}

async function searchList(params) {
  return searchBilibili(params);
}

async function searchGlobal(params) {
  return searchBilibili(params);
}

async function loadDetail(link) {
  var pageUrl = httpsUrl(link);
  if (!/bilibili\.com\/bangumi\/play\//i.test(pageUrl)) return [];
  try {
    var html = await getBody(pageUrl, biliHeaders(cookieFrom({}), pageUrl));
    var meta = pageMeta(html, pageUrl);
    var title = meta.title || "B站影视";
    var episodes = [];
    if (meta.seasonId) {
      try {
        var season = jsonBody(await getBody(query(BILI_SEASON, { season_id: meta.seasonId }), biliHeaders(cookieFrom({}), pageUrl)));
        if (season && Number(season.code) === 0 && season.result) {
          var result = season.result;
          title = cleanText(result.title || title);
          meta.cover = httpsUrl(result.cover || meta.cover);
          var list = Array.isArray(result.episodes) ? result.episodes : [];
          episodes = list.map(function (episode, index) {
            return mapEpisode(episode, index, meta.seasonId, Number(result.season_type) === 2 ? "movie" : "tv");
          }).filter(function (item) { return !!item; });
        }
      } catch (seasonError) {}
    }
    if (!episodes.length && meta.seasonId && meta.epId) {
      var route = playLink(meta.seasonId, meta.epId, meta.aid, meta.cid);
      if (route) episodes.push({ id: pageUrl, type: "link", title: "正片", mediaType: "movie", link: route });
    }
    if (!episodes.length) return statusItem("detail-empty", "详情缺少播放分集", "B站页面未返回可用分集参数。");
    return [{
      id: pageUrl,
      type: "link",
      mediaType: episodes[0].mediaType || "tv",
      title: title,
      posterPath: meta.cover,
      backdropPath: meta.cover,
      description: "B站官方影视详情",
      link: pageUrl,
      episodeItems: episodes,
    }];
  } catch (error) {
    return statusItem("detail", "B站详情失败", error && error.message ? error.message : String(error));
  }
}

function parsePlayLink(link) {
  var parts = String(link || "").split(":");
  if (parts.length !== 5 || parts[0] !== "bilibili-play" || !/^\d+$/.test(parts[1]) || !/^\d+$/.test(parts[2])) return null;
  return { seasonId: parts[1], epId: parts[2], aid: parts[3], cid: parts[4] };
}

function qualityLabel(result) {
  var q = Number(result && result.quality || 0);
  var descriptions = result && Array.isArray(result.accept_description) ? result.accept_description : [];
  var qualities = result && Array.isArray(result.accept_quality) ? result.accept_quality.map(Number) : [];
  var index = qualities.indexOf(q);
  if (index >= 0 && descriptions[index]) return cleanText(descriptions[index]);
  return ({ 16: "360P", 32: "480P", 64: "720P", 80: "1080P", 112: "1080P 高码率", 116: "1080P 60帧", 120: "4K", 125: "HDR", 127: "8K" })[q] || "账号可达清晰度";
}

async function requestPlay(route, cookie) {
  var qns = [127, 120, 116, 112, 80, 64, 32];
  var lastError = null;
  for (var index = 0; index < qns.length; index += 1) {
    try {
      var url = query(BILI_PLAY, {
        avid: route.aid,
        cid: route.cid,
        ep_id: route.epId,
        qn: qns[index],
        fnval: 0,
        fnver: 0,
        fourk: 1,
        high_quality: 1,
        platform: "html5",
      });
      var body = jsonBody(await getBody(url, biliHeaders(cookie, BILI_ORIGIN + "/bangumi/play/ep" + route.epId)));
      if (body && Number(body.code) === 0 && body.result && Array.isArray(body.result.durl) && body.result.durl.length) return body.result;
      lastError = new Error(body && body.message ? body.message : "没有可用播放线路");
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("B站没有返回可播放线路");
}

async function loadResource(params) {
  params = params || {};
  var route = parsePlayLink(params.link);
  if (!route || !route.aid || !route.cid) return [];
  try {
    var result = await requestPlay(route, cookieFrom(params));
    var resources = [];
    var seen = {};
    var sources = [];
    for (var index = 0; index < result.durl.length; index += 1) {
      var durl = result.durl[index] || {};
      sources.push(durl.url);
      if (Array.isArray(durl.backup_url)) sources = sources.concat(durl.backup_url);
    }
    for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      var url = httpsUrl(sources[sourceIndex]);
      if (!url || seen[url]) continue;
      seen[url] = true;
      resources.push({
        name: "B站 " + qualityLabel(result) + (sourceIndex ? " · 备用线路" : " · 首选线路"),
        description: "B站官方 MP4 播放源；按账号可达清晰度请求",
        url: url,
        playerType: "app",
        customHeaders: biliHeaders(cookieFrom(params), BILI_ORIGIN + "/bangumi/play/ep" + route.epId),
      });
    }
    return resources;
  } catch (error) {
    console.warn("[B站播放] 加载失败:", error && error.message ? error.message : error);
    return [];
  }
}

async function loadSubtitle(params) {
  params = params || {};
  var route = parsePlayLink(params.link);
  if (!route || !route.aid || !route.cid) return [];
  try {
    var body = jsonBody(await getBody(query(BILI_PLAYER_V2, { aid: route.aid, cid: route.cid }), biliHeaders(cookieFrom(params), BILI_ORIGIN + "/bangumi/play/ep" + route.epId)));
    var list = body && body.data && body.data.subtitle && Array.isArray(body.data.subtitle.subtitles) ? body.data.subtitle.subtitles : [];
    var seen = {};
    return list.map(function (subtitle, index) {
      var url = httpsUrl(subtitle && (subtitle.subtitle_url || subtitle.url));
      if (!url || seen[url]) return null;
      seen[url] = true;
      return {
        id: "bilibili-subtitle-" + String(subtitle.id || index),
        title: cleanText(subtitle.lan_doc || subtitle.lan || "B站官方字幕"),
        lang: cleanText(subtitle.lan || "und").replace(/_/g, "-"),
        count: 1,
        url: url,
      };
    }).filter(function (item) { return !!item; });
  } catch (error) {
    console.warn("[B站字幕] 加载失败:", error && error.message ? error.message : error);
    return [];
  }
}

WidgetMetadata = {
  id: "forward.bilibili.tv.search",
  title: "B站影视搜索",
  version: "1.4.0",
  requiredVersion: "0.0.2",
  description: "使用可选的个人 Cookie 搜索并在线观看 B站官方影视；自动请求账号可达的最高清晰度，并加载可用的官方字幕。",
  author: "Custom",
  site: "https://www.bilibili.com",
  detailCacheDuration: 0,
  globalParams: [
    {
      name: "bilibiliCookie",
      title: "B站 Cookie（可选）",
      type: "input",
      description: "填写你自己的完整 Cookie。仅随 B站请求发送，模块不会输出 Cookie。",
    },
  ],
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 0,
      params: [],
    },
    {
      id: "loadSubtitle",
      title: "加载字幕",
      functionName: "loadSubtitle",
      type: "subtitle",
      cacheDuration: 0,
      params: [],
    },
    {
      id: "searchCatalog",
      title: "搜索并观看",
      description: "输入影视名称，结果可直接选择正片或分集播放。",
      functionName: "search",
      cacheDuration: 0,
      params: [
        { name: "keyword", title: "影视名称", type: "input" },
      ],
    },
  ],
  search: {
    title: "搜索 B站影视",
    functionName: "search",
    params: [
      { name: "keyword", title: "影视名称", type: "input" },
    ],
  },
};

var BILIBILI_SEARCH_API = "https://api.bilibili.com/x/web-interface/search/type";
var BILIBILI_WBI_SEARCH_API = "https://api.bilibili.com/x/web-interface/wbi/search/type";
var BILIBILI_NAV_API = "https://api.bilibili.com/x/web-interface/nav";
var BILIBILI_SEASON_API = "https://api.bilibili.com/pgc/view/web/season";
var BILIBILI_PLAY_API = "https://api.bilibili.com/pgc/player/web/playurl";
var BILIBILI_PLAYER_V2_API = "https://api.bilibili.com/x/player/v2";
var BILIBILI_CACHE_PREFIX = "bilibili-tv-detail:v2:";
var BILIBILI_PLAY_ROUTE_CACHE_PREFIX = "bilibili-play-route:v1:";
var lastBilibiliCookie = "";
var cachedBilibiliWbiKeys = null;
var cachedBilibiliWbiKeysAt = 0;
var BILIBILI_WBI_KEY_TTL = 6 * 60 * 60 * 1000;
var BILIBILI_WBI_MIXIN_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

function sanitizeCookie(value) {
  return String(value || "").replace(/[\r\n]/g, "").trim();
}

function bilibiliHeaders(cookie, referer) {
  var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
    Referer: referer || "https://search.bilibili.com/",
    Origin: "https://www.bilibili.com",
  };
  if (cookie) headers.Cookie = cookie;
  return headers;
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
  return BILIBILI_WBI_MIXIN_TABLE.map(function (index) {
    return source[index] || "";
  }).join("").slice(0, 32);
}

async function loadBilibiliWbiKeys(cookie) {
  var now = Date.now();
  if (cachedBilibiliWbiKeys && now - cachedBilibiliWbiKeysAt < BILIBILI_WBI_KEY_TTL) {
    return cachedBilibiliWbiKeys;
  }
  var response = await Widget.http.get(BILIBILI_NAV_API, {
    headers: bilibiliHeaders(cookie, "https://www.bilibili.com/"),
  });
  var body = response && response.data;
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
  Object.keys(params).forEach(function (key) {
    if (params[key] !== undefined && params[key] !== null) signed[key] = params[key];
  });
  signed.wts = Math.floor(Date.now() / 1000);
  var query = Object.keys(signed).sort().map(function (key) {
    var value = String(signed[key]).replace(/[!'()*]/g, "");
    return encodeURIComponent(key) + "=" + encodeURIComponent(value);
  }).join("&");
  var mixinKey = bilibiliMixinKey(keys.imgKey, keys.subKey);
  signed.w_rid = bilibiliMd5(query + mixinKey);
  return signed;
}

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
  var url = String(value || "").trim();
  if (!url) return "";
  if (url.indexOf("//") === 0) return "https:" + url;
  return url.replace(/^http:\/\//i, "https://");
}

function formatDateFromUnix(value) {
  var timestamp = Number(value || 0);
  if (!timestamp) return "";
  var date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function uniqueParts(parts) {
  var seen = {};
  return parts.filter(function (part) {
    var text = cleanText(part);
    if (!text || seen[text]) return false;
    seen[text] = true;
    return true;
  });
}

function buildSearchDescription(row) {
  return uniqueParts([
    row.season_type_name,
    row.areas,
    row.styles,
    row.index_show,
    row.desc,
  ]).join(" · ");
}

function bilibiliCategory(row) {
  var seasonType = Number(row && (row.season_type || row.type) || 0);
  if (seasonType === 2) return "movie";
  if (seasonType === 5) return "tv";
  if (seasonType === 1 || seasonType === 4) return "anime";
  if (seasonType === 7) return "variety";
  if (seasonType === 3) return "documentary";

  var typeName = cleanText(row && row.season_type_name);
  if (typeName.indexOf("电影") >= 0) return "movie";
  if (typeName.indexOf("电视剧") >= 0) return "tv";
  if (typeName.indexOf("番剧") >= 0 || typeName.indexOf("国创") >= 0) return "anime";
  if (typeName.indexOf("综艺") >= 0) return "variety";
  if (typeName.indexOf("纪录片") >= 0) return "documentary";
  return "other";
}

function bilibiliMediaType(row) {
  return bilibiliCategory(row) === "movie" ? "movie" : "tv";
}

function bilibiliPlayRoute(seasonId, epId, aid, cid) {
  if (!/^\d+$/.test(String(seasonId || "")) || !/^\d+$/.test(String(epId || ""))) {
    return "";
  }
  return [
    "bilibili-play",
    String(seasonId),
    String(epId),
    /^\d+$/.test(String(aid || "")) ? String(aid) : "",
    /^\d+$/.test(String(cid || "")) ? String(cid) : "",
  ].join(":");
}

function bilibiliSearchTypes(contentType) {
  if (contentType === "anime" || contentType === "media_bangumi") return ["media_bangumi"];
  if (contentType === "movie" || contentType === "tv" ||
      contentType === "variety" || contentType === "documentary" ||
      contentType === "media_ft") {
    return ["media_ft"];
  }
  return ["media_bangumi", "media_ft"];
}

function isBilibiliCategoryFilter(contentType) {
  return ["movie", "tv", "anime", "variety", "documentary"].indexOf(contentType) >= 0;
}

function mapBilibiliSearchItem(row) {
  var seasonId = String(row.season_id || row.pgc_season_id || "");
  if (!seasonId) return null;
  var pageUrl = httpsUrl(row.goto_url || row.url) ||
    "https://www.bilibili.com/bangumi/play/ss" + seasonId;
  var episodeCover = row.eps && row.eps[0] ? httpsUrl(row.eps[0].cover) : "";
  var score = row.media_score ? Number(row.media_score.score || 0) : 0;
  var mediaType = bilibiliMediaType(row);
  var episodes = Array.isArray(row.eps)
    ? row.eps.map(function (episode, index) {
        return mapBilibiliEpisode(episode, index, mediaType, seasonId);
      }).filter(function (episode) { return !!(episode && episode.link); })
    : [];
  if (!episodes.length) {
    var pageEpisodeMatch = pageUrl.match(/\/bangumi\/play\/ep(\d+)/i);
    if (pageEpisodeMatch) {
      episodes.push(mapBilibiliEpisode({
        id: pageEpisodeMatch[1],
        title: mediaType === "movie" ? "正片" : "命中分集",
        url: pageUrl,
        cover: row.cover,
      }, 0, mediaType, seasonId));
    }
  }
  var item = {
    id: pageUrl,
    type: "url",
    mediaType: mediaType,
    title: cleanText(row.title || row.org_title),
    posterPath: httpsUrl(row.cover),
    backdropPath: episodeCover || httpsUrl(row.cover),
    description: buildSearchDescription(row),
    releaseDate: formatDateFromUnix(row.pubtime),
    link: "bilibili:" + seasonId,
    episodeItems: episodes,
  };
  if (score) item.rating = score;
  return item;
}

function cacheDetail(link, item) {
  try {
    Widget.storage.set(BILIBILI_CACHE_PREFIX + link, item);
  } catch (error) {
    console.warn("[B站搜索] 缓存详情失败:", error.message || error);
  }
}

function readCachedDetail(link) {
  try {
    return Widget.storage.get(BILIBILI_CACHE_PREFIX + link) || null;
  } catch (error) {
    return null;
  }
}

async function search(params = {}) {
  var keyword = String(params.keyword || params.query || params.title || "").trim();
  if (!keyword) throw new Error("请输入要搜索的影视名称");

  var page = Math.max(1, Number(params.page || 1));
  var requestedType = String(params.contentType || "all");
  var types = bilibiliSearchTypes(requestedType);
  lastBilibiliCookie = sanitizeCookie(params.bilibiliCookie);
  var wbiKeys = null;
  try {
    wbiKeys = await loadBilibiliWbiKeys(lastBilibiliCookie);
  } catch (wbiError) {
    console.warn("[B站搜索] WBI 初始化失败，使用兼容接口:", wbiError.message || wbiError);
  }

  var requestResults = await Promise.all(types.map(async function (searchType) {
    try {
      var requestParams = {
        search_type: searchType,
        keyword: keyword,
        page: page,
      };
      var searchApi = BILIBILI_SEARCH_API;
      if (wbiKeys) {
        requestParams = signBilibiliWbiParams(requestParams, wbiKeys);
        searchApi = BILIBILI_WBI_SEARCH_API;
      }
      var response = await Widget.http.get(searchApi, {
        headers: bilibiliHeaders(lastBilibiliCookie, "https://search.bilibili.com/"),
        params: requestParams,
      });
      var body = response && response.data;
      if (!body || Number(body.code) !== 0) {
        throw new Error(body && body.message ? body.message : "空响应");
      }
      var result = body.data && Array.isArray(body.data.result) ? body.data.result : [];
      return { type: searchType, rows: result };
    } catch (error) {
      console.error("[B站搜索] 请求失败:", searchType, error.message || error);
      return { type: searchType, error: error.message || String(error), rows: [] };
    }
  }));

  var rows = [];
  var successfulRequests = 0;
  var errors = [];
  for (var resultIndex = 0; resultIndex < requestResults.length; resultIndex += 1) {
    var requestResult = requestResults[resultIndex];
    if (requestResult.error) {
      errors.push(requestResult.type + ": " + requestResult.error);
      continue;
    }
    successfulRequests += 1;
    rows = rows.concat(requestResult.rows);
  }

  if (!successfulRequests) {
    throw new Error("B站搜索失败：" + errors.join("；"));
  }

  var seen = {};
  var items = [];
  for (var index = 0; index < rows.length; index += 1) {
    if (isBilibiliCategoryFilter(requestedType) &&
        bilibiliCategory(rows[index]) !== requestedType) continue;
    var mapped = mapBilibiliSearchItem(rows[index]);
    if (!mapped || seen[mapped.link]) continue;
    seen[mapped.link] = true;
    cacheDetail(mapped.link, mapped);
    items.push(mapped);
  }
  return items;
}

function mapBilibiliEpisode(episode, index, mediaType, seasonId) {
  var pageUrl = httpsUrl(episode.link || episode.url) ||
    "https://www.bilibili.com/bangumi/play/ep" + String(episode.id || "");
  var episodeNumber = cleanText(episode.title || episode.index_title) || String(index + 1);
  var longTitle = cleanText(episode.long_title);
  var numericEpisode = /^\d+(?:\.\d+)?$/.test(episodeNumber);
  var title = mediaType === "movie" || !numericEpisode
    ? episodeNumber + (longTitle ? " · " + longTitle : "")
    : "第" + episodeNumber + "集" + (longTitle ? " · " + longTitle : "");
  var badge = cleanText(episode.badge || (episode.badge_info && episode.badge_info.text));
  var route = bilibiliPlayRoute(seasonId, episode.id, episode.aid, episode.cid);
  var item = {
    id: pageUrl,
    type: "url",
    mediaType: mediaType,
    title: title,
    backdropPath: httpsUrl(episode.cover),
    description: badge ? "B站官方页面 · " + badge : "B站官方页面",
    releaseDate: formatDateFromUnix(episode.pub_time),
  };
  if (route) item.link = route;
  if (route && episode.aid && episode.cid) {
    cacheBilibiliPlayRoute(route, {
      seasonId: String(seasonId),
      epId: String(episode.id),
      aid: String(episode.aid),
      cid: String(episode.cid),
    });
  }
  if (numericEpisode) item.episode = Number(episodeNumber);
  return item;
}

async function loadDetail(link) {
  var route = String(link || "");
  if (route.indexOf("bilibili:") !== 0) return null;
  var seasonId = route.slice("bilibili:".length).trim();
  if (!/^\d+$/.test(seasonId)) return null;

  var cached = readCachedDetail(route);
  try {
    var response = await Widget.http.get(BILIBILI_SEASON_API, {
      headers: bilibiliHeaders(lastBilibiliCookie, "https://www.bilibili.com/"),
      params: { season_id: seasonId },
    });
    var body = response && response.data;
    if (!body || Number(body.code) !== 0 || !body.result) {
      throw new Error(body && body.message ? body.message : "空响应");
    }

    var data = body.result;
    var mediaType = bilibiliMediaType(data);
    if (mediaType !== "movie" && cached && cached.mediaType === "movie") {
      mediaType = "movie";
    }
    var pageUrl = httpsUrl(data.share_url || data.link) ||
      "https://www.bilibili.com/bangumi/play/ss" + seasonId;
    var rating = data.rating ? Number(data.rating.score || 0) : 0;
    var detail = {
      id: pageUrl,
      type: "url",
      mediaType: mediaType,
      title: cleanText(data.title || (cached && cached.title)),
      posterPath: httpsUrl(data.cover || (cached && cached.posterPath)),
      backdropPath: httpsUrl(data.bkg_cover || data.square_cover || data.cover || (cached && cached.backdropPath)),
      description: cleanText(data.evaluate || (cached && cached.description)),
      releaseDate: data.publish && data.publish.pub_time
        ? String(data.publish.pub_time).slice(0, 10)
        : (cached && cached.releaseDate) || "",
      link: route,
      episodeItems: (data.episodes || []).map(function (episode, index) {
        return mapBilibiliEpisode(episode, index, mediaType, seasonId);
      }),
    };
    if (rating) detail.rating = rating;
    cacheDetail(route, detail);
    return detail;
  } catch (error) {
    console.error("[B站详情] 加载失败:", error.message || error);
    if (cached) return cached;
    throw error;
  }
}

function bilibiliQualityLabel(result) {
  var quality = Number(result && result.quality || 0);
  var qualities = result && Array.isArray(result.accept_quality) ? result.accept_quality : [];
  var descriptions = result && Array.isArray(result.accept_description) ? result.accept_description : [];
  var index = qualities.map(Number).indexOf(quality);
  if (index >= 0 && descriptions[index]) return cleanText(descriptions[index]);
  var fallback = {
    16: "360P",
    32: "480P",
    64: "720P",
    74: "720P 60帧",
    80: "1080P",
    112: "1080P 高码率",
    116: "1080P 60帧",
    120: "4K",
    125: "HDR",
    126: "杜比视界",
    127: "8K",
  };
  return fallback[quality] || (quality ? "清晰度 " + quality : "自动清晰度");
}

function bilibiliPlaybackHeaders(epId) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
    Referer: "https://www.bilibili.com/bangumi/play/ep" + epId,
  };
}

function bilibiliPlayRouteCacheKey(playRoute) {
  return BILIBILI_PLAY_ROUTE_CACHE_PREFIX + playRoute.seasonId + ":" + playRoute.epId;
}

function cacheBilibiliPlayRoute(route, resolved) {
  var playRoute = parseBilibiliPlayRoute(route);
  if (!playRoute || !resolved || !resolved.aid || !resolved.cid) return;
  try {
    Widget.storage.set(bilibiliPlayRouteCacheKey(playRoute), resolved);
  } catch (error) {
    console.warn("[B站播放] 缓存分集参数失败:", error.message || error);
  }
}

function readCachedBilibiliPlayRoute(playRoute) {
  try {
    var cached = Widget.storage.get(bilibiliPlayRouteCacheKey(playRoute));
    return cached && cached.aid && cached.cid ? cached : null;
  } catch (error) {
    return null;
  }
}

function parseBilibiliPlayRoute(link) {
  var route = String(link || "");
  if (route.indexOf("bilibili-play:") !== 0) return null;
  var parts = route.split(":");
  if (parts.length !== 5 || !/^\d+$/.test(parts[1]) || !/^\d+$/.test(parts[2]) ||
      (parts[3] && !/^\d+$/.test(parts[3])) ||
      (parts[4] && !/^\d+$/.test(parts[4]))) return null;
  return {
    seasonId: parts[1],
    epId: parts[2],
    aid: parts[3],
    cid: parts[4],
  };
}

async function resolveBilibiliPlayRoute(playRoute) {
  if (playRoute.aid && playRoute.cid) return playRoute;
  var cached = readCachedBilibiliPlayRoute(playRoute);
  if (cached) return cached;

  var response = await Widget.http.get(BILIBILI_SEASON_API, {
    headers: bilibiliHeaders(lastBilibiliCookie, "https://www.bilibili.com/"),
    params: { season_id: playRoute.seasonId },
  });
  var body = response && response.data;
  var data = body && body.result;
  if (!body || Number(body.code) !== 0 || !data) {
    throw new Error(body && body.message ? body.message : "无法补充分集播放参数");
  }
  var episodes = Array.isArray(data.episodes)
    ? data.episodes
    : (data.main_section && Array.isArray(data.main_section.episodes)
      ? data.main_section.episodes
      : []);
  var selected = null;
  for (var index = 0; index < episodes.length; index += 1) {
    var episode = episodes[index] || {};
    if (!episode.id || !episode.aid || !episode.cid) continue;
    var resolved = {
      seasonId: String(playRoute.seasonId),
      epId: String(episode.id),
      aid: String(episode.aid),
      cid: String(episode.cid),
    };
    cacheBilibiliPlayRoute(
      bilibiliPlayRoute(resolved.seasonId, resolved.epId, resolved.aid, resolved.cid),
      resolved
    );
    if (resolved.epId === playRoute.epId) selected = resolved;
  }
  if (!selected) throw new Error("未找到搜索结果对应的可播放分集");
  return selected;
}

function isOfficialBilibiliSubtitleUrl(value) {
  return /^https?:\/\/(?:[a-z0-9-]+\.)*(?:bilibili\.com|hdslb\.com|bilivideo\.com)(?::\d+)?(?:\/|$)/i.test(String(value || ""));
}

function normalizeBilibiliSubtitleLanguage(value) {
  var language = String(value || "").replace(/_/g, "-");
  var aliases = {
    "ai-zh": "zh-CN",
    "zh-CN": "zh-CN",
    "zh-Hans": "zh-CN",
    "zh-TW": "zh-TW",
    "zh-Hant": "zh-TW",
  };
  return aliases[language] || language || "und";
}

async function loadSubtitle(params = {}) {
  var playRoute = parseBilibiliPlayRoute(params.link);
  if (!playRoute) return [];
  var runtimeCookie = sanitizeCookie(params.bilibiliCookie);
  if (runtimeCookie) lastBilibiliCookie = runtimeCookie;

  try {
    playRoute = await resolveBilibiliPlayRoute(playRoute);
    var response = await Widget.http.get(BILIBILI_PLAYER_V2_API, {
      headers: bilibiliHeaders(
        lastBilibiliCookie,
        "https://www.bilibili.com/bangumi/play/ep" + playRoute.epId
      ),
      params: {
        aid: playRoute.aid,
        cid: playRoute.cid,
      },
    });
    var body = response && response.data;
    if (!body || Number(body.code) !== 0 || !body.data) return [];
    var subtitleData = body.data.subtitle;
    var subtitles = subtitleData && Array.isArray(subtitleData.subtitles)
      ? subtitleData.subtitles
      : [];
    var seen = {};
    return subtitles.map(function (subtitle, index) {
      var url = httpsUrl(subtitle && (subtitle.subtitle_url || subtitle.url));
      if (!url || !isOfficialBilibiliSubtitleUrl(url) || seen[url]) return null;
      seen[url] = true;
      var language = normalizeBilibiliSubtitleLanguage(subtitle.lan);
      return {
        id: "bilibili-subtitle-" + String(subtitle.id || language || index),
        title: cleanText(subtitle.lan_doc || subtitle.lan || "B站官方字幕"),
        lang: language,
        count: 1,
        url: url,
      };
    }).filter(function (subtitle) { return !!subtitle; });
  } catch (error) {
    console.warn("[B站字幕] 加载失败:", error.message || error);
    return [];
  }
}

async function loadResource(params = {}) {
  var route = String(params.link || "");
  if (route.indexOf("bilibili-play:") !== 0) return [];
  var playRoute = parseBilibiliPlayRoute(route);
  if (!playRoute) {
    throw new Error("B站播放参数不完整，请重新打开影视详情后选择分集");
  }

  var runtimeCookie = sanitizeCookie(params.bilibiliCookie);
  if (runtimeCookie) lastBilibiliCookie = runtimeCookie;

  try {
    playRoute = await resolveBilibiliPlayRoute(playRoute);
    var epId = playRoute.epId;
    var aid = playRoute.aid;
    var cid = playRoute.cid;
    var response = await Widget.http.get(BILIBILI_PLAY_API, {
      headers: bilibiliHeaders(lastBilibiliCookie, "https://www.bilibili.com/bangumi/play/ep" + epId),
      params: {
        avid: aid,
        cid: cid,
        ep_id: epId,
        qn: 127,
        fnver: 0,
        fnval: 1,
        fourk: 1,
      },
    });
    var body = response && response.data;
    var result = body && body.result;
    if (!body || Number(body.code) !== 0 || !result ||
        (result.code !== undefined && Number(result.code) !== 0)) {
      throw new Error((result && result.message) || (body && body.message) || "平台未返回播放地址");
    }

    var durls = Array.isArray(result.durl) ? result.durl : [];
    if (durls.length !== 1 || !durls[0].url) {
      if (result.dash) {
        throw new Error("该视频仅返回分离音视频流，当前 Forward 播放器无法直接合并");
      }
      if (durls.length > 1) {
        throw new Error("该视频返回多段旧格式流，当前 Forward 播放器暂不支持连续拼接");
      }
      throw new Error("账号当前没有可播放的官方 MP4 线路，请检查会员权限或地区限制");
    }

    var urls = [durls[0].url].concat(Array.isArray(durls[0].backup_url) ? durls[0].backup_url : []);
    var seen = {};
    var quality = bilibiliQualityLabel(result);
    return urls.map(function (url, index) {
      var playbackUrl = httpsUrl(url);
      if (!playbackUrl || seen[playbackUrl]) return null;
      seen[playbackUrl] = true;
      return {
        name: "B站 " + quality + (index === 0 ? " · 账号当前最高" : " · 同画质备用线路 " + index),
        description: "B站官方混流 MP4 · 自动请求账号可达最高画质 · 默认音轨",
        url: playbackUrl,
        customHeaders: bilibiliPlaybackHeaders(epId),
        playerType: "app",
      };
    }).filter(function (item) { return !!item; });
  } catch (error) {
    console.error("[B站播放] 加载失败:", error.message || error);
    throw new Error("B站播放资源加载失败：" + (error.message || error));
  }
}

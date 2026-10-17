/* 爱奇艺 Rex 模块：直接请求官方搜索、详情和播放接口，避免客户端 params 序列化差异。 */
WidgetMetadata = {
  id: "rex.iqiyi.media",
  title: "爱奇艺影视搜索_Rex",
  author: "Custom",
  description: "爱奇艺电影、电视剧、动漫、综艺和纪录片搜索；按账号可达清晰度和音轨加载官方播放源。",
  version: "2.0.0",
  requiredVersion: "0.0.1",
  site: "https://www.iqiyi.com",
  globalParams: [
    {
      name: "iqiyiCookie",
      title: "爱奇艺 Cookie（可选）",
      type: "input",
      description: "填写自己的完整 Cookie；模块只把它发送给爱奇艺官方请求。",
    },
  ],
  modules: [
    {
      id: "searchList",
      title: "搜索爱奇艺影视",
      functionName: "searchList",
      type: "video",
      params: [
        { name: "keyword", title: "影视名称", type: "input" },
        { name: "page", title: "页码", type: "page" },
      ],
    },
    {
      id: "loadResource",
      title: "爱奇艺官方播放源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 0,
      params: [],
    },
    {
      id: "loadSubtitle",
      title: "爱奇艺官方字幕",
      functionName: "loadSubtitle",
      type: "subtitle",
      cacheDuration: 0,
      params: [],
    },
  ],
  search: {
    title: "全局搜索爱奇艺影视",
    functionName: "searchGlobal",
    params: [
      { name: "keyword", title: "影视名称", type: "input" },
      { name: "page", title: "页码", type: "page" },
    ],
  },
};

var IQIYI_SEARCH = "https://mesh.if.iqiyi.com/portal/lw/search/homePageV3";
var IQIYI_EPISODES = "https://pcw-api.iqiyi.com/albums/album/avlistinfo";
var IQIYI_PLAY = "https://cache.m.iqiyi.com/jp/tmts/";
var IQIYI_PLAY_SRC = "76f90cbd92f94a2e925d83e8ccd22cb7";
var IQIYI_PLAY_KEY = "d5fb4bd9d50c4be6948c97edd7254b0e";
var IQIYI_COOKIE_KEY = "rex.iqiyi.cookie:v2";
var IQIYI_CACHE_PREFIX = "rex.iqiyi.album:v2:";
var lastIqiyiCookie = "";

function cleanText(value) { return String(value || "").replace(/\s+/g, " ").trim(); }

function httpsUrl(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  if (text.indexOf("//") === 0) return "https:" + text;
  return text.replace(/^http:\/\//i, "https://");
}

function cookieFrom(params) {
  if (params && params.iqiyiCookie !== undefined) {
    lastIqiyiCookie = String(params.iqiyiCookie || "").replace(/[\r\n]/g, "").trim();
    try { Widget.storage.set(IQIYI_COOKIE_KEY, lastIqiyiCookie); } catch (error) {}
  }
  if (lastIqiyiCookie) return lastIqiyiCookie;
  try { return String(Widget.storage.get(IQIYI_COOKIE_KEY) || "").trim(); } catch (error) { return ""; }
}

function iqiyiHeaders(cookie, referer) {
  var headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
    Accept: "application/json, text/plain, */*",
    Referer: referer || "https://www.iqiyi.com/",
    Origin: "https://www.iqiyi.com",
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
  var response = await Widget.http.get(url, { headers: headers || iqiyiHeaders(cookieFrom({}), url) });
  return response && response.data;
}

function jsonBody(value) {
  if (value && typeof value === "object") return value;
  var text = String(value || "").replace(/^\uFEFF/, "").trim();
  text = text.replace(/^var\s+tvInfoJs\s*=\s*/i, "");
  text = text.replace(/;\s*$/, "");
  return text ? JSON.parse(text) : null;
}

function statusItem(id, title, subTitle) {
  return [{ id: "iqiyi-status-" + id, type: "text", title: title, subTitle: subTitle || "" }];
}

function cacheAlbum(item) {
  try { if (item && item.link) Widget.storage.set(IQIYI_CACHE_PREFIX + item.link, item); } catch (error) {}
}

function readAlbum(link) {
  try { return Widget.storage.get(IQIYI_CACHE_PREFIX + link) || null; } catch (error) { return null; }
}

function parseQips(value) {
  var text = String(value || "");
  var tvId = text.match(/(?:^|[;:/])tvid=(\d+)/i);
  var vid = text.match(/(?:^|[;:/])vid=([a-f0-9]{32})/i);
  return tvId && vid ? { tvId: tvId[1], vid: vid[1].toLowerCase() } : null;
}

function playLink(tvId, vid, pageUrl) {
  if (!/^\d+$/.test(String(tvId || "")) || !/^[a-f0-9]{32}$/i.test(String(vid || ""))) return "";
  return ["iqiyi-play", tvId, String(vid).toLowerCase(), encodeURIComponent(pageUrl || "https://www.iqiyi.com/")].join(":");
}

function parsePlayLink(value) {
  var parts = String(value || "").split(":");
  if (parts.length < 4 || parts[0] !== "iqiyi-play" || !/^\d+$/.test(parts[1]) || !/^[a-f0-9]{32}$/i.test(parts[2])) return null;
  var referer = "https://www.iqiyi.com/";
  try { referer = decodeURIComponent(parts.slice(3).join(":")) || referer; } catch (error) {}
  return { tvId: parts[1], vid: parts[2].toLowerCase(), referer: referer };
}

function categoryOf(album) {
  var channel = cleanText(album && (album.channel || album.category || album.type));
  if (/电影/.test(channel)) return "movie";
  if (/动漫|动画/.test(channel)) return "anime";
  if (/综艺/.test(channel)) return "variety";
  if (/纪录/.test(channel)) return "documentary";
  return "tv";
}

function mapEpisode(episode, index, mediaType) {
  var pageUrl = httpsUrl(episode.playUrl || episode.pageUrl || episode.url);
  var tvId = String(episode.tvId || episode.qipuId || episode.albumId || "");
  var vid = String(episode.vid || "");
  var route = playLink(tvId, vid, pageUrl);
  if (!pageUrl && !route) return null;
  return {
    id: pageUrl || route,
    type: "link",
    mediaType: mediaType || "tv",
    title: cleanText(episode.name || episode.shortTitle || episode.title) || (mediaType === "movie" ? "正片" : "第" + (Number(episode.order || index + 1)) + "集"),
    backdropPath: httpsUrl(episode.imageUrl || episode.img),
    description: episode.payMark ? "爱奇艺官方页面 · 会员内容" : "爱奇艺官方页面",
    releaseDate: cleanText(episode.period),
    durationText: cleanText(episode.duration),
    episode: mediaType === "movie" ? undefined : Number(episode.order || index + 1),
    link: route || pageUrl,
  };
}

function mapAlbum(album) {
  if (!album || !album.qipuId) return null;
  var pageUrl = httpsUrl(album.pageUrl || album.itemLink || album.albumUrl) || "https://www.iqiyi.com/a_" + album.qipuId + ".html";
  var mediaType = categoryOf(album) === "movie" ? "movie" : "tv";
  var qips = parseQips(album.playUrl || (album.autoPlayVideo && album.autoPlayVideo.playUrl));
  var episodes = [];
  if (qips) episodes.push(mapEpisode({ playUrl: pageUrl, tvId: qips.tvId, vid: qips.vid, name: mediaType === "movie" ? "正片" : album.title, payMark: album.paymark || album.firstVideoIsVip, imageUrl: album.imgH || album.img }, 0, mediaType));
  var description = cleanText(album.introduction || (album.brief && album.brief.value) || album.subtitle || album.subscriptContent);
  return {
    id: pageUrl,
    type: "link",
    mediaType: mediaType,
    title: cleanText(album.title) || "爱奇艺影视",
    posterPath: httpsUrl(album.img),
    backdropPath: httpsUrl(album.imgH || album.img),
    description: description,
    releaseDate: cleanText(album.releaseTime && album.releaseTime.value) || (album.year && album.year.value ? String(album.year.value) + "-01-01" : ""),
    link: "iqiyi:" + String(album.qipuId),
    episodeItems: episodes.filter(function (item) { return !!item; }),
  };
}

async function searchList(params) {
  params = params || {};
  var keyword = cleanText(params.keyword || params.query || params.title);
  if (!keyword) return statusItem("empty-search", "请输入关键词", "请输入电影、电视剧或综艺名称。");
  var page = Math.max(1, Number(params.page || 1));
  try {
    var url = query(IQIYI_SEARCH, { key: keyword, pageNum: page, pageSize: 20, source: "default" });
    var body = jsonBody(await getBody(url, iqiyiHeaders(cookieFrom(params), "https://www.iqiyi.com/")));
    if (!body || Number(body.code) !== 0 || !body.data) throw new Error(body && body.msg ? body.msg : "爱奇艺搜索返回空数据");
    var templates = Array.isArray(body.data.templates) ? body.data.templates : [];
    var result = [];
    var seen = {};
    for (var index = 0; index < templates.length; index += 1) {
      var album = templates[index] && templates[index].albumInfo;
      var item = mapAlbum(album);
      if (!item || seen[item.link]) continue;
      seen[item.link] = true;
      cacheAlbum(item);
      result.push(item);
    }
    return result.length ? result : statusItem("no-result", "没有找到影视", "爱奇艺搜索没有返回影视条目。");
  } catch (error) {
    return statusItem("search", "爱奇艺搜索失败", error && error.message ? error.message : String(error));
  }
}

async function searchGlobal(params) { return searchList(params); }

async function loadDetail(link) {
  var route = String(link || "");
  if (route.indexOf("iqiyi:") !== 0) return [];
  var albumId = route.slice(7);
  if (!/^\d+$/.test(albumId)) return [];
  var cached = readAlbum(route);
  try {
    var body = jsonBody(await getBody(query(IQIYI_EPISODES, { aid: albumId, page: 1, size: 200 }), iqiyiHeaders(cookieFrom({}), "https://www.iqiyi.com/")));
    if (!body || body.code !== "A00000" || !body.data) {
      if (cached) return [cached];
      throw new Error(body && body.msg ? body.msg : "爱奇艺详情返回空数据");
    }
    var list = Array.isArray(body.data.epsodelist) ? body.data.epsodelist : [];
    var episodes = list.map(function (episode, index) { return mapEpisode(episode, index, "tv"); }).filter(function (item) { return !!item; });
    if (!episodes.length) return cached ? [cached] : statusItem("detail-empty", "详情缺少播放分集", "爱奇艺没有返回可用分集参数。");
    var detail = {
      id: episodes[0].id,
      type: "link",
      mediaType: "tv",
      title: cached && cached.title ? cached.title : "爱奇艺影视 " + albumId,
      posterPath: episodes[0].backdropPath,
      backdropPath: episodes[0].backdropPath,
      description: "爱奇艺官方影视详情",
      link: route,
      episodeItems: episodes,
    };
    cacheAlbum(detail);
    return [detail];
  } catch (error) {
    if (cached) return [cached];
    return statusItem("detail", "爱奇艺详情失败", error && error.message ? error.message : String(error));
  }
}

function iqiyiMd5(value) {
  var bytes = [];
  var text = String(value || "");
  for (var i = 0; i < text.length; i += 1) bytes.push(text.charCodeAt(i) & 255);
  var bitLength = bytes.length * 8;
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (var lengthIndex = 0; lengthIndex < 8; lengthIndex += 1) bytes.push(Math.floor(bitLength / Math.pow(256, lengthIndex)) & 255);
  var shifts = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  var constants = [];
  for (var constantIndex = 0; constantIndex < 64; constantIndex += 1) constants.push(Math.floor(Math.abs(Math.sin(constantIndex + 1)) * 4294967296) >>> 0);
  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (var offset = 0; offset < bytes.length; offset += 64) {
    var words = [];
    for (var wordIndex = 0; wordIndex < 16; wordIndex += 1) { var base = offset + wordIndex * 4; words[wordIndex] = (bytes[base] | (bytes[base + 1] << 8) | (bytes[base + 2] << 16) | (bytes[base + 3] << 24)) >>> 0; }
    var a = a0, b = b0, c = c0, d = d0;
    for (var round = 0; round < 64; round += 1) {
      var f, g;
      if (round < 16) { f = (b & c) | ((~b) & d); g = round; } else if (round < 32) { f = (d & b) | ((~d) & c); g = (5 * round + 1) % 16; } else if (round < 48) { f = b ^ c ^ d; g = (3 * round + 5) % 16; } else { f = c ^ (b | (~d)); g = (7 * round) % 16; }
      var sum = (a + (f >>> 0) + constants[round] + words[g]) >>> 0;
      var rotated = ((sum << shifts[round]) | (sum >>> (32 - shifts[round]))) >>> 0;
      a = d; d = c; c = b; b = (b + rotated) >>> 0;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  function hex(word) { var output = ""; for (var index = 0; index < 4; index += 1) output += ("0" + ((word >>> (index * 8)) & 255).toString(16)).slice(-2); return output; }
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

async function requestPlayback(route, cookie, audioLid) {
  var timestamp = Date.now();
  var values = { tvid: route.tvId, vid: route.vid, src: IQIYI_PLAY_SRC, sc: iqiyiMd5(String(timestamp) + IQIYI_PLAY_KEY + route.tvId), t: timestamp };
  if (audioLid !== undefined && audioLid !== null && String(audioLid) !== "") values.lid = String(audioLid);
  var body = jsonBody(await getBody(query(IQIYI_PLAY + route.tvId + "/" + route.vid + "/", values), iqiyiHeaders(cookie, route.referer)));
  if (!body || body.code !== "A00000" || !body.data) throw new Error(body && (body.msg || body.message) ? (body.msg || body.message) : "爱奇艺没有返回播放数据");
  return body;
}

function resolutionScore(stream) {
  var match = cleanText(stream && stream.screenSize).match(/(\d+)x(\d+)/);
  if (match) return Number(match[1]) * Number(match[2]);
  return ({ 96: 426 * 240, 1: 640 * 360, 2: 896 * 504, 4: 1280 * 720, 5: 1920 * 1080, 10: 3840 * 2160, 19: 3840 * 2160 })[Number(stream && stream.vd)] || 0;
}

function streamLabel(stream) {
  var names = { 96: "极速", 1: "流畅", 2: "高清", 4: "720P", 5: "1080P", 10: "4K", 19: "4K" };
  return [names[Number(stream && stream.vd)] || "官方清晰度", cleanText(stream && stream.screenSize)].filter(function (part) { return !!part; }).join(" · ");
}

function audioTracks(data) {
  if (!data) return [];
  if (Array.isArray(data.audio)) return data.audio;
  if (data.audio && typeof data.audio === "object") return [data.audio];
  if (Array.isArray(data.audios)) return data.audios;
  return [];
}

function audioName(track) { return cleanText(track && (track.name || track._name)) || "默认音轨"; }

function resourcesFrom(body, track, referer, seen) {
  var data = body && body.data;
  var streams = data && Array.isArray(data.vidl) ? data.vidl.slice() : [];
  streams.sort(function (a, b) { return resolutionScore(b) - resolutionScore(a); });
  var result = [];
  for (var index = 0; index < streams.length; index += 1) {
    var stream = streams[index] || {};
    var url = httpsUrl(stream.m3u || stream.m3utx);
    if (!url || seen[url]) continue;
    seen[url] = true;
    result.push({
      name: "爱奇艺 " + streamLabel(stream) + " · " + audioName(track),
      description: "爱奇艺官方 HLS 播放源；当前音轨的最高可达清晰度",
      url: url,
      playerType: "app",
      customHeaders: iqiyiHeaders(lastIqiyiCookie, referer),
    });
  }
  return result;
}

async function loadResource(params) {
  params = params || {};
  var route = parsePlayLink(params.link);
  if (!route) return [];
  var cookie = cookieFrom(params);
  try {
    var first = await requestPlayback(route, cookie);
    var tracks = audioTracks(first.data);
    var responses = [{ track: tracks[0] || null, body: first }];
    for (var index = 1; index < tracks.length; index += 1) {
      try { responses.push({ track: tracks[index], body: await requestPlayback(route, cookie, tracks[index].lid) }); } catch (error) {}
    }
    var seen = {};
    var resources = [];
    for (var responseIndex = 0; responseIndex < responses.length; responseIndex += 1) resources = resources.concat(resourcesFrom(responses[responseIndex].body, responses[responseIndex].track, route.referer, seen));
    return resources;
  } catch (error) {
    console.warn("[爱奇艺播放] 加载失败:", error && error.message ? error.message : error);
    return [];
  }
}

async function loadSubtitle(params) {
  params = params || {};
  var route = parsePlayLink(params.link);
  if (!route) return [];
  try {
    var body = await requestPlayback(route, cookieFrom(params));
    var data = body && body.data;
    var tracks = data && data.program && Array.isArray(data.program.stl) ? data.program.stl : [];
    var base = data && data.dstl;
    return tracks.map(function (track, index) {
      var path = track && (track.webvtt || track.srt);
      if (!path) return null;
      var url = /^https?:\/\//i.test(path) ? httpsUrl(path) : httpsUrl(String(base || "").replace(/\/?$/, "/") + String(path).replace(/^\//, ""));
      return url ? { id: "iqiyi-subtitle-" + String(track.lid || index), title: cleanText(track._name || track.name || "爱奇艺官方字幕"), lang: cleanText(track.lid || "und"), count: 1, url: url } : null;
    }).filter(function (item) { return !!item; });
  } catch (error) {
    console.warn("[爱奇艺字幕] 加载失败:", error && error.message ? error.message : error);
    return [];
  }
}

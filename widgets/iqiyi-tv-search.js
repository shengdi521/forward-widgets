WidgetMetadata = {
  id: "forward.iqiyi.tv.search",
  title: "爱奇艺影视搜索",
  version: "1.3.1",
  requiredVersion: "0.0.2",
  description: "使用可选的个人 Cookie 搜索并在线观看爱奇艺官方影视；自动优先账号可达的最高清晰度，并支持可用音轨和字幕切换。",
  author: "Custom",
  site: "https://www.iqiyi.com",
  detailCacheDuration: 300,
  globalParams: [
    {
      name: "iqiyiCookie",
      title: "爱奇艺 Cookie（可选）",
      type: "input",
      description: "填写你自己的完整 Cookie。仅随爱奇艺请求发送，模块不会输出 Cookie。",
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
  ],
  search: {
    title: "搜索爱奇艺影视",
    functionName: "search",
    params: [
      { name: "keyword", title: "影视名称", type: "input" },
      { name: "page", title: "页码", type: "page" },
    ],
  },
};

var IQIYI_SEARCH_API = "https://mesh.if.iqiyi.com/portal/lw/search/homePageV3";
var IQIYI_EPISODE_API = "https://pcw-api.iqiyi.com/albums/album/avlistinfo";
var IQIYI_PLAY_API = "https://cache.m.iqiyi.com/jp/tmts/";
var IQIYI_PLAY_SRC = "76f90cbd92f94a2e925d83e8ccd22cb7";
var IQIYI_PLAY_KEY = "d5fb4bd9d50c4be6948c97edd7254b0e";
var IQIYI_CACHE_PREFIX = "iqiyi-tv-detail:";
var lastIqiyiCookie = "";

function sanitizeCookie(value) {
  return String(value || "").replace(/[\r\n]/g, "").trim();
}

function iqiyiHeaders(cookie) {
  var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
    Referer: "https://www.iqiyi.com/",
    Origin: "https://www.iqiyi.com",
  };
  if (cookie) headers.Cookie = cookie;
  return headers;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function httpsUrl(value) {
  var url = String(value || "").trim();
  if (!url) return "";
  if (url.indexOf("//") === 0) return "https:" + url;
  return url.replace(/^http:\/\//i, "https://");
}

function iqiyiMd5(value) {
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

function parseIqiyiQips(value) {
  var text = String(value || "");
  if (text.indexOf("qips://") !== 0) return null;
  var tvidMatch = text.match(/(?:^|[;:/])tvid=(\d+)/i);
  var vidMatch = text.match(/(?:^|[;:/])vid=([a-f0-9]{32})/i);
  if (!tvidMatch || !vidMatch) return null;
  return { tvId: tvidMatch[1], vid: vidMatch[1] };
}

function iqiyiPlayRoute(tvId, vid, pageUrl) {
  if (!/^\d+$/.test(String(tvId || "")) || !/^[a-f0-9]{32}$/i.test(String(vid || ""))) return "";
  return [
    "iqiyi-play",
    String(tvId),
    String(vid).toLowerCase(),
    encodeURIComponent(httpsUrl(pageUrl) || "https://www.iqiyi.com/"),
  ].join(":");
}

function iqiyiCategory(album) {
  var channel = String(album.channel || "");
  var channelParts = channel.split(",");
  var channelId = channelParts.length > 1 ? channelParts[channelParts.length - 1] : "";
  if (channelId === "1") return "movie";
  if (channelId === "2") return "tv";
  if (channelId === "3") return "documentary";
  if (channelId === "4") return "anime";
  if (channelId === "6") return "variety";
  return "other";
}

function isIqiyiMediaAlbum(template, album) {
  if (!album || !album.qipuId) return false;
  var templateId = Number(template || 0);
  if ([101, 102, 103, 104].indexOf(templateId) < 0) return false;
  var pageUrl = String(album.pageUrl || "");
  var isIqiyi = String(album.siteId || "").toLowerCase() === "iqiyi" ||
    (!album.siteId && /(^|\.)iqiyi\.com/i.test(pageUrl.replace(/^https?:\/\//, "").split("/")[0]));
  return isIqiyi && iqiyiCategory(album) !== "other";
}

function mapPeople(group, role) {
  var values = group && Array.isArray(group.value) ? group.value : [];
  return values.map(function (person) {
    return {
      id: String(person.qipuId || person.id || person.title || ""),
      title: cleanText(person.title || person.name),
      avatar: httpsUrl(person.image_url),
      role: role,
    };
  }).filter(function (person) {
    return person.id && person.title;
  });
}

function mapMeshEpisode(video, index, mediaType) {
  var pageUrl = httpsUrl(video.pageUrl || video.itemLink);
  var qips = parseIqiyiQips(video.playUrl);
  var tvId = String(video.qipuId || (qips && qips.tvId) || "");
  var vid = String(video.vid || (qips && qips.vid) || "");
  var playRoute = iqiyiPlayRoute(tvId, vid, pageUrl);
  if (!pageUrl && !playRoute) return null;
  var isVip = !!(video.payMark || video.payMarkUrl || /ischarge=true/i.test(String(video.playUrl || "")));
  var item = {
    id: pageUrl || "iqiyi-video:" + tvId,
    type: "url",
    mediaType: mediaType,
    title: cleanText(video.title) || "第" + String(video.number || index + 1) + "集",
    backdropPath: httpsUrl(video.img),
    description: isVip ? "爱奇艺官方页面 · 会员内容" : "爱奇艺官方页面",
    episode: Number(video.number || index + 1),
  };
  if (playRoute) item.link = playRoute;
  return item;
}

function mapIqiyiSearchItem(album) {
  var albumId = String(album.qipuId || "");
  var pageUrl = httpsUrl(album.pageUrl || album.itemLink || album.albumUrl);
  if (!albumId) return null;
  var category = iqiyiCategory(album);
  var mediaType = category === "movie" ? "movie" : "tv";
  var year = album.year && album.year.value ? String(album.year.value) : "";
  var description = cleanText(
    album.introduction ||
    (album.brief && album.brief.value) ||
    album.subtitle
  );
  var status = cleanText(album.subscriptContent);
  if (status) description = status + (description ? " · " + description : "");

  var episodes = Array.isArray(album.videos)
    ? album.videos.map(function (video, index) {
        return mapMeshEpisode(video, index, mediaType);
      }).filter(function (item) { return !!item; })
    : [];
  if (!episodes.length) {
    var direct = parseIqiyiQips(album.playUrl) ||
      parseIqiyiQips(album.autoPlayVideo && album.autoPlayVideo.playUrl);
    var directRoute = direct && iqiyiPlayRoute(direct.tvId, direct.vid, pageUrl);
    if (directRoute) {
      episodes.push({
        id: pageUrl || "iqiyi-video:" + direct.tvId,
        type: "url",
        mediaType: mediaType,
        title: mediaType === "movie" ? "正片" : cleanText(album.title),
        backdropPath: httpsUrl(album.imgH || album.img),
        description: album.paymark || album.firstVideoIsVip
          ? "爱奇艺官方页面 · 会员内容"
          : "爱奇艺官方页面",
        link: directRoute,
      });
    }
  }
  var peoples = mapPeople(album.actors, "主演").concat(mapPeople(album.directors, "导演"));
  var item = {
    id: pageUrl || "iqiyi-album:" + albumId,
    type: "url",
    mediaType: mediaType,
    title: cleanText(album.title),
    posterPath: httpsUrl(album.img),
    backdropPath: httpsUrl(album.imgH || album.img),
    description: description,
    releaseDate: cleanText(album.releaseTime && album.releaseTime.value) ||
      (/^\d{4}$/.test(year) ? year + "-01-01" : ""),
    link: "iqiyi:" + albumId,
    episodeItems: episodes,
    peoples: peoples,
  };
  var rating = Number(album.rating || album.score || 0);
  if (rating) item.rating = rating;
  var durationText = cleanText(album.timeLength && album.timeLength.value);
  if (durationText) item.durationText = durationText;
  return item;
}

function cacheDetail(link, item) {
  try {
    Widget.storage.set(IQIYI_CACHE_PREFIX + link, item);
  } catch (error) {
    console.warn("[爱奇艺搜索] 缓存详情失败:", error.message || error);
  }
}

function readCachedDetail(link) {
  try {
    return Widget.storage.get(IQIYI_CACHE_PREFIX + link) || null;
  } catch (error) {
    return null;
  }
}

async function search(params = {}) {
  var keyword = String(params.keyword || params.query || params.title || "").trim();
  if (!keyword) return [];
  var page = Math.max(1, Number(params.page || 1));
  var requestedType = String(params.contentType || "all");
  lastIqiyiCookie = sanitizeCookie(params.iqiyiCookie);

  try {
    var response = await Widget.http.get(IQIYI_SEARCH_API, {
      headers: iqiyiHeaders(lastIqiyiCookie),
      params: {
        key: keyword,
        pageNum: page,
        pageSize: 20,
        source: "default",
      },
    });
    var body = response && response.data;
    if (!body || Number(body.code) !== 0) {
      throw new Error(body && body.msg ? body.msg : "空响应");
    }

    var templates = body.data && Array.isArray(body.data.templates)
      ? body.data.templates
      : [];
    var seen = {};
    var items = [];
    for (var i = 0; i < templates.length; i += 1) {
      var template = templates[i] || {};
      var album = template.albumInfo;
      if (!isIqiyiMediaAlbum(template.template, album)) continue;
      if (requestedType !== "all" && iqiyiCategory(album) !== requestedType) continue;
      var mapped = mapIqiyiSearchItem(album);
      if (!mapped || seen[mapped.link]) continue;
      seen[mapped.link] = true;
      cacheDetail(mapped.link, mapped);
      items.push(mapped);
    }
    return items;
  } catch (error) {
    console.error("[爱奇艺搜索] 请求失败:", error.message || error);
    throw new Error("爱奇艺影视搜索失败：" + (error.message || error));
  }
}

function mapIqiyiEpisode(episode, index, mediaType) {
  var pageUrl = httpsUrl(episode.playUrl);
  if (!pageUrl) return null;
  var number = Number(episode.order || index + 1);
  var title = cleanText(episode.name || episode.shortTitle) || "第" + number + "集";
  var focus = cleanText(episode.focus);
  var description = cleanText(episode.description);
  if (focus) description = focus + (description ? " · " + description : "");
  if (episode.payMark) description = "会员内容" + (description ? " · " + description : "");
  var item = {
    id: pageUrl,
    type: "url",
    mediaType: mediaType,
    title: title,
    backdropPath: httpsUrl(episode.imageUrl),
    description: description || "爱奇艺官方页面",
    releaseDate: cleanText(episode.period),
    durationText: cleanText(episode.duration),
    episode: number,
  };
  var route = iqiyiPlayRoute(episode.tvId, episode.vid, pageUrl);
  if (route) item.link = route;
  return item;
}

async function loadDetail(link) {
  var route = String(link || "");
  if (route.indexOf("iqiyi:") !== 0) return null;
  var albumId = route.slice("iqiyi:".length).trim();
  if (!/^\d+$/.test(albumId)) return null;

  var cached = readCachedDetail(route);
  var mediaType = cached && cached.mediaType === "movie" ? "movie" : "tv";
  if (mediaType === "movie" && cached) return cached;
  try {
    var response = await Widget.http.get(IQIYI_EPISODE_API, {
      headers: iqiyiHeaders(lastIqiyiCookie),
      params: {
        aid: albumId,
        page: 1,
        size: 200,
      },
    });
    var body = response && response.data;
    if (!body || body.code !== "A00000" || !body.data) {
      throw new Error(body && body.msg ? body.msg : "空响应");
    }
    var episodes = Array.isArray(body.data.epsodelist)
      ? body.data.epsodelist.map(function (episode, index) {
          return mapIqiyiEpisode(episode, index, mediaType);
        }).filter(function (item) { return !!item; })
      : [];
    var firstEpisode = episodes[0] || null;
    var detail = {
      id: (cached && cached.id) || (firstEpisode && firstEpisode.id) || "https://www.iqiyi.com/",
      type: "url",
      mediaType: mediaType,
      title: (cached && cached.title) || "爱奇艺影视 " + albumId,
      posterPath: (cached && cached.posterPath) || "",
      backdropPath: (cached && cached.backdropPath) || (firstEpisode && firstEpisode.backdropPath) || "",
      description: (cached && cached.description) || "爱奇艺官方影视内容",
      releaseDate: (cached && cached.releaseDate) || "",
      link: route,
      episodeItems: episodes.length ? episodes : ((cached && cached.episodeItems) || []),
      peoples: (cached && cached.peoples) || [],
    };
    cacheDetail(route, detail);
    return detail;
  } catch (error) {
    console.error("[爱奇艺详情] 加载失败:", error.message || error);
    if (cached) return cached;
    throw error;
  }
}

function parseIqiyiPlaybackBody(value) {
  if (value && typeof value === "object") return value;
  var text = String(value || "").replace(/^\uFEFF/, "").trim();
  text = text.replace(/^var\s+tvInfoJs\s*=\s*/, "").replace(/;\s*$/, "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("爱奇艺播放接口返回了无法识别的数据");
  }
}

function iqiyiResolutionScore(stream) {
  var match = String(stream && stream.screenSize || "").match(/(\d+)x(\d+)/i);
  if (match) return Number(match[1]) * Number(match[2]);
  var fallback = {
    96: 426 * 240,
    1: 640 * 360,
    2: 896 * 504,
    21: 960 * 540,
    4: 1280 * 720,
    17: 1280 * 720,
    14: 1280 * 720,
    5: 1920 * 1080,
    18: 1920 * 1080,
    10: 3840 * 2160,
    19: 3840 * 2160,
  };
  return fallback[Number(stream && stream.vd)] || 0;
}

function iqiyiStreamLabel(stream) {
  var size = cleanText(stream && stream.screenSize);
  var codec = /265/i.test(String(stream && stream.fileFormat || "")) ? "H.265" : "H.264";
  var qualityNames = {
    96: "极速",
    1: "流畅",
    2: "高清",
    21: "高清",
    4: "720P",
    17: "720P",
    14: "720P",
    5: "1080P",
    18: "1080P",
    10: "4K",
    19: "4K",
  };
  var quality = qualityNames[Number(stream && stream.vd)] || "官方清晰度";
  return [quality, size, codec].filter(function (part) { return !!part; }).join(" · ");
}

function isOfficialIqiyiPlaybackUrl(value) {
  return /^https?:\/\/(?:[a-z0-9-]+\.)*(?:iqiyi\.com|qiyi\.com|iq\.com)(?::\d+)?(?:\/|$)/i.test(String(value || ""));
}

function parseIqiyiPlayRoute(link) {
  var route = String(link || "");
  if (route.indexOf("iqiyi-play:") !== 0) return null;
  var parts = route.split(":");
  if (parts.length < 4 || !/^\d+$/.test(parts[1]) || !/^[a-f0-9]{32}$/i.test(parts[2])) {
    return null;
  }
  var referer = "https://www.iqiyi.com/";
  try {
    referer = decodeURIComponent(parts.slice(3).join(":")) || referer;
  } catch (decodeError) {
    referer = "https://www.iqiyi.com/";
  }
  return {
    tvId: parts[1],
    vid: parts[2].toLowerCase(),
    referer: referer,
  };
}

async function requestIqiyiPlayback(tvId, vid, audioLid) {
  var timestamp = Date.now();
  var signature = iqiyiMd5(String(timestamp) + IQIYI_PLAY_KEY + tvId);
  var requestParams = {
    tvid: tvId,
    vid: vid,
    src: IQIYI_PLAY_SRC,
    sc: signature,
    t: timestamp,
  };
  if (audioLid !== undefined && audioLid !== null && String(audioLid) !== "") {
    requestParams.lid = String(audioLid);
  }
  var response = await Widget.http.get(IQIYI_PLAY_API + tvId + "/" + vid + "/", {
    headers: iqiyiHeaders(lastIqiyiCookie),
    params: requestParams,
  });
  var body = parseIqiyiPlaybackBody(response && response.data);
  if (!body || body.code !== "A00000" || !body.data) {
    throw new Error((body && (body.msg || body.message)) || "平台未返回播放地址");
  }
  return body;
}

function iqiyiAudioTracks(data) {
  var raw = data && data.audio;
  var tracks = Array.isArray(raw) ? raw.slice() : (raw ? [raw] : []);
  var seen = {};
  tracks = tracks.filter(function (track) {
    var lid = String(track && track.lid !== undefined ? track.lid : "");
    if (!lid || seen[lid]) return false;
    seen[lid] = true;
    return true;
  });
  tracks.sort(function (left, right) {
    return Number(right && right.ispre || 0) - Number(left && left.ispre || 0);
  });
  return tracks;
}

function iqiyiAudioName(track) {
  return cleanText(track && (track.name || track._name)) ||
    (track && track.lid !== undefined ? "音轨 " + String(track.lid) : "默认音轨");
}

function iqiyiSortedStreams(data) {
  var streams = data && Array.isArray(data.vidl) ? data.vidl.slice() : [];
  streams = streams.filter(function (stream) {
    return stream && stream.m3utx && isOfficialIqiyiPlaybackUrl(stream.m3utx);
  });
  streams.sort(function (left, right) {
    var resolutionDifference = iqiyiResolutionScore(right) - iqiyiResolutionScore(left);
    if (resolutionDifference) return resolutionDifference;
    var leftH265 = /265/i.test(String(left.fileFormat || "")) ? 1 : 0;
    var rightH265 = /265/i.test(String(right.fileFormat || "")) ? 1 : 0;
    return leftH265 - rightH265;
  });
  return streams;
}

function buildIqiyiResources(body, track, referer, seen) {
  var streams = iqiyiSortedStreams(body && body.data);
  var preview = body && body.data && body.data.boss_ts && body.data.boss_ts.data &&
    (body.data.boss_ts.data.prv || body.data.boss_ts.data.previewTime);
  var audioName = iqiyiAudioName(track);
  return streams.map(function (stream, index) {
    var playbackUrl = httpsUrl(stream.m3utx);
    if (seen[playbackUrl]) return null;
    seen[playbackUrl] = true;
    var label = iqiyiStreamLabel(stream);
    return {
      name: "爱奇艺 " + audioName + " · " + label +
        (index === 0 ? " · 账号当前最高" : " · 备用画质"),
      description: "爱奇艺官方混流 HLS · 选择线路可切换音轨" +
        (preview ? " · 当前为平台预览权限" : ""),
      url: playbackUrl,
      customHeaders: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
        Referer: referer,
      },
      playerType: "app",
    };
  }).filter(function (item) { return !!item; });
}

function iqiyiSubtitleLanguage(lid, fallback) {
  var languages = {
    1: "zh-CN",
    2: "zh-TW",
    3: "en",
    4: "ko",
    5: "ja",
    18: "th",
    21: "my",
    23: "vi",
    24: "id",
    26: "es",
    27: "pt",
    28: "ar",
  };
  return languages[Number(lid)] || cleanText(fallback) || "und";
}

function resolveIqiyiSubtitleUrl(baseUrl, value) {
  var path = String(value || "").trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.indexOf("//") === 0) return httpsUrl(path);
  var base = httpsUrl(baseUrl || "https://meta.video.iqiyi.com/");
  var originMatch = base.match(/^(https?:\/\/[^/]+)/i);
  if (path.charAt(0) === "/") return originMatch ? originMatch[1] + path : "";
  return base.replace(/\/?$/, "/") + path.replace(/^\.\//, "");
}

function isOfficialIqiyiSubtitleUrl(value) {
  return /^https?:\/\/(?:[a-z0-9-]+\.)*(?:iqiyi\.com|qiyi\.com|iq\.com|iqiyipic\.com)(?::\d+)?(?:\/|$)/i.test(String(value || ""));
}

function extractIqiyiSubtitles(body) {
  var data = body && body.data;
  var program = data && data.program;
  var tracks = program && Array.isArray(program.stl) ? program.stl : [];
  var baseUrl = data && data.dstl;
  var seen = {};
  return tracks.map(function (track, index) {
    var subtitlePath = track && (track.webvtt || track.srt);
    var url = resolveIqiyiSubtitleUrl(baseUrl, subtitlePath);
    if (!url || !isOfficialIqiyiSubtitleUrl(url) || seen[url]) return null;
    seen[url] = true;
    var language = iqiyiSubtitleLanguage(track.lid, track._name || track.name);
    return {
      id: "iqiyi-subtitle-" + String(track.lid || index),
      title: cleanText(track._name || track.name) || "爱奇艺官方字幕",
      lang: language,
      count: 1,
      url: url,
    };
  }).filter(function (subtitle) { return !!subtitle; });
}

async function loadSubtitle(params = {}) {
  var playRoute = parseIqiyiPlayRoute(params.link);
  if (!playRoute) return [];
  var runtimeCookie = sanitizeCookie(params.iqiyiCookie);
  if (runtimeCookie) lastIqiyiCookie = runtimeCookie;
  try {
    return extractIqiyiSubtitles(await requestIqiyiPlayback(playRoute.tvId, playRoute.vid));
  } catch (error) {
    console.warn("[爱奇艺字幕] 加载失败:", error.message || error);
    return [];
  }
}

async function loadResource(params = {}) {
  var route = String(params.link || "");
  if (route.indexOf("iqiyi-play:") !== 0) return [];
  var playRoute = parseIqiyiPlayRoute(route);
  if (!playRoute) {
    throw new Error("爱奇艺播放参数不完整，请重新打开影视详情后选择分集");
  }
  var runtimeCookie = sanitizeCookie(params.iqiyiCookie);
  if (runtimeCookie) lastIqiyiCookie = runtimeCookie;

  try {
    var body = await requestIqiyiPlayback(playRoute.tvId, playRoute.vid);
    var tracks = iqiyiAudioTracks(body.data);
    if (!tracks.length) tracks = [null];
    var responses = [{ track: tracks[0], body: body }];
    for (var trackIndex = 1; trackIndex < tracks.length; trackIndex += 1) {
      try {
        responses.push({
          track: tracks[trackIndex],
          body: await requestIqiyiPlayback(
            playRoute.tvId,
            playRoute.vid,
            tracks[trackIndex].lid
          ),
        });
      } catch (trackError) {
        console.warn("[爱奇艺播放] 音轨加载失败:", iqiyiAudioName(tracks[trackIndex]), trackError.message || trackError);
      }
    }

    var seen = {};
    var resources = [];
    for (var responseIndex = 0; responseIndex < responses.length; responseIndex += 1) {
      resources = resources.concat(buildIqiyiResources(
        responses[responseIndex].body,
        responses[responseIndex].track,
        playRoute.referer,
        seen
      ));
    }
    if (!resources.length) {
      throw new Error("账号当前没有可播放的官方 HLS 线路，请检查会员权限或地区限制");
    }
    return resources;
  } catch (error) {
    console.error("[爱奇艺播放] 加载失败:", error.message || error);
    throw new Error("爱奇艺播放资源加载失败：" + (error.message || error));
  }
}

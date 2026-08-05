WidgetMetadata = {
  id: "forward.iqiyi.tv.search",
  title: "爱奇艺影视搜索",
  version: "1.1.0",
  requiredVersion: "0.0.2",
  description: "使用可选的个人 Cookie 搜索爱奇艺站内电影、电视剧、动漫、综艺和纪录片，并展示官方详情与分集页面。",
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
      id: "searchIqiyiTv",
      title: "搜索爱奇艺影视",
      functionName: "search",
      cacheDuration: 300,
      params: [
        { name: "keyword", title: "影视名称", type: "input" },
        {
          name: "contentType",
          title: "内容类型",
          type: "enumeration",
          value: "all",
          enumOptions: [
            { title: "全部", value: "all" },
            { title: "电影", value: "movie" },
            { title: "电视剧", value: "tv" },
            { title: "动漫", value: "anime" },
            { title: "综艺", value: "variety" },
            { title: "纪录片", value: "documentary" },
          ],
        },
        { name: "page", title: "页码", type: "page" },
      ],
    },
  ],
  search: {
    title: "搜索爱奇艺影视",
    functionName: "search",
    params: [
      { name: "keyword", title: "影视名称", type: "input" },
      {
        name: "contentType",
        title: "内容类型",
        type: "enumeration",
        value: "all",
        enumOptions: [
          { title: "全部", value: "all" },
          { title: "电影", value: "movie" },
          { title: "电视剧", value: "tv" },
          { title: "动漫", value: "anime" },
          { title: "综艺", value: "variety" },
          { title: "纪录片", value: "documentary" },
        ],
      },
      { name: "page", title: "页码", type: "page" },
    ],
  },
};

var IQIYI_SEARCH_API = "https://mesh.if.iqiyi.com/portal/lw/search/homePageV3";
var IQIYI_EPISODE_API = "https://pcw-api.iqiyi.com/albums/album/avlistinfo";
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
  if (!pageUrl) return null;
  var item = {
    id: pageUrl,
    type: "url",
    mediaType: mediaType,
    title: cleanText(video.title) || "第" + String(video.number || index + 1) + "集",
    backdropPath: httpsUrl(video.img),
    description: "爱奇艺官方页面",
    episode: Number(video.number || index + 1),
  };
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
  var keyword = String(params.keyword || "").trim();
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
  return {
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

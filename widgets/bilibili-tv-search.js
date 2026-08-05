WidgetMetadata = {
  id: "forward.bilibili.tv.search",
  title: "B站电视剧搜索",
  version: "1.0.1",
  requiredVersion: "0.0.2",
  description: "使用可选的个人 Cookie 搜索 B站番剧、国创和影视内容，并展示官方详情与分集页面。",
  author: "Custom",
  site: "https://www.bilibili.com",
  detailCacheDuration: 300,
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
      id: "searchBilibiliTv",
      title: "搜索 B站电视剧",
      functionName: "search",
      cacheDuration: 300,
      params: [
        { name: "keyword", title: "剧名", type: "input" },
        {
          name: "contentType",
          title: "内容类型",
          type: "enumeration",
          value: "all",
          enumOptions: [
            { title: "全部（番剧/国创 + 影视）", value: "all" },
            { title: "番剧/国创", value: "media_bangumi" },
            { title: "影视", value: "media_ft" },
          ],
        },
        { name: "page", title: "页码", type: "page" },
      ],
    },
  ],
  search: {
    title: "搜索 B站电视剧",
    functionName: "search",
    params: [
      { name: "keyword", title: "剧名", type: "input" },
      {
        name: "contentType",
        title: "内容类型",
        type: "enumeration",
        value: "all",
        enumOptions: [
          { title: "全部（番剧/国创 + 影视）", value: "all" },
          { title: "番剧/国创", value: "media_bangumi" },
          { title: "影视", value: "media_ft" },
        ],
      },
      { name: "page", title: "页码", type: "page" },
    ],
  },
};

var BILIBILI_SEARCH_API = "https://api.bilibili.com/x/web-interface/search/type";
var BILIBILI_SEASON_API = "https://api.bilibili.com/pgc/view/web/season";
var BILIBILI_CACHE_PREFIX = "bilibili-tv-detail:";
var lastBilibiliCookie = "";

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

function mapBilibiliSearchItem(row) {
  var seasonId = String(row.season_id || row.pgc_season_id || "");
  if (!seasonId) return null;
  var pageUrl = httpsUrl(row.goto_url || row.url) ||
    "https://www.bilibili.com/bangumi/play/ss" + seasonId;
  var episodeCover = row.eps && row.eps[0] ? httpsUrl(row.eps[0].cover) : "";
  var score = row.media_score ? Number(row.media_score.score || 0) : 0;
  var item = {
    id: pageUrl,
    type: "url",
    mediaType: "tv",
    title: cleanText(row.title || row.org_title),
    posterPath: httpsUrl(row.cover),
    backdropPath: episodeCover || httpsUrl(row.cover),
    description: buildSearchDescription(row),
    releaseDate: formatDateFromUnix(row.pubtime),
    link: "bilibili:" + seasonId,
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
  var keyword = String(params.keyword || "").trim();
  if (!keyword) return [];

  var page = Math.max(1, Number(params.page || 1));
  var requestedType = String(params.contentType || "all");
  var types = requestedType === "all"
    ? ["media_bangumi", "media_ft"]
    : [requestedType];
  lastBilibiliCookie = sanitizeCookie(params.bilibiliCookie);

  var rows = [];
  var successfulRequests = 0;
  var errors = [];

  for (var i = 0; i < types.length; i += 1) {
    try {
      var response = await Widget.http.get(BILIBILI_SEARCH_API, {
        headers: bilibiliHeaders(lastBilibiliCookie, "https://search.bilibili.com/"),
        params: {
          search_type: types[i],
          keyword: keyword,
          page: page,
        },
      });
      var body = response && response.data;
      if (!body || Number(body.code) !== 0) {
        throw new Error(body && body.message ? body.message : "空响应");
      }
      successfulRequests += 1;
      var result = body.data && Array.isArray(body.data.result) ? body.data.result : [];
      rows = rows.concat(result);
    } catch (error) {
      errors.push(types[i] + ": " + (error.message || error));
      console.error("[B站搜索] 请求失败:", types[i], error.message || error);
    }
  }

  if (!successfulRequests) {
    throw new Error("B站搜索失败：" + errors.join("；"));
  }

  var seen = {};
  var items = [];
  for (var index = 0; index < rows.length; index += 1) {
    var mapped = mapBilibiliSearchItem(rows[index]);
    if (!mapped || seen[mapped.link]) continue;
    seen[mapped.link] = true;
    cacheDetail(mapped.link, mapped);
    items.push(mapped);
  }
  return items;
}

function mapBilibiliEpisode(episode, index) {
  var pageUrl = httpsUrl(episode.link) ||
    "https://www.bilibili.com/bangumi/play/ep" + String(episode.id || "");
  var episodeNumber = cleanText(episode.title) || String(index + 1);
  var longTitle = cleanText(episode.long_title);
  var title = "第" + episodeNumber + "集" + (longTitle ? " · " + longTitle : "");
  var badge = cleanText(episode.badge || (episode.badge_info && episode.badge_info.text));
  return {
    id: pageUrl,
    type: "url",
    mediaType: "tv",
    title: title,
    backdropPath: httpsUrl(episode.cover),
    description: badge ? "B站官方页面 · " + badge : "B站官方页面",
    releaseDate: formatDateFromUnix(episode.pub_time),
    episode: Number(episode.title || index + 1),
  };
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
    var pageUrl = httpsUrl(data.share_url || data.link) ||
      "https://www.bilibili.com/bangumi/play/ss" + seasonId;
    var rating = data.rating ? Number(data.rating.score || 0) : 0;
    var detail = {
      id: pageUrl,
      type: "url",
      mediaType: "tv",
      title: cleanText(data.title || (cached && cached.title)),
      posterPath: httpsUrl(data.cover || (cached && cached.posterPath)),
      backdropPath: httpsUrl(data.bkg_cover || data.square_cover || data.cover || (cached && cached.backdropPath)),
      description: cleanText(data.evaluate || (cached && cached.description)),
      releaseDate: data.publish && data.publish.pub_time
        ? String(data.publish.pub_time).slice(0, 10)
        : (cached && cached.releaseDate) || "",
      link: route,
      episodeItems: (data.episodes || []).map(mapBilibiliEpisode),
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

# Rex 模块编写记录

本记录以 `C:\Users\ASUS\Downloads\Missav_no_TuT.js` 为当前 Rex 模块的可运行参考样例。它不是 ForwardWidget 规范的转写；后续 Rex 模块应优先保持这个结构和返回值约定。

## 顶层结构

模块文件直接给全局变量赋值：

```js
WidgetMetadata = {
  id: "...",
  title: "...",
  author: "...",
  description: "...",
  version: "...",
  requiredVersion: "0.0.1",
  site: "https://...",
  modules: [...],
  search: {...}
};
```

网络请求使用 `Widget.http.get`，HTML 解析使用 `Widget.html.load`。模块源码不使用 `require`、`fetch` 或浏览器专属 API，也不把 Cookie、Token 或密码写入仓库。

## 返回值约定

- 列表、搜索和详情函数返回数组。
- 列表/搜索中的可打开条目使用 `type: "link"`，并填写 `id`、`title`、`link`；封面和描述按需填写。
- 详情页如果需要继续选择分集或动态请求播放源，也使用 `type: "link"`；详情页直接带播放地址时才使用 `type: "video"`、`videoUrl` 和 `playerType: "app"`。
- `loadDetail(link)` 成功时返回 `[detail]`，失败时返回一个或多个文本状态项，不能直接返回单个对象。
- 文本状态项使用 `type: "text"`、`title` 和 `subTitle`。
- 动态播放模块使用 `type: "stream"`、`cacheDuration: 0`，函数返回资源数组；资源至少包含 `name`、`description`、`url`、`playerType`，需要时附加 `customHeaders`。
- 字幕模块使用 `type: "subtitle"`，函数返回字幕数组；字幕项包含 `id`、`title`、`lang`、`count`、`url`。

## 搜索和分类

需要兼容 Rex 的普通入口和顶层搜索时，同时注册：

```js
{
  id: "searchList",
  title: "搜索",
  functionName: "searchList",
  type: "video",
  params: [
    { name: "keyword", title: "关键词", type: "input" },
    { name: "page", title: "页码", type: "page" }
  ]
}
```

并在 `WidgetMetadata.search` 中使用 `functionName: "searchGlobal"`，参数固定为 `keyword` 和 `page`。两个函数可以复用同一个解析实现，但顶层搜索函数名不能再次作为普通模块注册。

## 播放链路

列表条目通过 `link` 保存平台内部路由；Rex 进入详情后再调用 `loadResource`。播放资源按账号当前可达的最高画质排序，保留可用备用线路；官方字幕和音轨通过独立模块返回，平台权限和地区限制由平台接口决定。模块只检测当前用户网络返回结果，不做代理，也不绕过 Cloudflare、DRM 或会员权限。

## 当前仓库模块

- `widgets/bilibili-rex.js`：B站全影视搜索，Rex 列表/详情/流/字幕结构；保留 WBI、Cookie、DASH/MP4 兼容线路和官方字幕逻辑。
- `widgets/iqiyi-rex.js`：爱奇艺全影视搜索，Rex 列表/详情/流/字幕结构；保留 Cookie、最高可达画质、音轨和官方字幕逻辑。
- `widgets/javranking-rex.js`：JavRanking 榜单、搜索和详情；榜单、搜索和播放源模块声明 `requiresWebView: true`，保留已验证可播放版本的条目和 `loadResource` 链路，并修正影片标题解析。

## 修改后检查

1. 用 Node VM 加载三个文件，确认 `WidgetMetadata` 存在，所有 `functionName` 都有对应全局函数。
2. 检查 `requiredVersion === "0.0.1"`、顶层搜索参数为 `keyword/page`、普通搜索模块不是顶层搜索函数本身。
3. 使用离线夹具测试列表条目为 `type: "link"`，详情函数返回数组，播放函数返回资源数组，字幕函数返回字幕数组。
4. 通过 jsDelivr 的裸 JS 地址检查远程文件为 HTTP 200；Rex 中直接添加 JS 模块链接，不添加 Forward `.fwd` 清单。

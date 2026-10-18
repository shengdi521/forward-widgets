# Forward Widgets

ForwardWidget 全影视在线搜索模块：

- B站影视搜索：电影、电视剧、番剧、国创、综艺、纪录片（WBI 签名搜索、8K/杜比视界/HDR/4K 等 DASH 双轨画质、MP4 兼容线路、可用官方字幕）
- 爱奇艺影视搜索：电影、电视剧、动漫、综艺、纪录片（账号可达最高画质、可用官方字幕、多音轨线路切换）

## 订阅地址

```text
https://raw.githubusercontent.com/shengdi521/forward-widgets/main/bilibili.fwd
https://raw.githubusercontent.com/shengdi521/forward-widgets/main/iqiyi.fwd
https://raw.githubusercontent.com/shengdi521/forward-widgets/main/javranking.fwd
```

建议先分别添加上述三个单平台订阅，便于独立验证。合并订阅仍保留在 `forward-widgets.fwd`。

如果使用 Rex，请直接添加下面的 JS 模块地址：

```text
https://cdn.jsdelivr.net/gh/shengdi521/forward-widgets@251a330f5e6ead277fe6026bd6eba5dd31d2726b/widgets/bilibili-rex.js
https://cdn.jsdelivr.net/gh/shengdi521/forward-widgets@251a330f5e6ead277fe6026bd6eba5dd31d2726b/widgets/iqiyi-rex.js
https://cdn.jsdelivr.net/gh/shengdi521/forward-widgets@251a330f5e6ead277fe6026bd6eba5dd31d2726b/widgets/javranking-rex.js
```

Rex 版本分别提供 B站、爱奇艺和 JavRanking 三个独立 JS 模块。B站和爱奇艺保留账号 Cookie、最高可达画质、音轨/字幕和播放源逻辑；JavRanking 使用 `type: "video"` 的榜单和搜索模块，并将榜单、搜索和播放源请求声明为 WebView，提供 `loadResource` 播放源模块。18 个榜单是独立分类入口，选择榜单后才请求影片条目。

链接固定到已合并并验证的 Git 提交，避免 jsDelivr 的 `@main` 缓存把 Rex 回退到旧版本；Rex 无法访问 GitHub Raw 时，直接添加上面的 jsDelivr JS 地址。

JavRanking 订阅会把 18 个榜单显示为 18 个独立分类入口。打开某个榜单后，模块才会请求并返回该榜单中的影片条目；榜单名称本身不会作为视频返回。每个榜单都保留制式、发行状态、排序和分页参数。

搜索只通过 Forward 原生顶层搜索注册关键词与分页参数，避免普通模块参数页在 iPhone/iPad 键盘“完成”时丢失输入。B站搜索在 WBI 风控失败时会自动回退兼容接口，并只在搜索页携带少量可直接播放分集，避免超长剧集列表导致客户端丢弃整页结果；详情页仍会加载完整分集。电影、电视剧、动漫、综艺和纪录片仍会在同一搜索结果中返回。

## Cookie 安全

仓库和模块源码不包含任何账号 Cookie。请分别在各设备的 Forward 模块参数中填写自己的完整 Cookie；不要将 Cookie 提交到 GitHub、Issue 或聊天记录。

模块仅调用平台官方接口，过滤短视频、用户投稿和站外跳转。点击详情中的正片或分集后，Forward 会动态加载账号当前有权观看的官方播放线路；会员资格、地区限制和试看范围均由平台服务器判定，不绕过 DRM 或会员权限。

Forward 当前没有独立音轨字段，因此爱奇艺的国语、粤语等音轨会显示成不同播放线路；每个音轨把最高画质放在前面，并最多保留一个兼容备用，减少手机端重复线路。B站通过 `fnval=4048` 请求账号实际可达的全部 DASH 视频与音频轨，并在运行时为每个画质生成同时包含视频、音频和 `SegmentBase` 的 MPD 资源；8K、杜比视界、HDR、4K、1080P 等平台实际返回的档位会按最高画质优先排列。模块同时保留 `platform=html5`、`high_quality=1` 的单路 MP4 兼容线路，并按接口公布的可用档位精确重试。模块不会把无声 DASH 视频轨伪装成完整线路，也不会把不同音频码率伪装成语言音轨。B站 BCC 字幕会在运行时转成 WebVTT；爱奇艺只展示平台返回的官方 VTT/SRT。画面内嵌字幕无法关闭或切换。

更新旧版本时，请先删除失败的旧订阅和模块缓存，再分别添加新的单平台订阅。Rex 模块当前版本为 B站 `2.1.0`、爱奇艺 `1.4.6`、JavRanking `1.1.0`（基于首个可播放版本，增加 WebView 请求声明并保留标题修复）。

# TripClip v0.4 · Notion 同步部署指南

> 目标：让行前夹的「↗ 同步 Notion」按钮能把收藏自动写入你的 Notion 数据库。
> 全程约 10 分钟，一次性配置，之后只需点按钮同步。

## 架构

```
行前夹（浏览器） ──POST──▶ Cloudflare Worker ──▶ Notion API ──▶ 你的 Notion 数据库
   点同步按钮          （worker.js，持有 token）    按限速分批创建
```

- **Notion 的 token 只存在 Worker 服务端**，前端和本地文件里都不会出现，安全。
- 同步按「来源ID」幂等去重：同一批数据点多少次同步按钮，Notion 里都不会出现重复条目。

---

## 第一步：创建 Notion Integration（拿 token）

1. 打开 <https://www.notion.so/my-integrations>（建议用电脑浏览器）
2. 点 **New integration**：
   - Name：`TripClip Sync`
   - Associated workspace：选你自己的空间
   - Type：Internal
   - 点 **Submit**
3. 创建后进入详情页，点 **Show** 显示 **Internal Integration Secret**（`ntn_...` 开头），复制保存。**这就是 NOTION_TOKEN，不要泄露。**

## 第二步：创建 Notion 数据库（建列）

1. 在 Notion 里新建一个空页面（比如叫「行前夹」）
2. 输入 `/database`，选择 **Database - Inline**，创建一个数据库
3. 按下面表格 **逐个添加属性（+ Add a property）**，列名必须完全一致（大小写、标点都对）：

| 属性名 | 类型 | 说明 |
|---|---|---|
| 名称 | Title（数据库自带第一列，改名为"名称"） | 店名 / 航班 / 酒店名 |
| 类型 | Select | 机票 / 火车 / 酒店 / 餐厅… |
| 标签 | Multi-select | 按区域 / 日期分组 |
| 地址 | Text | 可复制 |
| 营业时间 | Text | |
| 人均 | Text | |
| 时间 | Text | 起飞 / 入住等 |
| 行程 | Text | 出发 → 到达 |
| 编号 | Text | 航班号 / 车次 |
| 订单/备注 | Text | 订单号等 |
| 免费退订 | Text | 取消底线 |
| 备注 | Text | 小贴士 |
| 原文链接 | URL | 小红书原文 |
| 来源ID | Text | 幂等键，用于去重（不要填内容） |
| 创建时间 | Text | 自动写入 |

> ⚠️ **来源ID 这一列是去重的关键，必须建。** 属性名"来源ID"、"订单/备注"中的 `/` 都要原样输入。

4. 复制这个**数据库页面的链接**（点页面右上角 `•••` → Copy link），链接形如：
   `https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...`
   其中 `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`（32 位）就是 **NOTION_DATABASE_ID**。

## 第三步：把数据库授权给 Integration

1. 打开该数据库页面，点右上角 `•••`（三个点）→ **Connections**（或 Add connections）
2. 在搜索框输入并选择 `TripClip Sync`
3. 确认后，数据库就允许这个 integration 读写

## 第四步：部署 Cloudflare Worker

1. 打开 <https://dash.cloudflare.com/>，注册 / 登录（免费版即可）
2. 左侧菜单 **Workers & Pages** → **Create** → **Create Worker** → 给名字（如 `tripclip-sync`）→ **Deploy**
3. 进入刚创建的 Worker → **Edit code**（编辑代码）
4. **全选删除默认代码**，粘贴本目录 `worker.js` 的全部内容 → **Deploy**
5. 回到 Worker 概览页 → **Settings** → **Variables and Secrets**：
   - **Add variable**：`NOTION_DATABASE_ID`，值填第二步的 32 位 ID
   - **Add secret**：`NOTION_TOKEN`，值填第一步的 `ntn_...`
6. 回到 Worker 概览页，右上角就是你的 **Worker URL**（如 `https://tripclip-sync.你的账号.workers.dev`），复制保存

## 第五步：在行前夹里配置

1. 打开 `tripclip/index.html`
2. 页面底部展开 **「Notion 同步设置（可选）」**
3. 粘贴 Worker URL → 点 **保存地址**
4. 回到顶部点 **「↗ 同步 Notion」**，等待几秒
5. 看到「✓ 新建 N 条」即成功；去 Notion 数据库刷新，条目已就位

---

## 常见问题

| 现象 | 原因与解决 |
|---|---|
| 同步失败：`查询 Notion 数据库失败` | 数据库未授权给 integration（第三步），或 database ID 填错（第二步） |
| 同步失败：`body failed validation` | 数据库列名与第二步表格不一致，逐个核对属性名 |
| 同步失败：`API token is invalid` | NOTION_TOKEN 复制不完整或有空格，重新在 Secrets 里更新 |
| 同步失败：`HTTP 403` | Integration 没有该页面权限，重新执行第三步 Connections 授权 |
| 同步成功但 Notion 没反应 | 稍等几秒刷新；检查同步的数据库是否是你授权的那一个 |
| 国内网络访问 Worker 慢/失败 | Cloudflare 域名在国内可能不稳定，可挂代理重试，或考虑换 Pipedream 中转 |
| 重复点同步会重复吗 | 不会。按「来源ID」去重，已同步条目自动跳过 |

## 安全须知

- `NOTION_TOKEN` 只放在 Worker 的 Secrets 里，**不要**写进 `index.html` 或任何前端文件。
- Integration 只能访问你显式授权的页面，默认权限范围很小；如需撤销，去 my-integrations 删除即可。
- 数据库仍属你个人，Worker 仅做转发，不存储任何数据。

## 重新部署 / 更新

改动 `worker.js` 后：打开 Cloudflare Worker → **Edit code** → 粘贴新代码 → **Deploy**。前端无需变动。

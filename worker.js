// ============================================================
// TripClip · Notion 同步服务（Cloudflare Worker）
// 行前夹 v0.4 配套的同步中转层
//
// 职责：接收行前夹前端的同步请求 → 查询 Notion 数据库已有
// 条目（按「来源ID」幂等去重）→ 批量创建缺失条目 → 返回结果
//
// 部署：见 DEPLOY.md
// 环境变量（Worker → 设置 → 变量）：
//   NOTION_TOKEN        Notion integration token（Secret 类型）
//   NOTION_DATABASE_ID  Notion 数据库 ID（页面 URL 中 32 位十六进制）
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// TripClip 条目字段 → Notion 数据库列名（部署时需按此建列）
const COL = {
  title: '名称',
  type: '类型',
  tags: '标签',
  address: '地址',
  hours: '营业时间',
  price: '人均',
  dateTime: '时间',
  fromTo: '行程',
  code: '编号',
  extra: '订单/备注',
  cancel: '免费退订',
  note: '备注',
  link: '原文链接',
  id: '来源ID',
  createdAt: '创建时间',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return json({ error: '仅支持 POST 请求' }, 405, CORS_HEADERS);
    }
    const token = env.NOTION_TOKEN;
    const databaseId = env.NOTION_DATABASE_ID;
    if (!token || !databaseId) {
      return json({ error: '服务端未配置 NOTION_TOKEN / NOTION_DATABASE_ID，请先在 Worker 设置中添加' }, 500, CORS_HEADERS);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: '请求体不是合法 JSON' }, 400, CORS_HEADERS);
    }
    const entries = Array.isArray(body.entries) ? body.entries.filter(e => e && e.id) : [];
    if (entries.length === 0) {
      return json({ error: '没有可同步的条目' }, 400, CORS_HEADERS);
    }

    // 1) 查询数据库已有「来源ID」，做幂等去重
    const existing = new Set();
    let cursor;
    do {
      const query = { page_size: 100 };
      if (cursor) query.start_cursor = cursor;
      const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: notionHeaders(token),
        body: JSON.stringify(query),
      });
      if (!res.ok) {
        const t = await res.text();
        return json({ error: '查询 Notion 数据库失败：' + t.slice(0, 300) }, 502, CORS_HEADERS);
      }
      const data = await res.json();
      for (const page of data.results || []) {
        const v = page.properties && page.properties[COL.id];
        if (v && v.type === 'rich_text' && v.rich_text && v.rich_text.length) {
          existing.add(v.rich_text[0].plain_text);
        }
      }
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    // 2) 过滤出需要新建的条目，分批创建（遵守 Notion 3 req/s 限速）
    const todo = entries.filter(e => !existing.has(String(e.id)));
    const created = [];
    const errors = [];
    for (let i = 0; i < todo.length; i += 3) {
      const batch = todo.slice(i, i + 3);
      const results = await Promise.all(batch.map(e => createPage(token, databaseId, e)));
      results.forEach(r => (r.ok ? created : errors).push(r.ok ? r.id : r.error));
      if (i + 3 < todo.length) await sleep(400);
    }

    const skipped = entries.length - created.length - errors.length;
    return json({
      ok: true,
      created: created.length,
      skipped,
      errors,
      detail: `新建 ${created.length} 条，跳过已同步 ${skipped} 条` + (errors.length ? `，失败 ${errors.length} 条` : ''),
    }, 200, CORS_HEADERS);
  },
};

// 创建单条 Notion 页面
async function createPage(token, databaseId, e) {
  const props = {
    [COL.title]: { title: [{ text: { content: String(e.name || '未命名地点').slice(0, 2000) } }] },
    [COL.type]: { select: { name: String(e.type || '其他').slice(0, 100) } },
    [COL.tags]: { multi_select: (e.tags || []).map(t => ({ name: String(t).slice(0, 100) })) },
    [COL.address]: rt(e.address),
    [COL.hours]: rt(e.hours),
    [COL.price]: rt(e.price),
    [COL.dateTime]: rt(e.dateTime),
    [COL.fromTo]: rt(e.fromTo),
    [COL.code]: rt(e.code),
    [COL.extra]: rt(e.extra),
    [COL.cancel]: rt(e.cancel),
    [COL.note]: rt(e.note),
    [COL.id]: rt(String(e.id)),
    [COL.createdAt]: rt(fmtTime(e.createdAt)),
  };
  const link = e.link || '';
  if (/^https?:\/\//i.test(link)) {
    props[COL.link] = { url: link.slice(0, 2000) };
  }
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: notionHeaders(token),
    body: JSON.stringify({ parent: { database_id: databaseId }, properties: props }),
  });
  if (res.ok) return { ok: true, id: e.id };
  const text = await res.text();
  return { ok: false, error: `${e.name || e.id}：${text.slice(0, 200)}` };
}

function rt(v) {
  const s = String(v == null ? '' : v);
  return s ? { rich_text: [{ text: { content: s.slice(0, 2000) } }] } : { rich_text: [] };
}

function notionHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('zh-CN', { hour12: false });
}

function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

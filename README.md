# 智慧护航运营态势大屏

**smart-escort-dashboard** 是智能眼镜相关系统的数据聚合与可视化演示大屏，展示设备状态、位置、AI 识别统计、社区服务流水和子系统概况，附带 Node.js 后端与 WebSocket 推送。

原仓库名为 `web`，于 2026-11-02 整理为能说明用途的名称。当前属于**系统集成与可视化演示项目**，并不代表真实设备、线上服务和 AI 已完成全链路验收。

## 与其他项目的关系

| 项目 | 职责 |
|---|---|
| [ai-glasses-platform](https://github.com/libra-sys/ai-glasses-platform) | AI 眼镜组件发布与分享平台 |
| [smart-glasses-management](https://github.com/libra-sys/smart-glasses-management) | 智能眼镜管理小程序 |
| 本仓库 | 聚合上述类型系统和眼镜服务器的数据，展示运营态势 |

代码有对应接口适配逻辑；具体接口协议、部署地址和联调状态仍需分别核对，不表示三个项目已经共同部署。

## 当前实现

- **浏览器大屏**：设备列表、Leaflet 地图、ECharts 统计与仪表盘、服务流水及模块放大视图。
- **数据聚合**：后端读取小程序、组件社区和眼镜服务器接口，整理内存快照。
- **实时推送**：浏览器通过 `/ws/dashboard` 接收 `metrics_update`。
- **同步接口**：接收设备、统计与日志推送。
- **可选快照存储**：配置 Supabase 后尝试写入；仓库没有提供建表 SQL。
- **后端指令接口**：可选 AI 调用与关键词降级；浏览器控制台目前只做本地关键词匹配，尚未接到这个后端接口。

## 快速查看前端

需要 Python 3，或任意静态文件服务器：

```powershell
git clone https://github.com/libra-sys/smart-escort-dashboard.git
cd smart-escort-dashboard
python -m http.server 8080 --bind 127.0.0.1
```

Windows 若没有 `python` 命令，可改用 `py -m http.server 8080 --bind 127.0.0.1`。

访问 [http://127.0.0.1:8080](http://127.0.0.1:8080)。图表与地图依赖外部 CDN、OpenStreetMap 瓦片，需要联网。前端固定连接 `ws://localhost:4000/ws/dashboard`；未启动后端时会重试，无法显示真实业务数据。能打开页面不等于业务已经运行通过。

## 启动数据后端

需要 **Node.js 18+**（使用原生 `fetch`）和 npm。在新终端运行：

```powershell
npm ci
Copy-Item .env.example .env
# 检查并修改 .env 与 backend.config.js 的历史地址，再启动。
npm start
```

开发模式用 `npm run dev`。Windows 的 `./start.ps1` 只执行 `npm start`，不会设置环境变量，也不会启动前端页面服务器。

默认健康检查：[http://localhost:4000/api/health](http://localhost:4000/api/health)。后端不托管 HTML，前端需另用 8080 端口的静态服务器。

### 配置项

| 变量 | 用途和限制 |
|---|---|
| `DASHBOARD_PORT` | 后端端口，默认 4000；修改后还要改前端固定 WebSocket 地址。 |
| `MINIPROGRAM_API_BASE` | 小程序云函数，POST `{"type":"getDevices"}` 等请求。 |
| `COMMUNITY_API_BASE` | 社区 API 根地址，读取 `/dashboard/kpi`、`/dashboard/ai-feature-ranking`、`/dashboard/events`。 |
| `GLASSES_SERVER_BASE` | 眼镜服务器根地址，读取设备、识别统计和服务日志。 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | 可选后端写入配置；服务角色密钥仅放服务器环境。 |
| `ASSISTANT_API_URL` / `ASSISTANT_API_KEY` | 可选后端 AI 请求；当前请求没有 `model` 字段，不保证直接兼容任意服务。 |
| `MAP_API_KEY` / `ALGORITHM_API_BASE` | 配置存在，但当前未用于地图初始化或独立算法 API 调用。 |

`backend.config.js` 内有社区和眼镜服务器的历史默认地址，启动时会尝试访问。运行前请核实替换；只检查界面时可仅启动静态服务器。`.env.example` 是旧配置参考，里面的项目标识不是通用可用配置。不要提交真实密钥。

## HTTP 与 WebSocket

| 入口 | 用途 |
|---|---|
| `GET /api/health` | 健康检查 |
| `GET /api/dashboard/snapshot` | 内存快照 |
| `GET /api/dashboard/logs?limit=50` | 最近服务日志 |
| `POST /api/dashboard-sync` | 接收数据并广播 |
| `POST /api/ai/command` | 返回 `answerText`、`focusMode` |
| `ws://localhost:4000/ws/dashboard` | 初次连接与周期性快照推送 |

后端先等待初次外部数据读取，再监听端口；每 5 秒更新循环，每五轮刷新部分外部数据。外部请求未设置显式超时，不可达服务可能拖慢启动或刷新。

## 演示逻辑与尚未完成的范围

- 初始设备和日志列表为空，接入失败不能视为真实运营数据。
- 服务质量初始值 `12 / 92 / 97` 是固定值，不是实测时延、满意度、成功率。
- “智能诊断”是按时间段拼接的前端文本，不是模型诊断结果。
- “未来两小时低电量”名单来自 `battery < 20` 的筛选，不是经过验证的预测模型。
- 代表性轨迹包含坐标偏移生成的点，不是完整真实定位轨迹。
- “一键发送提醒”只在浏览器插入本地日志，没有通知发送链路。
- 浏览器 AI 控制台没有调用后端 AI 接口；后端 AI 兼容性也未在本轮验证。
- API 未实现应用层鉴权，CORS 当前开放，不宜直接作为公网生产管理服务部署。
- 尚缺静态页面托管、Supabase 建表迁移、自动化测试与一键部署。

## 文件结构

```text
index.html / style.css / main.js   浏览器大屏
server.js                         API、外部数据聚合、WebSocket
backend.config.js                 配置与历史默认服务地址
package.json / package-lock.json  Node.js 依赖与启动命令
start.ps1                         Windows 后端启动
.env.example                      旧环境配置参考
BACKEND.md                        后端说明
AI智能体配置教程.md                AI 接入状态
docs/STATUS.md                    用途检查与验证边界
```

## 验证状态

2026-11-02 基于 14 个文件的目录，重点阅读核心实现与相关文档，核对前后端接线、配置消费、端口和演示逻辑；通过 Node.js 语法检查。仅改写文档和仓库元信息，没有变更业务代码。未连接历史外部系统，未作眼镜、小程序、社区、AI、Supabase 全链路运行验收。后续项见 [状态说明](docs/STATUS.md)。

## 许可证

当前仓库没有独立 `LICENSE` 文件。旧文档中的 “MIT” 字样不能替代完整许可；应先核对代码和第三方素材来源，再补充明确授权。

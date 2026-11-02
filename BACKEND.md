# 数据聚合后端

后端使用 Express + WebSocket，默认端口 **4000**，不托管前端 HTML。完整运行、配置与限制见 [README](README.md)。

路由：`GET /api/health`、`GET /api/dashboard/snapshot`、`GET /api/dashboard/logs`、`POST /api/dashboard-sync`、`POST /api/ai/command`。WebSocket 路径 `/ws/dashboard`，消息类型 `metrics_update`。

当前后端主动读取外部接口，并非旧说明中的纯随机数据服务。固定质量指标、偏移轨迹和低电量筛选仍有演示成分，不能当作真实服务效果。实现见 `server.js`，配置见 `backend.config.js`；真实联调、鉴权、超时和表迁移仍待完成。

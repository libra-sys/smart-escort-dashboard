# 可视化大屏后端服务说明

本服务为当前「智慧护航可视化大屏」提供统一的数据后端，负责聚合设备、社区网站、小程序、算法系统等数据，并通过 HTTP API + WebSocket 向前端推送实时态势。

> 说明：目前实现为**模拟数据驱动**，方便你本地调试和比赛演示；后续你提供地图 API Key、小助手 API、各系统接口后，只需要在少数几个位置替换为真实数据源即可。

---

## 一、项目结构
当前工作目录（`g:\WEBSE`）下新增了这些与后端相关的文件：
- `package.json`：Node.js 项目配置（依赖、启动脚本）。  
- `backend.config.js`：后端配置文件，集中管理端口号、地图 Key、小助手 API、各业务系统接口地址等。  
- `server.js`：后端主服务入口，提供 HTTP API 和 WebSocket 推送逻辑。  
- （已有）`index.html` / `style.css` / `main.js`：前端大屏代码，可在接入后端时调用本服务接口。

---

## 二、运行环境与启动方式

### 1. 环境要求

- Node.js：建议 **16+**（14+ 也基本可用）。
- 操作系统：Windows / macOS / Linux 均可。

### 2. 安装依赖

在 `g:\WEBSE` 目录打开终端，执行：

```bash
npm install
```

主要依赖：

- `express`：HTTP API 框架
- `ws`：WebSocket 服务端库
- `cors`：跨域支持
- `nodemon`：开发时热重启（可选）

### 3. 启动服务

```bash
# 普通启动
npm start

# 开发模式（代码变化自动重启，需全局或本地有 npx）
npm run dev
```

默认监听端口：`4000`（可在 `backend.config.js` 或环境变量中修改）。

浏览器或前端可以先访问健康检查接口验证服务是否正常：

```http
GET http://localhost:4000/api/health
```

返回示例：

```json
{
  "status": "ok",
  "time": "2025-01-01T12:34:56.789Z"
}
```

---

## 三、配置文件说明（`backend.config.js`）

```js
module.exports = {
  // HTTP server port
  port: parseInt(process.env.DASHBOARD_PORT || '4000', 10),

  // Map-related configuration (e.g. Gaode/AMap)
  map: {
    apiKey: process.env.MAP_API_KEY || '',
  },

  // "小助手" 或智能服务 API
  assistant: {
    baseUrl: process.env.ASSISTANT_API_URL || '',
    apiKey: process.env.ASSISTANT_API_KEY || '',
  },

  // Other subsystem APIs: community website, glasses app, algorithm service
  services: {
    communityApiBase: process.env.COMMUNITY_API_BASE || '',
    glassesApiBase: process.env.GLASSES_API_BASE || '',
    algorithmApiBase: process.env.ALGORITHM_API_BASE || '',
  },
};
```

后续你提供具体的 **地图 Key / 小助手 API / 各业务系统地址** 时，可以：

- 直接改这个文件里的默认值，或
- 在系统环境变量中设置：`MAP_API_KEY`、`ASSISTANT_API_URL`、`COMMUNITY_API_BASE` 等。

当前代码中这些配置尚未调用外部服务，只是预留了统一配置入口，方便后续对接。

---

## 四、HTTP API 设计

### 1. 健康检查

- **GET** `/api/health`
- 用途：探测后端是否存活。

返回：

```json
{
  "status": "ok",
  "time": "2025-01-01T12:34:56.789Z"
}
```

---

### 2. 大屏全量快照

- **GET** `/api/dashboard/snapshot`
- 用途：前端大屏初始化时，一次性获取当前态势的完整数据快照。

返回结构示例（字段基本对应现有前端 `state`）：

```json
{
  "devices": [
    {
      "id": "D01",
      "lat": 31.2301,
      "lng": 121.4703,
      "status": "online",
      "battery": 87,
      "signal": 4,
      "lastActiveAt": "2025-01-01T12:30:00.000Z"
    }
  ],
  "alerts": [],
  "communityHeat": [
    { "regionId": "R1", "intensity": 0.62 }
  ],
  "aiStats": [
    {
      "timestamp": "2025-01-01T12:20:00.000Z",
      "category": "行人",
      "count": 24,
      "confidence": 92.3
    }
  ],
  "serviceLogs": [
    {
      "id": "S123",
      "time": "12:34:56",
      "type": "help",
      "userId": "U321",
      "deviceId": "D03",
      "description": "发起护航求助"
    }
  ],
  "serviceQuality": {
    "averageResponseTime": 12.5,
    "satisfaction": 93.2,
    "successRate": 97.1
  },
  "ecosystem": {
    "communitySite": {
      "users": 1800,
      "solvedPosts": 520
    },
    "glassesApp": {
      "bindedGlasses": 320,
      "todayUpdates": 12
    },
    "algorithm": {
      "version": "v1.2.0",
      "qps": 85
    }
  },
  "prediction": {
    "devices": ["D03", "D05", "D07"],
    "hours": 2
  },
  "trajectory": [
    { "id": "D01", "lat": 31.2301, "lng": 121.4703 }
  ]
}
```

> 说明：目前所有数据在内存中随机生成和轻微抖动，用于演示；接入真实系统时，只需在 `initMockData()` 和 `updateState()` 中替换为实际数据来源即可。

---

### 3. 服务流水 / 系统日志

- **GET** `/api/dashboard/logs?limit=50`
- 参数：
  - `limit`（可选）：返回的最大日志条数，默认 50。

返回：

```json
{
  "logs": [
    {
      "id": "S-1700000000000",
      "time": "12:34:56",
      "type": "help",
      "userId": "U321",
      "deviceId": "D03",
      "description": "发起护航求助"
    }
  ]
}
```

前端可以用这个接口构建：

- 右侧「实时服务流水」基础数据；
- 放大视图中的「全系统实时服务日志监控」。

---

### 4. AI 控制台指令接口

- **POST** `/api/ai/command`
- 用途：让前端 AI 控制台把用户指令发送到后端，后端根据规则返回：
  - `answerText`：给用户展示的文本解释；
  - `focusMode`：用于告诉前端应该放大展示哪一块数据视图（如社区、小程序、算法、日志）。

请求示例：

```http
POST /api/ai/command
Content-Type: application/json

{
  "text": "放大展示社区组件网站的数据"
}
```

响应示例：

```json
{
  "answerText": "已放大展示社区组件网站的统计数据。",
  "focusMode": "community"
}
```

当前后端内置了一些简单规则匹配：

- 包含 `社区` / `组件网站` → `focusMode = community`
- 包含 `眼镜` / `小程序` → `focusMode = glasses`
- 包含 `算法` / `模型` / `系统负载` → `focusMode = algorithm`
- 包含 `日志` / `流水` / `监控` → `focusMode = logs`
- 包含 `3号设备` / `D03` → 返回该设备近期日志摘要

未来你可以改成真正调用你的小助手 API：

1. 在 `backend.config.js` 填好 `assistant.baseUrl` 和 `assistant.apiKey`；
2. 在 `server.js` 的 `/api/ai/command` 里，用 `fetch`/`axios` 调你自己的 AI 服务，
3. 把 AI 的解析结果映射成 `answerText` 与 `focusMode` 返回给前端。

---

## 五、WebSocket 实时推送

- 地址：`ws://<host>:<port>/ws/dashboard`
- 消息格式：

```json
{
  "type": "metrics_update",
  "payload": { /* 与 /api/dashboard/snapshot 相同结构 */ }
}
```

当前实现：

- 服务启动时调用 `initMockData()` 初始化内存中的全量数据；
- 每隔 **5 秒** 执行一次 `tick()`：
  - 模拟设备电量下降、状态变化；
  - 轻微抖动服务质量和生态指标；
  - 追加一条随机服务流水；
  - 调用 `broadcast('metrics_update', buildSnapshot())` 将最新快照推送给所有 WebSocket 客户端。

> 与前端的关系：前端可以在初始化时先调用一次 `/api/dashboard/snapshot` 渲染初始画面，然后通过 WebSocket 持续接收 `metrics_update`，每次收到后更新本地 `state` 并重绘图表。

---

## 六、前端接入参考（示例）

以下是把现有前端切换到调用后端的一个参考思路（不直接修改你的代码，只提供示例）：

```js
// main.js 中示意代码
const USE_BACKEND = true;
const BACKEND_BASE_URL = 'http://localhost:4000';

async function initFromBackend() {
  const res = await fetch(`${BACKEND_BASE_URL}/api/dashboard/snapshot`);
  const data = await res.json();
  Object.assign(state, data);

  renderDeviceTable();
  renderServiceLogs();
  updateKpis();
  updateAiSpectrumChart();
  updateGauges();
  updateEcosystemPanel();
}

function bindRealtime() {
  const ws = new WebSocket('ws://localhost:4000/ws/dashboard');
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'metrics_update') {
      Object.assign(state, msg.payload);
      renderDeviceTable();
      renderDevicesOnMap();
      updateKpis();
      updateAiSpectrumChart();
      updateGauges();
      updateEcosystemPanel();
      if (focusMode === 'logs') {
        renderFocusLogs();
      } else if (focusMode) {
        updateFocusChart();
      }
    }
  };
}

window.addEventListener('load', () => {
  initSystemTime();

  if (USE_BACKEND) {
    initFromBackend().then(() => {
      initMap();
      initAiSpectrumChart();
      initHeatChart();
      initGauges();
      updateDiagnosis();
      initAiConsole();
      initPredictionCard();
      initFocusOverlay();
      bindRealtime();
    });
  } else {
    // 保留你现在的本地模拟逻辑
    initMockData();
    initMap();
    initAiSpectrumChart();
    initHeatChart();
    initGauges();
    renderDeviceTable();
    renderServiceLogs();
    updateKpis();
    updateDiagnosis();
    initAiConsole();
    initPredictionCard();
    initFocusOverlay();
    setInterval(tick, 4000);
  }

  window.addEventListener('resize', onResize);
});
```

你可以根据这个思路，按自己的节奏逐步把前端从“本地模拟数据”切换为“后端真实数据 + WebSocket 实时推送”。

---

## 七、后续接入真实系统的建议

当你拿到实际的接口与 Key 之后，建议按这几个步骤演进：

1. **先只替换快照接口**：
   - 在 `initMockData()` 位置改成调用各系统的 REST API，构建一次性的 `buildSnapshot()`，不改 WebSocket；
   - 确保 `/api/dashboard/snapshot` 返回的数据与前端 `state` 结构一致。

2. **再接入定时任务 / WebSocket**：
   - 在 `updateState()` 中，从真实系统拉取增量或最新指标，替换当前的“随机抖动”；
   - 继续使用 `setInterval(tick, 5000)` 或改成按业务需要的周期，推送最新快照。

3. **最后接入小助手 API**：
   - 在 `backend.config.js` 配好小助手 API 地址与 Key；
   - 在 `/api/ai/command` 中改为实际调用小助手服务，并把返回结果映射为 `answerText` 与 `focusMode`。

如果你确定后端技术栈就用 Node.js，我可以在下一步帮你根据真实接口字段写出具体的对接代码（替换 `initMockData` 和 `updateState` 中的模拟部分），你只需要提供：

- 地图相关服务的接口或并发限制；
- 组件网站、小程序、算法系统的具体 API 路径和返回 JSON 示例。

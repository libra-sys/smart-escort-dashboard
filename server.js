'use strict';

require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const config = require('./backend.config');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws/dashboard' });

//  ------------ In-memory state & mock data generation ------------

const state = {
  devices: [],
  alerts: [],
  communityHeat: [],
  aiStats: [],
  serviceLogs: [],
  serviceQuality: {
    averageResponseTime: 12,
    satisfaction: 92,
    successRate: 97,
  },
  ecosystem: {
    communitySite: {
      users: 0,
      solvedPosts: 0,
    },
    glassesApp: {
      bindedGlasses: 0,
      todayUpdates: 0,
    },
    algorithm: {
      version: 'v1.0.0',
      qps: 0,
    },
  },
  prediction: {
    devices: [],
    hours: 2,
  },
  trajectory: [],
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 获取小程序云函数数据
async function fetchMiniprogramData(type) {
  try {
    const baseUrl = config.services.miniprogramApiBase;
    if (!baseUrl) return null;

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });

    if (!res.ok) {
      console.error(`小程序 API 返回错误 (${type}): HTTP ${res.status}`);
      return null;
    }

    const result = await res.json();
    return result.data || null;
  } catch (error) {
    console.error(`获取小程序数据失败 (${type}):`, error.message);
    return null;
  }
}

// 获取眼镜服务器数据
async function fetchGlassesServerData(endpoint) {
  try {
    const baseUrl = config.services.glassesServerBase;
    if (!baseUrl) return null;

    const res = await fetch(`${baseUrl}${endpoint}`);

    if (!res.ok) {
      console.error(`眼镜服务器 API 返回错误 (${endpoint}): HTTP ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error(`获取眼镜服务器数据失败 (${endpoint}):`, error.message);
    return null;
  }
}

// 获取 WEBMY 组件平台社区数据
async function fetchCommunityData() {
  try {
    const baseUrl = config.services.communityApiBase;
    if (!baseUrl) return null;

    const [kpiRes, rankingRes, eventsRes] = await Promise.all([
      fetch(`${baseUrl}/dashboard/kpi`),
      fetch(`${baseUrl}/dashboard/ai-feature-ranking`),
      fetch(`${baseUrl}/dashboard/events?limit=20`),
    ]);

    const kpi = await kpiRes.json();
    const ranking = await rankingRes.json();
    const events = await eventsRes.json();

    return { kpi, ranking, events };
  } catch (error) {
    console.error('获取组件平台数据失败:', error.message || error);
    return null;
  }
}

async function initRealData() {
  // 从小程序云函数和眼镜服务器获取真实数据
  const [devices, stats, aiStats, serviceLogs, communityData, glassesDevice, glassesAI, glassesLogs] = await Promise.all([
    fetchMiniprogramData('getDevices'),
    fetchMiniprogramData('getStats'),
    fetchMiniprogramData('getAIStats'),
    fetchMiniprogramData('getServiceLogs'),
    fetchCommunityData(),
    fetchGlassesServerData('/api/dashboard/device-status'),
    fetchGlassesServerData('/api/dashboard/ai-stats'),
    fetchGlassesServerData('/api/dashboard/service-logs'),
  ]);

  // 设备数据（小程序）
  if (devices && Array.isArray(devices)) {
    state.devices = devices.map((d) => ({
      id: d.deviceId || d.device_id,
      lat: d.location?.latitude || d.lat || 31.23,
      lng: d.location?.longitude || d.lng || 121.47,
      status: d.status || 'offline',
      battery: d.batteryLevel || d.battery || 0,
      signal: d.signalStrength || d.signal || 0,
      lastActiveAt: d.lastActiveAt || d.last_active_at || new Date().toISOString(),
    }));
  }
  
  // 眼镜设备数据
  if (glassesDevice && glassesDevice.deviceId) {
    state.devices.push({
      id: glassesDevice.deviceId,
      lat: glassesDevice.location?.lat || 31.23,
      lng: glassesDevice.location?.lng || 121.47,
      status: glassesDevice.status || 'offline',
      battery: glassesDevice.battery || 0,
      signal: glassesDevice.signal || 0,
      lastActiveAt: new Date(glassesDevice.lastActive * 1000).toISOString(),
    });
  }

  // 小程序统计数据
  if (stats) {
    state.ecosystem.glassesApp.bindedGlasses = stats.totalDevices || 0;
    state.ecosystem.glassesApp.todayUpdates = stats.todayUpdates || 0;
  }

  // AI统计数据
  if (aiStats && Array.isArray(aiStats)) {
    state.aiStats = aiStats.map((item) => ({
      timestamp: item.timestamp || new Date().toISOString(),
      category: item.category || item.objectType || '未知',
      count: item.count || 0,
      confidence: item.confidence || 0,
    }));
    
    // 计算算法 QPS
    const recentAI = aiStats.filter(
      (item) => new Date(item.timestamp) > new Date(Date.now() - 60000)
    );
    state.ecosystem.algorithm.qps = recentAI.length;
  }
  
  // 眼镜AI统计数据
  if (glassesAI) {
    state.ecosystem.algorithm.version = glassesAI.version || state.ecosystem.algorithm.version;
    state.ecosystem.algorithm.qps += glassesAI.qps || 0;
    
    if (glassesAI.recentRecognitions && Array.isArray(glassesAI.recentRecognitions)) {
      state.aiStats = [...state.aiStats, ...glassesAI.recentRecognitions.map((item) => ({
        timestamp: item.timestamp || new Date().toISOString(),
        category: item.category || item.objectType || '未知',
        count: 1,
        confidence: item.confidence || 0,
      }))];
    }
  }

  // 服务日志
  if (serviceLogs && Array.isArray(serviceLogs)) {
    state.serviceLogs = serviceLogs.map((log) => ({
      id: log.id || log._id,
      time: new Date(log.timestamp || log.created_at).toTimeString().substring(0, 8),
      type: log.type || log.logType || 'help',
      userId: log.userId || log.user_id || 'unknown',
      deviceId: log.deviceId || log.device_id || '',
      description: log.description || log.message || '',
    }));
  }
  
  // 眼镜服务日志
  if (glassesLogs && Array.isArray(glassesLogs)) {
    const glassesServiceLogs = glassesLogs.map((log) => ({
      id: log._id,
      time: new Date(log.createdAt * 1000).toTimeString().substring(0, 8),
      type: log.type || 'glasses',
      userId: log.userId,
      deviceId: log.deviceId,
      description: log.description,
    }));
    state.serviceLogs = [...glassesServiceLogs, ...state.serviceLogs];
  }

  // 社区平台数据
  if (communityData && communityData.kpi) {
    state.ecosystem.communitySite.users = communityData.kpi.totalServiceUsers || 0;
    state.ecosystem.communitySite.solvedPosts = communityData.kpi.componentCallsToday || 0;

    if (communityData.events && communityData.events.events) {
      communityData.events.events.slice(0, 10).forEach((evt) => {
        state.serviceLogs.unshift({
          id: evt.id,
          time: new Date(evt.created_at).toTimeString().substring(0, 8),
          type: 'community',
          userId: evt.user_id,
          deviceId: evt.component_id,
          description: evt.message,
        });
      });
    }
  }

  // 生成热力图数据（根据设备密度）
  const regions = {};
  state.devices.forEach((d) => {
    const regionKey = `${Math.floor(d.lat * 100)}_${Math.floor(d.lng * 100)}`;
    regions[regionKey] = (regions[regionKey] || 0) + 1;
  });
  state.communityHeat = Object.entries(regions)
    .slice(0, 8)
    .map(([key, count], idx) => ({
      regionId: `R${idx + 1}`,
      intensity: Math.min(count / 5, 1),
    }));

  // 生成轨迹（取最近的服务日志对应设备）
  if (state.serviceLogs.length > 0 && state.devices.length > 0) {
    const recentLog = state.serviceLogs[0];
    const device = state.devices.find((d) => d.id === recentLog.deviceId);
    if (device) {
      state.trajectory = [
        device,
        { lat: device.lat + 0.01, lng: device.lng + 0.01 },
        { lat: device.lat + 0.02, lng: device.lng + 0.015 },
      ];
    }
  }

  // 预测低电量设备
  state.prediction.devices = state.devices
    .filter((d) => d.battery < 20)
    .sort((a, b) => a.battery - b.battery)
    .slice(0, 5)
    .map((d) => d.id);

  console.log('✅ 已加载真实数据:', {
    设备数: state.devices.length,
    日志数: state.serviceLogs.length,
    AI识别数: state.aiStats.length,
    眼镜设备: glassesDevice ? '已连接' : '未连接',
  });
}

function buildSnapshot() {
  return {
    devices: state.devices,
    alerts: state.alerts,
    communityHeat: state.communityHeat,
    aiStats: state.aiStats,
    serviceLogs: state.serviceLogs.slice(-100),
    serviceQuality: state.serviceQuality,
    ecosystem: state.ecosystem,
    prediction: state.prediction,
    trajectory: state.trajectory,
  };
}

// initMockData 在启动流程中异步调用

// ------------ Supabase helpers ------------

async function appendServiceLogToSupabase(log) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('service_logs').insert({
      type: log.type,
      source_system: 'backend',
      user_id: log.userId,
      device_id: null,  // 暂时设为 null，避免外键约束
      description: log.description,
      raw_payload: log,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('写入 service_logs 失败:', error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('写入 service_logs 异常:', err.message || err);
  }
}

async function saveSnapshotToSupabase() {
  if (!supabase) return;
  const snapshot = buildSnapshot();
  const onlineDevices = snapshot.devices.filter((d) => d.status !== 'offline').length;
  try {
    const { error } = await supabase.from('ecosystem_snapshots').insert({
      community_users: snapshot.ecosystem.communitySite.users,
      community_solved_posts: snapshot.ecosystem.communitySite.solvedPosts,
      glasses_binded: snapshot.ecosystem.glassesApp.bindedGlasses,
      glasses_updates: snapshot.ecosystem.glassesApp.todayUpdates,
      algorithm_qps: snapshot.ecosystem.algorithm.qps,
      algorithm_version: snapshot.ecosystem.algorithm.version,
      online_devices: onlineDevices,
      avg_response_time: snapshot.serviceQuality.averageResponseTime,
      satisfaction: snapshot.serviceQuality.satisfaction,
      success_rate: snapshot.serviceQuality.successRate,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('写入 ecosystem_snapshots 失败:', error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('写入 ecosystem_snapshots 异常:', err.message || err);
  }
}

// ------------ HTTP API ------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Dashboard initial snapshot
app.get('/api/dashboard/snapshot', (req, res) => {
  res.json(buildSnapshot());
});

// Recent service logs
app.get('/api/dashboard/logs', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const logs = state.serviceLogs.slice(-limit).slice().reverse();
  res.json({ logs });
});

// AI command router - 智能体模式
async function callAIAgent(userInput) {
  const assistantUrl = config.assistant.baseUrl;
  const assistantKey = config.assistant.apiKey;

  if (!assistantUrl || !assistantKey) {
    return null;
  }

  try {
    const response = await fetch(assistantUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${assistantKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `你是智能护航可视化大屏的AI助手。根据用户指令，识别需要展示的模块数据。
可用模块：
- community: 社区组件网站数据
- glasses: 眼镜小程序运营数据
- algorithm: AI算法系统监控
- logs: 全系统服务日志
- device: 查询具体设备信息

请返回JSON格式：{"focusMode": "模块名或null", "answer": "回答文本", "deviceId": "设备ID或null"}`,
          },
          {
            role: 'user',
            content: userInput,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`AI助手调用失败: HTTP ${response.status}`);
      return null;
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('AI助手调用异常:', error.message);
    return null;
  }
}

app.post('/api/ai/command', async (req, res) => {
  const text = String((req.body && req.body.text) || '').trim();
  let focusMode = null;
  let answerText;
  let deviceId = null;

  if (!text) {
    return res.json({ answerText: '请输入有效的指令。', focusMode: null });
  }

  // 尝试调用AI智能体
  const aiResponse = await callAIAgent(text);
  
  if (aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse);
      focusMode = parsed.focusMode || null;
      answerText = parsed.answer || '已处理您的指令。';
      deviceId = parsed.deviceId || null;
      
      if (deviceId) {
        const logs = state.serviceLogs
          .filter((l) => l.deviceId === deviceId)
          .slice(-5)
          .map((l) => `${l.time} · ${l.description}`)
          .join('；');
        if (logs) {
          answerText += `\n${deviceId} 设备关键日志：${logs}`;
        }
      }
    } catch (e) {
      console.error('AI响应解析失败:', e);
    }
  }
  
  // 降级方案：关键词匹配
  if (!answerText) {
    if (/3号设备|3 号设备|D03/i.test(text)) {
      const logs = state.serviceLogs
        .filter((l) => l.deviceId === 'D03')
        .slice(-5)
        .map((l) => `${l.time} · ${l.description}`)
        .join('；');
      answerText = logs ? `3 号设备今日关键日志：${logs}` : '3 号设备今日暂无明显告警日志。';
    } else if (/社区|组件网站/.test(text)) {
      focusMode = 'community';
      answerText = '已放大展示社区组件网站的统计数据。';
    } else if (/眼镜|小程序/.test(text)) {
      focusMode = 'glasses';
      answerText = '已放大展示眼镜管理小程序运行数据。';
    } else if (/算法|模型|系统负载/.test(text)) {
      focusMode = 'algorithm';
      answerText = '已放大展示算法与系统负载监控。';
    } else if (/日志|流水|监控/.test(text)) {
      focusMode = 'logs';
      answerText = '已切换到全系统实时服务日志监控视图。';
    } else {
      answerText = '已根据指令筛选相关数据。';
    }
  }

  res.json({ answerText, focusMode });
});

// 接收小程序推送的数据
app.post('/api/dashboard-sync', (req, res) => {
  try {
    const { devices, stats, aiStats, serviceLogs } = req.body;

    // 更新设备数据
    if (devices && Array.isArray(devices)) {
      state.devices = devices.map((d) => ({
        id: d._id || d.deviceId,
        lat: d.location?.lat || 31.23,
        lng: d.location?.lng || 121.47,
        status: d.status || 'offline',
        battery: d.battery || 0,
        signal: d.signal || 0,
        lastActiveAt: d.lastActive || new Date().toISOString(),
      }));
    }

    // 更新统计数据
    if (stats) {
      state.ecosystem.glassesApp.bindedGlasses = stats.bindedGlasses || 0;
      state.ecosystem.glassesApp.todayUpdates = stats.todayUpdates || 0;
    }

    // 更新AI统计
    if (aiStats) {
      state.ecosystem.algorithm.qps = aiStats.qps || 0;
      state.ecosystem.algorithm.version = aiStats.version || 'v1.0.0';
      
      if (aiStats.recentRecognitions && Array.isArray(aiStats.recentRecognitions)) {
        state.aiStats = aiStats.recentRecognitions.map((item) => ({
          timestamp: item.timestamp || new Date().toISOString(),
          category: item.objectType || '未知',
          count: 1,
          confidence: item.confidence || 0,
        }));
      }
    }

    // 更新服务日志
    if (serviceLogs && Array.isArray(serviceLogs)) {
      const newLogs = serviceLogs.slice(0, 20).map((log) => ({
        id: log._id,
        time: new Date(log.createdAt).toTimeString().substring(0, 8),
        type: log.type || 'help',
        userId: log.userId || 'unknown',
        deviceId: log.deviceId || '',
        description: log.description || log.title || '',
      }));
      state.serviceLogs = [...newLogs, ...state.serviceLogs.slice(0, 80)];
    }

    console.log('✅ 收到小程序数据推送:', {
      设备数: devices?.length || 0,
      日志数: serviceLogs?.length || 0,
      AI识别数: aiStats?.recentRecognitions?.length || 0,
    });
    
    broadcast('metrics_update', buildSnapshot());
    
    res.json({ success: true, message: '数据同步成功' });
  } catch (error) {
    console.error('❌ 数据同步失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ------------ WebSocket push ------------

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'metrics_update', payload: buildSnapshot() }));
});

// ------------ Periodic update loop ------------

async function updateState() {
  // 每 5 次更新（约25秒）从小程序、社区平台和眼镜服务器刷新真实数据
  if (!updateState.counter) updateState.counter = 0;
  updateState.counter += 1;
  
  if (updateState.counter % 5 === 0) {
    const [serviceLogs, stats, communityData, glassesDevice, glassesLogs] = await Promise.all([
      fetchMiniprogramData('getServiceLogs'),
      fetchMiniprogramData('getStats'),
      fetchCommunityData(),
      fetchGlassesServerData('/api/dashboard/device-status'),
      fetchGlassesServerData('/api/dashboard/service-logs'),
    ]);

    // 更新服务日志
    if (serviceLogs && Array.isArray(serviceLogs)) {
      const newLogs = serviceLogs.slice(0, 10).map((log) => ({
        id: log.id || log._id,
        time: new Date(log.timestamp || log.created_at).toTimeString().substring(0, 8),
        type: log.type || log.logType || 'help',
        userId: log.userId || log.user_id || 'unknown',
        deviceId: log.deviceId || log.device_id || '',
        description: log.description || log.message || '',
      }));
      state.serviceLogs = [...newLogs, ...state.serviceLogs.slice(0, 90)];
    }
    
    // 更新眼镜服务日志
    if (glassesLogs && Array.isArray(glassesLogs)) {
      const glassesNewLogs = glassesLogs.slice(0, 10).map((log) => ({
        id: log._id,
        time: new Date(log.createdAt * 1000).toTimeString().substring(0, 8),
        type: log.type || 'glasses',
        userId: log.userId,
        deviceId: log.deviceId,
        description: log.description,
      }));
      state.serviceLogs = [...glassesNewLogs, ...state.serviceLogs.slice(0, 90)];
    }
    
    // 更新眼镜设备状态
    if (glassesDevice && glassesDevice.deviceId) {
      const existingIndex = state.devices.findIndex(d => d.id === glassesDevice.deviceId);
      const glassesDeviceData = {
        id: glassesDevice.deviceId,
        lat: glassesDevice.location?.lat || 31.23,
        lng: glassesDevice.location?.lng || 121.47,
        status: glassesDevice.status || 'offline',
        battery: glassesDevice.battery || 0,
        signal: glassesDevice.signal || 0,
        lastActiveAt: new Date(glassesDevice.lastActive * 1000).toISOString(),
      };
      
      if (existingIndex >= 0) {
        state.devices[existingIndex] = glassesDeviceData;
      } else {
        state.devices.push(glassesDeviceData);
      }
    }

    // 更新小程序统计
    if (stats) {
      state.ecosystem.glassesApp.bindedGlasses = stats.totalDevices || state.ecosystem.glassesApp.bindedGlasses;
      state.ecosystem.glassesApp.todayUpdates = stats.todayUpdates || state.ecosystem.glassesApp.todayUpdates;
    }

    // 更新社区平台数据
    if (communityData && communityData.kpi) {
      state.ecosystem.communitySite.users = communityData.kpi.totalServiceUsers || state.ecosystem.communitySite.users;
      state.ecosystem.communitySite.solvedPosts = communityData.kpi.componentCallsToday || state.ecosystem.communitySite.solvedPosts;
    }
  }
}

let snapshotCounter = 0;

async function tick() {
  await updateState();
  broadcast('metrics_update', buildSnapshot());

  snapshotCounter += 1;
  if (snapshotCounter % 12 === 0) {
    saveSnapshotToSupabase().catch(() => {});
  }
}

// ------------ Start server ------------

(async () => {
  await initRealData();

  setInterval(tick, 5000);

  const port = config.port || 4000;
  server.listen(port, () => {
    console.log(`Dashboard backend listening on http://localhost:${port}`);
  });
})();

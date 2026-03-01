// 简单的模拟数据与可视化逻辑

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

function initSystemTime() {
  const el = document.getElementById('system-time');
  const update = () => {
    const now = new Date();
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    const s = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    el.textContent = s;
  };
  update();
  setInterval(update, 1000);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// WebSocket 连接后端
let ws = null;

function connectBackend() {
  ws = new WebSocket('ws://localhost:4000/ws/dashboard');
  
  ws.onopen = () => {
    console.log('✅ 已连接到后端服务');
  };
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'metrics_update' && msg.payload) {
        updateStateFromBackend(msg.payload);
      }
    } catch (err) {
      console.error('解析后端消息失败:', err);
    }
  };
  
  ws.onerror = (err) => {
    console.error('❌ WebSocket 错误:', err);
  };
  
  ws.onclose = () => {
    console.warn('⚠️ 与后端断开连接，5秒后重连...');
    setTimeout(connectBackend, 5000);
  };
}

function updateStateFromBackend(payload) {
  state.devices = payload.devices || [];
  state.alerts = payload.alerts || [];
  state.communityHeat = payload.communityHeat || [];
  state.aiStats = payload.aiStats || [];
  state.serviceLogs = payload.serviceLogs || [];
  state.serviceQuality = payload.serviceQuality || state.serviceQuality;
  state.ecosystem = payload.ecosystem || state.ecosystem;
  state.prediction = payload.prediction || state.prediction;
  state.trajectory = payload.trajectory || [];
  
  // 更新所有UI组件
  renderDeviceTable();
  renderDevicesOnMap();
  renderTrajectoryOnMap();
  updateKpis();
  updateAiSpectrumChart();
  updateHeatChart();
  renderServiceLogs();
  updateGauges();
  updateEcosystemPanel();
  updateDiagnosis();
  
  if (focusMode === 'community' || focusMode === 'glasses' || focusMode === 'algorithm') {
    updateFocusChart();
  } else if (focusMode === 'logs') {
    renderFocusLogs();
  }
}

// 地图与轨迹
let map;
let deviceLayer;
let trajectoryLine;
let alertLayer;

function initMap() {
  map = L.map('map', {
    zoomControl: false,
  }).setView([31.23, 121.47], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(map);

  deviceLayer = L.layerGroup().addTo(map);
  alertLayer = L.layerGroup().addTo(map);

  renderDevicesOnMap();
  renderTrajectoryOnMap();
}

function renderDevicesOnMap() {
  if (!deviceLayer) return;
  deviceLayer.clearLayers();
  alertLayer.clearLayers();

  state.devices.forEach((d) => {
    const color = d.status === 'alert' ? '#f97373' : d.status === 'offline' ? '#9ca3af' : '#22c55e';
    const marker = L.circleMarker([d.lat, d.lng], {
      radius: 5,
      color,
      fillColor: color,
      fillOpacity: 0.9,
    }).addTo(deviceLayer);
    marker.bindPopup(
      `设备 ${d.id}<br>状态：${d.status}<br>电量：${d.battery}%<br>信号：${d.signal}<br>最后活跃：${new Date(
        d.lastActiveAt
      ).toLocaleTimeString()}`
    );

    if (d.status === 'alert') {
      const alertCircle = L.circle([d.lat, d.lng], {
        radius: 300,
        color: '#f97373',
        weight: 1,
        opacity: 0.6,
        fillOpacity: 0,
      }).addTo(alertLayer);
      alertCircle._isPulse = true;
    }
  });
}

function renderTrajectoryOnMap() {
  if (!map || state.trajectory.length < 2) return;
  const latlngs = state.trajectory.map((p) => [p.lat, p.lng]);
  if (trajectoryLine) {
    map.removeLayer(trajectoryLine);
  }
  trajectoryLine = L.polyline(latlngs, {
    color: '#38bdf8',
    weight: 3,
    opacity: 0.8,
    dashArray: '6 6',
  }).addTo(map);

  const bounds = L.latLngBounds(latlngs);
  map.fitBounds(bounds, { padding: [20, 20] });

  const info = document.getElementById('trajectory-info');
  info.textContent = `示例用户从设备 ${state.trajectory[0].id || '起点'} 出发，完成一次约 ${(Math.random() * 3 + 1).toFixed(
    1
  )} 公里的护航导航。`;
}

// KPI 卡片
function updateKpis() {
  const online = state.devices.filter((d) => d.status !== 'offline').length;
  document.getElementById('kpi-online-devices').textContent = String(online);
  document.getElementById('kpi-distance').textContent = (200 + Math.random() * 80).toFixed(1);
  document.getElementById('kpi-ai-accuracy').textContent = `${(92 + Math.random() * 4).toFixed(1)}%`;
  document.getElementById('kpi-community-response').textContent = `${(88 + Math.random() * 6).toFixed(1)}%`;
}

// 设备表格
function renderDeviceTable() {
  const tbody = document.getElementById('device-table-body');
  tbody.innerHTML = '';
  const list = state.devices.slice().sort((a, b) => a.battery - b.battery);
  list.forEach((d) => {
    const tr = document.createElement('tr');
    const statusText = d.status === 'online' ? '在线' : d.status === 'offline' ? '离线' : '告警';
    tr.innerHTML = `
      <td>${d.id}</td>
      <td>${d.battery}%</td>
      <td>${'▮'.repeat(d.signal)}</td>
      <td><span class="device-badge ${d.status}">${statusText}</span></td>
      <td>${new Date(d.lastActiveAt).toLocaleTimeString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// AI 光谱图
let aiSpectrumChart;

function initAiSpectrumChart() {
  aiSpectrumChart = echarts.init(document.getElementById('ai-spectrum'));
  updateAiSpectrumChart();
}

function updateAiSpectrumChart() {
  if (!aiSpectrumChart) return;
  const categories = ['行人', '车辆', '台阶', '障碍物'];
  const counts = categories.map((c) => {
    return state.aiStats
      .filter((s) => s.category === c)
      .slice(-6)
      .reduce((sum, s) => sum + s.count, 0);
  });
  const option = {
    grid: { left: 30, right: 10, top: 20, bottom: 20 },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: '#64748b' } },
      axisLabel: { color: '#cbd5f5' },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.26)' } },
      axisLabel: { color: '#cbd5f5' },
    },
    series: [
      {
        type: 'bar',
        data: counts,
        barWidth: 22,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#38bdf8' },
            { offset: 1, color: '#1d4ed8' },
          ]),
        },
      },
    ],
  };
  aiSpectrumChart.setOption(option);
}

// 热力图（简化为社区活跃柱状图）
let heatChart;

function initHeatChart() {
  heatChart = echarts.init(document.getElementById('heatmap-chart'));
  const option = {
    grid: { left: 35, right: 10, top: 10, bottom: 20 },
    xAxis: {
      type: 'category',
      data: state.communityHeat.map((r) => r.regionId),
      axisLabel: { color: '#cbd5f5', fontSize: 10 },
      axisLine: { lineStyle: { color: '#64748b' } },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.26)' } },
      axisLabel: { color: '#cbd5f5', fontSize: 10 },
    },
    series: [
      {
        type: 'bar',
        data: state.communityHeat.map((r) => (r.intensity * 100).toFixed(0)),
        barWidth: 12,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#34d399' },
            { offset: 1, color: '#15803d' },
          ]),
        },
      },
    ],
  };
  heatChart.setOption(option);
}

// 服务质量仪表盘
let gaugeResponse;
let gaugeSatisfaction;
let gaugeSuccess;
let focusChart;
let focusMode = null;

function initGauges() {
  gaugeResponse = echarts.init(document.getElementById('gauge-response-time'));
  gaugeSatisfaction = echarts.init(document.getElementById('gauge-satisfaction'));
  gaugeSuccess = echarts.init(document.getElementById('gauge-success'));
  updateGauges();
}

function gaugeOption(name, value, min, max, unit) {
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min,
        max,
        splitNumber: 4,
        axisLine: {
          lineStyle: {
            width: 8,
            color: [
              [0.25, '#ef4444'],
              [0.5, '#fbbf24'],
              [0.75, '#22c55e'],
              [1, '#22c55e'],
            ],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: true, length: '70%' },
        detail: {
          valueAnimation: true,
          formatter: (v) => `${v.toFixed(0)}${unit}`,
          color: '#e5e7eb',
          fontSize: 12,
        },
        title: {
          show: true,
          offsetCenter: [0, '65%'],
          color: '#9ca3af',
          fontSize: 10,
        },
        data: [{ value, name }],
      },
    ],
  };
}

function updateGauges() {
  if (!gaugeResponse) return;
  const rt = state.serviceQuality.averageResponseTime + (Math.random() - 0.5) * 2;
  const sat = state.serviceQuality.satisfaction + (Math.random() - 0.5) * 2;
  const success = state.serviceQuality.successRate + (Math.random() - 0.5) * 1.5;

  gaugeResponse.setOption(gaugeOption('平均响应(秒)', Math.max(5, Math.min(30, rt)), 0, 40, ''));
  gaugeSatisfaction.setOption(gaugeOption('满意度', Math.max(80, Math.min(100, sat)), 0, 100, '%'));
  gaugeSuccess.setOption(gaugeOption('完成率', Math.max(85, Math.min(100, success)), 0, 100, '%'));
}

function initFocusOverlay() {
  const chartEl = document.getElementById('focus-chart');
  if (chartEl) {
    focusChart = echarts.init(chartEl);
  }

  const overlay = document.getElementById('focus-overlay');
  const closeBtn = document.getElementById('focus-close');
  if (overlay && closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      focusMode = null;
    });
  }
}

function openFocusOverlay(mode) {
  const overlay = document.getElementById('focus-overlay');
  const titleEl = document.getElementById('focus-title');
  const chartEl = document.getElementById('focus-chart');
  const logEl = document.getElementById('focus-log');
  if (!overlay || !titleEl || !chartEl || !logEl) return;

  focusMode = mode;
  overlay.classList.remove('hidden');
  chartEl.style.display = 'none';
  logEl.style.display = 'none';

  if (mode === 'logs') {
    titleEl.textContent = '全系统实时服务日志监控';
    renderFocusLogs();
  } else if (mode === 'community') {
    titleEl.textContent = '社区组件网站统计概览';
    chartEl.style.display = 'block';
    updateFocusChart();
  } else if (mode === 'glasses') {
    titleEl.textContent = '眼镜管理小程序运行数据';
    chartEl.style.display = 'block';
    updateFocusChart();
  } else if (mode === 'algorithm') {
    titleEl.textContent = '算法与系统负载监控';
    chartEl.style.display = 'block';
    updateFocusChart();
  }
}

function updateFocusChart() {
  if (!focusChart || !focusMode) return;
  const eco = state.ecosystem;
  let option;

  if (focusMode === 'community') {
    option = {
      title: {
        text: '社区用户与解决情况',
        left: 'center',
        textStyle: { color: '#e5e7eb', fontSize: 12 },
      },
      grid: { left: 40, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: ['注册/活跃用户', '已解决帖子'],
        axisLabel: { color: '#cbd5f5' },
        axisLine: { lineStyle: { color: '#64748b' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#cbd5f5' },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.26)' } },
      },
      series: [
        {
          type: 'bar',
          data: [eco.communitySite.users, eco.communitySite.solvedPosts],
          barWidth: 30,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#38bdf8' },
              { offset: 1, color: '#1d4ed8' },
            ]),
          },
        },
      ],
    };
  } else if (focusMode === 'glasses') {
    option = {
      title: {
        text: '眼镜绑定与固件更新',
        left: 'center',
        textStyle: { color: '#e5e7eb', fontSize: 12 },
      },
      grid: { left: 40, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: ['已绑定眼镜', '今日固件更新'],
        axisLabel: { color: '#cbd5f5' },
        axisLine: { lineStyle: { color: '#64748b' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#cbd5f5' },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.26)' } },
      },
      series: [
        {
          type: 'bar',
          data: [eco.glassesApp.bindedGlasses, eco.glassesApp.todayUpdates],
          barWidth: 30,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#34d399' },
              { offset: 1, color: '#15803d' },
            ]),
          },
        },
      ],
    };
  } else if (focusMode === 'algorithm') {
    option = {
      title: {
        text: '算法推理吞吐 QPS',
        left: 'center',
        textStyle: { color: '#e5e7eb', fontSize: 12 },
      },
      grid: { left: 40, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: ['当前 QPS'],
        axisLabel: { color: '#cbd5f5' },
        axisLine: { lineStyle: { color: '#64748b' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#cbd5f5' },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.26)' } },
      },
      series: [
        {
          type: 'bar',
          data: [eco.algorithm.qps],
          barWidth: 30,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#f97373' },
              { offset: 1, color: '#facc15' },
            ]),
          },
        },
      ],
    };
  }

  if (option) {
    focusChart.setOption(option, true);
  }
}

function renderFocusLogs() {
  const logContainer = document.getElementById('focus-log');
  const chartEl = document.getElementById('focus-chart');
  if (!logContainer || !chartEl) return;

  chartEl.style.display = 'none';
  logContainer.style.display = 'block';
  logContainer.innerHTML = '';

  state.serviceLogs.slice(0, 30).forEach((log) => {
    const div = document.createElement('div');
    div.className = 'service-item';
    const typeText = {
      help: '求助',
      navigation: '导航',
      community: '互助',
    };
    div.innerHTML = `
      <div>
        <div class="service-item-type">${typeText[log.type] || '事件'} · 设备 ${log.deviceId} · 用户 ${log.userId}</div>
        <div class="service-item-desc">${log.description}</div>
      </div>
      <div class="service-item-time">${log.time}</div>
    `;
    logContainer.appendChild(div);
  });
}

// 服务流水
function renderServiceLogs() {
  const container = document.getElementById('service-log');
  container.innerHTML = '';
  state.serviceLogs.slice(0, 12).forEach((log) => {
    const div = document.createElement('div');
    div.className = 'service-item';
    const typeClasses = {
      help: 'help',
      navigation: 'navigation',
      community: 'community',
    };
    const typeText = {
      help: '求助',
      navigation: '导航',
      community: '互助',
    };
    div.innerHTML = `
      <div>
        <div class="service-item-type ${typeClasses[log.type]}">${typeText[log.type]} · 设备 ${log.deviceId} · 用户 ${log.userId}</div>
        <div class="service-item-desc">${log.description}</div>
      </div>
      <div class="service-item-time">${log.time}</div>
    `;
    container.appendChild(div);
  });
}

// 生态总览面板
function updateEcosystemPanel() {
  const eco = state.ecosystem;
  const communityUsers = document.getElementById('eco-community-users');
  const communityPosts = document.getElementById('eco-community-posts');
  const glassesBinded = document.getElementById('eco-glasses-binded');
  const glassesUpdates = document.getElementById('eco-glasses-updates');
  const algoVersion = document.getElementById('eco-algo-version');
  const algoQps = document.getElementById('eco-algo-qps');

  if (!communityUsers) return;

  communityUsers.textContent = `${eco.communitySite.users} 人`;
  communityPosts.textContent = `已解决帖子 ${eco.communitySite.solvedPosts} 条`;
  glassesBinded.textContent = `${eco.glassesApp.bindedGlasses} 副`;
  glassesUpdates.textContent = `今日固件更新 ${eco.glassesApp.todayUpdates} 次`;
  algoVersion.textContent = `当前模型 ${eco.algorithm.version}`;
  algoQps.textContent = `推理吞吐约 ${eco.algorithm.qps} QPS`;
}

// 智能诊断
function updateDiagnosis() {
  const diagnosis = document.getElementById('ai-diagnosis');
  const nowHour = new Date().getHours();
  const segment = nowHour >= 14 && nowHour <= 18 ? '下午光线变化时段' : '当前时段';
  diagnosis.textContent = `${segment}，低对比度场景下障碍物识别置信度较日常平均略有下降，建议在该时段采集更多样本并适当提高安全冗余系数。`;
}

// AI 控制台
function initAiConsole() {
  const questionInput = document.getElementById('ai-question');
  const btnAsk = document.getElementById('btn-ask');
  const answer = document.getElementById('ai-answer');

  const handleAsk = () => {
    const q = questionInput.value.trim();
    if (!q) return;
    // 仅做规则匹配演示
    if (q.includes('3号设备') || q.includes('3 号设备') || q.includes('D03')) {
      const logs = state.serviceLogs
        .filter((l) => l.deviceId === 'D03')
        .slice(0, 5)
        .map((l) => `${l.time} · ${l.description}`)
        .join('；');
      answer.textContent = logs
        ? `3 号设备今日关键日志：${logs}`
        : '3 号设备今日暂无明显告警日志。';
    } else if (q.includes('社区') || q.includes('组件网站')) {
      answer.textContent = '已放大展示社区组件网站的统计数据。';
      openFocusOverlay('community');
    } else if (q.includes('眼镜') || q.includes('小程序')) {
      answer.textContent = '已放大展示眼镜管理小程序运行数据。';
      openFocusOverlay('glasses');
    } else if (q.includes('算法') || q.includes('模型') || q.includes('系统负载')) {
      answer.textContent = '已放大展示算法与系统负载监控。';
      openFocusOverlay('algorithm');
    } else if (q.includes('日志') || q.includes('流水') || q.includes('监控')) {
      answer.textContent = '已切换到全系统实时服务日志监控视图。';
      openFocusOverlay('logs');
    } else {
      answer.textContent = '已根据指令筛选相关日志并在左侧列表与右侧流水中高亮呈现（演示模式下为模拟效果）。';
    }
  };

  btnAsk.addEventListener('click', handleAsk);
  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAsk();
  });
}

// 预测性指令
function initPredictionCard() {
  const text = document.getElementById('predict-text');
  const btn = document.getElementById('btn-execute-predict');
  const devicesText = state.prediction.devices.join('、');
  text.textContent = `预测未来 ${state.prediction.hours} 小时内，将有 ${state.prediction.devices.length} 台设备（${devicesText}）进入低电量状态，是否一键发送提醒？`;

  btn.addEventListener('click', () => {
    // 点击后在服务流水中插入一条记录
    const now = new Date();
    state.serviceLogs.unshift({
      id: `P-${now.getTime()}`,
      time: now.toTimeString().substring(0, 8),
      type: 'community',
      userId: '系统',
      deviceId: '-',
      description: `已向 ${devicesText} 发送低电量提醒。`,
    });
    renderServiceLogs();
  });
}

// 删除 tick 函数中的模拟数据更新，改为只更新UI（数据由后端推送）
// 此函数已无用，数据更新由 WebSocket 实时推送

function onResize() {
  aiSpectrumChart && aiSpectrumChart.resize();
  heatChart && heatChart.resize();
  gaugeResponse && gaugeResponse.resize();
  gaugeSatisfaction && gaugeSatisfaction.resize();
  gaugeSuccess && gaugeSuccess.resize();
  focusChart && focusChart.resize();
}

window.addEventListener('load', () => {
  initSystemTime();
  initMap();
  initAiSpectrumChart();
  initHeatChart();
  initGauges();
  initAiConsole();
  initPredictionCard();
  initFocusOverlay();
  
  // 连接后端 WebSocket
  connectBackend();

  window.addEventListener('resize', onResize);
});

// Backend configuration for dashboard service
// External keys/URLs can be filled later or via environment variables.

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
    communityApiBase: process.env.COMMUNITY_API_BASE || 'https://help.hlw.work/api',
    miniprogramApiBase: process.env.MINIPROGRAM_API_BASE || '',
    algorithmApiBase: process.env.ALGORITHM_API_BASE || '',
    glassesServerBase: process.env.GLASSES_SERVER_BASE || 'http://a.yesfrp0.asia:45464',
  },
};

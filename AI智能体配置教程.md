# 可视化大屏 AI 智能体配置教程

## 功能说明

大屏支持通过自然语言指令动态调取数据，例如：
- "帮我看一下社区网站今天的数据"
- "眼镜小程序运行得怎么样"
- "查询GLASSES_001设备的日志"
- "算法系统负载高吗"

## 配置步骤

### 1. 获取 AI 服务密钥

选择以下任一平台：

**阿里通义千问（推荐）**
- 访问：https://dashscope.console.aliyun.com/
- 创建应用 → 获取 API Key

**OpenAI**
- 访问：https://platform.openai.com/api-keys
- 创建 API Key

**其他兼容 OpenAI 接口的服务**
- 如 Moonshot、DeepSeek 等

### 2. 配置环境变量

编辑 `G:\WEBSE\.env` 文件，添加以下配置：

```env
# ========== AI 智能体配置 ==========

# 阿里通义千问
ASSISTANT_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
ASSISTANT_API_KEY=你的通义千问密钥

# 或使用 OpenAI
# ASSISTANT_API_URL=https://api.openai.com/v1/chat/completions
# ASSISTANT_API_KEY=sk-你的OpenAI密钥

# 或使用 Moonshot
# ASSISTANT_API_URL=https://api.moonshot.cn/v1/chat/completions
# ASSISTANT_API_KEY=你的Moonshot密钥
```

### 3. 重启大屏服务

```powershell
cd G:\WEBSE
npm start
```

### 4. 测试智能体

在大屏右下角的 AI 控制台输入任意指令，例如：
- "展示社区数据"
- "小程序今天有多少更新"
- "看看算法系统"

## 支持的指令模块

| 模块 | 触发词示例 | 功能 |
|------|-----------|------|
| community | 社区、组件网站 | 放大展示社区组件网站统计 |
| glasses | 眼镜、小程序 | 放大展示眼镜小程序数据 |
| algorithm | 算法、模型、负载 | 放大展示AI算法监控 |
| logs | 日志、流水、监控 | 切换到全系统日志视图 |
| device | 设备ID | 查询具体设备的日志 |

## 降级机制

当 AI 服务未配置或调用失败时，系统自动切换到关键词匹配模式：

- 检测到"社区"关键词 → 显示社区数据
- 检测到"眼镜"关键词 → 显示小程序数据
- 检测到"算法"关键词 → 显示算法监控
- 检测到"日志"关键词 → 显示日志流水

## 常见问题

### Q: 输入指令没有反应？

1. 检查 `.env` 文件中 `ASSISTANT_API_URL` 和 `ASSISTANT_API_KEY` 是否配置正确
2. 确认 API 密钥有效且有余额
3. 查看后端控制台是否有错误日志

### Q: AI 响应很慢？

这取决于所使用的 AI 服务响应速度，可以：
- 使用国内服务（如通义千问）减少网络延迟
- 降级到关键词匹配模式（删除 AI 配置）

### Q: 如何切换 AI 服务？

修改 `.env` 文件中的 `ASSISTANT_API_URL` 和 `ASSISTANT_API_KEY`，然后重启服务即可。

## 技术架构

```
用户输入指令
    ↓
/api/ai/command 接口
    ↓
尝试调用 AI 服务 (callAIAgent)
    ↓
成功 → 解析 JSON 响应 → 执行对应操作
失败 → 降级到关键词匹配 → 执行对应操作
    ↓
返回 { answerText, focusMode }
    ↓
前端更新视图
```

## 相关文件

- 后端逻辑：`G:\WEBSE\server.js`
- 环境配置：`G:\WEBSE\.env`
- 配置模板：`G:\WEBSE\backend.config.js`

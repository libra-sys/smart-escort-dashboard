# AI 指令接入状态

目前有两条独立路径：

1. `main.js` 的浏览器控制台：本地关键词匹配与模块放大，没有请求后端 AI 接口。
2. `server.js` 的 `POST /api/ai/command`：尝试外部 AI，失败时关键词降级。

因此仅填密钥并重启后端，不会让现有浏览器控制台自动变成真实 AI 对话。

本地 `.env` 可设置 `ASSISTANT_API_URL` 和 `ASSISTANT_API_KEY`。当前请求含 `messages` 但没有 `model`，需按目标服务核对字段；不保证直接兼容所有提供商。密钥只能放后端，不提交 Git。

接口请求示例：`{"text":"展示社区数据"}`；返回 `answerText` 与 `focusMode`。关键词降级也会返回答案，因此不能凭答案判定外部模型调用成功。

前端接线与真实服务验证仍待实施。本轮未调用外部 AI。完整边界见 [README](README.md#演示逻辑与尚未完成的范围)。

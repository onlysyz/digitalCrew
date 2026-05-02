# DigitalCrew

本地多 Agent 协同数字员工工作台 / Local Multi-Agent Collaboration Platform

## 项目概述

DigitalCrew 是一个本地优先的多 Agent 协同工作台，让用户可以创建、调度和协调多个 AI Agent 来完成复杂任务。所有数据完全留存在本地，不上传任何服务器。

### 核心特性

- **多 Agent 协同**：主管 Agent 负责任务拆解与调度，多个工作 Agent 并行执行
- **本地运行**：支持 Ollama 本地模型，数据完全本地存储
- **灵活工具**：内置文件读写、代码执行、网络搜索等工具，支持 MCP 扩展
- **三层记忆**：工作记忆 + 情景记忆 + 知识库，Agent 具备持续学习能力
- **可视化界面**：团队概览、对话面板、任务中心、资源监控

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS |
| 后端 | Python 3.11 + FastAPI |
| Agent 编排 | LangGraph |
| 存储 | SQLite (结构化) + ChromaDB (向量) |
| 本地模型 | Ollama |

## 快速开始

### 使用 Docker Compose（推荐）

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问 http://localhost:3000

### 手动启动

#### 1. 启动后端

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 7700 --host 127.0.0.1
```

### 2. 启动前端

```bash
npm install
npm run dev
```

访问 http://localhost:3000

### 3. 配置 Ollama（可选）

```bash
# 安装 Ollama
brew install ollama  # macOS
# 或参考 https://ollama.com/download

# 下载模型
ollama pull llama3
ollama pull nomic-embed-text
```

## 目录结构

```
digitalCrew/
├── backend/              # Python FastAPI 后端
│   ├── api/
│   │   └── routes/       # API 路由（agents, tasks, chat, knowledge, tools, system）
│   ├── core/            # 核心模块
│   ├── models/          # 数据模型（Pydantic schemas）
│   ├── services/         # 业务服务
│   ├── tools/           # 工具实现
│   ├── memory/           # 记忆系统
│   └── main.py          # FastAPI 应用入口
├── src/                 # React 前端
│   ├── components/       # UI 组件
│   ├── pages/           # 页面
│   ├── stores/           # Zustand 状态管理
│   ├── services/         # API 调用层
│   └── types/           # TypeScript 类型
└── prd.md              # 产品需求文档
```

## API 文档

后端启动后访问：
- Swagger UI: http://localhost:7700/api/docs
- ReDoc: http://localhost:7700/api/redoc

### 主要 API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/v1/agents` | 列出所有 Agent |
| `POST /api/v1/agents` | 创建新 Agent |
| `POST /api/v1/tasks` | 提交任务 |
| `POST /api/v1/chat/team` | 团队对话（主管模式） |
| `GET /api/v1/knowledge` | 知识库列表 |
| `GET /api/v1/tools` | 可用工具列表 |
| `GET /api/v1/system/resources` | 系统资源监控 |

## 开发计划

- [x] 项目架构设计
- [x] 后端 API 框架搭建
- [x] 前端状态管理和服务层
- [x] Agent 运行时实现
- [x] LLM 路由层（Ollama + OpenAI）
- [x] 工具系统实现
- [x] 记忆与知识库模块
- [x] 前端页面完善
- [x] 多 Agent 协同
- [x] 打包部署（Docker Compose + 用户引导向导）

## License

MIT
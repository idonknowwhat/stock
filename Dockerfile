# ========== 阶段1: 构建前端 ==========
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:20-slim
FROM ${NODE_IMAGE} AS frontend-builder

WORKDIR /app/stock-analyzer

# 复制前端依赖文件
COPY stock-analyzer/package.json stock-analyzer/package-lock.json* ./

# 安装前端依赖
RUN npm install

# 复制前端源码
COPY stock-analyzer/ ./

# 构建前端
RUN npm run build

# ========== 阶段2: 运行环境 ==========
ARG NODE_IMAGE
FROM ${NODE_IMAGE}

# 设置时区为北京时间
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 设置工作目录
WORKDIR /app

# 复制后端服务器文件和依赖
COPY stock-analyzer/chatHistoryServer.js ./stock-analyzer/
COPY stock-analyzer/package.json ./stock-analyzer/

# 从前端构建阶段复制构建产物
COPY --from=frontend-builder /app/stock-analyzer/dist ./stock-analyzer/dist

# 安装生产依赖（仅后端需要的）
WORKDIR /app/stock-analyzer
RUN npm install --production --no-cache

# 创建必要的目录
WORKDIR /app
RUN mkdir -p chat_history export

# 暴露端口
EXPOSE 3001

# 运行服务器
WORKDIR /app/stock-analyzer
CMD ["node", "chatHistoryServer.js"]

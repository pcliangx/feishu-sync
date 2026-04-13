# Feishu Sync

将 Markdown 文件同步到飞书文档，支持 Mermaid 图表自动渲染。

## 功能特点

- **Markdown 转飞书文档** - 支持标题、列表、代码块、表格等
- **Mermaid 图表渲染** - 自动将 `mermaid` 代码块渲染为图片
- **批量块插入** - 自动分批插入（每批 50 个，符合飞书 API 限制）
- **图片自动上传** - Mermaid 图表自动上传到飞书云文档

## 安装

```bash
npm install
```

## 配置

创建 `.env` 文件：

```bash
FEISHU_APP_ID=你的飞书应用ID
FEISHU_APP_SECRET=你的飞书应用密钥
FEISHU_FOLDER_TOKEN=可选，文档所在文件夹token
```

### 获取飞书 API 凭证

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建应用 → 获取 `App ID` 和 `App Secret`
3. 开通权限：`docx` (文档读写)、`drive` (云文档)

## 使用

### 命令行

```bash
# 开发模式（直接运行 TypeScript）
npm run dev -- your-file.md

# 构建并运行
npm run build
npm run start -- your-file.md

# 带选项
npm run start -- your-file.md --title "文档标题"
```

### Claude Code Skill

将项目作为 Skill 使用：

```
~/.claude/skills/feishu-sync/
```

在 Claude Code 中直接说：
- `/feishu-sync`
- "同步 markdown 到飞书"

## 打包分发

```bash
# 1. 编译 TypeScript
npm run build

# 2. 使用 esbuild 打包
./node_modules/.bin/esbuild src/index.ts --bundle --platform=node \
  --external:sharp --external:@sparticuz/chromium \
  --external:puppeteer-core --external:graphviz \
  --outfile=dist/bundle.js

# 3. 使用 pkg 生成可执行文件
./node_modules/.bin/pkg dist/bundle.js --targets node18-macos-x64 --output feishu-sync

# 4. 运行
FEISHU_APP_ID=xxx FEISHU_APP_SECRET=xxx ./feishu-sync your-file.md
```

## 项目结构

```
src/
├── index.ts           # CLI 入口
├── skill.ts           # 主同步逻辑
├── config/            # 环境变量配置
├── feishu/
│   ├── client.ts      # 飞书 SDK 客户端
│   ├── document.ts    # 创建文档
│   ├── blocks.ts      # 块类型定义
│   └── media.ts       # 图片上传
├── markdown/
│   ├── extractor.ts   # 提取 Mermaid 块
│   ├── parser.ts      # Markdown 解析
│   └── transformer.ts # 转换为飞书块
└── diagrams/
    ├── detector.ts    # 检测 Mermaid
    ├── renderer.ts    # 渲染为 PNG
    └── uploader.ts    # 上传图表
```

## Mermaid 示例

````markdown
```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do Something]
    B -->|No| D[End]
```
````

渲染结果会自动上传到飞书文档中显示为图片。

## API 参考

| 环境变量 | 说明 | 必需 |
|---------|------|------|
| `FEISHU_APP_ID` | 飞书应用 ID | 是 |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | 是 |
| `FEISHU_FOLDER_TOKEN` | 文件夹 Token | 否 |

## License

MIT

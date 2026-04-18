# ForgeKit

一套纯浏览器端的开发者在线工具箱，打开即用，数据不离开浏览器。

## 在线工具

| 分类 | 工具 | 说明 |
|------|------|------|
| 数据 | JSON Formatter | 格式化、校验 JSON，即时错误反馈 |
| 数据 | JSON-YAML Converter | JSON 与 YAML 双向转换 |
| 比较 | JSON Diff | 两份 JSON 并排对比，语法高亮 |
| 数据 | Regex Tester | 正则测试，匹配索引与捕获组 |
| 时间 | Timestamp Converter | Unix 时间戳与可读日期互转 |
| 编码 | Base64 Encoder | Base64 编解码，完整 UTF-8 支持 |
| 编码 | URL Encoder | URL 组件编解码 |
| 编码 | Hash Generator | SHA-1/256/384/512 哈希（Web Crypto API） |
| 认证 | JWT Decoder | 本地解码 JWT Header 与 Payload |
| 生成 | UUID Generator | 批量生成 UUID v4（1-50 个） |
| 生成 | QR Code Generator | 生成 URL/文本/Wi-Fi 二维码，可下载 PNG |
| 媒体 | Image Cropper | 上传、裁剪、标注（Fabric.js 画笔）、导出 PNG |

所有工具均在客户端运行，不发送任何数据到服务器。

## 技术栈

- **框架**：Next.js 15（App Router、SSG）
- **语言**：TypeScript 5.7
- **UI**：React 18 + Tailwind CSS 3.4
- **编辑器**：CodeMirror 6
- **国际化**：中文 / English 双语

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

## 构建

```bash
npm run build   # 静态生成所有语言和工具页面
npm run start   # 启动生产服务
```

## 项目结构

```
src/
  app/
    [locale]/           # 国际化路由（zh / en）
      tools/
        [slug]/page.tsx # 单个工具页面
  components/
    tools/              # 12 个工具组件
    ui/                 # 基础 UI 组件
    tool-shell.tsx      # 通用输入/输出面板
  data/
    tools.ts            # 工具定义与分类
  lib/
    i18n.ts             # 双语字典
    utils.ts            # 工具函数
```

## License

MIT

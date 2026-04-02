import type { ToolCategory, ToolDefinition } from "@/data/tools";

export const locales = ["zh", "en"] as const;

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getDefaultLocale(): Locale {
  return "zh";
}

export const categoryLabels: Record<Locale, Record<ToolCategory, string>> = {
  zh: {
    Data: "数据",
    Encoding: "编码",
    Auth: "认证",
    Generators: "生成",
    Time: "时间",
    Comparison: "对比",
    Media: "媒体"
  },
  en: {
    Data: "Data",
    Encoding: "Encoding",
    Auth: "Auth",
    Generators: "Generators",
    Time: "Time",
    Comparison: "Comparison",
    Media: "Media"
  }
};

export const categoryDescriptions: Record<Locale, Record<ToolCategory, string>> = {
  zh: {
    Data: "查看、格式化和校验日常开发中的常见数据载荷。",
    Encoding: "在浏览器内完成编码和解码，不用反复切终端。",
    Auth: "本地打开 token，快速理解认证层返回了什么。",
    Generators: "为测试、演示和 fixture 生成稳定可用的值。",
    Time: "在时间戳、UTC 和日期字符串之间快速转换。",
    Comparison: "快速比较两个结构化结果，定位字段增删改。",
    Media: "直接生成开发和分享场景里常用的可视化输出。"
  },
  en: {
    Data: "Inspect, format, and validate payloads you touch every day.",
    Encoding: "Encode and decode values without jumping between terminal snippets.",
    Auth: "Open tokens locally and understand what your auth layer is doing.",
    Generators: "Create realistic IDs and values for fixtures, demos, and tests.",
    Time: "Translate timestamps, UTC strings, and deadlines without guesswork.",
    Comparison: "Compare structured data and pinpoint field-level changes quickly.",
    Media: "Generate visual outputs that fit common development and sharing workflows."
  }
};

export const dictionary = {
  zh: {
    siteTitle: "Dev Toolbox",
    siteTagline: "面向所有程序员的常用在线工具",
    nav: {
      home: "首页",
      tools: "工具"
    },
    localeSwitch: {
      zh: "中文",
      en: "English"
    },
    footer: {
      left: "快速、稳定、可直接使用的开发者在线工具。",
      right: "支持中文与英文，适合前端、接口联调和日常数据处理。"
    },
    home: {
      badge: "Developer Tools",
      title: "ForgeKit",
      description:
        "打开即用，覆盖格式化、解码、转换、生成和调试等高频场景，适合前端、后端、测试、运维和独立开发者的日常工作。",
      browse: "浏览工具",
      openFeatured: "打开 JSON Formatter",
      featured: "精选工具",
      featuredTitle: "高频、直接、可立即使用",
      viewAll: "查看全部工具"
    },
    toolsPage: {
      badge: "工具库",
      title: "适合日常开发的实用工具",
      description: "先覆盖浏览器内即可完成的高频调试、转换和格式化场景。",
      searchPlaceholder: "搜索工具名、描述或关键词",
      allCategories: "全部分类",
      emptyTitle: "没有找到匹配的工具",
      emptyDescription: "试试更短的关键词，或者切换到其他分类。"
    },
    toolCard: {
      open: "进入"
    },
    toolPage: {
      useCasesTitle: "适用场景"
    },
    toolUi: {
      run: "执行",
      clear: "清空",
      copy: "复制",
      resultPlaceholder: "结果会显示在这里。"
    }
  },
  en: {
    siteTitle: "Dev Toolbox",
    siteTagline: "Online utilities for all programmers",
    nav: {
      home: "Home",
      tools: "Tools"
    },
    localeSwitch: {
      zh: "中文",
      en: "English"
    },
    footer: {
      left: "Fast, stable developer utilities that work right away.",
      right: "Bilingual support for frontend work, API debugging, and daily data handling."
    },
    home: {
      badge: "Developer Tools",
      title: "ForgeKit",
      description:
        "Open a tool and use it immediately. The library covers formatting, decoding, conversion, generation, and debugging workflows for frontend, backend, QA, DevOps, and indie development.",
      browse: "Browse Tools",
      openFeatured: "Open JSON Formatter",
      featured: "Featured",
      featuredTitle: "Fast, direct, and ready to use",
      viewAll: "View all tools"
    },
    toolsPage: {
      badge: "Tool Library",
      title: "Daily utilities for developers",
      description:
        "The first release focuses on fast browser-side tools for high-frequency debugging and payload handling tasks.",
      searchPlaceholder: "Search by tool name, description, or keyword",
      allCategories: "All categories",
      emptyTitle: "No matching tools found",
      emptyDescription: "Try a shorter keyword or switch to another category."
    },
    toolCard: {
      open: "Open"
    },
    toolPage: {
      useCasesTitle: "Use cases"
    },
    toolUi: {
      run: "Run",
      clear: "Clear",
      copy: "Copy",
      resultPlaceholder: "Result will appear here."
    }
  }
} as const;

type ToolTranslation = {
  name: string;
  description: string;
  keywords: string[];
  useCases: string[];
};

const toolTranslations: Record<Locale, Record<ToolDefinition["slug"], ToolTranslation>> = {
  zh: {
    "json-formatter": {
      name: "JSON Formatter",
      description: "本地格式化、校验和压缩 JSON，适合调试接口返回和配置文件。",
      keywords: ["json 格式化", "json 校验", "json 美化"],
      useCases: ["调试接口响应", "整理分享前的 payload", "校验配置文件"]
    },
    "timestamp-converter": {
      name: "Timestamp Converter",
      description: "双向转换 Unix 时间戳和可读日期，适合日志、数据库和接口联调。",
      keywords: ["时间戳转换", "unix 时间", "epoch 转换"],
      useCases: ["查看后端事件时间", "生成未来时间戳", "核对 UTC 格式"]
    },
    "base64-encoder": {
      name: "Base64 Encoder",
      description: "在浏览器内安全地进行 Base64 编码与解码。",
      keywords: ["base64 编码", "base64 解码", "base64 工具"],
      useCases: ["检查 token 内容", "转换文本 payload", "排查编码字符串"]
    },
    "url-encoder": {
      name: "URL Encoder",
      description: "编码或解码 query、path 和 URL 中的特殊字符。",
      keywords: ["url 编码", "url 解码", "percent encode"],
      useCases: ["构造查询参数", "查看跳转链接", "转义特殊字符"]
    },
    "jwt-decoder": {
      name: "JWT Decoder",
      description: "本地解析 JWT 的 header 和 payload，不向服务端发送内容。",
      keywords: ["jwt 解析", "token 查看", "jwt decode"],
      useCases: ["查看认证载荷", "检查 token 过期时间", "验证自定义 claims"]
    },
    "uuid-generator": {
      name: "UUID Generator",
      description: "批量生成 UUID v4，适合本地测试数据和 fixture。",
      keywords: ["uuid 生成", "uuid v4", "随机 id"],
      useCases: ["初始化数据库", "生成 fixture", "创建请求标识"]
    },
    "json-diff": {
      name: "JSON Diff",
      description: "比较两段 JSON，快速定位字段新增、删除和修改。",
      keywords: ["json 对比", "json diff", "payload 比较"],
      useCases: ["对比接口返回", "查看配置差异", "检查嵌套对象变化"]
    },
    "qr-code-generator": {
      name: "QR Code Generator",
      description: "为链接、文本和 Wi-Fi 信息生成二维码，适合分享、测试和快速跳转。",
      keywords: ["二维码生成", "qr code", "链接二维码"],
      useCases: ["快速分享链接", "生成 Wi-Fi 二维码", "生成下载跳转二维码"]
    },
    "image-cropper": {
      name: "Image Cropper",
      description: "上传图片后快速裁剪，适合头像、封面图和截图处理。",
      keywords: ["图片裁剪", "image cropper", "裁剪图片"],
      useCases: ["准备头像", "裁剪社媒配图", "快速处理截图"]
    }
  },
  en: {
    "json-formatter": {
      name: "JSON Formatter",
      description: "Format, validate, and minify JSON with instant error feedback.",
      keywords: ["json formatter", "json beautify", "json validate"],
      useCases: ["Debug API responses", "Clean payloads before sharing", "Validate config files"]
    },
    "timestamp-converter": {
      name: "Timestamp Converter",
      description: "Convert Unix timestamps and readable dates in both directions.",
      keywords: ["timestamp converter", "unix time", "epoch converter"],
      useCases: ["Inspect backend event times", "Generate future timestamps", "Check UTC formatting"]
    },
    "base64-encoder": {
      name: "Base64 Encoder",
      description: "Encode or decode Base64 text safely in the browser.",
      keywords: ["base64 encode", "base64 decode", "base64 tool"],
      useCases: ["Inspect tokens", "Convert payloads", "Debug encoded strings"]
    },
    "url-encoder": {
      name: "URL Encoder",
      description: "Encode and decode query strings, paths, and unsafe URL characters.",
      keywords: ["url encode", "url decode", "percent encode"],
      useCases: ["Build query params", "Inspect redirect URLs", "Escape special characters"]
    },
    "jwt-decoder": {
      name: "JWT Decoder",
      description: "Inspect JWT headers and payloads locally without sending them anywhere.",
      keywords: ["jwt decode", "jwt parser", "token inspector"],
      useCases: ["Inspect auth payloads", "Check token expiry", "Verify custom claims"]
    },
    "uuid-generator": {
      name: "UUID Generator",
      description: "Generate UUID v4 identifiers in batches for test data and fixtures.",
      keywords: ["uuid generator", "uuid v4", "random id"],
      useCases: ["Seed databases", "Generate fixtures", "Create request identifiers"]
    },
    "json-diff": {
      name: "JSON Diff",
      description: "Compare two JSON documents and highlight structural changes instantly.",
      keywords: ["json diff", "json compare", "payload diff"],
      useCases: ["Compare API payloads", "Review config changes", "Inspect nested object updates"]
    },
    "qr-code-generator": {
      name: "QR Code Generator",
      description: "Generate QR codes for URLs, text, Wi-Fi credentials, and app download links.",
      keywords: ["qr code generator", "qrcode", "qr for url"],
      useCases: ["Share links quickly", "Generate Wi-Fi QR codes", "Create download handoff pages"]
    },
    "image-cropper": {
      name: "Image Cropper",
      description: "Crop uploaded images with fixed or freeform ratios and export the result instantly.",
      keywords: ["image cropper", "crop image", "image trim"],
      useCases: ["Prepare avatars", "Cut social share images", "Trim screenshots quickly"]
    }
  }
};

export function getDictionary(locale: Locale) {
  return dictionary[locale];
}

export function localizeTool(tool: ToolDefinition, locale: Locale) {
  return {
    ...tool,
    ...toolTranslations[locale][tool.slug],
    categoryLabel: categoryLabels[locale][tool.category]
  };
}

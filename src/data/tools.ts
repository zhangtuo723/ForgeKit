export type ToolCategory =
  | "Data"
  | "Encoding"
  | "Auth"
  | "Generators"
  | "Time"
  | "Comparison"
  | "Media";

export type ToolDefinition = {
  slug: string;
  name: string;
  category: ToolCategory;
  description: string;
  keywords: string[];
  useCases: string[];
};

export const tools: ToolDefinition[] = [
  {
    slug: "json-formatter",
    name: "JSON Formatter",
    category: "Data",
    description: "Format, validate, and minify JSON with instant error feedback.",
    keywords: ["json formatter", "json beautify", "json validate"],
    useCases: ["Debug API responses", "Clean payloads before sharing", "Validate config files"]
  },
  {
    slug: "timestamp-converter",
    name: "Timestamp Converter",
    category: "Time",
    description: "Convert Unix timestamps and readable dates in both directions.",
    keywords: ["timestamp converter", "unix time", "epoch converter"],
    useCases: ["Inspect backend event times", "Generate future timestamps", "Check UTC formatting"]
  },
  {
    slug: "base64-encoder",
    name: "Base64 Encoder",
    category: "Encoding",
    description: "Encode or decode Base64 text safely in the browser.",
    keywords: ["base64 encode", "base64 decode", "base64 tool"],
    useCases: ["Inspect tokens", "Convert payloads", "Debug encoded strings"]
  },
  {
    slug: "url-encoder",
    name: "URL Encoder",
    category: "Encoding",
    description: "Encode and decode query strings, paths, and unsafe URL characters.",
    keywords: ["url encode", "url decode", "percent encode"],
    useCases: ["Build query params", "Inspect redirect URLs", "Escape special characters"]
  },
  {
    slug: "jwt-decoder",
    name: "JWT Decoder",
    category: "Auth",
    description: "Inspect JWT headers and payloads locally without sending them anywhere.",
    keywords: ["jwt decode", "jwt parser", "token inspector"],
    useCases: ["Inspect auth payloads", "Check token expiry", "Verify custom claims"]
  },
  {
    slug: "uuid-generator",
    name: "UUID Generator",
    category: "Generators",
    description: "Generate UUID v4 identifiers in batches for test data and fixtures.",
    keywords: ["uuid generator", "uuid v4", "random id"],
    useCases: ["Seed databases", "Generate fixtures", "Create request identifiers"]
  },
  {
    slug: "json-diff",
    name: "JSON Diff",
    category: "Comparison",
    description: "Compare two JSON documents and highlight structural changes instantly.",
    keywords: ["json diff", "json compare", "payload diff"],
    useCases: ["Compare API payloads", "Review config changes", "Inspect nested object updates"]
  },
  {
    slug: "qr-code-generator",
    name: "QR Code Generator",
    category: "Media",
    description: "Generate QR codes for URLs, text, Wi-Fi credentials, and app download links.",
    keywords: ["qr code generator", "qrcode", "二维码生成"],
    useCases: ["Share links quickly", "Generate Wi-Fi QR codes", "Create download handoff pages"]
  },
  {
    slug: "image-cropper",
    name: "Image Cropper",
    category: "Media",
    description: "Crop uploaded images with fixed or freeform ratios and export the result instantly.",
    keywords: ["image cropper", "crop image", "图片裁剪"],
    useCases: ["Prepare avatars", "Cut social share images", "Trim screenshots quickly"]
  }
];

export const categories = [
  {
    name: "Data",
    description: "Inspect, format, and validate payloads you touch every day."
  },
  {
    name: "Encoding",
    description: "Encode and decode values without jumping between terminal snippets."
  },
  {
    name: "Auth",
    description: "Open tokens locally and understand what your auth layer is doing."
  },
  {
    name: "Generators",
    description: "Create realistic IDs and values for fixtures, demos, and tests."
  },
  {
    name: "Time",
    description: "Translate timestamps, UTC strings, and deadlines without guesswork."
  },
  {
    name: "Comparison",
    description: "Spot payload and config changes without manually scanning raw JSON."
  },
  {
    name: "Media",
    description: "Generate shareable assets like QR codes directly from developer workflows."
  }
] as const;

export const featuredSlugs = [
  "json-formatter",
  "timestamp-converter",
  "jwt-decoder"
];

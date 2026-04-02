import { Base64EncoderTool } from "@/components/tools/base64-encoder-tool";
import { JsonFormatterTool } from "@/components/tools/json-formatter-tool";
import { JwtDecoderTool } from "@/components/tools/jwt-decoder-tool";
import { TimestampConverterTool } from "@/components/tools/timestamp-converter-tool";
import { UrlEncoderTool } from "@/components/tools/url-encoder-tool";
import { UuidGeneratorTool } from "@/components/tools/uuid-generator-tool";

export function ToolRenderer({ slug }: { slug: string }) {
  switch (slug) {
    case "json-formatter":
      return <JsonFormatterTool />;
    case "timestamp-converter":
      return <TimestampConverterTool />;
    case "base64-encoder":
      return <Base64EncoderTool />;
    case "url-encoder":
      return <UrlEncoderTool />;
    case "jwt-decoder":
      return <JwtDecoderTool />;
    case "uuid-generator":
      return <UuidGeneratorTool />;
    default:
      return null;
  }
}

import { Base64EncoderTool } from "@/components/tools/base64-encoder-tool";
import { ImageCropperTool } from "@/components/tools/image-cropper-tool";
import { JsonFormatterTool } from "@/components/tools/json-formatter-tool";
import { JsonDiffTool } from "@/components/tools/json-diff-tool";
import { JwtDecoderTool } from "@/components/tools/jwt-decoder-tool";
import { QrCodeGeneratorTool } from "@/components/tools/qr-code-generator-tool";
import { TimestampConverterTool } from "@/components/tools/timestamp-converter-tool";
import { UrlEncoderTool } from "@/components/tools/url-encoder-tool";
import { UuidGeneratorTool } from "@/components/tools/uuid-generator-tool";
import { type Locale } from "@/lib/i18n";

export function ToolRenderer({ slug, locale }: { slug: string; locale: Locale }) {
  switch (slug) {
    case "json-formatter":
      return <JsonFormatterTool locale={locale} />;
    case "json-diff":
      return <JsonDiffTool locale={locale} />;
    case "timestamp-converter":
      return <TimestampConverterTool locale={locale} />;
    case "base64-encoder":
      return <Base64EncoderTool locale={locale} />;
    case "image-cropper":
      return <ImageCropperTool locale={locale} />;
    case "url-encoder":
      return <UrlEncoderTool locale={locale} />;
    case "jwt-decoder":
      return <JwtDecoderTool locale={locale} />;
    case "qr-code-generator":
      return <QrCodeGeneratorTool locale={locale} />;
    case "uuid-generator":
      return <UuidGeneratorTool locale={locale} />;
    default:
      return null;
  }
}

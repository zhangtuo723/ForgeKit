"use client";

import { Download, QrCode } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Locale } from "@/lib/i18n";

export function QrCodeGeneratorTool({ locale }: { locale: Locale }) {
  const [value, setValue] = useState("https://forgekit.dev");
  const [size, setSize] = useState(240);
  const [includeMargin, setIncludeMargin] = useState(true);
  const qrRef = useRef<HTMLDivElement>(null);

  const text =
    locale === "zh"
      ? {
          title: "QR Code Generator",
          description: "输入链接、文本或 Wi-Fi 信息，立即生成可下载的二维码。",
          inputLabel: "二维码内容",
          inputPlaceholder: "输入 URL、文本或 Wi-Fi 配置",
          sizeLabel: "尺寸",
          marginLabel: "包含留白",
          previewLabel: "二维码预览",
          download: "下载 PNG",
          examples: "快速示例",
          wifi: "Wi-Fi",
          app: "下载链接",
          text: "普通文本"
        }
      : {
          title: "QR Code Generator",
          description: "Generate QR codes instantly from URLs, text, and Wi-Fi payloads.",
          inputLabel: "QR value",
          inputPlaceholder: "Enter a URL, text, or Wi-Fi payload",
          sizeLabel: "Size",
          marginLabel: "Include margin",
          previewLabel: "QR Preview",
          download: "Download PNG",
          examples: "Quick presets",
          wifi: "Wi-Fi",
          app: "App link",
          text: "Plain text"
        };

  const presets = useMemo(
    () => [
      { label: text.app, value: "https://forgekit.dev/download" },
      { label: text.text, value: locale === "zh" ? "欢迎使用 ForgeKit" : "Welcome to ForgeKit" },
      { label: text.wifi, value: "WIFI:T:WPA;S:ForgeKit Office;P:forgekit123;;" }
    ],
    [locale, text.app, text.text, text.wifi]
  );

  return (
    <section className="grid items-stretch gap-4 xl:grid-cols-[0.95fr,1.05fr]">
      <div className="flex min-h-[560px] flex-col rounded-xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
        <div className="border-b border-white/8 pb-4">
          <h2 className="text-xl font-semibold text-white sm:text-[1.65rem]">{text.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{text.description}</p>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-3 block text-sm font-medium text-slate-300">{text.inputLabel}</label>
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={text.inputPlaceholder}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr,auto] sm:items-end">
            <div>
              <label className="mb-3 block text-sm font-medium text-slate-300">
                {text.sizeLabel}: {size}px
              </label>
              <input
                type="range"
                min={160}
                max={320}
                step={20}
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="w-full accent-cyan-300"
              />
            </div>

            <label className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={includeMargin}
                onChange={(event) => setIncludeMargin(event.target.checked)}
                className="h-4 w-4 accent-cyan-300"
              />
              {text.marginLabel}
            </label>
          </div>
        </div>

        <div className="mt-5 border-t border-white/8 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {text.examples}
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setValue(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-[560px] flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-white/8 pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-sm">
            {text.previewLabel}
          </h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              const canvas = qrRef.current?.querySelector("canvas");
              if (!canvas) return;
              const link = document.createElement("a");
              link.download = "qrcode.png";
              link.href = canvas.toDataURL("image/png");
              link.click();
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            {text.download}
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/60 p-6">
          <div
            ref={qrRef}
            className="flex w-full max-w-[420px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white px-8 py-10 text-slate-950 shadow-[0_18px_48px_rgba(15,23,42,0.24)]"
          >
            <QRCodeCanvas
              value={value || " "}
              size={size}
              includeMargin={includeMargin}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
            <div className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <QrCode className="h-4 w-4" />
              <span className="truncate">{value || "QR Code"}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

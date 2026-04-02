"use client";

import { Canvas, FabricImage, PencilBrush } from "fabric";
import { Download, Paintbrush, RotateCcw, Upload } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
  type PercentCrop,
  type PixelCrop
} from "react-image-crop";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n";

import "react-image-crop/dist/ReactCrop.css";

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 80
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

async function createCroppedResult(image: HTMLImageElement, crop: PixelCrop) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not supported");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = Math.floor(crop.width * scaleX);
  canvas.height = Math.floor(crop.height * scaleY);

  context.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height
  };
}

export function ImageCropperTool({ locale }: { locale: Locale }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<PercentCrop>();
  const [pixelCrop, setPixelCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState({ width: 0, height: 0 });
  const [brushColor, setBrushColor] = useState("#ef4444");
  const [brushWidth, setBrushWidth] = useState(6);
  const [isDrawing, setIsDrawing] = useState(true);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const fabricElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const baseImageRef = useRef<FabricImage | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const brushColorRef = useRef(brushColor);
  const brushWidthRef = useRef(brushWidth);
  const isDrawingRef = useRef(isDrawing);
  const [previewSize, setPreviewSize] = useState({ width: 520, height: 420 });

  const text = useMemo(
    () =>
      locale === "zh"
        ? {
            title: "Image Cropper",
            description: "上传本地图片后自由拖拽裁剪框，裁剪后可直接涂鸦标注并导出。",
            upload: "上传图片",
            replace: "重新选择",
            cropPreview: "裁剪区域",
            result: "裁剪与标注结果",
            download: "下载 PNG",
            empty: "上传图片并应用裁剪后，这里会显示结果。",
            ratio: "比例",
            square: "1:1",
            wide: "16:9",
            portrait: "4:5",
            free: "自由",
            apply: "应用裁剪",
            draw: "涂鸦模式",
            clear: "清空标注",
            color: "画笔颜色",
            size: "粗细"
          }
        : {
            title: "Image Cropper",
            description: "Upload a local image, drag the crop box freely, then annotate the result with drawing tools.",
            upload: "Upload image",
            replace: "Replace image",
            cropPreview: "Crop area",
            result: "Cropped and annotated result",
            download: "Download PNG",
            empty: "Upload an image and apply a crop to see the result here.",
            ratio: "Ratio",
            square: "1:1",
            wide: "16:9",
            portrait: "4:5",
            free: "Free",
            apply: "Apply crop",
            draw: "Draw mode",
            clear: "Clear drawing",
            color: "Brush color",
            size: "Brush size"
          },
    [locale]
  );

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop(undefined);
      setPixelCrop(undefined);
      setResultSrc(null);
      setResultSize({ width: 0, height: 0 });
    };
    reader.readAsDataURL(file);
  }, []);

  const onImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = event.currentTarget;
      const nextCrop: PercentCrop =
        aspect
          ? centerAspectCrop(width, height, aspect)
          : {
              unit: "%",
              x: 10,
              y: 10,
              width: 60,
              height: 60
            };

      setCrop(nextCrop);
      setPixelCrop(convertToPixelCrop(nextCrop, width, height));
    },
    [aspect]
  );

  const applyCrop = useCallback(async () => {
    if (!pixelCrop || !imgRef.current) return;
    if (pixelCrop.width <= 0 || pixelCrop.height <= 0) return;

    const result = await createCroppedResult(imgRef.current, pixelCrop);
    setResultSrc(result.dataUrl);
    setResultSize({ width: result.width, height: result.height });
  }, [pixelCrop]);

  useLayoutEffect(() => {
    const element = previewFrameRef.current;
    if (!element) return;

    const updateSize = () => {
      const width = Math.max(320, element.clientWidth - 24);
      const height = Math.max(260, element.clientHeight - 24);
      setPreviewSize({ width, height });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    brushColorRef.current = brushColor;
    brushWidthRef.current = brushWidth;
    isDrawingRef.current = isDrawing;
  }, [brushColor, brushWidth, isDrawing]);

  useEffect(() => {
    const element = fabricElementRef.current;
    if (!element || !resultSrc) return;
    const currentResultSrc = resultSrc;

    let cancelled = false;
    const fabricCanvas =
      fabricCanvasRef.current ??
      new Canvas(element, {
        selection: false
      });

    fabricCanvasRef.current = fabricCanvas;

    async function syncCanvas() {
      const image = await FabricImage.fromURL(currentResultSrc);
      if (cancelled) return;

      const maxWidth = previewSize.width;
      const maxHeight = previewSize.height;
      const ratio = Math.min(maxWidth / image.width!, maxHeight / image.height!, 1);
      const width = Math.floor(image.width! * ratio);
      const height = Math.floor(image.height! * ratio);

      fabricCanvas.clear();
      fabricCanvas.setDimensions({ width, height });

      image.set({
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        selectable: false,
        evented: false
      });
      image.scale(ratio);
      fabricCanvas.add(image);
      fabricCanvas.sendObjectToBack(image);
      baseImageRef.current = image;

      const brush = new PencilBrush(fabricCanvas);
      brush.color = brushColorRef.current;
      brush.width = brushWidthRef.current;
      fabricCanvas.freeDrawingBrush = brush;
      fabricCanvas.isDrawingMode = isDrawingRef.current;
      fabricCanvas.renderAll();
    }

    syncCanvas();

    return () => {
      cancelled = true;
    };
  }, [resultSrc, previewSize.height, previewSize.width]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !canvas.freeDrawingBrush) return;

    canvas.isDrawingMode = isDrawing;
    canvas.freeDrawingBrush.color = brushColor;
    canvas.freeDrawingBrush.width = brushWidth;
    canvas.renderAll();
  }, [brushColor, brushWidth, isDrawing]);

  return (
    <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.92fr)]">
      <div className="flex h-[620px] flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
        <div className="border-b border-white/8 pb-4">
          <h2 className="text-xl font-semibold text-white sm:text-[1.65rem]">{text.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{text.description}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button type="button" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {imageSrc ? text.replace : text.upload}
          </Button>
          <Button type="button" variant="secondary" onClick={applyCrop} disabled={!imageSrc}>
            {text.apply}
          </Button>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">
            {text.ratio}
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: text.square, value: 1 as number | undefined },
              { label: text.wide, value: 16 / 9 },
              { label: text.portrait, value: 4 / 5 },
              { label: text.free, value: undefined }
            ].map((option) => (
              <Button
                key={option.label}
                type="button"
                size="sm"
                variant={aspect === option.value ? "default" : "secondary"}
                onClick={() => {
                  setAspect(option.value);
                  if (imgRef.current) {
                    const nextCrop = option.value
                      ? centerAspectCrop(imgRef.current.width, imgRef.current.height, option.value)
                      : ({
                          unit: "%",
                          x: 10,
                          y: 10,
                          width: 60,
                          height: 60
                        } satisfies Crop);

                    setCrop(nextCrop);
                    setPixelCrop(convertToPixelCrop(nextCrop, imgRef.current.width, imgRef.current.height));
                  }
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-white/10 bg-[#0a1226] p-4">
          {imageSrc ? (
            <ReactCrop
              crop={crop}
              onChange={(nextPixelCrop, nextPercentCrop) => {
                setCrop(nextPercentCrop);
                setPixelCrop(nextPixelCrop);
              }}
              aspect={aspect}
              keepSelection
              className="max-h-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop source"
                onLoad={onImageLoad}
                className="max-h-[460px] w-auto max-w-full object-contain"
              />
            </ReactCrop>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {text.cropPreview}
            </div>
          )}
        </div>
      </div>

      <div className="flex h-[620px] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-white/8 pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-sm">
            {text.result}
          </h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              const canvas = fabricCanvasRef.current;
              if (!canvas) return;
              canvas.discardActiveObject();
              const link = document.createElement("a");
              link.download = "cropped-image.png";
              link.href = canvas.toDataURL({
                format: "png",
                multiplier:
                  resultSize.width > 0 && canvas.getWidth() > 0
                    ? resultSize.width / canvas.getWidth()
                    : 1
              });
              link.click();
            }}
            disabled={!resultSrc}
          >
            <Download className="mr-2 h-4 w-4" />
            {text.download}
          </Button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr,110px,120px]">
          <Button
            type="button"
            variant={isDrawing ? "default" : "secondary"}
            onClick={() => setIsDrawing((value) => !value)}
          >
            <Paintbrush className="mr-2 h-4 w-4" />
            {text.draw}
          </Button>
          <Input
            type="color"
            value={brushColor}
            onChange={(event) => setBrushColor(event.target.value)}
            aria-label={text.color}
            className="h-10 rounded-xl px-2"
          />
          <Input
            type="number"
            min={1}
            max={40}
            value={brushWidth}
            onChange={(event) => setBrushWidth(Number(event.target.value))}
            aria-label={text.size}
            className="h-10 rounded-xl"
          />
        </div>

        <div
          ref={previewFrameRef}
          className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/60 p-3 sm:p-4"
        >
          {resultSrc ? (
            <div className="flex max-h-full max-w-full items-center justify-center overflow-auto rounded-lg">
              <canvas ref={fabricElementRef} />
            </div>
          ) : (
            <div className="text-sm text-slate-500">{text.empty}</div>
          )}
        </div>

        <div className="mt-4 border-t border-white/8 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const canvas = fabricCanvasRef.current;
              if (!canvas) return;
              canvas
                .getObjects()
                .filter((object) => object !== baseImageRef.current)
                .forEach((object) => canvas.remove(object));
              canvas.renderAll();
            }}
            disabled={!resultSrc}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {text.clear}
          </Button>
        </div>
      </div>
    </section>
  );
}

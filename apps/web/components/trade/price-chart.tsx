"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { getMarketChart, type ApiMarketChart, type ChartRange } from "@/lib/api";
import { cents } from "@/lib/format";
import { Segmented } from "../ui/primitives";

// Chart colors mirror the theme tokens in globals.css (canvas can't read CSS variables).
const COLORS = { signal: "#c7ff4a", index: "#7d8684", long: "#5ae6a8", short: "#ff6b62", text: "#7d8684", grid: "rgba(235,232,223,0.04)" };
const REFRESH_MS = 10_000;
const MIN_SPAN_CENTS = 10;
const ts = (seconds: number) => seconds as UTCTimestamp;

const RANGES = [
  { value: "1h", label: "1H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "all", label: "All" },
] as const;

/**
 * Probability chart built from Moxie's own on-chain data (via the indexer): the protected mark,
 * the source (Panta) index, and fills — your own fills labelled.
 */
export function PriceChart({ marketAddress, ownPortfolio }: { marketAddress: string; ownPortfolio?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<{ mark: ISeriesApi<"Line">; index: ISeriesApi<"Line">; candles: ISeriesApi<"Candlestick">; markMarkers: ISeriesMarkersPluginApi<Time>; candleMarkers: ISeriesMarkersPluginApi<Time> } | null>(null);
  const [range, setRange] = useState<ChartRange>("1d");
  const [style, setStyle] = useState<"line" | "candles">("line");
  const [data, setData] = useState<ApiMarketChart | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: COLORS.text, fontFamily: getComputedStyle(document.body).getPropertyValue("--font-geist-mono") || "monospace", fontSize: 11, attributionLogo: true },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      localization: { priceFormatter: (value: number) => cents(value) },
    });
    // Keep small moves readable, but never show prices outside a probability's 0–100¢.
    const autoscaleInfoProvider = (original: () => { priceRange: { minValue: number; maxValue: number } | null } | null) => {
      const result = original();
      if (!result?.priceRange) return result;
      const { minValue, maxValue } = result.priceRange;
      const mid = (minValue + maxValue) / 2;
      const half = Math.max((maxValue - minValue) / 2, MIN_SPAN_CENTS / 2);
      return { ...result, priceRange: { minValue: Math.max(0, mid - half), maxValue: Math.min(100, mid + half) } };
    };
    const index = chart.addSeries(LineSeries, { color: COLORS.index, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider });
    const mark = chart.addSeries(LineSeries, { color: COLORS.signal, lineWidth: 2, priceLineColor: COLORS.signal, autoscaleInfoProvider });
    const candles = chart.addSeries(CandlestickSeries, { upColor: COLORS.long, downColor: COLORS.short, wickUpColor: COLORS.long, wickDownColor: COLORS.short, borderVisible: false, visible: false, autoscaleInfoProvider });
    seriesRef.current = { mark, index, candles, markMarkers: createSeriesMarkers(mark, []), candleMarkers: createSeriesMarkers(candles, []) };
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await getMarketChart(marketAddress, range);
        if (!active) return;
        setData(next);
        setFailed(false);
      } catch {
        if (active) setFailed(true);
      }
    };
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [marketAddress, range]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !data) return;
    series.mark.setData(data.mark.map((p) => ({ time: ts(p.time), value: p.value })));
    series.index.setData(data.index.map((p) => ({ time: ts(p.time), value: p.value })));
    series.candles.setData(data.candles.map((c) => ({ time: ts(c.time), open: c.open, high: c.high, low: c.low, close: c.close })));
    const markers: SeriesMarker<Time>[] = data.fills.map((fill) => {
      const own = Boolean(ownPortfolio) && fill.portfolio === ownPortfolio;
      const long = fill.side === "long";
      return {
        time: ts(fill.time),
        position: long ? "belowBar" : "aboveBar",
        color: long ? COLORS.long : COLORS.short,
        shape: own ? (long ? "arrowUp" : "arrowDown") : "circle",
        size: own ? 1.2 : 0.5,
        text: own ? `You ${long ? "long" : "short"} ${fill.size.toFixed(2)} @ ${cents(fill.price)}` : undefined,
      };
    });
    series.markMarkers.setMarkers(style === "line" ? markers : []);
    series.candleMarkers.setMarkers(style === "candles" ? markers : []);
    series.mark.applyOptions({ visible: style === "line" });
    series.index.applyOptions({ visible: style === "line" });
    series.candles.applyOptions({ visible: style === "candles" });
    chartRef.current?.timeScale().fitContent();
  }, [data, style, ownPortfolio]);

  const lastIndex = data?.index.at(-1)?.value;
  const message = failed
    ? "Chart data is unavailable — retrying"
    : data && data.mark.length === 0 && data.fills.length === 0
      ? "No price history in this range yet"
      : style === "candles" && data && data.candles.length === 0
        ? "No trades in this range to build candles"
        : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <Segmented label="Chart range" size="sm" value={range} onChange={setRange} options={RANGES} />
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-4 text-xs text-subtle sm:flex">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-signal" aria-hidden="true" /> Moxie price</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-px w-3 border-t border-dashed border-subtle" aria-hidden="true" /> Source {lastIndex === undefined ? "(paused)" : ""}</span>
          </div>
          <Segmented
            label="Chart style"
            size="sm"
            value={style}
            onChange={setStyle}
            options={[
              { value: "line", label: "Line" },
              { value: "candles", label: "Candles" },
            ]}
          />
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {message ? <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-subtle">{message}</p> : null}
      </div>
    </div>
  );
}

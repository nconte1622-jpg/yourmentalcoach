import { Capacitor } from "@capacitor/core";

type Insets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readCapacitorInsets(): Promise<Insets | null> {
  if (!Capacitor.isNativePlatform()) return null;

  const plugins = (Capacitor as unknown as { Plugins?: Record<string, unknown> }).Plugins;
  if (!plugins) return null;

  const candidates = [plugins.SafeArea, plugins.SafeAreaInsets] as Array<{
    getSafeAreaInsets?: () => Promise<unknown>;
  } | undefined>;

  for (const plugin of candidates) {
    if (!plugin?.getSafeAreaInsets) continue;
    try {
      const result = await plugin.getSafeAreaInsets();
      const insets = (result as { insets?: Record<string, unknown> } | null)?.insets ?? (result as Record<string, unknown>);
      const top = toNumber(insets?.top);
      const bottom = toNumber(insets?.bottom);
      const left = toNumber(insets?.left);
      const right = toNumber(insets?.right);
      return { top, bottom, left, right };
    } catch {
      // Ignore plugin errors and fall back to CSS env() insets.
    }
  }

  return null;
}

function readCssInsetVar(name: string): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return 0;
  return toNumber(raw.replace("px", ""));
}

function setSafeAreaVars(insets: Insets) {
  const root = document.documentElement;
  root.style.setProperty("--sat", `${Math.max(0, Math.round(insets.top))}px`);
  root.style.setProperty("--sab", `${Math.max(0, Math.round(insets.bottom))}px`);
  root.style.setProperty("--sal", `${Math.max(0, Math.round(insets.left))}px`);
  root.style.setProperty("--sar", `${Math.max(0, Math.round(insets.right))}px`);
}

export function initSafeAreaInsets(): () => void {
  let cancelled = false;

  const update = async () => {
    if (cancelled) return;
    const insets = await readCapacitorInsets();
    if (!insets || cancelled) return;

    // Prefer CSS env() values. Only override vars still at 0px.
    const cssTop = readCssInsetVar("--sat");
    const cssBottom = readCssInsetVar("--sab");
    const cssLeft = readCssInsetVar("--sal");
    const cssRight = readCssInsetVar("--sar");

    const resolved: Insets = {
      top: cssTop > 0 ? cssTop : insets.top,
      bottom: cssBottom > 0 ? cssBottom : insets.bottom,
      left: cssLeft > 0 ? cssLeft : insets.left,
      right: cssRight > 0 ? cssRight : insets.right,
    };

    setSafeAreaVars(resolved);
  };

  void update();
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);

  return () => {
    cancelled = true;
    window.removeEventListener("resize", update);
    window.removeEventListener("orientationchange", update);
  };
}

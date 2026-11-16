export const EDITOR_THEME_MESSAGE_TYPE = "presenton:editor-theme" as const;

export type EditorThemeName = "presenton" | "dsfr";
export type EditorColorScheme = "light" | "dark";

export type EditorThemeSelection = {
  theme: EditorThemeName;
  scheme: EditorColorScheme;
};

export type EditorThemeMessage = EditorThemeSelection & {
  type: typeof EDITOR_THEME_MESSAGE_TYPE;
};

export const DEFAULT_EDITOR_THEME: EditorThemeSelection = {
  theme: "presenton",
  scheme: "light",
};

export type EditorThemeTokens = {
  background: string;
  surface: string;
  surfaceSubtle: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primarySoft: string;
  primaryForeground: string;
  border: string;
  borderStrong: string;
  danger: string;
  dangerSoft: string;
  focus: string;
  overlay: string;
};

const PRESENTON_LIGHT: EditorThemeTokens = {
  background: "#EDEEEF",
  surface: "#FFFFFF",
  surfaceSubtle: "#F6F6F9",
  text: "#191919",
  textMuted: "#667085",
  primary: "#7C51F8",
  primaryHover: "#6847F4",
  primaryActive: "#5141E5",
  primarySoft: "#F4F3FF",
  primaryForeground: "#FFFFFF",
  border: "#EDEEEF",
  borderStrong: "#D0D5DD",
  danger: "#D83B3B",
  dangerSoft: "#FEF3F2",
  focus: "#7A5AF8",
  overlay: "#10182873",
};

const DSFR_LIGHT: EditorThemeTokens = {
  background: "#F8F8F9",
  surface: "#FFFFFF",
  surfaceSubtle: "#F0F0F3",
  text: "#222631",
  textMuted: "#555E74",
  primary: "#3E5DE7",
  primaryHover: "#2845C1",
  primaryActive: "#223E9E",
  primarySoft: "#EDF0FF",
  primaryForeground: "#FFFFFF",
  border: "#DFE2EA",
  borderStrong: "#C1C7D3",
  danger: "#CF202D",
  dangerSoft: "#FFEDEB",
  focus: "#3E5DE7",
  overlay: "#0F111773",
};

const DSFR_DARK: EditorThemeTokens = {
  background: "#0F1117",
  surface: "#181B24",
  surfaceSubtle: "#222631",
  text: "#F6F8F9",
  textMuted: "#B2B9C7",
  primary: "#90A7FF",
  primaryHover: "#A2B6FF",
  primaryActive: "#C8D3FF",
  primarySoft: "#172446",
  primaryForeground: "#0F1117",
  border: "#3F4759",
  borderStrong: "#626A80",
  danger: "#FB5759",
  dangerSoft: "#410003",
  focus: "#A2B6FF",
  overlay: "#000000B2",
};

export function getEditorThemeTokens(
  selection: EditorThemeSelection,
): EditorThemeTokens {
  if (selection.theme === "dsfr") {
    return selection.scheme === "dark" ? DSFR_DARK : DSFR_LIGHT;
  }
  return PRESENTON_LIGHT;
}

export function normalizeEditorTheme(
  theme: string | null | undefined,
  scheme: string | null | undefined,
): EditorThemeSelection {
  return {
    theme: theme === "dsfr" ? "dsfr" : "presenton",
    scheme: scheme === "dark" ? "dark" : "light",
  };
}

export function editorThemeFromSearchParams(
  params: Pick<URLSearchParams, "get">,
): EditorThemeSelection {
  return normalizeEditorTheme(params.get("ui_theme"), params.get("scheme"));
}

export function editorHostOriginFromSearchParams(
  params: Pick<URLSearchParams, "get">,
): string | null {
  const value = params.get("host_origin");
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function createEditorThemeMessage(
  selection: EditorThemeSelection,
): EditorThemeMessage {
  return { type: EDITOR_THEME_MESSAGE_TYPE, ...selection };
}

export function parseEditorThemeMessage(
  value: unknown,
): EditorThemeSelection | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== EDITOR_THEME_MESSAGE_TYPE) return null;
  if (candidate.theme !== "presenton" && candidate.theme !== "dsfr")
    return null;
  if (candidate.scheme !== "light" && candidate.scheme !== "dark") return null;
  return { theme: candidate.theme, scheme: candidate.scheme };
}

export function isEditorThemeEventAllowed(
  event: Pick<MessageEvent, "origin" | "source">,
  hostOrigin: string | null,
  parentWindow: unknown,
): boolean {
  return Boolean(
    hostOrigin &&
      parentWindow &&
      event.source === parentWindow &&
      event.origin === hostOrigin,
  );
}

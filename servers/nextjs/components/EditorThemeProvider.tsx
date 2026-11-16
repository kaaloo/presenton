"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";

import {
  DEFAULT_EDITOR_THEME,
  editorHostOriginFromSearchParams,
  editorThemeFromSearchParams,
  getEditorThemeTokens,
  isEditorThemeEventAllowed,
  parseEditorThemeMessage,
  type EditorThemeSelection,
  type EditorThemeTokens,
} from "@/lib/editor-theme";

type EditorThemeContextValue = EditorThemeSelection & {
  tokens: EditorThemeTokens;
};

const EditorThemeContext = createContext<EditorThemeContextValue>({
  ...DEFAULT_EDITOR_THEME,
  tokens: getEditorThemeTokens(DEFAULT_EDITOR_THEME),
});

export function useEditorTheme() {
  return useContext(EditorThemeContext);
}

export function EditorThemeProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const initialSelection = useMemo(
    () => editorThemeFromSearchParams(searchParams),
    [searchParams],
  );
  const hostOrigin = useMemo(
    () => editorHostOriginFromSearchParams(searchParams),
    [searchParams],
  );
  const [selection, setSelection] = useState(initialSelection);

  useEffect(() => {
    setSelection(initialSelection);
  }, [initialSelection]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isEditorThemeEventAllowed(event, hostOrigin, window.parent)) return;
      const nextSelection = parseEditorThemeMessage(event.data);
      if (nextSelection) setSelection(nextSelection);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [hostOrigin]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.editorTheme = selection.theme;
    root.dataset.editorScheme = selection.scheme;
    root.style.colorScheme = selection.scheme;

    return () => {
      delete root.dataset.editorTheme;
      delete root.dataset.editorScheme;
      root.style.colorScheme = "";
    };
  }, [selection]);

  const value = useMemo(
    () => ({ ...selection, tokens: getEditorThemeTokens(selection) }),
    [selection],
  );

  return (
    <EditorThemeContext.Provider value={value}>
      {children}
    </EditorThemeContext.Provider>
  );
}

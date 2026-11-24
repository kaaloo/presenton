"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";

import {
  DEFAULT_EDITOR_THEME,
  editorHostOriginAfterSearchParamsChange,
  editorHostOriginFromSearchParams,
  editorThemeAfterSearchParamsChange,
  editorThemeFromSearchParams,
  getEditorThemeTokens,
  isEditorThemeEventAllowed,
  parseEditorThemeMessage,
  shouldApplyEditorThemeConfiguration,
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
  const [selection, setSelection] = useState(() =>
    editorThemeFromSearchParams(searchParams),
  );
  const [hostOrigin, setHostOrigin] = useState<string | null>(() =>
    editorHostOriginFromSearchParams(searchParams),
  );
  const previousSearchParams = useRef(searchParams);

  useEffect(() => {
    if (
      !shouldApplyEditorThemeConfiguration(
        previousSearchParams.current,
        searchParams,
      )
    ) {
      return;
    }
    previousSearchParams.current = searchParams;
    setSelection((current) =>
      editorThemeAfterSearchParamsChange(current, searchParams),
    );
    setHostOrigin((current) =>
      editorHostOriginAfterSearchParamsChange(current, searchParams),
    );
  }, [searchParams]);

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

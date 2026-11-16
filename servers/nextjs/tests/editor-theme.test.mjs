import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";

let theme;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "presenton-editor-theme-"),
  );
  const outputFile = path.join(temporaryDirectory, "bundle.mjs");
  await build({
    entryPoints: [path.resolve("lib/editor-theme.ts")],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });
  theme = await import(pathToFileURL(outputFile).href);
});

test.after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

test("empty and malformed theme parameters preserve stock Presenton", () => {
  assert.deepEqual(theme.editorThemeFromSearchParams(new URLSearchParams()), {
    theme: "presenton",
    scheme: "light",
  });
  assert.deepEqual(
    theme.editorThemeFromSearchParams(
      new URLSearchParams("ui_theme=unknown&scheme=unknown"),
    ),
    { theme: "presenton", scheme: "light" },
  );
  assert.deepEqual(
    theme.getEditorThemeTokens({ theme: "presenton", scheme: "dark" }),
    theme.getEditorThemeTokens({ theme: "presenton", scheme: "light" }),
  );
});

test("DSFR light and dark parameters select their exact themes", () => {
  assert.deepEqual(
    theme.editorThemeFromSearchParams(
      new URLSearchParams("ui_theme=dsfr&scheme=dark"),
    ),
    { theme: "dsfr", scheme: "dark" },
  );
  assert.notDeepEqual(
    theme.getEditorThemeTokens({ theme: "dsfr", scheme: "light" }),
    theme.getEditorThemeTokens({ theme: "dsfr", scheme: "dark" }),
  );
});

test("unrelated navigation preserves theme and host configuration", () => {
  const selection = { theme: "dsfr", scheme: "dark" };
  const host = "https://conversations.example";
  const presentationNavigation = new URLSearchParams(
    "id=deck-1&mode=present&slide=1&type=smart",
  );
  assert.equal(
    theme.editorThemeAfterSearchParamsChange(selection, presentationNavigation),
    selection,
  );
  assert.equal(
    theme.editorHostOriginAfterSearchParamsChange(host, presentationNavigation),
    host,
  );

  assert.deepEqual(
    theme.editorThemeAfterSearchParamsChange(
      selection,
      new URLSearchParams("scheme=light"),
    ),
    { theme: "dsfr", scheme: "light" },
  );
  assert.deepEqual(
    theme.editorThemeAfterSearchParamsChange(
      selection,
      new URLSearchParams("ui_theme=presenton"),
    ),
    { theme: "presenton", scheme: "dark" },
  );
  assert.equal(
    theme.editorHostOriginAfterSearchParamsChange(
      host,
      new URLSearchParams("host_origin=javascript%3Aalert(1)"),
    ),
    null,
  );
});

test("unrelated query changes do not reapply stale theme fields", () => {
  const initial = new URLSearchParams(
    "ui_theme=dsfr&scheme=light&stream=true&host_origin=https%3A%2F%2Fconversations.example",
  );
  const streamCompleted = new URLSearchParams(
    "ui_theme=dsfr&scheme=light&host_origin=https%3A%2F%2Fconversations.example",
  );
  assert.equal(
    theme.shouldApplyEditorThemeConfiguration(initial, streamCompleted),
    false,
  );
  assert.equal(
    theme.shouldApplyEditorThemeConfiguration(
      initial,
      new URLSearchParams(
        "ui_theme=dsfr&scheme=dark&stream=true&host_origin=https%3A%2F%2Fconversations.example",
      ),
    ),
    true,
  );
  assert.equal(
    theme.shouldApplyEditorThemeConfiguration(
      initial,
      new URLSearchParams("id=deck-1&mode=present&slide=1"),
    ),
    true,
  );
});

test("host origins are normalized and restricted to HTTP(S)", () => {
  assert.equal(
    theme.editorHostOriginFromSearchParams(
      new URLSearchParams(
        "host_origin=https%3A%2F%2Fconversations.example%2Fchat%2F123",
      ),
    ),
    "https://conversations.example",
  );
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "not a URL",
    "",
  ]) {
    const params = new URLSearchParams();
    if (value) params.set("host_origin", value);
    assert.equal(theme.editorHostOriginFromSearchParams(params), null);
  }
});

test("theme messages round-trip and malformed messages are rejected", () => {
  const selection = { theme: "dsfr", scheme: "dark" };
  const message = theme.createEditorThemeMessage(selection);
  assert.deepEqual(theme.parseEditorThemeMessage(message), selection);

  for (const value of [
    null,
    "dsfr",
    {},
    { ...message, type: "other" },
    { ...message, theme: "unknown" },
    { ...message, scheme: "unknown" },
  ]) {
    assert.equal(theme.parseEditorThemeMessage(value), null);
  }
});

test("theme events require the exact host origin and parent window", () => {
  const parent = {};
  const event = { origin: "https://conversations.example", source: parent };
  assert.equal(
    theme.isEditorThemeEventAllowed(
      event,
      "https://conversations.example",
      parent,
    ),
    true,
  );
  assert.equal(
    theme.isEditorThemeEventAllowed(
      { ...event, origin: "https://attacker.example" },
      "https://conversations.example",
      parent,
    ),
    false,
  );
  assert.equal(
    theme.isEditorThemeEventAllowed(
      { ...event, source: {} },
      "https://conversations.example",
      parent,
    ),
    false,
  );
  assert.equal(theme.isEditorThemeEventAllowed(event, null, parent), false);
});

test("CSS contains every JS token and explicitly isolates slide documents", async () => {
  const css = (
    await readFile(path.resolve("app/editor-dsfr.css"), "utf8")
  ).toLowerCase();
  for (const scheme of ["light", "dark"]) {
    const tokens = theme.getEditorThemeTokens({ theme: "dsfr", scheme });
    for (const [name, value] of Object.entries(tokens)) {
      assert.ok(
        css.includes(value.toLowerCase()),
        `${scheme}.${name} is missing ${value}`,
      );
    }
  }
  assert.ok(css.includes('[data-editor-theme="dsfr"] [data-slide-document]'));

  const renderer = await readFile(
    path.resolve(
      "app/(presentation-generator)/components/PresentationRender.tsx",
    ),
    "utf8",
  );
  assert.match(renderer, /data-slide-document/);

  const parsedCss = postcss.parse(css);
  const typographySelectors = [];
  let overlayRule;
  let slideBoundaryRule;
  parsedCss.walkRules((rule) => {
    if (
      rule.nodes.some(
        (node) =>
          node.type === "decl" &&
          node.prop === "font-family" &&
          node.value === "var(--editor-font-family)",
      )
    ) {
      typographySelectors.push(rule.selector);
    }
    if (rule.selector.endsWith(".editor-dialog-overlay")) overlayRule = rule;
    if (
      rule.selector === ':root[data-editor-theme="dsfr"] [data-slide-document]'
    ) {
      slideBoundaryRule = rule;
    }
  });
  for (const className of [
    "editor-typography",
    "editor-button",
    "editor-input",
    "editor-select-trigger",
    "editor-dialog",
    "editor-popover",
    "editor-dropdown",
    "editor-select-content",
    "editor-tooltip",
  ]) {
    assert.ok(
      typographySelectors.some((selector) =>
        selector.includes(`.${className}`),
      ),
      `${className} is missing from the typography rule`,
    );
  }
  assert.ok(overlayRule);
  assert.equal(
    overlayRule.nodes.some(
      (node) => node.type === "decl" && node.prop === "font-family",
    ),
    false,
  );
  assert.ok(slideBoundaryRule);
  assert.ok(
    slideBoundaryRule.nodes.some(
      (node) =>
        node.type === "decl" &&
        node.prop === "color" &&
        node.value === "hsl(240 10% 3.9%)",
    ),
    "the slide boundary must reset the inherited body text color",
  );

  for (const [className, color] of [
    ["editor-dialog-title", "var(--editor-text)"],
    ["editor-dialog-description", "var(--editor-text-muted)"],
  ]) {
    let found = false;
    parsedCss.walkRules((rule) => {
      if (!rule.selector.includes(`.${className}`)) return;
      found ||= rule.nodes.some(
        (node) =>
          node.type === "decl" && node.prop === "color" && node.value === color,
      );
    });
    assert.ok(found, `${className} must use ${color}`);
  }
  const dialogSource = await readFile(
    path.resolve("components/ui/dialog.tsx"),
    "utf8",
  );
  assert.match(dialogSource, /editor-dialog-title/);
  assert.match(dialogSource, /editor-dialog-description/);

  for (const className of ["text-\\[\\#19001f\\]", "text-black"]) {
    let found = false;
    parsedCss.walkRules((rule) => {
      if (!rule.selector.includes(".editor-popover")) return;
      if (!rule.selector.includes(className)) return;
      found ||= rule.nodes.some(
        (node) =>
          node.type === "decl" &&
          node.prop === "color" &&
          node.value === "var(--editor-text)",
      );
    });
    assert.ok(found, `${className} must use themed text in shared popovers`);
  }

  for (const [className, prop, value] of [
    ["editor-export-panel", "background", "var(--editor-surface)"],
    ["editor-component-menu-item", "color", "var(--editor-text)"],
    [
      "editor-component-menu-shortcut",
      "background",
      "var(--editor-surface-subtle)",
    ],
  ]) {
    let found = false;
    parsedCss.walkRules((rule) => {
      if (!rule.selector.includes(`.${className}`)) return;
      found ||= rule.nodes.some(
        (node) =>
          node.type === "decl" && node.prop === prop && node.value === value,
      );
    });
    assert.ok(found, `${className} must set ${prop} to ${value}`);
  }
  const headerSource = await readFile(
    path.resolve(
      "app/(presentation-generator)/presentation/components/PresentationHeader.tsx",
    ),
    "utf8",
  );
  assert.match(headerSource, /editor-export-panel/);
  const componentMenuSource = await readFile(
    path.resolve("components/slide-editor/selection/ComponentActionsMenu.tsx"),
    "utf8",
  );
  assert.match(componentMenuSource, /editor-component-menu-item/);
  assert.match(componentMenuSource, /editor-component-menu-shortcut/);
});

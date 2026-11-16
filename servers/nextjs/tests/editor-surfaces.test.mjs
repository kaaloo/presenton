import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import postcss from "postcss";

let surfaceCss;
let foundationCss;
let layout;

test.before(async () => {
  [surfaceCss, foundationCss, layout] = await Promise.all([
    readFile(path.resolve("app/editor-surfaces.css"), "utf8"),
    readFile(path.resolve("app/editor-dsfr.css"), "utf8"),
    readFile(path.resolve("app/layout.tsx"), "utf8"),
  ]);
});

test("surface styles load after the foundation and keep stock themes untouched", () => {
  assert.ok(
    layout.indexOf("./editor-dsfr.css") <
      layout.indexOf("./editor-surfaces.css"),
  );
  const root = postcss.parse(surfaceCss);
  const selectors = [];
  root.walkRules((rule) => selectors.push(rule.selector));
  assert.ok(selectors.length > 0);
  assert.ok(
    selectors.every((selector) =>
      selector.includes('[data-editor-theme="dsfr"]'),
    ),
  );
  assert.ok(surfaceCss.includes("var(--editor-primary)"));
  assert.ok(surfaceCss.includes("var(--editor-surface)"));
  assert.ok(surfaceCss.includes("@media (width <= 640px)"));
});

test("header and mobile layout use semantic surfaces and actions", () => {
  const root = postcss.parse(surfaceCss);
  const expectations = new Map([
    [".editor-header", ["background", "var(--editor-surface)"]],
    [".editor-export-button", ["background", "var(--editor-primary)"]],
    [".editor-thumbnail--selected", ["border-color", "var(--editor-primary)"]],
    [".editor-mobile-assistant", ["background", "var(--editor-primary)"]],
    [".editor-floating-toolbar", ["background", "var(--editor-surface)"]],
    [".editor-send-button", ["border-radius", "var(--editor-control-radius)"]],
  ]);
  for (const [className, [property, value]] of expectations) {
    let found = false;
    root.walkRules((rule) => {
      if (!rule.selector.includes(className)) return;
      found ||= rule.nodes.some(
        (node) =>
          node.type === "decl" &&
          node.prop === property &&
          node.value === value,
      );
    });
    assert.ok(found, `${className} must set ${property} to ${value}`);
  }
});

test("action panels and floating toolbars join the shared overlay migration", () => {
  for (const className of [
    "editor-actions",
    "editor-panel",
    "editor-chat",
    "editor-floating-toolbar",
  ]) {
    assert.ok(foundationCss.includes(className), `${className} is missing`);
  }
  assert.match(foundationCss, /input,\s+textarea,\s+select/);
  assert.ok(surfaceCss.includes("::placeholder"));
  assert.ok(foundationCss.includes(":where(:not([data-slide-document], [data-slide-document] *)"));
  assert.ok(foundationCss.includes(".editor-slide-actions"));
  assert.ok(surfaceCss.includes("stroke: currentColor"));
});

test("editor surfaces use stable classes and Konva uses theme tokens", async () => {
  const files = {
    header:
      "app/(presentation-generator)/presentation/components/PresentationHeader.tsx",
    page: "app/(presentation-generator)/presentation/components/PresentationPage.tsx",
    actions:
      "app/(presentation-generator)/presentation/components/PresentationActions.tsx",
    chat: "app/(presentation-generator)/presentation/components/Chat.tsx",
    thumbnails:
      "app/(presentation-generator)/presentation/components/SlideThumbnailCard.tsx",
    floating: "components/slide-editor/toolbar/FloatingToolbar.tsx",
    transformers: "components/slide-editor/selection/SelectionTransformers.tsx",
  };
  const source = Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([name, file]) => [
        name,
        await readFile(path.resolve(file), "utf8"),
      ]),
    ),
  );
  for (const className of [
    "editor-header",
    "editor-title-block",
    "editor-export-button",
    "editor-export-panel",
  ]) {
    assert.ok(
      source.header.includes(className),
      `${className} is missing from the header`,
    );
  }
  assert.ok(source.page.includes("editor-page"));
  assert.ok(source.page.includes("editor-action-panel"));
  assert.ok(source.actions.includes("editor-action-button"));
  assert.ok(source.actions.includes("editor-panel"));
  assert.ok(source.chat.includes("editor-chat"));
  assert.ok(source.thumbnails.includes("editor-thumbnail--selected"));
  assert.ok(source.floating.includes("editor-floating-toolbar"));
  assert.ok(source.transformers.includes("useEditorTheme"));
  assert.ok(source.transformers.includes("tokens.primary"));
  assert.ok(source.transformers.includes("tokens.surface"));
  assert.ok(source.transformers.includes("tokens.borderStrong"));
  assert.ok(!source.transformers.includes('borderStroke="#7A5AF8"'));
});

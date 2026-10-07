import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter,
  highlightSpecialChars, keymap, lineNumbers,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from "@codemirror/commands";
import { bracketMatching, foldGutter, foldKeymap, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { tags } from "@lezer/highlight";
import type { Language } from "../types/domain";

export interface CodeEditorHandle {
  goToLine: (line: number) => void;
  focus: () => void;
}

interface Props {
  ref?: Ref<CodeEditorHandle>;
  value: string;
  label: string;
  language: Language | null;
  tabSize: number;
  lineNumbers: boolean;
  wordWrap: boolean;
  readOnly: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCursorChange: (position: { line: number; column: number }) => void;
}

function languageExtension(language: Language | null): Extension {
  switch (language) {
    case "typescript": case "tsx": case "javascript": case "jsx":
      return javascript({ typescript: language === "typescript" || language === "tsx", jsx: language === "jsx" || language === "tsx" });
    case "python": return python();
    case "json": return json();
    case "html": return html();
    case "css": return css();
    case "markdown": return markdown();
    default: return [];
  }
}

function configuration(props: Props): Extension {
  return [
    languageExtension(props.language),
    EditorState.tabSize.of(props.tabSize), indentUnit.of(" ".repeat(props.tabSize)),
    EditorState.readOnly.of(props.readOnly), EditorView.editable.of(!props.readOnly),
    EditorView.contentAttributes.of({ "aria-label": props.label, "aria-multiline": "true", "aria-readonly": String(props.readOnly), role: "textbox", spellcheck: "false", tabindex: "0" }),
    props.lineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : [],
    props.wordWrap ? EditorView.lineWrapping : [],
  ];
}

const editorTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "var(--editor-bg)", color: "var(--editor-text)", fontSize: "13px" },
  ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-code, monospace)", lineHeight: "1.65" },
  ".cm-content": { padding: "14px 0", caretColor: "var(--editor-text)" },
  ".cm-line": { padding: "0 20px 0 10px" },
  ".cm-gutters": { backgroundColor: "var(--editor-bg)", color: "var(--editor-muted)", border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { minWidth: "46px", padding: "0 12px 0 8px" },
  ".cm-foldGutter .cm-gutterElement": { padding: "0 6px" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--editor-active-line)" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--editor-text)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--editor-selection)" },
  ".cm-matchingBracket": { backgroundColor: "var(--editor-selection)", outline: "1px solid var(--editor-border)" },
  ".cm-tooltip, .cm-panels": { backgroundColor: "var(--editor-panel)", color: "var(--editor-text)", borderColor: "var(--editor-border)" },
  ".cm-search input, .cm-search button": { color: "var(--editor-text)", backgroundColor: "var(--editor-bg)", border: "1px solid var(--editor-border)" },
}, { dark: true });

const editorHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: "var(--editor-keyword)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--editor-string)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--editor-number)" },
  { tag: tags.comment, color: "var(--editor-comment)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--editor-function)" },
  { tag: [tags.typeName, tags.className], color: "var(--editor-type)" },
  { tag: [tags.propertyName, tags.attributeName], color: "var(--editor-variable)" },
  { tag: [tags.tagName, tags.heading], color: "var(--editor-keyword)" },
]);

export function CodeEditorSurface(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const configurationRef = useRef(new Compartment());
  const latestProps = useRef(props);
  latestProps.current = props;

  useImperativeHandle(props.ref, () => ({
    goToLine(number) {
      const view = viewRef.current;
      if (!view) return;
      const line = view.state.doc.line(Math.max(1, Math.min(number, view.state.doc.lines)));
      view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
      view.focus();
    },
    focus() { viewRef.current?.focus(); },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: latestProps.current.value,
        extensions: [
          configurationRef.current.of(configuration(latestProps.current)),
          editorTheme, syntaxHighlighting(editorHighlight), history(), drawSelection(),
          highlightSpecialChars(), highlightActiveLine(), indentOnInput(), bracketMatching(),
          closeBrackets(), autocompletion(), highlightSelectionMatches(),
          keymap.of([
            { key: "Mod-s", preventDefault: true, run: () => { latestProps.current.onSave(); return true; } },
            { key: "Tab", run: indentMore, shift: indentLess },
            ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latestProps.current.onChange(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              latestProps.current.onCursorChange({ line: line.number, column: head - line.from + 1 });
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    latestProps.current.onCursorChange({ line: 1, column: 1 });
    view.focus();
    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== props.value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: props.value } });
    }
  }, [props.value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: configurationRef.current.reconfigure(configuration(latestProps.current)) });
  }, [props.language, props.tabSize, props.lineNumbers, props.wordWrap, props.readOnly, props.label]);

  return <div ref={containerRef} className="vscode-code-surface" />;
}

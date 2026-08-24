import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {EditorView} from '@codemirror/view';
import {tags} from '@lezer/highlight';

export const codeEditorTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--code-editor-fg)',
      backgroundColor: 'var(--code-editor-bg)',
    },
    '.cm-content': {
      caretColor: 'var(--code-editor-caret)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--code-editor-caret)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--code-editor-selection) !important',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--code-editor-active-line)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--code-editor-active-line)',
    },
    '.cm-gutters': {
      color: 'var(--code-editor-gutter-fg)',
      backgroundColor: 'var(--code-editor-gutter-bg)',
      borderRight: '1px solid var(--code-editor-border)',
    },
    '.cm-foldGutter span': {
      color: 'var(--code-editor-gutter-fg)',
    },
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      textDecoration: 'underline wavy var(--code-editor-error)',
      textUnderlineOffset: '2px',
    },
    '.cm-lintRange-warning': {
      backgroundImage: 'none',
      textDecoration: 'underline wavy var(--code-editor-warning)',
      textUnderlineOffset: '2px',
    },
    '.cm-tooltip.cm-tooltip-lint': {
      backgroundColor: 'var(--code-editor-bg)',
      color: 'var(--code-editor-fg)',
      border: '1px solid var(--code-editor-border)',
    },
    '.cm-diagnostic-error': {
      borderLeft: '3px solid var(--code-editor-error)',
    },
    '.cm-lint-marker-error': {
      content: '""',
    },
  },
  {dark: false},
);

export const codeEditorHighlight = syntaxHighlighting(
  HighlightStyle.define([
    {tag: tags.comment, color: 'var(--code-editor-comment)', fontStyle: 'italic'},
    {tag: [tags.string, tags.special(tags.string)], color: 'var(--code-editor-string)'},
    {tag: tags.number, color: 'var(--code-editor-number)'},
    {tag: tags.bool, color: 'var(--code-editor-bool)'},
    {tag: tags.null, color: 'var(--code-editor-null)'},
    {tag: [tags.keyword, tags.operatorKeyword], color: 'var(--code-editor-keyword)'},
    {tag: [tags.propertyName, tags.definition(tags.propertyName)], color: 'var(--code-editor-property)'},
    {tag: tags.punctuation, color: 'var(--code-editor-punctuation)'},
    {tag: tags.bracket, color: 'var(--code-editor-punctuation)'},
    {tag: tags.invalid, color: 'var(--code-editor-error)'},
  ]),
);

export const lintMarkerTheme = EditorView.baseTheme({
  '.cm-lint-marker.cm-lint-marker-error': {
    content: '""',
    display: 'inline-block',
    width: '0.55rem',
    height: '0.55rem',
    marginInlineEnd: '0.15rem',
    borderRadius: '50%',
    backgroundColor: 'var(--code-editor-error)',
  },
});

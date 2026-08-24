import {Diagnostic} from '@codemirror/lint';
import {jsonParseLinter} from '@codemirror/lang-json';
import {EditorView} from '@codemirror/view';
import {parseDocument, YAMLError} from 'yaml';

export {jsonParseLinter};

function toDiagnostic(view: EditorView, error: YAMLError): Diagnostic {
  const [from, to] = error.pos;
  const docLength = view.state.doc.length;

  return {
    from: Math.max(0, Math.min(from, docLength)),
    to: Math.max(from + 1, Math.min(to, docLength)),
    severity: error.name === 'YAMLWarning' ? 'warning' : 'error',
    message: error.message,
    source: 'yaml',
  };
}

export function yamlParseLinter(): (view: EditorView) => Diagnostic[] {
  return (view) => {
    const text = view.state.doc.toString();
    if (!text.trim()) {
      return [];
    }

    const doc = parseDocument(text, {prettyErrors: false});
    if (!doc.errors.length) {
      return [];
    }

    return doc.errors.map((error) => toDiagnostic(view, error));
  };
}

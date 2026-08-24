import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import {Compartment, EditorState, Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {json} from '@codemirror/lang-json';
import {yaml} from '@codemirror/lang-yaml';
import {linter} from '@codemirror/lint';
import {basicSetup} from 'codemirror';
import {FileDirectoryFormat} from '../../core/models/directory.models';
import {jsonParseLinter, yamlParseLinter} from './code-editor-lint';
import {
  codeEditorHighlight,
  codeEditorTheme,
  lintMarkerTheme,
} from './code-editor-theme';

@Component({
  selector: 'app-code-editor',
  standalone: true,
  template: `<div #host class="host"></div>`,
  styleUrl: './code-editor.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeEditorComponent implements AfterViewInit, OnDestroy {
  readonly value = input('');
  readonly language = input<FileDirectoryFormat>('json');
  readonly valueChange = output<string>();

  @ViewChild('host', {static: true})
  private readonly host!: ElementRef<HTMLDivElement>;

  private view?: EditorView;
  private readonly viewReady = signal(false);
  private readonly languageCompartment = new Compartment();
  private syncingFromParent = false;

  constructor() {
    effect(() => {
      if (!this.viewReady()) {
        return;
      }
      const view = this.view;
      if (!view) {
        return;
      }
      const next = this.value();
      const current = view.state.doc.toString();
      if (current === next) {
        return;
      }
      this.syncingFromParent = true;
      view.dispatch({
        changes: {from: 0, to: current.length, insert: next},
      });
      this.syncingFromParent = false;
    });

    effect(() => {
      if (!this.viewReady()) {
        return;
      }
      const view = this.view;
      if (!view) {
        return;
      }
      view.dispatch({
        effects: this.languageCompartment.reconfigure(
          this.extensionFor(this.language()),
        ),
      });
    });
  }

  ngAfterViewInit(): void {
    this.view = new EditorView({
      parent: this.host.nativeElement,
      state: EditorState.create({
        doc: this.value(),
        extensions: [
          basicSetup,
          codeEditorTheme,
          codeEditorHighlight,
          lintMarkerTheme,
          this.languageCompartment.of(this.extensionFor(this.language())),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !this.syncingFromParent) {
              this.valueChange.emit(update.state.doc.toString());
            }
          }),
          EditorView.theme({
            '&': {height: '100%', fontSize: '0.875rem'},
            '.cm-scroller': {
              overflow: 'auto',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            },
            '.cm-editor': {height: '100%'},
            '.cm-focused': {outline: 'none'},
          }),
        ],
      }),
    });
    this.viewReady.set(true);
  }

  ngOnDestroy(): void {
    this.viewReady.set(false);
    this.view?.destroy();
    this.view = undefined;
  }

  private extensionFor(language: FileDirectoryFormat): Extension {
    if (language === 'yaml') {
      return [yaml(), linter(yamlParseLinter(), {delay: 300})];
    }
    return [json(), linter(jsonParseLinter(), {delay: 300})];
  }
}

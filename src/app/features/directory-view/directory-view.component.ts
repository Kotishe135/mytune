import {JsonPipe} from '@angular/common';
import {Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiTable} from '@taiga-ui/addon-table';
import {
  TuiButton,
  TuiCheckbox,
  TuiDialog,
  TuiInput,
  TuiLabel,
  TuiNotification,
  TuiTextfield,
  TuiTitle,
} from '@taiga-ui/core';
import {
  TuiChevron,
  TuiDataListWrapper,
  TuiInputChip,
  TuiSelect,
  TuiSwitch,
  TuiTextarea,
} from '@taiga-ui/kit';
import {TuiCardLarge, TuiHeader} from '@taiga-ui/layout';
import {map} from 'rxjs';
import {
  DirectoryItem,
  FieldDefinition,
  FieldType,
} from '../../core/models/directory.models';
import {DirectoryStoreService} from '../../core/services/directory-store.service';

type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-directory-view',
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
    RouterLink,
    TuiButton,
    TuiCardLarge,
    TuiCheckbox,
    TuiChevron,
    TuiDataListWrapper,
    TuiDialog,
    TuiHeader,
    TuiInput,
    TuiInputChip,
    TuiLabel,
    TuiNotification,
    TuiSelect,
    TuiSwitch,
    TuiTable,
    TuiTextarea,
    TuiTextfield,
    TuiTitle,
  ],
  templateUrl: './directory-view.component.html',
  styleUrl: './directory-view.component.less',
})
export class DirectoryViewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(DirectoryStoreService);

  private readonly directoryId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') || '')),
    {initialValue: ''},
  );

  readonly directory = computed(() => {
    const id = this.directoryId();
    return id ? this.store.getDirectory(id) : undefined;
  });

  readonly groupName = computed(() => {
    const dir = this.directory();
    return dir ? this.store.getGroup(dir.groupId)?.name || '—' : '—';
  });

  readonly fieldNames = computed(
    () => this.directory()?.schema.fields.map((f) => f.name) ?? [],
  );

  readonly visibleColumns = signal<string[]>([]);
  readonly search = signal('');
  readonly filterField = signal<string | null>(null);
  readonly filterValue = signal('');
  readonly sortField = signal<string>('id');
  readonly sortDir = signal<SortDir>('asc');
  readonly createOpen = signal(false);
  readonly formError = signal('');
  formModel: Record<string, unknown> = {};

  readonly editableFields = computed(() =>
    (this.directory()?.schema.fields ?? []).filter(
      (f) => !this.isAutoField(f.type) || f.type === 'uuid',
    ),
  );

  readonly columns = computed(() => {
    const fields = this.directory()?.schema.fields ?? [];
    const selected = this.visibleColumns();
    return selected.length
      ? fields.filter((f) => selected.includes(f.name))
      : fields;
  });

  readonly columnNames = computed(() => [
    ...this.columns().map((f) => f.name),
    'actions',
  ]);

  readonly displayedItems = computed(() => {
    const dir = this.directory();
    if (!dir) {
      return [];
    }

    let items = [...dir.items];
    const q = this.search().trim().toLowerCase();
    if (q) {
      items = items.filter((item) =>
        Object.values(item.data).some((value) =>
          this.stringifyValue(value).toLowerCase().includes(q),
        ),
      );
    }

    const field = this.filterField();
    const filterValue = this.filterValue().trim().toLowerCase();
    if (field && filterValue) {
      items = items.filter((item) =>
        this.stringifyValue(item.data[field])
          .toLowerCase()
          .includes(filterValue),
      );
    }

    const sortField = this.sortField();
    const dirOrder = this.sortDir() === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const av = this.stringifyValue(a.data[sortField]);
      const bv = this.stringifyValue(b.data[sortField]);
      return av.localeCompare(bv, undefined, {numeric: true}) * dirOrder;
    });

    return items;
  });

  constructor() {
    effect(() => {
      const dir = this.directory();
      if (!dir) {
        return;
      }
      untracked(() => {
        this.visibleColumns.set(dir.schema.fields.map((f) => f.name));
        this.sortField.set('id');
      });
    });
  }

  openCreate(): void {
    if (!this.directory()) {
      void this.router.navigate(['/']);
      return;
    }

    this.formError.set('');
    this.formModel = {};
    for (const field of this.editableFields()) {
      this.formModel[field.name] = field.isList
        ? []
        : field.type === 'bool'
          ? false
          : field.type === 'json'
            ? '{}'
            : '';
    }
    this.createOpen.set(true);
  }

  toggleColumn(name: string, enabled: boolean): void {
    this.visibleColumns.update((cols) => {
      if (enabled) {
        return cols.includes(name) ? cols : [...cols, name];
      }
      const next = cols.filter((c) => c !== name);
      return next.length ? next : cols;
    });
  }

  isColumnVisible(name: string): boolean {
    return this.visibleColumns().includes(name);
  }

  toggleSort(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
  }

  cellValue(item: DirectoryItem, field: FieldDefinition): string {
    return this.stringifyValue(item.data[field.name]);
  }

  referenceOptions(field: FieldDefinition): string[] {
    if (!field.referenceDirectoryId) {
      return [];
    }
    return (
      this.store
        .getDirectory(field.referenceDirectoryId)
        ?.items.map((i) => i.id) || []
    );
  }

  stringifyRef = (id: string): string => {
    for (const dir of this.store.directories()) {
      const item = dir.items.find((i) => i.id === id);
      if (item) {
        const label =
          (item.data['name'] as string) ||
          (item.data['title'] as string) ||
          id;
        return `${label} (${id.slice(0, 8)}…)`;
      }
    }
    return id;
  };

  saveItem(observer: {complete: () => void}): void {
    const dir = this.directory();
    if (!dir) {
      return;
    }

    this.formError.set('');
    const payload: Record<string, unknown> = {};

    for (const field of dir.schema.fields) {
      if (this.isAutoField(field.type) && field.type !== 'uuid') {
        continue;
      }

      let value = this.formModel[field.name];

      if (field.type === 'int' && !field.isList) {
        value =
          value === '' || value === null || value === undefined
            ? undefined
            : Number(value);
      }

      if (field.type === 'json') {
        try {
          value = field.isList
            ? (value as string[]).map((v) => JSON.parse(String(v)))
            : JSON.parse(String(value || '{}'));
        } catch {
          this.formError.set(`Поле «${field.name}»: невалидный JSON`);
          return;
        }
      }

      if (field.validations.some((v) => v.kind === 'required')) {
        const emptyList = field.isList && Array.isArray(value) && !value.length;
        const emptyScalar =
          !field.isList &&
          (value === undefined || value === null || value === '');
        if (emptyList || emptyScalar) {
          this.formError.set(`Поле «${field.name}» обязательно`);
          return;
        }
      }

      payload[field.name] = value;
    }

    this.store.addItem(dir.id, payload);
    this.createOpen.set(false);
    observer.complete();
  }

  deleteItem(itemId: string): void {
    const dir = this.directory();
    if (!dir) {
      return;
    }
    this.store.deleteItem(dir.id, itemId);
  }

  isAutoField(type: FieldType): boolean {
    return type === 'autogenerated_uuid' || type === 'autoincrement';
  }

  private stringifyValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

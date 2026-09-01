import {JsonPipe} from '@angular/common';
import {Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiTable, TuiTablePagination} from '@taiga-ui/addon-table';
import {
  TuiButton,
  TuiDataList,
  TuiDialogService,
  TuiDropdown,
  TuiHint,
  TuiIcon,
  TuiInput,
  TuiLabel,
  TuiNotification,
  TuiTextfield,
  TuiTitle,
} from '@taiga-ui/core';
import {
  TUI_CONFIRM,
  TuiAccordion,
  TuiBadge,
  TuiChevron,
  TuiChip,
  TuiDataListWrapper,
  TuiFilter,
  TuiItemsWithMore,
  TuiSelect,
  TuiStatus,
} from '@taiga-ui/kit';
import {TuiCardLarge, TuiForm, TuiHeader} from '@taiga-ui/layout';
import {PolymorpheusTemplate} from '@taiga-ui/polymorpheus';
import {map} from 'rxjs';
import {
  DirectoryItem,
  DirectoryType,
  FILE_DIRECTORY_FORMAT_OPTIONS,
  FieldDefinition,
  FileDirectoryFormat,
} from '../../core/models/directory.models';
import {DirectoryItemFormService} from '../../core/services/directory-item-form.service';
import {DirectoryStoreService} from '../../core/services/directory-store.service';
import {CodeEditorComponent} from '../../shared/code-editor/code-editor.component';
import {DirectoryItemFieldsComponent} from '../directory-item-fields/directory-item-fields.component';
import {parseDocument} from 'yaml';

type SortDir = 'asc' | 'desc';

interface ListFieldFilter {
  id: string;
  field: string | null;
  value: string;
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

@Component({
  selector: 'app-directory-view',
  standalone: true,
  imports: [
    CodeEditorComponent,
    DirectoryItemFieldsComponent,
    FormsModule,
    JsonPipe,
    PolymorpheusTemplate,
    RouterLink,
    TuiAccordion,
    TuiBadge,
    TuiButton,
    TuiCardLarge,
    TuiChevron,
    TuiChip,
    TuiDataList,
    TuiDataListWrapper,
    TuiDropdown,
    TuiFilter,
    TuiForm,
    TuiHeader,
    TuiHint,
    TuiIcon,
    TuiInput,
    TuiItemsWithMore,
    TuiLabel,
    TuiNotification,
    TuiSelect,
    TuiStatus,
    TuiTable,
    TuiTablePagination,
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
  private readonly dialogs = inject(TuiDialogService);
  readonly itemForm = inject(DirectoryItemFormService);

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

  readonly directoryType = computed<DirectoryType>(
    () => this.directory()?.type ?? 'list',
  );

  readonly isListDirectory = computed(() => this.directoryType() === 'list');
  readonly isSingleDirectory = computed(() => this.directoryType() === 'single');
  readonly isFileDirectory = computed(() => this.directoryType() === 'file');
  readonly isSchemaType = computed(
    () => this.isListDirectory() || this.isSingleDirectory(),
  );

  readonly singleItem = computed(() => this.directory()?.items[0]);

  readonly fileFormat = computed<FileDirectoryFormat>(
    () => this.directory()?.fileFormat ?? 'json',
  );
  readonly fileContent = signal('');
  readonly fileError = signal('');
  readonly singleFormError = signal('');
  private initialSingleSnapshot = '';
  private initialFileContent = '';

  readonly fieldNames = computed(
    () => this.directory()?.schema.fields.map((f) => f.name) ?? [],
  );

  readonly visibleColumns = signal<string[]>([]);
  readonly search = signal('');
  readonly fieldFilters = signal<ListFieldFilter[]>([]);
  readonly sortField = signal<string>('id');
  readonly sortDir = signal<SortDir>('asc');
  readonly filtersOpen = signal(false);
  readonly columnsOpen = signal(false);
  readonly dirMenuOpen = signal(false);
  readonly contextItemId = signal<string | null>(null);
  readonly pageSizes = PAGE_SIZES;
  readonly page = signal(0);
  readonly pageSize = signal(10);

  readonly formFields = computed(() => this.directory()?.schema.fields ?? []);

  readonly columns = computed(() => {
    const fields = this.directory()?.schema.fields ?? [];
    const selected = this.visibleColumns();
    return selected.length
      ? fields.filter((f) => selected.includes(f.name))
      : fields;
  });

  readonly columnNames = computed(() => this.columns().map((f) => f.name));

  readonly activeFieldFiltersCount = computed(
    () =>
      this.fieldFilters().filter(
        (filter) => filter.field && filter.value.trim(),
      ).length,
  );

  readonly hasFieldFilter = computed(() => this.activeFieldFiltersCount() > 0);

  readonly columnLayout = computed(() => {
    const fields = this.columns();
    const items = this.filteredItems();
    const widthsPx = fields.map((field) => {
      let maxLen = Math.max(field.name.length, 8);
      for (const item of items.slice(0, 80)) {
        maxLen = Math.max(maxLen, this.cellValue(item, field).length);
      }
      return Math.max(160, Math.min(40, maxLen) * 9);
    });
    const widthPx = widthsPx.reduce((sum, width) => sum + width, 0);
    return {
      widths: widthsPx.map((width) => `${width}px`),
      width: `${widthPx}px`,
    };
  });

  readonly filteredItems = computed(() => {
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

    const fieldFilters = this.fieldFilters();
    for (const filter of fieldFilters) {
      const field = filter.field;
      const filterValue = filter.value.trim().toLowerCase();
      if (field && filterValue) {
        items = items.filter((item) =>
          this.stringifyValue(item.data[field])
            .toLowerCase()
            .includes(filterValue),
        );
      }
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

  readonly pagedItems = computed(() => {
    const items = this.filteredItems();
    const size = this.pageSize();
    const maxPage = Math.max(0, Math.ceil(items.length / size) - 1);
    const page = Math.min(this.page(), maxPage);
    return items.slice(page * size, page * size + size);
  });

  constructor() {
    effect(() => {
      const dir = this.directory();
      const type = this.directoryType();
      untracked(() => {
        if (!dir || (type !== 'single' && type !== 'file') || dir.items.length) {
          return;
        }
        this.store.addItem(
          dir.id,
          type === 'file' ? {format: dir.fileFormat ?? 'json', content: ''} : {},
        );
      });
    });

    effect(() => {
      const dir = this.directory();
      const type = this.directoryType();
      const item = this.singleItem();
      untracked(() => {
        if (!dir || type !== 'file') {
          return;
        }
        this.fileContent.set(String(item?.data['content'] ?? ''));
        this.initialFileContent = this.fileContent();
        this.fileError.set('');
      });
    });

    effect(() => {
      const dir = this.directory();
      const type = this.directoryType();
      const item = this.singleItem();
      untracked(() => {
        if (type !== 'single' || !dir) {
          return;
        }
        this.itemForm.populate(dir.schema.fields, item);
        this.initialSingleSnapshot = this.itemForm.formSnapshot(dir.schema.fields);
        this.singleFormError.set('');
      });
    });

    effect(() => {
      const id = this.directoryId();
      untracked(() => {
        const dir = id ? this.store.getDirectory(id) : undefined;
        if (!dir) {
          return;
        }
        this.visibleColumns.set(dir.schema.fields.map((f) => f.name));
        this.sortField.set('id');
        this.page.set(0);
      });
    });

    effect(() => {
      this.search();
      this.fieldFilters();
      untracked(() => this.page.set(0));
    });

    effect(() => {
      const total = this.filteredItems().length;
      const size = this.pageSize();
      const maxPage = Math.max(0, Math.ceil(total / size) - 1);
      if (this.page() > maxPage) {
        untracked(() => this.page.set(maxPage));
      }
    });
  }

  openCreate(): void {
    const dir = this.directory();
    if (!dir) {
      void this.router.navigate(['/']);
      return;
    }
    void this.router.navigate(['/directories', dir.id, 'items', 'new']);
  }

  openEdit(item: DirectoryItem): void {
    const dir = this.directory();
    if (!dir) {
      return;
    }
    void this.router.navigate(['/directories', dir.id, 'items', item.id]);
  }

  editContextItem(): void {
    const item = this.contextItem();
    if (item) {
      this.openEdit(item);
    }
  }

  deleteContextItem(): void {
    const itemId = this.contextItemId();
    if (!itemId) {
      return;
    }
    this.deleteItem(itemId);
    this.contextItemId.set(null);
  }

  private contextItem(): DirectoryItem | undefined {
    const itemId = this.contextItemId();
    if (!itemId) {
      return undefined;
    }
    return this.directory()?.items.find((item) => item.id === itemId);
  }

  editDirectory(): void {
    const dir = this.directory();
    if (!dir) {
      return;
    }
    void this.router.navigate(['/directories', dir.id, 'edit']);
  }

  deleteDirectory(): void {
    const dir = this.directory();
    if (!dir) {
      return;
    }
    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: `Удалить «${dir.name}»?`,
        size: 's',
        data: {
          content:
            'Справочник и все его объекты будут удалены без возможности восстановления.',
          yes: 'Удалить',
          no: 'Отмена',
          appearance: 'negative',
        },
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.store.deleteDirectory(dir.id);
        void this.router.navigate(['/']);
      });
  }

  onColumnsChange(columns: readonly string[]): void {
    if (!columns.length) {
      return;
    }
    this.visibleColumns.set([...columns]);
  }

  onFiltersOpen(open: boolean): void {
    this.filtersOpen.set(open);
    if (open && !this.fieldFilters().length) {
      this.addFieldFilter();
    }
  }

  addFieldFilter(): void {
    this.fieldFilters.update((filters) => [
      ...filters,
      {id: crypto.randomUUID(), field: null, value: ''},
    ]);
  }

  updateFieldFilter(
    id: string,
    patch: Partial<Pick<ListFieldFilter, 'field' | 'value'>>,
  ): void {
    this.fieldFilters.update((filters) =>
      filters.map((filter) =>
        filter.id === id ? {...filter, ...patch} : filter,
      ),
    );
  }

  removeFieldFilter(id: string): void {
    this.fieldFilters.update((filters) =>
      filters.filter((filter) => filter.id !== id),
    );
  }

  clearFilter(): void {
    this.fieldFilters.set([]);
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

  cellList(item: DirectoryItem, field: FieldDefinition): string[] {
    const value = item.data[field.name];
    if (Array.isArray(value)) {
      return value.map((v) => this.stringifyValue(v)).filter(Boolean);
    }
    const text = this.stringifyValue(value);
    return text ? [text] : [];
  }

  isListCell(item: DirectoryItem, field: FieldDefinition): boolean {
    return field.isList || Array.isArray(item.data[field.name]);
  }

  isBoolCell(field: FieldDefinition): boolean {
    return field.type === 'bool' && !field.isList;
  }

  boolValue(item: DirectoryItem, field: FieldDefinition): boolean {
    return Boolean(item.data[field.name]);
  }

  isEmptyCell(item: DirectoryItem, field: FieldDefinition): boolean {
    const value = item.data[field.name];
    if (Array.isArray(value)) {
      return !value.length;
    }
    return value === null || value === undefined || value === '';
  }

  stringifyFileFormat = (value: FileDirectoryFormat): string =>
    FILE_DIRECTORY_FORMAT_OPTIONS.find((o) => o.value === value)?.label || value;

  saveSingleItem(): void {
    const dir = this.directory();
    const item = this.singleItem();
    if (!dir || !item) {
      return;
    }

    this.singleFormError.set('');
    const {payload, error} = this.itemForm.buildPayload(
      dir.schema.fields,
      item.id,
    );
    if (error) {
      this.singleFormError.set(error);
      return;
    }

    this.store.updateItem(dir.id, item.id, payload);
    this.initialSingleSnapshot = this.itemForm.formSnapshot(dir.schema.fields);
  }

  cancelSingleItemChanges(): void {
    const dir = this.directory();
    const item = this.singleItem();
    if (!dir) {
      return;
    }
    this.itemForm.populate(dir.schema.fields, item);
    this.singleFormError.set('');
  }

  hasSingleChanges(): boolean {
    const dir = this.directory();
    if (!dir) {
      return false;
    }
    return (
      this.itemForm.formSnapshot(dir.schema.fields) !== this.initialSingleSnapshot
    );
  }

  saveFile(): void {
    const dir = this.directory();
    if (!dir || this.directoryType() !== 'file') {
      return;
    }

    this.fileError.set('');
    const format = this.fileFormat();
    const content = this.fileContent();

    if (content.trim()) {
      if (format === 'json') {
        try {
          JSON.parse(content);
        } catch {
          this.fileError.set('Невалидный JSON');
          return;
        }
      } else {
        const validationError = this.validateYaml(content);
        if (validationError) {
          this.fileError.set(validationError);
          return;
        }
      }
    }

    const item = this.singleItem();
    const payload = {format, content};
    if (item) {
      this.store.updateItem(dir.id, item.id, payload);
    } else {
      this.store.addItem(dir.id, payload);
    }

    this.initialFileContent = content;
  }

  cancelFileChanges(): void {
    this.fileContent.set(this.initialFileContent);
    this.fileError.set('');
  }

  hasFileChanges(): boolean {
    return this.fileContent() !== this.initialFileContent;
  }

  deleteItem(itemId: string): void {
    if (this.directoryType() !== 'list') {
      return;
    }
    const dir = this.directory();
    if (!dir) {
      return;
    }
    this.store.deleteItem(dir.id, itemId);
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

  private validateYaml(content: string): string | null {
    const doc = parseDocument(content, {prettyErrors: false});
    const error = doc.errors.find((item) => item.name === 'YAMLParseError');
    return error?.message ?? null;
  }
}

import {JsonPipe} from '@angular/common';
import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray} from '@angular/cdk/drag-drop';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {
  TuiButton,
  TuiCell,
  TuiClose,
  TuiIcon,
  TuiInput,
  TuiLabel,
  TuiNotification,
  TuiPopup,
  TuiTextfield,
  TuiTitle,
} from '@taiga-ui/core';
import {
  TuiAccordion,
  TuiBadge,
  TuiChevron,
  TuiDataListWrapper,
  TuiDrawer,
  TuiInputChip,
  TuiSelect,
  TuiSwitch,
  TuiTextarea,
} from '@taiga-ui/kit';
import {TuiCardLarge, TuiForm, TuiHeader} from '@taiga-ui/layout';
import {
  DIRECTORY_TYPE_OPTIONS,
  FIELD_TYPE_OPTIONS,
  FILE_DIRECTORY_FORMAT_OPTIONS,
  DirectoryType,
  FieldDefinition,
  FieldType,
  FieldValidation,
  FileDirectoryFormat,
  VALIDATION_KIND_OPTIONS,
  ValidationKind,
} from '../../core/models/directory.models';
import {DirectoryStoreService} from '../../core/services/directory-store.service';
import {ItemFactoryService} from '../../core/services/item-factory.service';
import {SchemaBuilderService} from '../../core/services/schema-builder.service';
import {ValidationCatalogService} from '../../core/services/validation-catalog.service';

@Component({
  selector: 'app-directory-create',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    FormsModule,
    JsonPipe,
    RouterLink,
    TuiAccordion,
    TuiBadge,
    TuiButton,
    TuiCardLarge,
    TuiCell,
    TuiChevron,
    TuiClose,
    TuiDataListWrapper,
    TuiDrawer,
    TuiForm,
    TuiHeader,
    TuiIcon,
    TuiInput,
    TuiInputChip,
    TuiLabel,
    TuiNotification,
    TuiPopup,
    TuiSelect,
    TuiSwitch,
    TuiTextarea,
    TuiTextfield,
    TuiTitle,
  ],
  templateUrl: './directory-create.component.html',
  styleUrl: './directory-create.component.less',
})
export class DirectoryCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(DirectoryStoreService);
  private readonly ids = inject(ItemFactoryService);
  readonly schemaBuilder = inject(SchemaBuilderService);
  readonly validationCatalog = inject(ValidationCatalogService);

  readonly fieldTypeValues = FIELD_TYPE_OPTIONS.map((o) => o.value);
  readonly validationKindValues = VALIDATION_KIND_OPTIONS.map((o) => o.value);
  readonly directoryTypeValues = DIRECTORY_TYPE_OPTIONS.map((o) => o.value);
  readonly fileFormatValues = FILE_DIRECTORY_FORMAT_OPTIONS.map((o) => o.value);

  groupId = '';
  directoryId = '';
  name = '';
  description = '';
  directoryType: DirectoryType = 'list';
  fileFormat: FileDirectoryFormat = 'json';
  fileSchemaEnabled = false;
  fileSchemaText = '';

  readonly isEdit = signal(false);
  readonly fields = signal<FieldDefinition[]>([]);
  readonly error = signal('');
  readonly fieldDrawerOpen = signal(false);
  readonly draft = signal<FieldDefinition | null>(null);
  readonly draftMode = signal<'add' | 'edit'>('add');
  readonly draftError = signal('');
  readonly nestedFieldDrawerOpen = signal(false);
  readonly nestedDraft = signal<FieldDefinition | null>(null);
  readonly nestedDraftMode = signal<'add' | 'edit'>('add');
  readonly nestedDraftError = signal('');
  readonly nestedEditPath = signal<number[]>([]);

  readonly previewSchema = computed(() =>
    this.schemaBuilder.buildJsonSchema(this.schemaFieldsForType(), this.name.trim() || 'directory'),
  );

  readonly groupName = computed(
    () => this.store.getGroup(this.groupId)?.name || '—',
  );

  readonly directoryIds = computed(() =>
    this.store
      .directories()
      .filter((d) => d.id !== this.directoryId)
      .map((d) => d.id),
  );

  readonly pageTitle = computed(() =>
    this.isEdit() ? 'Редактирование справочника' : 'Новый справочник',
  );

  readonly saveLabel = computed(() =>
    this.isEdit() ? 'Сохранить' : 'Создать справочник',
  );

  readonly cancelLink = computed(() =>
    this.isEdit() && this.directoryId
      ? ['/directories', this.directoryId]
      : ['/'],
  );

  readonly idField = computed(
    () => this.fields().find((f) => this.isSystemField(f)) ?? null,
  );

  readonly userFields = computed(() =>
    this.fields().filter((f) => !this.isSystemField(f)),
  );

  readonly tileFields = computed(() => {
    const idField = this.idField();
    return idField ? [idField, ...this.userFields()] : this.userFields();
  });

  readonly drawerTitle = computed(() =>
    this.draftMode() === 'add' ? 'Новое поле' : 'Редактирование поля',
  );
  readonly nestedDrawerTitle = computed(() =>
    this.nestedDraftMode() === 'add'
      ? 'Новое вложенное поле'
      : 'Редактирование вложенного поля',
  );

  ngOnInit(): void {
    const directoryId = this.route.snapshot.paramMap.get('id') || '';
    if (directoryId) {
      const directory = this.store.getDirectory(directoryId);
      if (!directory) {
        void this.router.navigate(['/']);
        return;
      }
      this.isEdit.set(true);
      this.directoryId = directory.id;
      this.groupId = directory.groupId;
      this.name = directory.name;
      this.description = directory.description;
      this.directoryType = directory.type ?? 'list';
      this.fileFormat = directory.fileFormat ?? 'json';
      this.fileSchemaEnabled = directory.fileSchemaEnabled ?? false;
      this.fileSchemaText = directory.fileSchemaText ?? '';
      this.fields.set(
        this.directoryType === 'file'
          ? []
          : directory.schema.fields
              .map((field) => this.cloneField(field))
              .filter((field) =>
                this.directoryType === 'single' ? !this.isSystemField(field) : true,
              ),
      );
      return;
    }

    this.groupId = this.route.snapshot.paramMap.get('groupId') || '';
    if (!this.store.getGroup(this.groupId)) {
      void this.router.navigate(['/']);
      return;
    }
    this.directoryType = 'list';
    this.fileFormat = 'json';
    this.fileSchemaEnabled = false;
    this.fileSchemaText = '';
    this.fields.set(this.schemaBuilder.ensureIdField([]));
  }

  onDirectoryTypeChange(type: DirectoryType): void {
    this.directoryType = type;
    if (type === 'file') {
      this.fields.set([]);
      return;
    }

    if (type === 'list') {
      this.fields.set(this.schemaBuilder.ensureIdField(this.fields()));
      return;
    }
    this.fields.set(this.fields().filter((f) => !this.isSystemField(f)));
  }

  openAddField(): void {
    this.draftMode.set('add');
    this.draftError.set('');
    this.draft.set({
      id: this.ids.uuid(),
      name: '',
      description: '',
      type: 'string',
      isList: false,
      fields: [],
      enumValues: [],
      validations: [],
    });
    this.fieldDrawerOpen.set(true);
  }

  openEditField(field: FieldDefinition): void {
    this.draftMode.set('edit');
    this.draftError.set('');
    const cloned = this.cloneField(field);
    this.draft.set(cloned);
    this.fieldDrawerOpen.set(true);
  }

  closeFieldDrawer(): void {
    this.fieldDrawerOpen.set(false);
    this.draft.set(null);
    this.draftError.set('');
    this.closeNestedFieldDrawer();
  }

  patchDraft(patch: Partial<FieldDefinition>): void {
    this.draft.update((current) => {
      if (!current) {
        return current;
      }
      if (this.isSystemField(current)) {
        return {...current, description: patch.description ?? current.description};
      }
      const next = {...current, ...patch};
      if (patch.type && !this.schemaBuilder.typeSupportsList(patch.type)) {
        next.isList = false;
      }
      if (patch.type && patch.type !== 'enum') {
        next.enumValues = [];
      }
      if (patch.type && patch.type !== 'reference') {
        next.referenceDirectoryId = undefined;
      }
      if (patch.type && patch.type !== 'object') {
        next.fields = [];
      }
      return next;
    });
  }

  setDraftEnumValues(values: string[]): void {
    this.patchDraft({enumValues: values});
  }

  addDraftValidation(): void {
    this.draft.update((current) =>
      current
        ? {
            ...current,
            validations: [
              ...current.validations,
              {id: this.ids.uuid(), kind: 'required'},
            ],
          }
        : current,
    );
  }

  updateDraftValidation(
    validationId: string,
    patch: Partial<FieldValidation>,
  ): void {
    this.draft.update((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        validations: current.validations.map((v) =>
          v.id === validationId ? {...v, ...patch} : v,
        ),
      };
    });
  }

  removeDraftValidation(validationId: string): void {
    const locked = new Set(['val-id-required', 'val-id-unique']);
    this.draft.update((current) => {
      if (!current) {
        return current;
      }
      if (this.isSystemField(current) && locked.has(validationId)) {
        return current;
      }
      return {
        ...current,
        validations: current.validations.filter((v) => v.id !== validationId),
      };
    });
  }

  onDraftValidationNumber(
    validationId: string,
    value: string | number | null,
  ): void {
    this.updateDraftValidation(validationId, {
      value: value === '' || value === null ? undefined : Number(value),
    });
  }

  nestedFields(path: number[]): FieldDefinition[] {
    const objectField = this.objectFieldByPath(path);
    return objectField?.fields ?? [];
  }

  nestedPath(path: number[], index: number): number[] {
    return [...path, index];
  }

  openAddNestedField(path: number[]): void {
    const parent = this.objectFieldByPath(path);
    if (!parent || parent.type !== 'object') {
      return;
    }
    this.nestedDraftMode.set('add');
    this.nestedDraftError.set('');
    this.nestedEditPath.set(path);
    this.nestedDraft.set({
      id: this.ids.uuid(),
      name: '',
      description: '',
      type: 'string',
      isList: false,
      fields: [],
      enumValues: [],
      validations: [],
    });
    this.nestedFieldDrawerOpen.set(true);
  }

  openEditNestedField(path: number[]): void {
    const field = this.fieldByPath(path);
    if (!field || this.isSystemField(field)) {
      return;
    }
    this.nestedDraftMode.set('edit');
    this.nestedDraftError.set('');
    this.nestedEditPath.set(path);
    this.nestedDraft.set(this.cloneField(field));
    this.nestedFieldDrawerOpen.set(true);
  }

  closeNestedFieldDrawer(): void {
    this.nestedFieldDrawerOpen.set(false);
    this.nestedDraft.set(null);
    this.nestedDraftError.set('');
    this.nestedEditPath.set([]);
  }

  patchNestedDraft(patch: Partial<FieldDefinition>): void {
    this.nestedDraft.update((current) => {
      if (!current) {
        return current;
      }
      const next = {...current, ...patch};
      if (patch.type && !this.schemaBuilder.typeSupportsList(patch.type)) {
        next.isList = false;
      }
      if (patch.type && patch.type !== 'enum') {
        next.enumValues = [];
      }
      if (patch.type && patch.type !== 'reference') {
        next.referenceDirectoryId = undefined;
      }
      if (patch.type && patch.type !== 'object') {
        next.fields = [];
      }
      return next;
    });
  }

  setNestedDraftEnumValues(values: string[]): void {
    this.patchNestedDraft({enumValues: values});
  }

  addNestedDraftValidation(): void {
    this.nestedDraft.update((current) =>
      current
        ? {
            ...current,
            validations: [
              ...current.validations,
              {id: this.ids.uuid(), kind: 'required'},
            ],
          }
        : current,
    );
  }

  updateNestedDraftValidation(
    validationId: string,
    patch: Partial<FieldValidation>,
  ): void {
    this.nestedDraft.update((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        validations: current.validations.map((v) =>
          v.id === validationId ? {...v, ...patch} : v,
        ),
      };
    });
  }

  onNestedDraftValidationNumber(
    validationId: string,
    value: string | number | null,
  ): void {
    this.updateNestedDraftValidation(validationId, {
      value: value === '' || value === null ? undefined : Number(value),
    });
  }

  removeNestedDraftValidation(validationId: string): void {
    this.nestedDraft.update((current) =>
      current
        ? {
            ...current,
            validations: current.validations.filter((v) => v.id !== validationId),
          }
        : current,
    );
  }

  saveNestedDraft(): void {
    const draft = this.nestedDraft();
    if (!draft) {
      return;
    }
    this.nestedDraftError.set('');
    const path = this.nestedEditPath();
    const siblingNames =
      this.nestedDraftMode() === 'add'
        ? this.nestedFields(path).map((f) => f.name.trim())
        : this.siblingNestedNames(path, draft.id);
    const message = this.validateField(draft, siblingNames);
    if (message) {
      this.nestedDraftError.set(message);
      return;
    }

    const normalized: FieldDefinition = {
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      fields: draft.type === 'object' ? draft.fields ?? [] : [],
      enumValues: draft.enumValues ?? [],
    };
    const nestedError = this.validateNestedFields(normalized);
    if (nestedError) {
      this.nestedDraftError.set(nestedError);
      return;
    }

    this.draft.update((root) => {
      if (!root) {
        return root;
      }
      const editable = this.cloneField(root);
      if (this.nestedDraftMode() === 'add') {
        const target = this.objectFieldByPath(path, editable);
        if (!target) {
          return root;
        }
        target.fields = [...(target.fields ?? []), normalized];
      } else {
        const replaced = this.replaceFieldAtPath(path, normalized, editable);
        if (!replaced) {
          return root;
        }
      }
      return editable;
    });

    this.closeNestedFieldDrawer();
  }

  removeNestedField(path: number[]): void {
    if (!path.length) {
      return;
    }
    this.draft.update((root) => {
      if (!root) {
        return root;
      }
      const editable = this.cloneField(root);
      const parentPath = path.slice(0, -1);
      const index = path[path.length - 1];
      const parent = this.objectFieldByPath(parentPath, editable);
      if (!parent || !parent.fields) {
        return root;
      }
      parent.fields = parent.fields.filter((_, i) => i !== index);
      return editable;
    });
  }

  saveDraft(): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }

    this.draftError.set('');
    const message = this.validateField(draft, this.siblingNames(draft.id));
    if (message) {
      this.draftError.set(message);
      return;
    }

    const normalized: FieldDefinition = {
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      fields: draft.type === 'object' ? draft.fields ?? [] : [],
      enumValues: draft.enumValues ?? [],
    };

    const nestedError = this.validateNestedFields(normalized);
    if (nestedError) {
      this.draftError.set(nestedError);
      return;
    }

    if (this.draftMode() === 'add') {
      this.fields.update((list) => [...list, normalized]);
    } else {
      this.fields.update((list) =>
        list.map((f) => (f.id === normalized.id ? normalized : f)),
      );
    }

    this.closeFieldDrawer();
  }

  removeField(fieldId: string): void {
    this.fields.update((list) =>
      list.filter((f) => !(f.id === fieldId && !this.isSystemField(f))),
    );
  }

  dropField(event: CdkDragDrop<FieldDefinition[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const reordered = [...this.tileFields()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);

    const idField = reordered.find((field) => this.isSystemField(field));
    const userFields = reordered.filter((field) => !this.isSystemField(field));
    this.fields.set(idField ? [idField, ...userFields] : userFields);
  }

  serverValidatorIds(type: FieldType): string[] {
    return this.validationCatalog.forType(type).map((v) => v.id);
  }

  stringifyType = (value: FieldType): string =>
    FIELD_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;

  typeBadge(type: FieldType): string {
    const label = FIELD_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
    return label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label;
  }

  stringifyDirectoryType = (value: DirectoryType): string =>
    DIRECTORY_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;

  stringifyFileFormat = (value: FileDirectoryFormat): string =>
    FILE_DIRECTORY_FORMAT_OPTIONS.find((o) => o.value === value)?.label || value;

  stringifyValidation = (value: ValidationKind): string =>
    VALIDATION_KIND_OPTIONS.find((o) => o.value === value)?.label || value;

  stringifyDirectory = (id: string): string =>
    this.store.getDirectory(id)?.name || id;

  stringifyServerValidator = (id: string): string =>
    this.validationCatalog.byId(id)?.name || id;

  isSystemField(field: Pick<FieldDefinition, 'id'>): boolean {
    return this.schemaBuilder.isSystemIdField(field);
  }

  isSchemaType(): boolean {
    return this.directoryType === 'list' || this.directoryType === 'single';
  }

  save(): void {
    this.error.set('');

    const name = this.name.trim();
    if (!name) {
      this.error.set('Укажите название справочника');
      return;
    }

    let schema;
    if (this.isSchemaType()) {
      const fields = this.schemaFieldsForType();
      for (const field of fields) {
        const message = this.validateField(
          field,
          fields.filter((f) => f.id !== field.id).map((f) => f.name.trim()),
        );
        if (message) {
          this.error.set(message);
          return;
        }
      }

      const normalized = fields.map((f) => ({
        ...f,
        name: f.name.trim(),
        description: f.description.trim(),
      }));

      schema = {
        fields: normalized,
        jsonSchema: this.schemaBuilder.buildJsonSchema(normalized, name),
      };
    } else {
      schema = {
        fields: [],
        jsonSchema: this.fileSchemaEnabled ? this.fileSchemaText : {},
      };
    }

    if (this.isEdit()) {
      this.store.updateDirectory(this.directoryId, {
        name,
        description: this.description.trim(),
        type: this.directoryType,
        fileFormat: this.directoryType === 'file' ? this.fileFormat : undefined,
        fileSchemaEnabled: this.directoryType === 'file' ? this.fileSchemaEnabled : undefined,
        fileSchemaText: this.directoryType === 'file' ? this.fileSchemaText : undefined,
        schema,
      });
      void this.router.navigate(['/directories', this.directoryId]);
      return;
    }

    const directory = this.store.createDirectory({
      groupId: this.groupId,
      name,
      description: this.description.trim(),
      type: this.directoryType,
      fileFormat: this.directoryType === 'file' ? this.fileFormat : undefined,
      fileSchemaEnabled: this.directoryType === 'file' ? this.fileSchemaEnabled : undefined,
      fileSchemaText: this.directoryType === 'file' ? this.fileSchemaText : undefined,
      schema,
    });

    void this.router.navigate(['/directories', directory.id]);
  }

  private schemaFieldsForType(): FieldDefinition[] {
    if (this.directoryType === 'list') {
      return this.schemaBuilder.ensureIdField(this.fields());
    }
    return this.fields().filter((f) => !this.isSystemField(f));
  }

  private siblingNames(fieldId: string): string[] {
    return this.tileFields()
      .filter((f) => f.id !== fieldId)
      .map((f) => f.name.trim());
  }

  private validateField(
    field: FieldDefinition,
    otherNames: string[],
  ): string | null {
    const name = field.name.trim();
    if (!name) {
      return 'Укажите имя поля';
    }
    if (!this.isSystemField(field) && name === 'id') {
      return 'Имя «id» зарезервировано системным полем';
    }
    if (otherNames.includes(name)) {
      return 'Имена полей должны быть уникальны';
    }
    if (field.type === 'enum' && !field.enumValues?.length) {
      return `Поле «${name}»: задайте значения enum`;
    }
    if (field.type === 'reference' && !field.referenceDirectoryId) {
      return `Поле «${name}»: выберите справочник-ссылку`;
    }
    for (const v of field.validations) {
      if (v.kind === 'server' && !v.serverValidatorId) {
        return `Поле «${name}»: выберите серверный валидатор`;
      }
      if (v.kind === 'custom' && !v.customRule?.trim()) {
        return `Поле «${name}»: опишите кастомное правило`;
      }
      if (
        ['min', 'max', 'minLength', 'maxLength', 'regex'].includes(v.kind) &&
        (v.value === undefined || v.value === '')
      ) {
        return `Поле «${name}»: укажите значение для валидации ${v.kind}`;
      }
    }
    return null;
  }

  private validateNestedFields(
    parent: FieldDefinition,
    path = parent.name.trim(),
  ): string | null {
    if (parent.type !== 'object') {
      return null;
    }
    const nested = parent.fields ?? [];
    const names = new Set<string>();
    for (const field of nested) {
      const fieldName = field.name.trim();
      if (!fieldName) {
        return `Объект «${path}»: укажите имя каждого вложенного поля`;
      }
      if (fieldName === 'id') {
        return `Объект «${path}»: имя «id» зарезервировано`;
      }
      if (names.has(fieldName)) {
        return `Объект «${path}»: имена вложенных полей должны быть уникальны`;
      }
      names.add(fieldName);
      const message = this.validateField(
        field,
        nested
          .filter((f) => f !== field)
          .map((f) => f.name.trim()),
      );
      if (message) {
        return `Объект «${path}»: ${message}`;
      }
      const childError = this.validateNestedFields(field, `${path}.${fieldName}`);
      if (childError) {
        return childError;
      }
    }
    return null;
  }

  private cloneField(field: FieldDefinition): FieldDefinition {
    return {
      ...field,
      fields: (field.fields ?? []).map((nested) => this.cloneField(nested)),
      enumValues: [...(field.enumValues || [])],
      validations: field.validations.map((v) => ({...v})),
    };
  }

  private siblingNestedNames(path: number[], fieldId: string): string[] {
    if (!path.length) {
      return [];
    }
    const parent = this.objectFieldByPath(path.slice(0, -1));
    return (parent?.fields ?? [])
      .filter((f) => f.id !== fieldId)
      .map((f) => f.name.trim());
  }

  private fieldByPath(path: number[], root = this.draft()): FieldDefinition | null {
    if (!root) {
      return null;
    }
    if (!path.length) {
      return root;
    }
    let current: FieldDefinition | undefined = root;
    for (const index of path) {
      if (!current || current.type !== 'object') {
        return null;
      }
      current = (current.fields ?? [])[index];
    }
    return current ?? null;
  }

  private objectFieldByPath(path: number[], root = this.draft()): FieldDefinition | null {
    const field = this.fieldByPath(path, root);
    return field && field.type === 'object' ? field : null;
  }

  private replaceFieldAtPath(
    path: number[],
    field: FieldDefinition,
    root: FieldDefinition,
  ): boolean {
    if (!path.length) {
      return false;
    }
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    const parent = this.objectFieldByPath(parentPath, root);
    if (!parent || !parent.fields || !parent.fields[index]) {
      return false;
    }
    parent.fields = parent.fields.map((item, i) => (i === index ? field : item));
    return true;
  }
}

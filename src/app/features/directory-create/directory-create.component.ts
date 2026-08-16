import {JsonPipe} from '@angular/common';
import {Component, computed, inject, OnInit, signal} from '@angular/core';
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
  TuiTiles,
} from '@taiga-ui/kit';
import {TuiCardLarge, TuiForm, TuiHeader} from '@taiga-ui/layout';
import {
  FIELD_TYPE_OPTIONS,
  FieldDefinition,
  FieldType,
  FieldValidation,
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
    TuiTiles,
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

  groupId = '';
  directoryId = '';
  name = '';
  description = '';
  fieldOrder = new Map<number, number>();

  readonly isEdit = signal(false);
  readonly fields = signal<FieldDefinition[]>([]);
  readonly error = signal('');
  readonly fieldDrawerOpen = signal(false);
  readonly draft = signal<FieldDefinition | null>(null);
  readonly draftMode = signal<'add' | 'edit'>('add');
  readonly draftError = signal('');

  readonly previewSchema = computed(() =>
    this.schemaBuilder.buildJsonSchema(
      this.schemaBuilder.ensureIdField(this.orderedFields()),
      this.name.trim() || 'directory',
    ),
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
      this.fields.set(
        this.schemaBuilder.ensureIdField(
          directory.schema.fields.map((field) => ({
            ...field,
            enumValues: [...(field.enumValues || [])],
            validations: field.validations.map((v) => ({...v})),
          })),
        ),
      );
      return;
    }

    this.groupId = this.route.snapshot.paramMap.get('groupId') || '';
    if (!this.store.getGroup(this.groupId)) {
      void this.router.navigate(['/']);
      return;
    }
    this.fields.set(this.schemaBuilder.ensureIdField([]));
  }

  openAddField(): void {
    this.applyOrder();
    this.draftMode.set('add');
    this.draftError.set('');
    this.draft.set({
      id: this.ids.uuid(),
      name: '',
      description: '',
      type: 'string',
      isList: false,
      enumValues: [],
      validations: [],
    });
    this.fieldDrawerOpen.set(true);
  }

  openEditField(field: FieldDefinition): void {
    this.applyOrder();
    this.draftMode.set('edit');
    this.draftError.set('');
    this.draft.set({
      ...field,
      enumValues: [...(field.enumValues || [])],
      validations: field.validations.map((v) => ({...v})),
    });
    this.fieldDrawerOpen.set(true);
  }

  closeFieldDrawer(): void {
    this.fieldDrawerOpen.set(false);
    this.draft.set(null);
    this.draftError.set('');
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
      enumValues: draft.enumValues ?? [],
    };

    if (this.draftMode() === 'add') {
      this.fields.update((list) => [...list, normalized]);
    } else {
      this.fields.update((list) =>
        list.map((f) => (f.id === normalized.id ? normalized : f)),
      );
    }

    this.fieldOrder = new Map();
    this.closeFieldDrawer();
  }

  removeField(fieldId: string): void {
    this.applyOrder();
    this.fields.update((list) =>
      list.filter((f) => !(f.id === fieldId && !this.isSystemField(f))),
    );
    this.fieldOrder = new Map();
  }

  serverValidatorIds(type: FieldType): string[] {
    return this.validationCatalog.forType(type).map((v) => v.id);
  }

  stringifyType = (value: FieldType): string =>
    FIELD_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;

  typeBadge(type: FieldType): string {
    return type;
  }

  stringifyValidation = (value: ValidationKind): string =>
    VALIDATION_KIND_OPTIONS.find((o) => o.value === value)?.label || value;

  stringifyDirectory = (id: string): string =>
    this.store.getDirectory(id)?.name || id;

  stringifyServerValidator = (id: string): string =>
    this.validationCatalog.byId(id)?.name || id;

  isSystemField(field: Pick<FieldDefinition, 'id'>): boolean {
    return this.schemaBuilder.isSystemIdField(field);
  }

  save(): void {
    this.error.set('');
    this.applyOrder();

    const name = this.name.trim();
    if (!name) {
      this.error.set('Укажите название справочника');
      return;
    }

    const fields = this.schemaBuilder.ensureIdField(this.fields());
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

    const schema = {
      fields: normalized,
      jsonSchema: this.schemaBuilder.buildJsonSchema(normalized, name),
    };

    if (this.isEdit()) {
      this.store.updateDirectory(this.directoryId, {
        name,
        description: this.description.trim(),
        schema,
      });
      void this.router.navigate(['/directories', this.directoryId]);
      return;
    }

    const directory = this.store.createDirectory({
      groupId: this.groupId,
      name,
      description: this.description.trim(),
      schema,
    });

    void this.router.navigate(['/directories', directory.id]);
  }

  private orderedFields(): FieldDefinition[] {
    const idField = this.idField();
    const ordered = this.orderedUserFields();
    return idField ? [idField, ...ordered] : ordered;
  }

  private orderedUserFields(): FieldDefinition[] {
    const list = this.tileFields();
    return list
      .map((field, index) => ({field, index}))
      .sort(
        (a, b) =>
          (this.fieldOrder.get(a.index) ?? a.index) -
          (this.fieldOrder.get(b.index) ?? b.index),
      )
      .map(({field}) => field)
      .sort((a, b) => Number(this.isSystemField(b)) - Number(this.isSystemField(a)));
  }

  private applyOrder(): void {
    const next = this.orderedFields();
    this.fields.set(next);
    this.fieldOrder = new Map();
  }

  private siblingNames(fieldId: string): string[] {
    return this.orderedFields()
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
}

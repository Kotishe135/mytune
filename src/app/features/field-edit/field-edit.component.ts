import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray} from '@angular/cdk/drag-drop';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {combineLatest, map} from 'rxjs';
import {
  TuiButton,
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
  TuiChevron,
  TuiDataListWrapper,
  TuiInputChip,
  TuiInputNumber,
  TuiSelect,
  TuiSwitch,
} from '@taiga-ui/kit';
import {TuiCardLarge, TuiForm} from '@taiga-ui/layout';
import {
  FIELD_TYPE_OPTIONS,
  FieldDefinition,
  FieldType,
  FieldValidation,
  VALIDATION_KIND_OPTIONS,
  ValidationKind,
} from '../../core/models/directory.models';
import {DirectoryDraftService} from '../../core/services/directory-draft.service';
import {DirectoryStoreService} from '../../core/services/directory-store.service';
import {ItemFactoryService} from '../../core/services/item-factory.service';
import {SchemaBuilderService} from '../../core/services/schema-builder.service';
import {ValidationCatalogService} from '../../core/services/validation-catalog.service';
import {
  cloneField,
  createEmptyField,
  createValidation,
  fieldTypeLabel,
  MAX_OBJECT_NESTING_DEPTH,
  normalizeField,
  OBJECT_NESTING_LIMIT_HINT,
  patchField,
  validateField,
  validateNestedFields,
} from '../../core/utils/field-definition.util';

@Component({
  selector: 'app-field-edit',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    FormsModule,
    TuiButton,
    TuiCardLarge,
    TuiChevron,
    TuiDataListWrapper,
    TuiDropdown,
    TuiForm,
    TuiHint,
    TuiIcon,
    TuiInput,
    TuiInputChip,
    ...TuiInputNumber,
    TuiLabel,
    TuiNotification,
    TuiSelect,
    TuiSwitch,
    TuiTextfield,
    TuiTitle,
  ],
  templateUrl: './field-edit.component.html',
  styleUrl: './field-edit.component.less',
})
export class FieldEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly draftService = inject(DirectoryDraftService);
  private readonly store = inject(DirectoryStoreService);
  private readonly ids = inject(ItemFactoryService);
  readonly schemaBuilder = inject(SchemaBuilderService);
  private readonly validationCatalog = inject(ValidationCatalogService);

  readonly fieldTypeValues = FIELD_TYPE_OPTIONS.map((o) => o.value);
  readonly validationKindValues = VALIDATION_KIND_OPTIONS.map((o) => o.value);

  readonly field = signal<FieldDefinition>(createEmptyField(''));
  readonly error = signal('');
  readonly mode = signal<'add' | 'edit'>('edit');
  readonly objectAncestorCount = signal(0);

  readonly objectNestingLimitHint = OBJECT_NESTING_LIMIT_HINT;

  private ownerFieldId: string | null = null;
  private fieldId = '';
  private directoryReturnUrl: string[] = [];
  private isNewField = false;

  readonly pageTitle = computed(() => {
    if (this.mode() === 'add') {
      return 'Новое поле';
    }
    const name = this.field().name.trim();
    return name ? `Редактирование: ${name}` : 'Редактирование поля';
  });

  readonly directoryIds = computed(() => {
    const draft = this.draftService.draft();
    if (!draft) {
      return [];
    }
    return this.store
      .directories()
      .filter((d) => d.id !== draft.directoryId)
      .map((d) => d.id);
  });

  readonly fieldTypeLabel = fieldTypeLabel;

  ngOnInit(): void {
    const draft = this.draftService.draft();
    if (!draft) {
      void this.router.navigate(['/']);
      return;
    }

    this.directoryReturnUrl = draft.isEdit
      ? ['/directories', draft.directoryId, 'edit']
      : ['/groups', draft.groupId, 'directories', 'new'];

    combineLatest([
      this.route.paramMap.pipe(map((params) => params.get('fieldId') || '')),
      this.route.queryParamMap.pipe(map((params) => params.get('new') === '1')),
    ]).subscribe(([fieldId, isNewField]) => {
      this.isNewField = isNewField;
      this.loadField(fieldId);
    });
  }

  private loadField(fieldId: string): void {
    if (!fieldId) {
      void this.router.navigate(this.directoryReturnUrl);
      return;
    }

    this.fieldId = fieldId;
    this.ownerFieldId = this.draftService.getFieldParentId(fieldId);
    this.mode.set(this.isNewField ? 'add' : 'edit');

    const located = this.draftService.findField(fieldId);
    if (!located) {
      void this.router.navigate(this.directoryReturnUrl);
      return;
    }

    if (this.ownerFieldId) {
      const owner = this.draftService.findField(this.ownerFieldId)?.field;
      if (!owner || owner.type !== 'object') {
        void this.router.navigate(this.directoryReturnUrl);
        return;
      }
    }

    this.field.set(cloneField(located.field));
    this.objectAncestorCount.set(
      this.draftService.getObjectAncestorCount(this.ownerFieldId),
    );
    this.error.set('');
  }

  patchField(patch: Partial<FieldDefinition>): void {
    if (patch.type === 'object' && this.isObjectTypeDisabled('object')) {
      return;
    }
    this.field.update((current) => patchField(current, patch, this.schemaBuilder));
  }

  isSystemField(): boolean {
    return this.schemaBuilder.isSystemIdField(this.field());
  }

  isLockedValidation(validationId: string): boolean {
    return (
      this.isSystemField() &&
      new Set(['val-id-required', 'val-id-unique']).has(validationId)
    );
  }

  isObjectTypeDisabled(type: FieldType): boolean {
    return type === 'object' && this.objectAncestorCount() >= MAX_OBJECT_NESTING_DEPTH;
  }

  disabledFieldTypeHandler = (type: FieldType): boolean => this.isObjectTypeDisabled(type);

  addValidation(): void {
    this.field.update((current) => ({
      ...current,
      validations: [...current.validations, createValidation(this.ids.uuid())],
    }));
  }

  updateValidation(validationId: string, patch: Partial<FieldValidation>): void {
    this.field.update((current) => ({
      ...current,
      validations: current.validations.map((v) =>
        v.id === validationId ? {...v, ...patch} : v,
      ),
    }));
  }

  onValidationNumber(validationId: string, value: number | null): void {
    this.updateValidation(validationId, {
      value: value === null ? undefined : value,
    });
  }

  removeValidation(validationId: string): void {
    if (this.isLockedValidation(validationId)) {
      return;
    }
    this.field.update((current) => ({
      ...current,
      validations: current.validations.filter((v) => v.id !== validationId),
    }));
  }

  serverValidatorIds(): string[] {
    return this.validationCatalog.forType(this.field().type).map((v) => v.id);
  }

  stringifyType = (value: FieldType): string =>
    FIELD_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;

  stringifyValidation = (value: ValidationKind): string =>
    VALIDATION_KIND_OPTIONS.find((o) => o.value === value)?.label || value;

  stringifyDirectory = (id: string): string =>
    this.store.getDirectory(id)?.name || id;

  stringifyServerValidator = (id: string): string =>
    this.validationCatalog.byId(id)?.name || id;

  openAddNestedField(): void {
    this.draftService.upsertField(this.ownerFieldId, this.field(), 'edit');
    const nested = createEmptyField(this.ids.uuid());
    this.draftService.upsertField(this.field().id, nested, 'add');
    void this.router.navigate(this.fieldEditUrl(nested.id), {
      queryParams: {new: '1'},
    });
  }

  openNestedField(nestedFieldId: string): void {
    this.draftService.upsertField(this.ownerFieldId, this.field(), 'edit');
    void this.router.navigate(this.fieldEditUrl(nestedFieldId), {
      queryParams: {new: null},
    });
  }

  removeNestedField(nestedFieldId: string): void {
    this.field.update((current) => ({
      ...current,
      fields: (current.fields ?? []).filter((f) => f.id !== nestedFieldId),
    }));
    this.draftService.upsertField(this.ownerFieldId, this.field(), 'edit');
  }

  dropNestedField(event: CdkDragDrop<FieldDefinition[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const reordered = [...(this.field().fields ?? [])];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.field.update((current) => ({...current, fields: reordered}));
    this.draftService.upsertField(this.ownerFieldId, this.field(), 'edit');
  }

  goBack(): void {
    const parentFieldId = this.draftService.getFieldParentId(this.fieldId);
    if (parentFieldId) {
      void this.router.navigate(this.fieldEditUrl(parentFieldId), {
        queryParams: {new: null},
      });
      return;
    }
    void this.router.navigate(this.directoryReturnUrl);
  }

  cancel(): void {
    if (this.isNewField) {
      this.draftService.removeField(this.fieldId, this.ownerFieldId);
    }
    this.goBack();
  }

  save(): void {
    this.error.set('');
    const working = normalizeField(this.field());

    const siblings = (this.draftService.findOwnerFields(this.ownerFieldId) ?? [])
      .filter((f) => f.id !== working.id)
      .map((f) => f.name.trim());

    const message = validateField(working, siblings, this.schemaBuilder);
    if (message) {
      this.error.set(message);
      return;
    }

    const nestedError = validateNestedFields(working, this.schemaBuilder);
    if (nestedError) {
      this.error.set(nestedError);
      return;
    }

    this.draftService.upsertField(this.ownerFieldId, working, 'edit');

    const parentFieldId = this.draftService.getFieldParentId(this.fieldId);
    if (parentFieldId) {
      void this.router.navigate(this.fieldEditUrl(parentFieldId), {
        queryParams: {new: null},
      });
      return;
    }
    void this.router.navigate(this.directoryReturnUrl);
  }

  private fieldEditUrl(fieldId: string): string[] {
    const draft = this.draftService.draft();
    if (!draft) {
      return ['/'];
    }
    if (draft.isEdit) {
      return ['/directories', draft.directoryId, 'edit', 'fields', fieldId];
    }
    return ['/groups', draft.groupId, 'directories', 'new', 'fields', fieldId];
  }
}

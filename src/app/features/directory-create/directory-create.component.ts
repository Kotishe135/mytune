import {JsonPipe} from '@angular/common';
import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {
  TuiButton,
  TuiCheckbox,
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
  TuiTextarea,
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
    TuiButton,
    TuiCardLarge,
    TuiCheckbox,
    TuiChevron,
    TuiDataListWrapper,
    TuiForm,
    TuiHeader,
    TuiInput,
    TuiInputChip,
    TuiLabel,
    TuiNotification,
    TuiSelect,
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

  groupId = '';
  name = '';
  description = '';
  readonly fields = signal<FieldDefinition[]>([]);
  readonly error = signal('');
  readonly previewSchema = computed(() =>
    this.schemaBuilder.buildJsonSchema(
      this.schemaBuilder.ensureIdField(this.fields()),
      this.name.trim() || 'directory',
    ),
  );

  readonly groupName = computed(
    () => this.store.getGroup(this.groupId)?.name || '—',
  );

  readonly directoryIds = computed(() =>
    this.store.directories().map((d) => d.id),
  );

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') || '';
    if (!this.store.getGroup(this.groupId)) {
      void this.router.navigate(['/']);
      return;
    }
    this.fields.set(this.schemaBuilder.ensureIdField([]));
  }

  addField(): void {
    this.fields.update((list) => [
      ...list,
      {
        id: this.ids.uuid(),
        name: '',
        description: '',
        type: 'string',
        isList: false,
        enumValues: [],
        validations: [],
      },
    ]);
  }

  removeField(fieldId: string): void {
    this.fields.update((list) =>
      list.filter((f) => !(f.id === fieldId && f.name !== 'id')),
    );
  }

  updateField(fieldId: string, patch: Partial<FieldDefinition>): void {
    this.fields.update((list) =>
      list.map((f) => {
        if (f.id !== fieldId) {
          return f;
        }
        if (f.name === 'id') {
          return {...f, description: patch.description ?? f.description};
        }
        const next = {...f, ...patch};
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
      }),
    );
  }

  setEnumValues(fieldId: string, values: string[]): void {
    this.updateField(fieldId, {enumValues: values});
  }

  addValidation(fieldId: string): void {
    this.fields.update((list) =>
      list.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              validations: [
                ...f.validations,
                {id: this.ids.uuid(), kind: 'required'},
              ],
            }
          : f,
      ),
    );
  }

  updateValidation(
    fieldId: string,
    validationId: string,
    patch: Partial<FieldValidation>,
  ): void {
    this.fields.update((list) =>
      list.map((f) => {
        if (f.id !== fieldId) {
          return f;
        }
        return {
          ...f,
          validations: f.validations.map((v) =>
            v.id === validationId ? {...v, ...patch} : v,
          ),
        };
      }),
    );
  }

  removeValidation(fieldId: string, validationId: string): void {
    const locked = new Set(['val-id-required', 'val-id-unique']);
    this.fields.update((list) =>
      list.map((f) => {
        if (f.id !== fieldId) {
          return f;
        }
        if (f.name === 'id' && locked.has(validationId)) {
          return f;
        }
        return {
          ...f,
          validations: f.validations.filter((v) => v.id !== validationId),
        };
      }),
    );
  }

  serverValidatorIds(type: FieldType): string[] {
    return this.validationCatalog.forType(type).map((v) => v.id);
  }

  stringifyType = (value: FieldType): string =>
    FIELD_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;

  stringifyValidation = (value: ValidationKind): string =>
    VALIDATION_KIND_OPTIONS.find((o) => o.value === value)?.label || value;

  stringifyDirectory = (id: string): string =>
    this.store.getDirectory(id)?.name || id;

  stringifyServerValidator = (id: string): string =>
    this.validationCatalog.byId(id)?.name || id;

  onValidationNumber(
    fieldId: string,
    validationId: string,
    value: string | number | null,
  ): void {
    this.updateValidation(fieldId, validationId, {
      value: value === '' || value === null ? undefined : Number(value),
    });
  }

  save(): void {
    this.error.set('');
    const name = this.name.trim();
    if (!name) {
      this.error.set('Укажите название справочника');
      return;
    }

    const fields = this.schemaBuilder.ensureIdField(this.fields());
    const names = fields.map((f) => f.name.trim());
    if (names.some((n) => !n)) {
      this.error.set('У всех полей должно быть имя');
      return;
    }
    if (new Set(names).size !== names.length) {
      this.error.set('Имена полей должны быть уникальны');
      return;
    }

    for (const field of fields) {
      if (field.type === 'enum' && !field.enumValues?.length) {
        this.error.set(`Поле «${field.name}»: задайте значения enum`);
        return;
      }
      if (field.type === 'reference' && !field.referenceDirectoryId) {
        this.error.set(`Поле «${field.name}»: выберите справочник-ссылку`);
        return;
      }
      for (const v of field.validations) {
        if (v.kind === 'server' && !v.serverValidatorId) {
          this.error.set(`Поле «${field.name}»: выберите серверный валидатор`);
          return;
        }
        if (v.kind === 'custom' && !v.customRule?.trim()) {
          this.error.set(`Поле «${field.name}»: опишите кастомное правило`);
          return;
        }
        if (
          ['min', 'max', 'minLength', 'maxLength', 'regex'].includes(v.kind) &&
          (v.value === undefined || v.value === '')
        ) {
          this.error.set(
            `Поле «${field.name}»: укажите значение для валидации ${v.kind}`,
          );
          return;
        }
      }
    }

    const normalized = fields.map((f) => ({
      ...f,
      name: f.name.trim(),
      description: f.description.trim(),
    }));

    const directory = this.store.createDirectory({
      groupId: this.groupId,
      name,
      description: this.description.trim(),
      schema: {
        fields: normalized,
        jsonSchema: this.schemaBuilder.buildJsonSchema(normalized, name),
      },
    });

    void this.router.navigate(['/directories', directory.id]);
  }
}

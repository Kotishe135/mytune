import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray} from '@angular/cdk/drag-drop';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {
  TuiButton,
  TuiIcon,
  TuiInput,
  TuiLabel,
  TuiNotification,
  TuiTextfield,
  TuiTitle,
} from '@taiga-ui/core';
import {TuiChevron, TuiDataListWrapper, TuiSelect, TuiSwitch, TuiTextarea} from '@taiga-ui/kit';
import {TuiCardLarge, TuiForm} from '@taiga-ui/layout';
import {
  DIRECTORY_TYPE_OPTIONS,
  FILE_DIRECTORY_FORMAT_OPTIONS,
  DirectoryType,
  FieldDefinition,
  FileDirectoryFormat,
} from '../../core/models/directory.models';
import {DirectoryDraftService} from '../../core/services/directory-draft.service';
import {DirectoryStoreService} from '../../core/services/directory-store.service';
import {ItemFactoryService} from '../../core/services/item-factory.service';
import {SchemaBuilderService} from '../../core/services/schema-builder.service';
import {
  cloneField,
  createEmptyField,
  fieldTypeLabel,
  validateField,
} from '../../core/utils/field-definition.util';
import {CodeEditorComponent} from '../../shared/code-editor/code-editor.component';

@Component({
  selector: 'app-directory-create',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    CodeEditorComponent,
    FormsModule,
    RouterLink,
    TuiButton,
    TuiCardLarge,
    TuiChevron,
    TuiDataListWrapper,
    TuiForm,
    TuiIcon,
    TuiInput,
    TuiLabel,
    TuiNotification,
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
  private readonly draftService = inject(DirectoryDraftService);
  private readonly ids = inject(ItemFactoryService);
  readonly schemaBuilder = inject(SchemaBuilderService);

  readonly directoryTypeValues = DIRECTORY_TYPE_OPTIONS.map((o) => o.value);
  readonly fileFormatValues = FILE_DIRECTORY_FORMAT_OPTIONS.map((o) => o.value);

  readonly error = signal('');

  get groupId(): string {
    return this.draftService.draft()?.groupId ?? '';
  }

  get directoryId(): string {
    return this.draftService.draft()?.directoryId ?? '';
  }

  get name(): string {
    return this.draftService.draft()?.name ?? '';
  }
  set name(value: string) {
    this.draftService.patchDraft({name: value});
  }

  get description(): string {
    return this.draftService.draft()?.description ?? '';
  }
  set description(value: string) {
    this.draftService.patchDraft({description: value});
  }

  get directoryType(): DirectoryType {
    return this.draftService.draft()?.directoryType ?? 'list';
  }

  get fileFormat(): FileDirectoryFormat {
    return this.draftService.draft()?.fileFormat ?? 'json';
  }
  set fileFormat(value: FileDirectoryFormat) {
    this.draftService.patchDraft({fileFormat: value});
  }

  get fileSchemaEnabled(): boolean {
    return this.draftService.draft()?.fileSchemaEnabled ?? false;
  }
  set fileSchemaEnabled(value: boolean) {
    this.draftService.patchDraft({fileSchemaEnabled: value});
  }

  get fileSchemaText(): string {
    return this.draftService.draft()?.fileSchemaText ?? '';
  }

  readonly isEdit = computed(() => this.draftService.draft()?.isEdit ?? false);

  readonly fields = computed(() => this.draftService.draft()?.fields ?? []);

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

  readonly fieldTypeLabel = fieldTypeLabel;

  ngOnInit(): void {
    const directoryId = this.route.snapshot.paramMap.get('id') || '';
    const existingDraft = this.draftService.draft();

    if (directoryId) {
      if (existingDraft?.directoryId === directoryId) {
        return;
      }
      const directory = this.store.getDirectory(directoryId);
      if (!directory) {
        void this.router.navigate(['/']);
        return;
      }
      this.draftService.setDraft({
        groupId: directory.groupId,
        directoryId: directory.id,
        isEdit: true,
        name: directory.name,
        description: directory.description,
        directoryType: directory.type ?? 'list',
        fileFormat: directory.fileFormat ?? 'json',
        fileSchemaEnabled: directory.fileSchemaEnabled ?? false,
        fileSchemaText: directory.fileSchemaText ?? '',
        fields:
          directory.type === 'file'
            ? []
            : directory.schema.fields
                .filter((field) =>
                  directory.type === 'single'
                    ? !this.schemaBuilder.isSystemIdField(field)
                    : true,
                )
                .map((field) => cloneField(field)),
      });
      return;
    }

    const groupId = this.route.snapshot.paramMap.get('groupId') || '';
    if (existingDraft?.groupId === groupId && !existingDraft.isEdit) {
      return;
    }
    if (!this.store.getGroup(groupId)) {
      void this.router.navigate(['/']);
      return;
    }
    this.draftService.setDraft({
      groupId,
      directoryId: '',
      isEdit: false,
      name: '',
      description: '',
      directoryType: 'list',
      fileFormat: 'json',
      fileSchemaEnabled: false,
      fileSchemaText: '',
      fields: this.schemaBuilder.ensureIdField([]),
    });
  }

  onDirectoryTypeChange(type: DirectoryType): void {
    const draft = this.draftService.draft();
    if (!draft) {
      return;
    }

    if (type === 'file') {
      this.draftService.patchDraft({
        directoryType: type,
        fields: [],
        fileSchemaEnabled: false,
      });
      return;
    }

    const fields =
      type === 'list'
        ? this.schemaBuilder.ensureIdField(draft.fields)
        : draft.fields.filter((f) => !this.schemaBuilder.isSystemIdField(f));

    this.draftService.patchDraft({
      directoryType: type,
      fields,
      fileSchemaEnabled: false,
      fileSchemaText: '',
    });
  }

  onFileSchemaChange(value: string): void {
    this.draftService.patchDraft({fileSchemaText: value});
  }

  openAddField(): void {
    const field = createEmptyField(this.ids.uuid());
    this.draftService.upsertField(null, field, 'add');
    void this.router.navigate(this.fieldEditUrl(field.id), {queryParams: {new: '1'}});
  }

  openEditField(field: FieldDefinition): void {
    void this.router.navigate(this.fieldEditUrl(field.id));
  }

  removeField(fieldId: string): void {
    this.draftService.removeField(fieldId, null);
  }

  dropField(event: CdkDragDrop<FieldDefinition[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const reordered = [...this.tileFields()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);

    const idField = reordered.find((field) => this.isSystemField(field));
    const userFields = reordered.filter((field) => !this.isSystemField(field));
    this.draftService.patchDraft({
      fields: idField ? [idField, ...userFields] : userFields,
    });
  }

  stringifyDirectoryType = (value: DirectoryType): string =>
    DIRECTORY_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;

  stringifyFileFormat = (value: FileDirectoryFormat): string =>
    FILE_DIRECTORY_FORMAT_OPTIONS.find((o) => o.value === value)?.label || value;

  isSystemField(field: Pick<FieldDefinition, 'id'>): boolean {
    return this.schemaBuilder.isSystemIdField(field);
  }

  isSchemaType(): boolean {
    return this.directoryType === 'list' || this.directoryType === 'single';
  }

  save(): void {
    this.error.set('');
    const draft = this.draftService.draft();
    if (!draft) {
      return;
    }

    const name = draft.name.trim();
    if (!name) {
      this.error.set('Укажите название справочника');
      return;
    }

    let schema;
    if (this.isSchemaType()) {
      const fields = this.schemaFieldsForType();
      for (const field of fields) {
        const message = validateField(
          field,
          fields.filter((f) => f.id !== field.id).map((f) => f.name.trim()),
          this.schemaBuilder,
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
        jsonSchema: draft.fileSchemaEnabled ? draft.fileSchemaText : {},
      };
    }

    if (draft.isEdit) {
      this.store.updateDirectory(draft.directoryId, {
        name,
        description: draft.description.trim(),
        type: draft.directoryType,
        fileFormat: draft.directoryType === 'file' ? draft.fileFormat : undefined,
        fileSchemaEnabled:
          draft.directoryType === 'file' ? draft.fileSchemaEnabled : undefined,
        fileSchemaText:
          draft.directoryType === 'file' ? draft.fileSchemaText : undefined,
        schema,
      });
      this.draftService.clear();
      void this.router.navigate(['/directories', draft.directoryId]);
      return;
    }

    const directory = this.store.createDirectory({
      groupId: draft.groupId,
      name,
      description: draft.description.trim(),
      type: draft.directoryType,
      fileFormat: draft.directoryType === 'file' ? draft.fileFormat : undefined,
      fileSchemaEnabled:
        draft.directoryType === 'file' ? draft.fileSchemaEnabled : undefined,
      fileSchemaText:
        draft.directoryType === 'file' ? draft.fileSchemaText : undefined,
      schema,
    });

    this.draftService.clear();
    void this.router.navigate(['/directories', directory.id]);
  }

  private schemaFieldsForType(): FieldDefinition[] {
    const fields = this.fields();
    if (this.directoryType === 'list') {
      return this.schemaBuilder.ensureIdField(fields);
    }
    return fields.filter((f) => !this.isSystemField(f));
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

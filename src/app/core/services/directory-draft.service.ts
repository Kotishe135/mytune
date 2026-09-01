import {Injectable, signal} from '@angular/core';
import {
  DirectoryType,
  FieldDefinition,
  FileDirectoryFormat,
} from '../models/directory.models';

export interface DirectoryDraft {
  groupId: string;
  directoryId: string;
  isEdit: boolean;
  name: string;
  description: string;
  directoryType: DirectoryType;
  fileFormat: FileDirectoryFormat;
  fileSchemaEnabled: boolean;
  fileSchemaText: string;
  fields: FieldDefinition[];
}

@Injectable({providedIn: 'root'})
export class DirectoryDraftService {
  readonly draft = signal<DirectoryDraft | null>(null);

  setDraft(draft: DirectoryDraft): void {
    this.draft.set(draft);
  }

  patchDraft(patch: Partial<DirectoryDraft>): void {
    const current = this.draft();
    if (!current) {
      return;
    }
    this.draft.set({...current, ...patch});
  }

  clear(): void {
    this.draft.set(null);
  }

  findField(
    fieldId: string,
    fields = this.draft()?.fields,
  ): {field: FieldDefinition; siblings: FieldDefinition[]} | null {
    if (!fields) {
      return null;
    }
    for (const field of fields) {
      if (field.id === fieldId) {
        return {field, siblings: fields};
      }
      if (field.type === 'object' && field.fields) {
        const nested = this.findField(fieldId, field.fields);
        if (nested) {
          return nested;
        }
      }
    }
    return null;
  }

  findOwnerFields(ownerFieldId: string | null): FieldDefinition[] | null {
    const draft = this.draft();
    if (!draft) {
      return null;
    }
    if (!ownerFieldId) {
      return draft.fields;
    }
    const owner = this.findField(ownerFieldId)?.field;
    if (!owner || owner.type !== 'object') {
      return null;
    }
    if (!owner.fields) {
      owner.fields = [];
    }
    return owner.fields;
  }

  upsertField(
    ownerFieldId: string | null,
    field: FieldDefinition,
    mode: 'add' | 'edit',
  ): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }

    if (!ownerFieldId) {
      const fields =
        mode === 'add'
          ? [...draft.fields, field]
          : draft.fields.map((f) => (f.id === field.id ? field : f));
      this.draft.set({...draft, fields});
      return;
    }

    const owner = this.findField(ownerFieldId)?.field;
    if (!owner || owner.type !== 'object') {
      return;
    }

    const nested = owner.fields ?? [];
    owner.fields =
      mode === 'add'
        ? [...nested, field]
        : nested.map((f) => (f.id === field.id ? field : f));

    this.draft.set({...draft, fields: [...draft.fields]});
  }

  removeField(fieldId: string, ownerFieldId: string | null): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }

    if (!ownerFieldId) {
      this.draft.set({
        ...draft,
        fields: draft.fields.filter((f) => f.id !== fieldId),
      });
      return;
    }

    const owner = this.findField(ownerFieldId)?.field;
    if (!owner?.fields) {
      return;
    }
    owner.fields = owner.fields.filter((f) => f.id !== fieldId);
    this.draft.set({...draft, fields: [...draft.fields]});
  }

  persistOwnerField(ownerFieldId: string, field: FieldDefinition): void {
    const located = this.findField(ownerFieldId);
    if (!located) {
      return;
    }
    const draft = this.draft();
    if (!draft) {
      return;
    }
    const index = located.siblings.findIndex((f) => f.id === ownerFieldId);
    if (index < 0) {
      return;
    }
    located.siblings[index] = field;
    this.draft.set({...draft, fields: [...draft.fields]});
  }

  findFieldPath(
    fieldId: string,
    fields = this.draft()?.fields,
    path: FieldDefinition[] = [],
  ): FieldDefinition[] | null {
    if (!fields) {
      return null;
    }
    for (const field of fields) {
      const currentPath = [...path, field];
      if (field.id === fieldId) {
        return currentPath;
      }
      if (field.type === 'object' && field.fields) {
        const nested = this.findFieldPath(fieldId, field.fields, currentPath);
        if (nested) {
          return nested;
        }
      }
    }
    return null;
  }

  getObjectAncestorCount(ownerFieldId: string | null): number {
    if (!ownerFieldId) {
      return 0;
    }
    const path = this.findFieldPath(ownerFieldId);
    if (!path) {
      return 0;
    }
    return path.filter((field) => field.type === 'object').length;
  }

  getFieldParentId(fieldId: string): string | null {
    const path = this.findFieldPath(fieldId);
    if (!path || path.length < 2) {
      return null;
    }
    return path[path.length - 2].id;
  }
}

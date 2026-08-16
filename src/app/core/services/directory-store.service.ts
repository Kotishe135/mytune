import {computed, inject, Injectable, signal} from '@angular/core';
import {
  AppStoreState,
  Directory,
  DirectoryGroup,
  DirectoryItem,
  DirectorySchema,
} from '../models/directory.models';
import {ItemFactoryService} from './item-factory.service';

const STORAGE_KEY = 'mytune.directories.v1';

@Injectable({providedIn: 'root'})
export class DirectoryStoreService {
  private readonly items = inject(ItemFactoryService);
  private readonly state = signal<AppStoreState>(this.load());

  readonly groups = computed(() =>
    [...this.state().groups].sort((a, b) => a.order - b.order),
  );
  readonly directories = computed(() => this.state().directories);

  readonly navTree = computed(() =>
    this.groups().map((group) => ({
      group,
      directories: this.state().directories.filter((d) => d.groupId === group.id),
    })),
  );

  getDirectory(id: string): Directory | undefined {
    return this.state().directories.find((d) => d.id === id);
  }

  getGroup(id: string): DirectoryGroup | undefined {
    return this.state().groups.find((g) => g.id === id);
  }

  addGroup(name: string): DirectoryGroup {
    const group: DirectoryGroup = {
      id: this.items.uuid(),
      name: name.trim(),
      order: this.state().groups.length,
    };
    this.patch({groups: [...this.state().groups, group]});
    return group;
  }

  renameGroup(id: string, name: string): void {
    this.patch({
      groups: this.state().groups.map((g) =>
        g.id === id ? {...g, name: name.trim()} : g,
      ),
    });
  }

  removeGroup(id: string): void {
    const hasDirectories = this.state().directories.some((d) => d.groupId === id);
    if (hasDirectories) {
      throw new Error('Нельзя удалить группу, в которой есть справочники');
    }
    this.patch({groups: this.state().groups.filter((g) => g.id !== id)});
  }

  createDirectory(input: {
    groupId: string;
    name: string;
    description: string;
    schema: DirectorySchema;
  }): Directory {
    const now = new Date().toISOString();
    const directory: Directory = {
      id: this.items.uuid(),
      groupId: input.groupId,
      name: input.name.trim(),
      description: input.description.trim(),
      schema: input.schema,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    this.patch({directories: [...this.state().directories, directory]});
    return directory;
  }

  updateDirectory(
    id: string,
    input: {
      name: string;
      description: string;
      schema: DirectorySchema;
    },
  ): void {
    this.patch({
      directories: this.state().directories.map((d) =>
        d.id === id
          ? {
              ...d,
              name: input.name.trim(),
              description: input.description.trim(),
              schema: input.schema,
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    });
  }

  updateDirectorySchema(id: string, schema: DirectorySchema): void {
    this.patch({
      directories: this.state().directories.map((d) =>
        d.id === id
          ? {...d, schema, updatedAt: new Date().toISOString()}
          : d,
      ),
    });
  }

  deleteDirectory(id: string): void {
    this.patch({
      directories: this.state().directories.filter((d) => d.id !== id),
    });
  }

  addItem(directoryId: string, raw: Record<string, unknown>): DirectoryItem {
    const directory = this.requireDirectory(directoryId);
    const item = this.items.createItem(directory, raw);
    this.patch({
      directories: this.state().directories.map((d) =>
        d.id === directoryId
          ? {
              ...d,
              items: [...d.items, item],
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    });
    return item;
  }

  updateItem(
    directoryId: string,
    itemId: string,
    raw: Record<string, unknown>,
  ): void {
    const directory = this.requireDirectory(directoryId);
    const data = this.items.applyGeneratedFields(
      directory,
      {...raw, id: itemId},
      {onlyEmpty: true},
    );

    this.patch({
      directories: this.state().directories.map((d) => {
        if (d.id !== directoryId) {
          return d;
        }
        return {
          ...d,
          updatedAt: new Date().toISOString(),
          items: d.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  data: {...data, id: item.id},
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        };
      }),
    });
  }

  deleteItem(directoryId: string, itemId: string): void {
    this.patch({
      directories: this.state().directories.map((d) =>
        d.id === directoryId
          ? {
              ...d,
              items: d.items.filter((i) => i.id !== itemId),
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    });
  }

  clearAll(): void {
    const fresh = this.seed();
    this.state.set(fresh);
    this.persist(fresh);
  }

  private requireDirectory(id: string): Directory {
    const directory = this.getDirectory(id);
    if (!directory) {
      throw new Error(`Directory ${id} not found`);
    }
    return directory;
  }

  private patch(partial: Partial<AppStoreState>): void {
    const next = {...this.state(), ...partial};
    this.state.set(next);
    this.persist(next);
  }

  private load(): AppStoreState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return this.seed();
      }
      const parsed = JSON.parse(raw) as AppStoreState;
      if (!parsed.groups?.length) {
        return this.seed();
      }
      return {
        groups: parsed.groups,
        directories: parsed.directories ?? [],
      };
    } catch {
      return this.seed();
    }
  }

  private persist(state: AppStoreState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  private seed(): AppStoreState {
    const state: AppStoreState = {
      groups: [
        {id: this.items.uuid(), name: 'Общие', order: 0},
        {id: this.items.uuid(), name: 'Системные', order: 1},
      ],
      directories: [],
    };
    this.persist(state);
    return state;
  }
}

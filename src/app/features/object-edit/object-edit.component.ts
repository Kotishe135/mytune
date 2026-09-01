import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TuiButton, TuiDialogService, TuiNotification, TuiTitle} from '@taiga-ui/core';
import {TUI_CONFIRM} from '@taiga-ui/kit';
import {TuiCardLarge} from '@taiga-ui/layout';
import {combineLatest, map} from 'rxjs';
import {DirectoryItemFormService} from '../../core/services/directory-item-form.service';
import {DirectoryStoreService} from '../../core/services/directory-store.service';
import {DirectoryItemFieldsComponent} from '../directory-item-fields/directory-item-fields.component';

@Component({
  selector: 'app-object-edit',
  standalone: true,
  imports: [
    DirectoryItemFieldsComponent,
    TuiButton,
    TuiCardLarge,
    TuiNotification,
    TuiTitle,
  ],
  templateUrl: './object-edit.component.html',
  styleUrl: './object-edit.component.less',
})
export class ObjectEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(DirectoryStoreService);
  readonly form = inject(DirectoryItemFormService);
  private readonly dialogs = inject(TuiDialogService);

  private readonly directoryId = signal('');
  readonly editingItemId = signal<string | null>(null);
  readonly formError = signal('');

  readonly directory = computed(() => {
    const id = this.directoryId();
    return id ? this.store.getDirectory(id) : undefined;
  });

  readonly formFields = computed(() => this.directory()?.schema.fields ?? []);

  readonly pageTitle = computed(() =>
    this.editingItemId() ? 'Редактирование объекта' : 'Новый объект',
  );

  ngOnInit(): void {
    combineLatest([
      this.route.paramMap.pipe(map((params) => params.get('id') || '')),
      this.route.paramMap.pipe(map((params) => params.get('itemId') || '')),
    ]).subscribe(([dirId, itemId]) => {
      const dir = dirId ? this.store.getDirectory(dirId) : undefined;
      if (!dir) {
        void this.router.navigate(['/']);
        return;
      }

      this.directoryId.set(dirId);
      const fields = dir.schema.fields;

      if (itemId === 'new') {
        this.editingItemId.set(null);
        this.form.populate(fields);
      } else {
        const item = dir.items.find((i) => i.id === itemId);
        if (!item) {
          void this.router.navigate(['/directories', dirId]);
          return;
        }
        this.editingItemId.set(itemId);
        this.form.populate(fields, item);
      }

      this.formError.set('');
    });
  }

  save(): void {
    this.formError.set('');
    const dir = this.directory();
    if (!dir) {
      return;
    }

    const {payload, error} = this.form.buildPayload(
      this.formFields(),
      this.editingItemId(),
    );
    if (error) {
      this.formError.set(error);
      return;
    }

    const editingId = this.editingItemId();
    if (editingId) {
      this.store.updateItem(dir.id, editingId, payload);
    } else {
      this.store.addItem(dir.id, payload);
    }

    void this.router.navigate(['/directories', dir.id]);
  }

  cancel(): void {
    const dir = this.directory();
    if (dir) {
      void this.router.navigate(['/directories', dir.id]);
    }
  }

  deleteItem(): void {
    const dir = this.directory();
    const itemId = this.editingItemId();
    if (!dir || !itemId) {
      return;
    }

    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: 'Удалить объект?',
        size: 's',
        data: {
          content: 'Объект будет удалён без возможности восстановления.',
          yes: 'Удалить',
          no: 'Отмена',
          appearance: 'negative',
        },
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.store.deleteItem(dir.id, itemId);
        void this.router.navigate(['/directories', dir.id]);
      });
  }
}

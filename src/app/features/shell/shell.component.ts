import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink, RouterOutlet} from '@angular/router';
import {
  TuiButton,
  TuiDataList,
  TuiDialog,
  TuiDialogService,
  TuiDropdown,
  TuiIcon,
  TuiInput,
  TuiLabel,
  TuiRoot,
  TuiTextfield,
} from '@taiga-ui/core';
import {TUI_CONFIRM, TuiChevron} from '@taiga-ui/kit';
import {TuiNavigation} from '@taiga-ui/layout';
import {Directory} from '../../core/models/directory.models';
import {DirectoryStoreService} from '../../core/services/directory-store.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    FormsModule,
    RouterOutlet,
    RouterLink,
    TuiRoot,
    TuiNavigation,
    TuiButton,
    TuiDataList,
    TuiDropdown,
    TuiIcon,
    TuiInput,
    TuiLabel,
    TuiTextfield,
    TuiDialog,
    TuiChevron,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.less',
})
export class ShellComponent {
  private readonly store = inject(DirectoryStoreService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(TuiDialogService);

  readonly navTree = this.store.navTree;
  readonly expanded = signal(true);
  readonly groupDialogOpen = signal(false);
  newGroupName = '';

  openCreateGroup(): void {
    this.newGroupName = '';
    this.groupDialogOpen.set(true);
  }

  createGroup(): void {
    const name = this.newGroupName.trim();
    if (!name) {
      return;
    }
    this.store.addGroup(name);
    this.groupDialogOpen.set(false);
    this.newGroupName = '';
  }

  createDirectory(groupId: string): void {
    void this.router.navigate(['/groups', groupId, 'directories', 'new']);
  }

  editDirectory(id: string): void {
    void this.router.navigate(['/directories', id, 'edit']);
  }

  deleteDirectory(directory: Directory): void {
    this.dialogs
      .open<boolean>(TUI_CONFIRM, {
        label: `Удалить «${directory.name}»?`,
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
        const viewing = this.router.url.startsWith(
          `/directories/${directory.id}`,
        );
        this.store.deleteDirectory(directory.id);
        if (viewing) {
          void this.router.navigate(['/']);
        }
      });
  }

  toggleAside(): void {
    this.expanded.update((v) => !v);
  }
}

import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink, RouterOutlet} from '@angular/router';
import {
  TuiButton,
  TuiDialog,
  TuiIcon,
  TuiInput,
  TuiLabel,
  TuiRoot,
  TuiTextfield,
} from '@taiga-ui/core';
import {TuiChevron} from '@taiga-ui/kit';
import {TuiNavigation} from '@taiga-ui/layout';
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

  toggleAside(): void {
    this.expanded.update((v) => !v);
  }
}

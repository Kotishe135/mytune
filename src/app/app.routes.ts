import {Routes} from '@angular/router';
import {ShellComponent} from './features/shell/shell.component';
import {HomeComponent} from './features/home/home.component';
import {DirectoryCreateComponent} from './features/directory-create/directory-create.component';
import {DirectoryViewComponent} from './features/directory-view/directory-view.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {path: '', component: HomeComponent},
      {
        path: 'groups/:groupId/directories/new',
        component: DirectoryCreateComponent,
      },
      {
        path: 'directories/:id/edit',
        component: DirectoryCreateComponent,
      },
      {
        path: 'directories/:id',
        component: DirectoryViewComponent,
      },
    ],
  },
  {path: '**', redirectTo: ''},
];

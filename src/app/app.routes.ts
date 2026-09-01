import {Routes} from '@angular/router';
import {ShellComponent} from './features/shell/shell.component';
import {HomeComponent} from './features/home/home.component';
import {DirectoryCreateComponent} from './features/directory-create/directory-create.component';
import {DirectoryViewComponent} from './features/directory-view/directory-view.component';
import {FieldEditComponent} from './features/field-edit/field-edit.component';

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
        path: 'groups/:groupId/directories/new/fields/:fieldId',
        component: FieldEditComponent,
      },
      {
        path: 'directories/:id/edit',
        component: DirectoryCreateComponent,
      },
      {
        path: 'directories/:id/edit/fields/:fieldId',
        component: FieldEditComponent,
      },
      {
        path: 'directories/:id',
        component: DirectoryViewComponent,
      },
    ],
  },
  {path: '**', redirectTo: ''},
];

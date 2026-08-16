import {Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TuiButton, TuiTitle} from '@taiga-ui/core';
import {TuiCardLarge, TuiHeader} from '@taiga-ui/layout';
import {DirectoryStoreService} from '../../core/services/directory-store.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, TuiCardLarge, TuiHeader, TuiTitle, TuiButton],
  template: `
    <section tuiCardLarge>
      <header tuiHeader>
        <hgroup tuiTitle>
          <h2>Сервис справочников</h2>
          <p tuiSubtitle>
            Создавайте группы и JSON-схемы справочников, наполняйте объекты и
            управляйте ими в браузерном кэше.
          </p>
        </hgroup>
      </header>

      <p>
        Групп: <strong>{{ store.groups().length }}</strong>, справочников:
        <strong>{{ store.directories().length }}</strong>
      </p>

      <footer>
        <button
          appearance="secondary"
          tuiButton
          type="button"
          (click)="store.clearAll()"
        >
          Сбросить локальные данные
        </button>
        @if (store.groups()[0]; as firstGroup) {
          <a
            appearance="primary"
            tuiButton
            [routerLink]="['/groups', firstGroup.id, 'directories', 'new']"
          >
            Создать справочник
          </a>
        }
      </footer>
    </section>
  `,
  styles: `
    section {
      max-width: 48rem;
    }

    footer {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
  `,
})
export class HomeComponent {
  readonly store = inject(DirectoryStoreService);
}

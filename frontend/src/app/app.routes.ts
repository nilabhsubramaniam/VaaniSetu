import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'assistant' },
  {
    path: 'assistant',
    loadComponent: () => import('./assistant/assistant.page').then((m) => m.AssistantPage),
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'assistant' },
];

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

interface PrivacyToggle {
  readonly key: string;
  readonly label: string;
  readonly description: string;
}

/**
 * Visual preview only. These toggles hold local component state and do
 * nothing else — there is no consent log, no storage, no backend in
 * Phase 1. They exist to show the shape of the future privacy dashboard
 * described in docs/ARCHITECTURE.md §20 / docs/DECISIONS.md ADR-001, not to
 * implement it.
 */
@Component({
  selector: 'app-privacy-toggles',
  templateUrl: './privacy-toggles.html',
  styleUrl: './privacy-toggles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyToggles {
  readonly toggles: readonly PrivacyToggle[] = [
    {
      key: 'storeHistory',
      label: 'Store conversation history',
      description: 'Keep past turns on this device between sessions.',
    },
    {
      key: 'useForTraining',
      label: 'Use my conversations to improve models',
      description: 'Only ever on-device, opt-in, and revocable.',
    },
    {
      key: 'documentUploads',
      label: 'Allow document uploads for answers',
      description: 'Needed once document Q&A (RAG) is built.',
    },
  ];

  private readonly values = signal<Record<string, boolean>>({});

  isOn(key: string): boolean {
    return this.values()[key] ?? false;
  }

  toggle(key: string): void {
    this.values.update((current) => ({ ...current, [key]: !current[key] }));
  }
}

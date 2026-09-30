import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  AUTO_DETECT_OPTION,
  LANGUAGE_OPTIONS,
  type AutoDetectOption,
  type LanguageOption,
} from '../../../core/models/language.model';
import { SettingsStore } from '../../../core/services/settings.store';

type SelectorOption = AutoDetectOption | LanguageOption;

/**
 * Header-level language control. This is the ONE place preferred language is
 * set — the landing page's `LandingI18nService` derives its copy locale from
 * `SettingsStore` rather than owning a second, independent selector.
 *
 * Built as a WAI-ARIA listbox popover (button + `role="listbox"`) instead of
 * a native `<select>` so disabled ("coming soon") languages can be shown
 * inline with a label rather than needing a separate legend.
 */
@Component({
  selector: 'app-language-selector',
  templateUrl: './language-selector.html',
  styleUrl: './language-selector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSelector {
  private readonly settingsStore = inject(SettingsStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly options: readonly SelectorOption[] = [AUTO_DETECT_OPTION, ...LANGUAGE_OPTIONS];
  readonly preferredLanguage = this.settingsStore.preferredLanguage;
  readonly autoDetectLanguage = this.settingsStore.autoDetectLanguage;

  readonly isOpen = signal(false);
  readonly activeIndex = signal(0);

  readonly buttonEl = viewChild<ElementRef<HTMLButtonElement>>('buttonEl');
  readonly listEl = viewChild<ElementRef<HTMLUListElement>>('listEl');
  readonly optionEls = viewChildren<ElementRef<HTMLLIElement>>('optionEl');

  readonly currentOption = computed<SelectorOption>(() => {
    if (this.autoDetectLanguage()) {
      return AUTO_DETECT_OPTION;
    }
    return (
      LANGUAGE_OPTIONS.find((option) => option.code === this.preferredLanguage()) ??
      LANGUAGE_OPTIONS[0]
    );
  });

  /** Short enough for the header pill — "Auto-detect" is fine in the open
   * list but too wide as the trigger's own label. */
  readonly triggerLabel = computed(() =>
    this.autoDetectLanguage() ? 'Auto' : this.currentOption().label,
  );

  constructor() {
    const onPointerDown = (event: PointerEvent) => {
      if (!this.isOpen()) return;
      const target = event.target as Node;
      if (
        this.buttonEl()?.nativeElement.contains(target) ||
        this.listEl()?.nativeElement.contains(target)
      ) {
        return;
      }
      this.close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    this.destroyRef.onDestroy(() => document.removeEventListener('pointerdown', onPointerDown));
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    const index = this.options.findIndex((option) => option.code === this.currentOption().code);
    this.activeIndex.set(index >= 0 ? index : 0);
    this.isOpen.set(true);
    queueMicrotask(() => this.focusActiveOption());
  }

  close(): void {
    this.isOpen.set(false);
    this.buttonEl()?.nativeElement.focus();
  }

  select(option: SelectorOption): void {
    if (!option.enabled) return;
    if (option.code === 'auto') {
      this.settingsStore.setAutoDetectLanguage(true);
    } else {
      this.settingsStore.setAutoDetectLanguage(false);
      this.settingsStore.setPreferredLanguage(option.code);
    }
    this.close();
  }

  onButtonKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open();
    }
  }

  onListKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.activeIndex.set(0);
        this.focusActiveOption();
        break;
      case 'End':
        event.preventDefault();
        this.activeIndex.set(this.options.length - 1);
        this.focusActiveOption();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.select(this.options[this.activeIndex()]);
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }

  private moveActive(delta: number): void {
    const next = (this.activeIndex() + delta + this.options.length) % this.options.length;
    this.activeIndex.set(next);
    this.focusActiveOption();
  }

  private focusActiveOption(): void {
    this.optionEls()[this.activeIndex()]?.nativeElement.focus();
  }
}

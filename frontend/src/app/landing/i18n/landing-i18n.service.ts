import { Injectable, computed, inject } from '@angular/core';
import { SettingsStore } from '../../core/services/settings.store';
import { EN_COPY } from './en';
import { HI_COPY } from './hi';
import type { LandingCopy } from './landing-i18n.types';

type LandingLocale = 'en' | 'hi';

const COPY: Record<LandingLocale, LandingCopy> = {
  en: EN_COPY,
  hi: HI_COPY,
};

/**
 * Landing page copy locale, DERIVED from the header's language preference
 * (`SettingsStore`) rather than owning independent state. `hinglish` reads
 * Hindi copy — there is no separate Hinglish translation for page prose.
 */
@Injectable({ providedIn: 'root' })
export class LandingI18nService {
  private readonly settingsStore = inject(SettingsStore);

  readonly locale = computed<LandingLocale>(() => {
    const preferred = this.settingsStore.preferredLanguage();
    return preferred === 'hi' || preferred === 'hinglish' ? 'hi' : 'en';
  });

  readonly t = computed<LandingCopy>(() => COPY[this.locale()]);
}

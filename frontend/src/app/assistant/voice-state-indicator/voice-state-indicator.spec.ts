import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VoiceStateIndicator } from './voice-state-indicator';
import { VoiceSessionService } from '../../core/services/voice-session.service';
import type { VoiceState } from '../../core/models/voice-state.model';

describe('VoiceStateIndicator', () => {
  const voiceState = signal<VoiceState>('idle');

  beforeEach(() => {
    voiceState.set('idle');
    TestBed.configureTestingModule({
      providers: [{ provide: VoiceSessionService, useValue: { state: voiceState } }],
    });
  });

  it('shows the idle label and hint by default', () => {
    const fixture = TestBed.createComponent(VoiceStateIndicator);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ready');
    expect(el.textContent).toContain('Tap the mic or type to start');
  });

  it('updates the visible label and the aria-live announcement when the state changes', () => {
    const fixture = TestBed.createComponent(VoiceStateIndicator);
    fixture.detectChanges();

    voiceState.set('listening');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Listening');
    const liveRegion = el.querySelector('[role="status"]');
    expect(liveRegion?.textContent).toContain('Listening');
  });

  it('reflects the error state', () => {
    voiceState.set('error');
    const fixture = TestBed.createComponent(VoiceStateIndicator);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Something went wrong');
  });
});

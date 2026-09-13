import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AssistantPage } from './assistant.page';
import { ConversationService } from '../core/services/conversation.service';
import { VoiceSessionService } from '../core/services/voice-session.service';
import type { VoiceState } from '../core/models/voice-state.model';

describe('AssistantPage', () => {
  const voiceState = signal<VoiceState>('idle');
  const turns = signal([]);
  let simulateError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    voiceState.set('idle');
    simulateError = vi.fn(() => voiceState.set('error'));

    TestBed.configureTestingModule({
      providers: [
        { provide: ConversationService, useValue: { turns, sendUserTurn: vi.fn(), simulateError } },
        { provide: VoiceSessionService, useValue: { state: voiceState, setState: vi.fn() } },
      ],
    });
  });

  it('shows no error banner when idle', () => {
    const fixture = TestBed.createComponent(AssistantPage);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.error-banner')).toBeNull();
  });

  it('shows the error banner once the voice state is error', () => {
    const fixture = TestBed.createComponent(AssistantPage);
    fixture.detectChanges();

    const devButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Simulate error'))!;
    devButton.click();
    fixture.detectChanges();

    expect(simulateError).toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('.error-banner')).not.toBeNull();
  });
});

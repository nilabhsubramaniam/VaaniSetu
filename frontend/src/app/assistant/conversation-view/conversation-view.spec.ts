import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConversationView } from './conversation-view';
import { ConversationService } from '../../core/services/conversation.service';
import { VoiceSessionService } from '../../core/services/voice-session.service';
import type { Turn } from '../../core/models/turn.model';
import type { VoiceState } from '../../core/models/voice-state.model';

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: 't1',
    role: 'user',
    text: 'Hi',
    language: 'en',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('ConversationView', () => {
  const turns = signal<readonly Turn[]>([]);
  const voiceState = signal<VoiceState>('idle');

  beforeEach(() => {
    // jsdom's scrollIntoView is a no-op in some versions and absent in
    // others; stub it so the afterRenderEffect never throws in tests.
    HTMLElement.prototype.scrollIntoView = vi.fn();

    turns.set([]);
    voiceState.set('idle');

    TestBed.configureTestingModule({
      providers: [
        { provide: ConversationService, useValue: { turns } },
        { provide: VoiceSessionService, useValue: { state: voiceState } },
      ],
    });
  });

  it('shows the empty state when there are no turns', () => {
    const fixture = TestBed.createComponent(ConversationView);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Start speaking or type a message');
  });

  it('renders one message bubble per turn and hides the empty state', () => {
    turns.set([makeTurn({ id: 'a' }), makeTurn({ id: 'b', role: 'assistant' })]);

    const fixture = TestBed.createComponent(ConversationView);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-message-bubble')).toHaveLength(2);
    expect(el.textContent).not.toContain('Start speaking or type a message');
  });

  it('shows the thinking indicator only while processing', () => {
    const fixture = TestBed.createComponent(ConversationView);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.thinking')).toBeNull();

    voiceState.set('processing');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.thinking')).not.toBeNull();
  });
});

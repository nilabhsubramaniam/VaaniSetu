import { TestBed } from '@angular/core/testing';
import { TextInputBar } from './text-input-bar';
import { ConversationService } from '../../core/services/conversation.service';
import { VoiceSessionMockService } from '../../core/services/voice-session.mock.service';
import { VoiceSessionService } from '../../core/services/voice-session.service';

describe('TextInputBar', () => {
  let sendUserTurn: ReturnType<typeof vi.fn>;
  let voiceSession: VoiceSessionMockService;

  beforeEach(() => {
    sendUserTurn = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: VoiceSessionService, useClass: VoiceSessionMockService },
        { provide: ConversationService, useValue: { sendUserTurn, simulateError: vi.fn() } },
      ],
    });
    voiceSession = TestBed.inject(VoiceSessionService) as VoiceSessionMockService;
  });

  function type(fixture: ReturnType<typeof TestBed.createComponent<TextInputBar>>, text: string) {
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('disables send when the draft is empty', () => {
    const fixture = TestBed.createComponent(TextInputBar);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('enables send once there is non-whitespace text', () => {
    const fixture = TestBed.createComponent(TextInputBar);
    fixture.detectChanges();
    type(fixture, 'Hello');
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('sends the draft and clears the field on submit', () => {
    const fixture = TestBed.createComponent(TextInputBar);
    fixture.detectChanges();
    type(fixture, 'Hello');

    fixture.componentInstance.send();
    fixture.detectChanges();

    expect(sendUserTurn).toHaveBeenCalledWith('Hello', 'hi');
    expect(fixture.componentInstance.draft()).toBe('');
  });

  it('disables send while a reply is in flight', () => {
    const fixture = TestBed.createComponent(TextInputBar);
    fixture.detectChanges();
    type(fixture, 'Hello');
    voiceSession.setState('processing');
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});

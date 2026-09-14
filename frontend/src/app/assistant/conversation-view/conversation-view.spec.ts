import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConversationView, isNearBottom } from './conversation-view';
import { ConversationService } from '../../core/services/conversation.service';
import { VoiceSessionService } from '../../core/services/voice-session.service';
import type { Turn } from '../../core/models/turn.model';
import type { VoiceState } from '../../core/models/voice-state.model';

/** Overrides jsdom's always-0 scroll metrics on a real element for a test. */
function setScrollMetrics(
  el: HTMLElement,
  metrics: { scrollTop: number; scrollHeight: number; clientHeight: number },
) {
  Object.defineProperty(el, 'scrollTop', { value: metrics.scrollTop, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: metrics.scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: metrics.clientHeight, configurable: true });
}

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

  it('shows the welcome empty state, with example prompts, when there are no turns', () => {
    const fixture = TestBed.createComponent(ConversationView);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('How can I help?');
    expect(el.querySelectorAll('.example')).toHaveLength(3);
  });

  it('renders one message bubble per turn and hides the empty state', () => {
    turns.set([makeTurn({ id: 'a' }), makeTurn({ id: 'b', role: 'assistant' })]);

    const fixture = TestBed.createComponent(ConversationView);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-message-bubble')).toHaveLength(2);
    expect(el.textContent).not.toContain('How can I help?');
  });

  it('sends the clicked example prompt as a user turn', () => {
    const sendUserTurn = vi.fn();
    TestBed.overrideProvider(ConversationService, { useValue: { turns, sendUserTurn } });

    const fixture = TestBed.createComponent(ConversationView);
    fixture.detectChanges();

    const firstExample = (fixture.nativeElement as HTMLElement).querySelector(
      '.example',
    ) as HTMLButtonElement;
    firstExample.click();

    expect(sendUserTurn).toHaveBeenCalledWith(expect.any(String), 'hi');
  });

  it('shows the thinking indicator only while processing', () => {
    const fixture = TestBed.createComponent(ConversationView);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.thinking')).toBeNull();

    voiceState.set('processing');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.thinking')).not.toBeNull();
  });

  describe('isNearBottom', () => {
    it('is true when scrolled to the very bottom', () => {
      expect(isNearBottom({ scrollTop: 920, scrollHeight: 1000, clientHeight: 80 })).toBe(true);
    });

    it('is true within the threshold', () => {
      expect(isNearBottom({ scrollTop: 850, scrollHeight: 1000, clientHeight: 80 })).toBe(true);
    });

    it('is false once scrolled well away from the bottom', () => {
      expect(isNearBottom({ scrollTop: 200, scrollHeight: 1000, clientHeight: 80 })).toBe(false);
    });
  });

  describe('smart auto-scroll', () => {
    it('auto-scrolls new turns while pinned to the bottom (the default)', () => {
      const fixture = TestBed.createComponent(ConversationView);
      fixture.detectChanges();
      const scrollSpy = HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
      scrollSpy.mockClear();

      turns.set([makeTurn({ id: 'a' })]);
      fixture.detectChanges();

      expect(scrollSpy).toHaveBeenCalled();
      expect((fixture.nativeElement as HTMLElement).querySelector('.jump-to-latest')).toBeNull();
    });

    it('stops auto-scrolling once the user scrolls away from the bottom, and shows jump-to-latest', () => {
      const fixture = TestBed.createComponent(ConversationView);
      turns.set([makeTurn({ id: 'a' })]);
      fixture.detectChanges();

      const viewportEl = (fixture.nativeElement as HTMLElement).querySelector(
        '.viewport',
      ) as HTMLElement;
      setScrollMetrics(viewportEl, { scrollTop: 0, scrollHeight: 1000, clientHeight: 80 });
      viewportEl.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();

      const scrollSpy = HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
      scrollSpy.mockClear();

      turns.set([...turns(), makeTurn({ id: 'b', role: 'assistant' })]);
      fixture.detectChanges();

      expect(scrollSpy).not.toHaveBeenCalled();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.jump-to-latest'),
      ).not.toBeNull();
    });

    it('jumpToLatest re-pins to the bottom and hides the affordance', () => {
      const fixture = TestBed.createComponent(ConversationView);
      turns.set([makeTurn({ id: 'a' })]);
      fixture.detectChanges();

      const viewportEl = (fixture.nativeElement as HTMLElement).querySelector(
        '.viewport',
      ) as HTMLElement;
      setScrollMetrics(viewportEl, { scrollTop: 0, scrollHeight: 1000, clientHeight: 80 });
      viewportEl.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();

      const jumpButton = (fixture.nativeElement as HTMLElement).querySelector(
        '.jump-to-latest',
      ) as HTMLButtonElement;
      expect(jumpButton).not.toBeNull();

      jumpButton.click();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('.jump-to-latest')).toBeNull();
    });
  });
});

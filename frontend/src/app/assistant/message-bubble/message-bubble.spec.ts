import { TestBed } from '@angular/core/testing';
import { MessageBubble } from './message-bubble';
import type { Turn } from '../../core/models/turn.model';

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: 't1',
    role: 'assistant',
    text: 'Hello',
    language: 'en',
    createdAt: new Date('2026-01-01T10:00:00'),
    ...overrides,
  };
}

describe('MessageBubble', () => {
  it('renders the turn text', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ text: 'Hello there' }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Hello there');
  });

  it('marks the row with the turn role for alignment styling', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ role: 'user' }));
    fixture.detectChanges();

    const row = (fixture.nativeElement as HTMLElement).querySelector('.row');
    expect(row?.getAttribute('data-role')).toBe('user');
  });

  it('sets lang="hi" for Hindi text so the Devanagari font stack applies', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'hi', text: 'नमस्ते' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.getAttribute('lang')).toBe('hi');
  });

  it('does not set a lang attribute for Hinglish text', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'hinglish', text: 'Kaise ho?' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.hasAttribute('lang')).toBe(false);
  });

  it('shows the source note and latency only for assistant turns', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ role: 'assistant', latencyMs: 812 }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Local model');
    expect(el.textContent).toContain('812 ms');
  });

  it('omits the source note for user turns', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ role: 'user' }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Local model');
  });
});

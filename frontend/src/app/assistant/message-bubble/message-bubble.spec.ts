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

  it('sets lang="ml" for Malayalam text so the Malayalam font stack applies', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'ml', text: 'നമസ്കാരം' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.getAttribute('lang')).toBe('ml');
  });

  it('sets lang="mai" for Maithili text so the Devanagari font stack applies', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'mai', text: 'प्रणाम' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.getAttribute('lang')).toBe('mai');
  });

  it('sets lang="bn" for Bengali text so the Bengali font stack applies', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'bn', text: 'নমস্কার' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.getAttribute('lang')).toBe('bn');
  });

  it('sets lang="ta" for Tamil text so the Tamil font stack applies', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'ta', text: 'வணக்கம்' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.getAttribute('lang')).toBe('ta');
  });

  it('sets lang="te" for Telugu text so the Telugu font stack applies', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'te', text: 'నమస్కారం' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.getAttribute('lang')).toBe('te');
  });

  it('sets lang="kn" for Kannada text so the Kannada font stack applies', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'kn', text: 'ನಮಸ್ಕಾರ' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.getAttribute('lang')).toBe('kn');
  });

  it('sets lang="gu" for Gujarati text so the Gujarati font stack applies', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'gu', text: 'નમસ્તે' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.getAttribute('lang')).toBe('gu');
  });

  it('sets lang="mr" for Marathi text so the Devanagari font stack applies', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'mr', text: 'नमस्कार' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.getAttribute('lang')).toBe('mr');
  });

  it('sets lang="pa" for Punjabi text so the Gurmukhi font stack applies', async () => {
    const fixture = TestBed.createComponent(MessageBubble);
    fixture.componentRef.setInput('turn', makeTurn({ language: 'pa', text: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ' }));
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.bubble');
    expect(bubble?.getAttribute('lang')).toBe('pa');
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

import { VoiceSessionMockService } from './voice-session.mock.service';

describe('VoiceSessionMockService', () => {
  it('starts idle', () => {
    const service = new VoiceSessionMockService();
    expect(service.state()).toBe('idle');
  });

  it('setState updates the signal', () => {
    const service = new VoiceSessionMockService();
    service.setState('listening');
    expect(service.state()).toBe('listening');
    service.setState('error');
    expect(service.state()).toBe('error');
  });
});

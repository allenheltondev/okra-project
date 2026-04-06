import { validateSubmissionPayload } from '../../src/services/submissions.mjs';

describe('submission payload validation', () => {
  it('accepts valid payload', () => {
    const result = validateSubmissionPayload({
      rawLocationText: 'Austin, TX',
      displayLat: 30.2672,
      displayLng: -97.7431,
      privacyMode: 'city'
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects invalid coordinates', () => {
    const result = validateSubmissionPayload({
      rawLocationText: 'Austin, TX',
      displayLat: 120,
      displayLng: -500
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('displayLat must be between -90 and 90');
    expect(result.issues).toContain('displayLng must be between -180 and 180');
  });
});

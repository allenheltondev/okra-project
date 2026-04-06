import { isUuid, validateUploadIntentPayload } from '../../src/services/photos.mjs';

describe('photo upload intent validation', () => {
  it('accepts supported contentType', () => {
    const result = validateUploadIntentPayload({
      contentType: 'image/jpeg',
      fileName: 'okra.jpg'
    });

    expect(result.valid).toBe(true);
  });

  it('rejects unsupported contentType', () => {
    const result = validateUploadIntentPayload({
      contentType: 'application/pdf'
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('contentType must be one of: image/jpeg, image/png, image/webp');
  });

  it('validates uuid helper', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});

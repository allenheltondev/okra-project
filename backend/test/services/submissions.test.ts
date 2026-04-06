import { validate } from '@aws-lambda-powertools/validation';
import { SchemaValidationError } from '@aws-lambda-powertools/validation/errors';
import { createSubmissionRequestSchema } from '../../src/schemas/submissions.mjs';

describe('submission request schema validation', () => {
  it('accepts valid payload', () => {
    const payload = validate({
      payload: {
        rawLocationText: 'Austin, TX',
        displayLat: 30.2672,
        displayLng: -97.7431,
        privacyMode: 'city'
      },
      schema: createSubmissionRequestSchema
    });

    expect(payload.rawLocationText).toBe('Austin, TX');
  });

  it('rejects invalid coordinates', () => {
    expect(() =>
      validate({
        payload: {
          rawLocationText: 'Austin, TX',
          displayLat: 120,
          displayLng: -500
        },
        schema: createSubmissionRequestSchema
      })
    ).toThrow(SchemaValidationError);
  });
});

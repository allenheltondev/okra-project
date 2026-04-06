export const createSubmissionRequestSchema = {
  type: 'object',
  properties: {
    contributorName: { type: 'string' },
    contributorEmail: { type: 'string' },
    storyText: { type: 'string' },
    rawLocationText: { type: 'string' },
    privacyMode: {
      type: 'string',
      enum: ['exact', 'nearby', 'neighborhood', 'city']
    },
    displayLat: { type: 'number', minimum: -90, maximum: 90 },
    displayLng: { type: 'number', minimum: -180, maximum: 180 }
  },
  required: ['rawLocationText', 'displayLat', 'displayLng'],
  additionalProperties: false
};

export const createSubmissionResponseSchema = {
  type: 'object',
  properties: {
    submissionId: { type: 'string' },
    status: { type: 'string' },
    createdAt: { type: 'string' }
  },
  required: ['submissionId', 'status', 'createdAt'],
  additionalProperties: true
};

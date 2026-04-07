import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';

function getQueueUrl() {
  const queueUrl = process.env.PHOTO_PROCESSING_QUEUE_URL;
  if (!queueUrl) {
    throw new Error('PHOTO_PROCESSING_QUEUE_URL is required');
  }
  return queueUrl;
}

function getRegion() {
  return process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
}

export async function enqueuePhotoProcessing(photoIds) {
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return;
  }

  const queueUrl = getQueueUrl();
  const sqs = new SQSClient({ region: getRegion() });

  for (let i = 0; i < photoIds.length; i += 10) {
    const entries = photoIds.slice(i, i + 10).map((photoId, idx) => ({
      Id: `photo-${i + idx}`,
      MessageBody: JSON.stringify({ photoId })
    }));

    const result = await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries
      })
    );

    if ((result.Failed ?? []).length > 0) {
      throw new Error(`Failed to enqueue ${result.Failed.length} photo processing message(s)`);
    }
  }
}

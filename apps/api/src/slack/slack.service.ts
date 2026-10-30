import { Injectable } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import type { SlackBlock } from '../digest/digest-message.util';

export interface UploadPhotoParams {
  channelId: string;
  threadTs: string;
  filename: string;
  bytes: Buffer;
}

// Wraps the Slack calls the digest job needs — one text message per trainer per day
// (ADR-013), and the 3-call native file-upload flow per photo (ADR-008): no presigned
// URLs are ever embedded, so an upload survives indefinitely once it succeeds.
@Injectable()
export class SlackService {
  private readonly client: WebClient;

  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  async postMessage(channel: string, blocks: SlackBlock[]): Promise<{ ts: string; channelId: string }> {
    const result = await this.client.chat.postMessage({ channel, blocks });
    if (!result.ts || !result.channel) {
      throw new Error('Slack chat.postMessage did not return a message ts/channel');
    }
    return { ts: result.ts, channelId: result.channel };
  }

  async uploadPhotoToThread(params: UploadPhotoParams): Promise<string> {
    const uploadUrlResult = await this.client.files.getUploadURLExternal({
      filename: params.filename,
      length: params.bytes.length,
    });
    if (!uploadUrlResult.upload_url || !uploadUrlResult.file_id) {
      throw new Error('Slack files.getUploadURLExternal did not return an upload URL/file id');
    }

    const uploadResponse = await fetch(uploadUrlResult.upload_url, {
      method: 'POST',
      body: params.bytes as unknown as BodyInit,
    });
    if (!uploadResponse.ok) {
      throw new Error(`Slack file upload POST failed with status ${uploadResponse.status}`);
    }

    await this.client.files.completeUploadExternal({
      files: [{ id: uploadUrlResult.file_id }],
      channel_id: params.channelId,
      thread_ts: params.threadTs,
    });

    return uploadUrlResult.file_id;
  }
}

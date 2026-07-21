import { Injectable } from '@nestjs/common';
import { Response } from 'express';
@Injectable()
export class ActivitiesRealtimeService {
  private readonly clients = new Set<Response>();
  connect(response: Response) { response.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); response.flushHeaders?.(); this.clients.add(response); response.write('event: connected\ndata: {}\n\n'); const timer = setInterval(() => response.write(': heartbeat\n\n'), 25000); response.on('close', () => { this.clients.delete(response); clearInterval(timer); }); }
  publishCreated(activityId: string) { const payload = `event: activity.created\ndata: ${JSON.stringify({ activity_id: activityId })}\n\n`; for (const client of this.clients) client.write(payload); }
  publishFavoriteUpdated(activityId: string, favoriteCount: number) { const payload = `event: activity.favorite_updated\ndata: ${JSON.stringify({ activity_id: activityId, favorite_count: favoriteCount })}\n\n`; for (const client of this.clients) client.write(payload); }
}

import type Redis from 'ioredis';
import { getRedis } from './client-redis';

type MessageListener = (message: string) => void;

class RedisSubscriberMultiplexer {
  private subscriber: Redis | null = null;
  private channelToListeners: Map<string, Set<MessageListener>> = new Map();
  private pendingSubscribes: Map<string, Promise<void>> = new Map();

  private async ensureSubscriber(): Promise<Redis> {
    if (this.subscriber) return this.subscriber;
    const base = getRedis();
    const sub = base.duplicate();
    try {
      // 관측을 위한 이름
      await sub.client('SETNAME', `arcsolve-pubsub:${Date.now()}`);
    } catch {
      // ignore
    }
    sub.on('message', (channel: string, message: string) => {
      const listeners = this.channelToListeners.get(channel);
      if (!listeners || listeners.size === 0) return;
      for (const listener of Array.from(listeners)) {
        try {
          listener(message);
        } catch {
          // ignore listener errors
        }
      }
    });
    this.subscriber = sub;
    return sub;
  }

  async subscribe(channel: string, listener: MessageListener): Promise<() => Promise<void>> {
    const sub = await this.ensureSubscriber();
    let listeners = this.channelToListeners.get(channel);
    if (!listeners) {
      listeners = new Set<MessageListener>();
      this.channelToListeners.set(channel, listeners);
    }

    listeners.add(listener);

    if (listeners.size === 1) {
      // 최초 구독: 중복 subscribe 방지
      let pending = this.pendingSubscribes.get(channel);
      if (!pending) {
        pending = sub.subscribe(channel).then(() => {
          // 구독 성공
        }).catch((e) => {
          // 구독 실패 시 리스너 롤백
          listeners?.delete(listener);
          if (listeners?.size === 0) {
            this.channelToListeners.delete(channel);
          }
          throw e;
        });
        this.pendingSubscribes.set(channel, pending);
      }
      await pending.finally(() => this.pendingSubscribes.delete(channel));
    }

    return async () => {
      const current = this.channelToListeners.get(channel);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.channelToListeners.delete(channel);
        try {
          const s = await this.ensureSubscriber();
          await s.unsubscribe(channel);
        } catch {
          // ignore
        }
      }
    };
  }
}

declare global {
  var __arcsolveRedisSubscriber: RedisSubscriberMultiplexer | undefined;
}

export function getRedisSubscriber(): RedisSubscriberMultiplexer {
  return globalThis.__arcsolveRedisSubscriber ??= new RedisSubscriberMultiplexer();
}



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
    sub.on('end', () => {
      // 연결 종료 시 재생성을 위해 참조 해제
      this.subscriber = null;
    });
    sub.on('error', () => {
      // 운영 관찰성은 상위 레벨에서 처리, 여기서는 누수 방지만
    });
    this.subscriber = sub;
    return sub;
  }

  private async closeIfIdle(): Promise<void> {
    if (this.channelToListeners.size > 0) return;
    const s = this.subscriber;
    if (!s) return;
    this.subscriber = null;
    try {
      await s.quit();
    } catch {
      // ignore
    }
  }

  async subscribe(channel: string, listener: MessageListener): Promise<() => Promise<void>> {
    const sub = await this.ensureSubscriber();
    let listeners = this.channelToListeners.get(channel);
    if (!listeners) {
      listeners = new Set<MessageListener>();
      this.channelToListeners.set(channel, listeners);
    }

    listeners.add(listener);

    // 채널 최초 리스너이면 실제 subscribe 수행
    let pending = this.pendingSubscribes.get(channel);
    if (!pending && listeners.size === 1) {
      pending = (async () => {
        await sub.subscribe(channel);
      })().catch((e) => {
        // 구독 실패 시 이 채널의 모든 리스너 정리하여 누수 방지
        const set = this.channelToListeners.get(channel);
        if (set) {
          set.clear();
          this.channelToListeners.delete(channel);
        }
        throw e;
      });
      this.pendingSubscribes.set(channel, pending);
    }

    // 동시 구독 호출은 동일 pending에 동기화되어 성공/실패를 공유
    if (pending) {
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
        } finally {
          await this.closeIfIdle();
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



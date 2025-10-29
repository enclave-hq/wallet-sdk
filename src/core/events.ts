/**
 * Event System
 */

import EventEmitter from 'eventemitter3'

/**
 * Type-safe Event Emitter
 * Uses type assertion to provide type-safe API while avoiding type conflicts with base class
 */
export class TypedEventEmitter<
  TEvents extends Record<string, (...args: any[]) => void>
> {
  private emitter = new EventEmitter()

  on<K extends keyof TEvents>(
    event: K,
    handler: TEvents[K]
  ): this {
    this.emitter.on(event as string, handler as any)
    return this
  }

  once<K extends keyof TEvents>(
    event: K,
    handler: TEvents[K]
  ): this {
    this.emitter.once(event as string, handler as any)
    return this
  }

  off<K extends keyof TEvents>(
    event: K,
    handler: TEvents[K]
  ): this {
    this.emitter.off(event as string, handler as any)
    return this
  }

  emit<K extends keyof TEvents>(
    event: K,
    ...args: Parameters<TEvents[K]>
  ): boolean {
    return this.emitter.emit(event as string, ...args)
  }

  removeAllListeners<K extends keyof TEvents>(event?: K): this {
    if (event !== undefined) {
      this.emitter.removeAllListeners(event as string)
    } else {
      this.emitter.removeAllListeners()
    }
    return this
  }
}


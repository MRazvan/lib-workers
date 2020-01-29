import { isNumber } from 'lodash';
import { Serialize } from '../../../attributes/serializer';
import { getLog, Logger } from '../../../logging';
import { PrimitiveType } from '../primitive.types';
import { INVALID_PRIMITIVE_INDEX, Synchronization } from '../sync';

export enum EventState {
  LOCKED = 1,
  UNLOCKED = 0
}

// Make it so it's serializable, we can send it to other workers
@Serialize()
export class ManualResetEvent {
  private static readonly _log: Logger = getLog('[ManualResetEvent]');
  private constructor(public key: number, private readonly _index: number) {}

  public get state(): EventState {
    return Atomics.load(Synchronization.getBuffer(), this._index) === EventState.LOCKED
      ? EventState.LOCKED
      : EventState.UNLOCKED;
  }

  // Wait on this until someone call's notify
  public waitOne(timeout: number = Number.MAX_SAFE_INTEGER): boolean {
    ManualResetEvent._log(`Wait.`, this.key);
    return Atomics.wait(Synchronization.getBuffer(), this._index, EventState.LOCKED, timeout) === 'ok';
  }

  public set(): void {
    ManualResetEvent._log(`Set.`, this.key);
    // Release the lock
    Atomics.store(Synchronization.getBuffer(), this._index, EventState.UNLOCKED);
    // Wakeup waiting agents
    Atomics.notify(Synchronization.getBuffer(), this._index, Number.MAX_SAFE_INTEGER);
  }

  public reset(): void {
    ManualResetEvent._log(`Reset.`, this.key);
    Atomics.store(Synchronization.getBuffer(), this._index, EventState.LOCKED);
  }

  public static createOrGet(eventKey: number, state: EventState = EventState.LOCKED): ManualResetEvent {
    if (!isNumber(eventKey) || isNaN(eventKey) || !isFinite(eventKey)) {
      throw new Error(`The ManualResetEvent key must be a number. Got ${eventKey}`);
    }
    const eventBufferIndex = Synchronization.getIndexForPrimitive(eventKey, PrimitiveType.MANUAL_RESET_EVENT, [
      state,
      EventState.LOCKED
    ]);
    if (eventBufferIndex === INVALID_PRIMITIVE_INDEX) {
      throw new Error('Cannot allocated space for ManualResetEvent');
    }
    return new ManualResetEvent(eventKey, eventBufferIndex);
  }
}

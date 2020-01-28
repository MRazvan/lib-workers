import { isNil } from 'lodash';
import { ThreadLoad } from '../../attributes/thread.load';
import { Threading, ThreadingEnvType } from '../../implementation/threading/threading';
import { PrimitiveType } from './primitive.types';

const BUFFER_LOCK_INDEX = 0;
const UNLOCKED = 0;
const LOCK = 1;

const PRIMITIVE_TYPE_IDX = 0;
const PRIMITIVE_ID_IDX = 1;

const SIZE_OF_INT32_IN_BYTES = 4;
const SIZE_OF_PRIMITIVE_IN_BYTES = 4 * SIZE_OF_INT32_IN_BYTES;
const NUMBER_OF_PRIMITIVE_TO_RESERVE = 4 * 1024;

@ThreadLoad()
export class Synchronization {
  private static _syncPrimitiveSharedBuffer: Int32Array = null;

  public static initialize(context: any): void {
    if (Threading.type === ThreadingEnvType.MAIN) {
      if (isNil(Synchronization._syncPrimitiveSharedBuffer)) {
        // Set the buffer to be sent to the workers
        // We need an int buffer view for Atomics to work
        // We also require 4 int's per sync primitive
        // So if we want 4 k of primitives available we need 4 (int size) * 4 (needed ints) * 4 * 1024 -> 16 bytes / primitive
        // we need one more by to lock the full array when we do changes on it
        Synchronization._syncPrimitiveSharedBuffer = new Int32Array(
          new SharedArrayBuffer(SIZE_OF_PRIMITIVE_IN_BYTES * NUMBER_OF_PRIMITIVE_TO_RESERVE + 4)
        );
        context.sync = {
          buffer: Synchronization._syncPrimitiveSharedBuffer
        };
      }
    } else {
      Synchronization._syncPrimitiveSharedBuffer = context.sync.buffer;
    }
  }

  public static getBuffer(): Int32Array {
    return Synchronization._syncPrimitiveSharedBuffer;
  }

  public static getIndexForPrimitive(id: number, type: PrimitiveType, data?: [number, number]): number {
    // Go through the array and check to see if we have the index and
    let locked = true;
    while (locked) {
      Atomics.wait(Synchronization._syncPrimitiveSharedBuffer, BUFFER_LOCK_INDEX, LOCK);
      const state = Atomics.compareExchange(
        Synchronization._syncPrimitiveSharedBuffer,
        BUFFER_LOCK_INDEX,
        UNLOCKED, // Expect
        LOCK // Set
      );
      if (state === UNLOCKED) {
        locked = false;
      }
    }

    // Get or create the primitive
    let primitiveIndex = 0;
    for (primitiveIndex = 1; primitiveIndex < Synchronization._syncPrimitiveSharedBuffer.length; primitiveIndex += 4) {
      if (Synchronization._syncPrimitiveSharedBuffer[primitiveIndex + PRIMITIVE_TYPE_IDX] === PrimitiveType.NOT_SET) {
        // We reached the end of allocated primitives, allocate this index
        Synchronization._syncPrimitiveSharedBuffer[primitiveIndex + PRIMITIVE_TYPE_IDX] = type;
        Synchronization._syncPrimitiveSharedBuffer[primitiveIndex + PRIMITIVE_ID_IDX] = id;
        // Initialize the data if we have any
        if (!isNil(data)) {
          Synchronization._syncPrimitiveSharedBuffer[primitiveIndex + 2] = data[0];
          Synchronization._syncPrimitiveSharedBuffer[primitiveIndex + 3] = data[1];
        }
        break;
      } else if (
        Synchronization._syncPrimitiveSharedBuffer[primitiveIndex + PRIMITIVE_TYPE_IDX] === type &&
        Synchronization._syncPrimitiveSharedBuffer[primitiveIndex + PRIMITIVE_ID_IDX] === id
      ) {
        break;
      }
    }
    // Unlock
    Atomics.store(Synchronization._syncPrimitiveSharedBuffer, BUFFER_LOCK_INDEX, UNLOCKED);
    Atomics.notify(Synchronization._syncPrimitiveSharedBuffer, BUFFER_LOCK_INDEX, Number.MAX_SAFE_INTEGER);
    // Return the index pointing to the data not the metadata we store
    return primitiveIndex + 2;
  }
}

Threading.registerInitializer({
  initialize: Synchronization.initialize
});

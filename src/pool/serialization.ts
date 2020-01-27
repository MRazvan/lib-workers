import { isNil, isString } from 'lodash';
import { isArray, isBoolean, isNumber } from 'util';
import { GetSerializers, ISerializer, SerializationHandlerKey } from './attributes/serializer';
import { SerializationError } from './errors/serialization.error';
import { getLog, Logger } from './logging';

export class Serializer {
  private static readonly _log: Logger = getLog(`[${Serializer.name}]`);
  public static serialize(obj: any): any {
    if (isNil(obj) || isString(obj) || isNumber(obj) || isBoolean(obj)) return obj;
    if (isArray(obj)) {
      // TODO: Circular references, make this smarter
      return obj.map(item => Serializer.serialize(item));
    }
    if (!obj.___WorkerMessageKey) {
      Serializer._log(`Message not decorated with @Serialize. ${JSON.stringify(obj)}`);
      return obj;
    }

    // Check to see if we have a serialization decorator
    const cd = GetSerializers().find(wm => wm.name === obj.___WorkerMessageKey);
    if (cd && cd.tags[SerializationHandlerKey]) {
      try {
        const handler = cd.tags[SerializationHandlerKey] as ISerializer;
        const serializedData: any = handler.serialize(obj);
        serializedData.___WorkerMessageKey = obj.___WorkerMessageKey;
        serializedData.id = obj.id;
        return serializedData;
      } catch (err) {
        Serializer._log(`Error serializing object '${obj.___WorkerMessageKey}'.`, err);
        throw new SerializationError();
      }
    }

    // Fallback
    return {
      ...obj,
      ___WorkerMessageKey: obj.___WorkerMessageKey
    };
  }

  public static deserialize(obj: any): any {
    if (isNil(obj) || isString(obj) || isNumber(obj) || isBoolean(obj)) return obj;
    if (isArray(obj)) {
      // TODO: Circular references, make this smarter
      return obj.map(item => Serializer.deserialize(item));
    }
    if (!obj.___WorkerMessageKey) {
      return obj;
    }

    // Try and instantiate our object
    const cd = GetSerializers().find(cd => cd.name === obj.___WorkerMessageKey);
    if (!cd) {
      Serializer._log(`Deserialization. ClassData Not found for '${obj.___WorkerMessageKey}'`);
      throw new Error(`Deserialization. ClassData Not found for '${obj.___WorkerMessageKey}'`);
    }
    if (cd.tags[SerializationHandlerKey]) {
      const handler = cd.tags[SerializationHandlerKey] as ISerializer;
      return handler.deserialize(obj);
    }
    // Fallback construct the object
    const instance = Reflect.construct(cd.target, []);
    Object.assign(instance, obj);
    return instance;
  }
}

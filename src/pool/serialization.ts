import { ReflectHelper } from 'lib-reflect';
import { isString } from 'lodash';
import { isBoolean, isNumber } from 'util';
import { GetWorkerMessages, ISerializer, SerializationHandlerKey } from './attributes/message';
import { DeserializationError } from './errors/deserialization.error';
import { SerializationError } from './errors/serialization.error';

export class Serializer {
  public static serialize(obj: any): any {
    if (isString(obj) || isNumber(obj) || isBoolean(obj)) return obj;
    // Check to see if we have a serialization decorator
    const cd = ReflectHelper.getClass(obj);
    if (cd) {
      if (cd.tags[SerializationHandlerKey]) {
        try {
          const handler = cd.tags[SerializationHandlerKey] as ISerializer;
          const serializedData = handler.serialize(obj);
          return {
            ...serializedData,
            ___WorkerMessageKey: obj.___WorkerMessageKey
          };
        } catch (err) {
          throw new SerializationError();
        }
      }
    }
    return {
      ...obj,
      ___WorkerMessageKey: obj.___WorkerMessageKey
    };
  }

  public static deserialize(obj: any): any {
    if (isString(obj) || isNumber(obj) || isBoolean(obj)) return obj;
    // Check to see if we have a serialization decorator
    const cd = ReflectHelper.getClass(obj);
    if (cd) {
      if (cd.tags[SerializationHandlerKey]) {
        try {
          const handler = cd.tags[SerializationHandlerKey] as ISerializer;
          return handler.deserialize(obj);
        } catch (err) {
          throw new DeserializationError();
        }
      }
    }
    if (!obj.___WorkerMessageKey) {
      return obj;
    }

    // Try and instantiate our object
    try {
      const cd = GetWorkerMessages().find(cd => cd.name === obj.___WorkerMessageKey);
      if (!cd) {
        throw new DeserializationError();
      }
      const instance = Reflect.construct(cd.target, []);
      Object.assign(instance, obj);
      return instance;
    } catch (err) {
      throw new DeserializationError();
    }
  }
}

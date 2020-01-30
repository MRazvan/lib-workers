import { ClassData, ClassDecoratorFactory, ReflectHelper } from 'lib-reflect';
import { isNil } from 'lodash';

class SerializedMetaStorage {}

export interface ISerializer {
  serialize(data: any): any;
  deserialize(data: any): any;
}

export const SerializationHandlerKey = 'SerializationHandlerKey';

const SerializationBagKey = 'SerializationBagKey';

function addSerializerToBag(cd: ClassData): void {
  const ctxCd = ReflectHelper.getOrCreateClassData(SerializedMetaStorage);
  if (isNil(ctxCd.tags[SerializationBagKey])) {
    ctxCd.tags[SerializationBagKey] = [];
  }
  if (!ctxCd.tags[SerializationBagKey].includes(cd)) {
    ctxCd.tags[SerializationBagKey].push(cd);
  }
}

export const Serialize = (serializer?: ISerializer): ClassDecorator =>
  ClassDecoratorFactory((cd: ClassData) => {
    cd.target.prototype.___WorkerMessageKey = cd.name;
    if (!isNil(serializer)) {
      cd.tags[SerializationHandlerKey] = serializer;
    }
    addSerializerToBag(cd);
  });

export function GetSerializers(): ClassData[] {
  const ctxCd = ReflectHelper.getOrCreateClassData(SerializedMetaStorage);
  return ctxCd.tags[SerializationBagKey] || [];
}

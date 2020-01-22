import { ClassData, ClassDecoratorFactory, ReflectHelper } from 'lib-reflect';
import { isNil } from 'lodash';

class Messages {}

export interface ISerializer {
  serialize(data: any): any;
  deserialize(data: any): any;
}

export const SerializationHandlerKey = 'SerializationHandlerKey';
const MessageClassBagKey = 'MessageClassBagKey';
export const Message = (serializer?: ISerializer): ClassDecorator =>
  ClassDecoratorFactory((cd: ClassData) => {
    cd.target.prototype.___WorkerMessageKey = cd.name;
    if (!isNil(serializer)) {
      cd.tags[SerializationHandlerKey] = serializer;
    }
    const ctxCd = ReflectHelper.getOrCreateClassData(Messages);
    let classes: any[] = ctxCd.tags[MessageClassBagKey];
    if (!classes) {
      classes = [];
      ctxCd.tags[MessageClassBagKey] = classes;
    }
    if (!classes.includes(cd)) {
      classes.push(cd);
    }
  });

export function GetWorkerMessages(): ClassData[] {
  const ctxCd = ReflectHelper.getOrCreateClassData(Messages);
  return ctxCd.tags[MessageClassBagKey] || [];
}

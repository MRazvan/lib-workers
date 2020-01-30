import * as getCallerFile from 'get-caller-file';
import { ClassData, ClassDecoratorFactory, ReflectHelper } from 'lib-reflect';
import { isNil } from 'lodash';

class ThreadLoadBag {}

export const ThreadLoadBagKey = 'ThreadLoadFileKey';
function addToFilesBag(cd: ClassData): void {
  const bagCd = ReflectHelper.getOrCreateClassData(ThreadLoadBag);
  if (isNil(bagCd.tags[ThreadLoadBagKey])) {
    bagCd.tags[ThreadLoadBagKey] = [];
  }
  bagCd.tags[ThreadLoadBagKey].push(cd);
}

export function ThreadLoad(fileName?: string): ClassDecorator {
  fileName = isNil(fileName) ? getCallerFile() : fileName;
  return ClassDecoratorFactory((cd: ClassData) => {
    cd.tags[ThreadLoadBagKey] = fileName;
    addToFilesBag(cd);
  });
}

export function GetThreadLoadClasses(): ClassData[] {
  const bagCd = ReflectHelper.getOrCreateClassData(ThreadLoadBag);
  return bagCd.tags[ThreadLoadBagKey] || [];
}

import * as getCallerFile from 'get-caller-file';
import { ClassData, ClassDecoratorFactory, ReflectHelper } from 'lib-reflect';
import { isNil } from 'lodash';
class Contexts {}

export const WorkerScheduledFileNameTagKey = 'WorkerScheduledTag';

const AllWorkerScheduledClasses = 'WorkerScheduledClasses';

export const WorkerContext = (fileName?: string): ClassDecorator => {
  fileName = isNil(fileName) ? getCallerFile() : fileName;
  return ClassDecoratorFactory((cd: ClassData) => {
    // Set the filename
    cd.tags[WorkerScheduledFileNameTagKey] = fileName;

    // Register this class for worker loading
    const ctxCd = ReflectHelper.getOrCreateClassData(Contexts);
    let classes = ctxCd.tags[AllWorkerScheduledClasses];
    if (!classes) {
      classes = [];
      ctxCd.tags[AllWorkerScheduledClasses] = classes;
    }
    classes.push(cd);
  });
};

export function GetWorkerContexts(): ClassData[] {
  const ctxCd = ReflectHelper.getOrCreateClassData(Contexts);
  return ctxCd.tags[AllWorkerScheduledClasses] || [];
}

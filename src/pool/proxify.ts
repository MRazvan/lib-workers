import { Dynamic, DynamicClass, DynamicMethod, MethodData, ReflectHelper } from 'lib-reflect';
import { isNil } from 'lodash';
import { WorkerScheduledFileNameTagKey } from './attributes/worker.context';
import { DoneMsg } from './messages/done';
import { ExecuteMsg } from './messages/execute';
import * as WP from './worker.pool';

export function Proxify<T>(target: Function): new () => T {
  // Some sanity checks
  if (isNil(target)) {
    throw new Error('Cannot create Proxy for null or undefined.');
  }

  // If we are not in a worker environment or the workers are not enabled
  //    return the actual target back
  if (WP.WorkerPool.isWorker() || !WP.WorkerPool.isEnabled()) {
    return target as new () => T;
  }

  // This will get the reflection information on that target
  const cd = ReflectHelper.getClass(target);
  if (isNil(cd)) {
    throw new Error(
      `Invalid target for proxy generation. It was not found in the Reflection system, use @WorkerContext. ${target.name}`
    );
  }

  // Check to see if the target is marked for processing on workers
  if (isNil(cd.tags[WorkerScheduledFileNameTagKey])) {
    // Do we throw an error, or just leave it be and return a regular instance?
    //  If we return a regular instance, the user might get fooled into thinking they are running on a worker
    //  when actually the main thread will be the one running and getting blocked
    // So for not just thrown an error
    throw new Error(`Requested target for Worker proxy generation is not decorated with @WorkerContext. '${cd.name}'`);
  }

  // Did we generate a proxy before? If yes return that
  if (!isNil(cd.tags['ProxyClass'])) {
    return cd.tags['ProxyClass'].target as new () => T;
  }

  // Make sure we build the metadata so we have all methods from that class
  cd.build();

  // Create the proxy class
  const dynamicClass = Dynamic.createClass('Proxy' + cd.name, null, (dc: DynamicClass) => {
    // Now create the proxy for the methods
    cd.methods.forEach((md: MethodData) => {
      // Skip over the constructor
      if (md.name === 'constructor') {
        return;
      }

      // Add a method, same method as the one we have on the class
      dc.addMethod(md.name, (dm: DynamicMethod) => {
        // Set the body of the proxied method
        dm.addBody(function(...args: any[]): Promise<any> {
          // Finally send the work to the worker threads and return the result, or just throw if anything happens
          return WP.WorkerPool.sendToWorker(new ExecuteMsg(cd.name, md.name, args)).then((val: DoneMsg) => val.payload);
        });
      });
    });
  });

  // Try to make instanceof work on proxyfied targets
  //    so code like (proxy instanceof Target) is true
  try {
    Object.defineProperty(cd.target, Symbol.hasInstance, {
      value: (instance: any): boolean => {
        if (isNil(instance)) return false;
        return instance.constructor === dynamicClass.target;
      }
    });
  } catch (err) {
    // We can't do runtime type checking with instanceof
  }

  // Cache the proxy, next time just return the generated one
  cd.tags['ProxyClass'] = dynamicClass;

  // Return the new class 'Function' to create an instance
  return dynamicClass.target as new () => T;
}

export function Create<T>(target: Function): T {
  return Reflect.construct(Proxify<T>(target), []);
}

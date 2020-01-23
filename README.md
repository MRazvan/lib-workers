# lib-workers

Library to help with nodejs worker-threads.

It takes care of creating a pool of workers, communication with those workers and running functionalitiy in them.
It also provides some synchronization primitives.

Still WIP.

## WorkerPool
Represents the pool of workers that were created, and allows communication with the workers. All methods are static.

1.  *initialize(numWorkers):void* - initialize the pool with *numWorkers* number of workers. Default: os.cpus().length - 1
2.  *isWorker():boolean* - indicate if the line where this is called is running inside a worker or not
3.  *isEnabled():boolean* - indicate if we initialized but we do not have any workers created. True - workers are spawned.
4.  *workersCount():number* - Return the number of workers spawned. If the calling thread is a worker it returns -1.
5.  *pendingMessages():number* - Return the number of messages we have in the queue. If the calling thread is a worker it returns -1.

```typescript
// This will initialize the worker pool with os.cpus()-1 workers.
WorkerPool.initialize();

console.log(WorkerPool.isWorker());
console.log(WorkerPool.isEnabled());
console.log(WorkerPool.workersCount());
console.log(WorkerPool.pendingMessages());

```

## Doing work in the workers

The system for handling work to be done on the child workers is based on decorators. Any class that contains code should be marked with **@WorkerContext()**

```typescript
// The containing file for the following class 
//  will be replicated in the worker threads
@WorkerContext()
class MyFunctionalityHandler{
  public doSomeWork(): Promise<any> {}
}
```
In cases where the library does not know what to load the decorator has a 'fileName' argument.
```typescript
// The containing file for the following class 
//  will be replicated in the worker threads
@WorkerContext(__filename)
class MyFunctionalityHandler{
  public doSomeWork(): Promise<any> {}
}
```

In order to execute the functionality in the workers we need to do something on the main thread. That something means telling the workers to execute **doSomeWork()** and return the result, in order to do that, we create a proxy of the class in the main thread and use that for communication.

```typescript
import * as WP from 'lib-workers';
const inst = WP.Create<MyFunctionalityHandler>(MyFunctionalityHandler);

// inst is a proxy over the original class, 
//  it will still behave like the original class 
//  however when calling a method on that it will be proxied 
//  to a worker thread for execution

// This will queue work on a worker thread and wait for that work to finish
await inst.doSomeWork();
```

There are some limitation regarding the data that can be sent to the worker-threads, the data we send is cloned using [HTML structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).

Meaning we can send plain data, we can't send instances of classes that we can use on the other side. To circumvent this and have functionalities on the other side of the channel you can decorate the class with **@Serialize()**.

```typescript
class GetNextInt {
  constructor(public init: number){}
  public next(): number { return this.init++; }
}
const gni = new GetNextInt(10);
sendToWorker(gni);
// ************************
//    IN WORKER
gni.next(); // This will fail, gni is a plain object.

/////////////////////
// To circumvent that we need to decorate the class with @Serialize()
@Serialize()
class GetPrevInt {
  constructor(public init: number){}
  public prev(): number { return this.init--; }
}
// The way this works is, on the worker side, the handler will create an instance of GetPrevInt
//  and do an Object.assign to initialize the state with the data received from the parent.
const gpi = new GetPrevInt(10);
sendToWorker(gpi);
// ************************
//    IN WORKER
gpi.prev(); // This will work, gpi is an instance of GetPrevInt
```
Keep in mind the following.
- If you send only plain objects / data, you don't need to do anything special.
- If you send instances of simple classes you can use @Serialize() to make the instance work on the other side
- If you need more functionality you can implement your own serializer / deserializer in the same decorator and make use of the **Serializer** methods
  ```typescript
  @Serialize({
    serialize: (data:GetPrevInt): any {},
    deserialize: (data:any): GetPrevInt {}
  })
  ```

<br/> <br/>

> **Attention** 
> 
> You should return promises from the methods that you want to call 
> on worker threads, that is because the proxy for that method 
> returns a Promise, if you want your intellisense to work 
> correctly, you should return a Promise.


Limitations for now:
1. You can't register individual functions for execution on worker threads.
2. You should not have constructors with arguments on classes.

## Synchronization
The library provides 2 clasic synchronization mechanism and one custom.
- **Mutex**
  
  Clasic mutex functionality used for critical sections, the worker that call's *lock* owns the mutex and only that worker can unlock it. Obviously with some omissions (there is no priority for workers), also it's not reentrant.
- **BinarySemaphore**

  Clasic binary semaphore used for signaling.

- **Barrier**
  
  Custom signaling to allow multiple workers to wait on some condition, and when that condition happens they all start.
  ```typescript
    const barrier: Barrier ...

    // Everyone waits here
    barrier.wait();


    /*****************************/
    // Somewhere in main
    barrier.notify();
    // From this point on, anyone that was waiting on the barrier will start running
    /*****************************/
  ```

## Examples
### Long Running
Simplest example, 
- Create a class and decorate it
- Initialize the WorkerPool
- Create a proxy instance of the class
- Call the methods to queue work on worker threads.

```typescript
// in long.running.ts
@WorkerContext()
export class LongRunning {
  public calculatePrimes(maxPrime: number): Promise<number>{
    // Calculate all primes up to maxPrime
  }
}
```
```typescript
// in index.ts
import * as WP from 'lib-workers';
import {LongRunning} from './long.running';

WP.WorkerPool.initialize();
const heavyCPU = WP.Create<LongRunning>(LongRunning);

const resultPromise = heavyCPU.calculatePrimes(20000000); // This 
// We can continue executing other stuff while the 'calculatePrimes' finishes.
```

### Mutex

Similar to the one above, showing how to use a mutex. 

The workers will run in parallel up until the **lock** after that point they will run sequentially fighting for the lock

```typescript
// in mutex.example.ts
import * as WP from 'lib-workers';
@WorkerContext()
export class MutexTest {
  public waitOnMutex(mutex: WP.Mutex): Promise<number>{
    console.log(`${WP.getThreadId()} - TRY AND GET THE LOCK `);
    
    m.lock(); // Try and get the lock
    { 
      // CRITICAL SECTION :) In a 'single threaded' v8 execution context, with no way to easily share data :D
      //  Just for fun we can still dream about them
      console.log(`${WP.getThreadId()} - WE GOT THE LOCK RELEASE IN 1 second  `);
      await WP.wait(1000);
      console.log(`${WP.getThreadId()} - RELEASE `);
    }
    m.unlock();
    
    return Promise.resolve(WP.getThreadId());
  }
}
```
```typescript
// in index.ts
import * as WP from 'lib-workers';
import {MutexTest} from './mutex.example';

WP.WorkerPool.initialize();
const heavyCPU = WP.Create<MutexTest>(MutexTest);
const mutex = WP.Mutex.create('some_key');
// We don't lock the mutex on main, we let the workers fight for it.
//  if we wanted we could lock the mutex here and unlock it sometime later
// Spawn a bunch of work
for (let idx = 0; idx < WP.WorkerPool.workersCount(); ++idx) {
  heavyCPU.waitOnMutex(mutex);
}
```

## Barrier
Shows the barrier functionality

```typescript

import * as WP from 'lib-workers';
@WorkerContext()
export class BarrierTest {
  public async waitOnBarrier(m: WP.Barrier): Promise<number> {
    console.log(`${WP.getThreadId()} - WAIT FOR BARRIER `);
    
    m.wait(); // Like the log above said, wait for barrier to be lifted
    
    console.log(`${WP.getThreadId()} - BARRIER LIFTED `);
    return Promise.resolve(WP.getThreadId());
  }
}
```
```typescript
// in index.ts
import * as WP from 'lib-workers';
import {LongRunning} from './long.running';

WP.WorkerPool.initialize();
const heavyCPU = WP.Create<BarrierTest>(BarrierTest);
const barrier = WP.Barrier.create('some_key');
// The barrier is locked by default
for (let idx = 0; idx < WP.WorkerPool.workersCount(); ++idx) {
  heavyCPU.waitOnBarrier(barrier);
}
// Lift the barrier after 3 seconds, all worker threads will start at that point.
setTimeout(() => {
  console.log('Notify the barrier');
  barrier.notify();
}, 3000);
```
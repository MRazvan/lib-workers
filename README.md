# lib-workers

Library to help with nodejs worker-threads.


- [lib-workers](#lib-workers)
  - [Overview](#overview)
  - [Installation](#installation)
  - [Threading](#threading)
      - [Methods](#methods)
      - [Properties](#properties)
  - [Doing work](#doing-work)
  - [Synchronization](#synchronization)
  - [Debugging](#debugging)
    - [Log](#log)
    - [Tracing](#tracing)
  - [Examples](#examples)
    - [Express](#express)
    - [NestJS](#nestjs)
    - [Inversify (inversify)](#inversify-inversify)
  - [Limitations](#limitations)

## Overview
This library and it's functionality takes care of creating a pool of workers, communication with those workers and running some work in them. Create a proxy for a class that needs to run in a worker, and use that proxy like the actual class.
- Simple to use
- Integrates easily with DI systems
- Synchronization primitives
- Support customization of functionalities (Advanced)
- FIFO scheduler (for now) - as soon as a worker completes it will take the next item from the queue for processing
- Nice to have features
  - ***instanceof*** still works on proxies
  ```typescript
  const proxy = WP.Create(ResizeImage)
  console.log(proxy instanceof ResizeImage); // true
  ```
  - Any metadata on the class will be set on the proxy also so it can be used with existing code that relies on the metadata available.
  For example DI containers.
<br />

## Installation
Standard npm package install.
```
npm i lib-workers
```

## Threading
Represents the pool of workers that were created, and allows communication with the workers. All methods / properties are static.
#### Methods
1.  ***initialize**(numWorkers):void* - initialize the pool with *numWorkers* number of workers. Default: os.cpus().length - 1
2.  ***send**(msg: Packet, destination?:number):Promise* - Send a packet to be handled by the worker threads. Destination is optional and represents the worker id that should handle the packet. If no worker id is specified, the first thread that can handle the packet will. Targeted messages will be scheduled first for the workers before any other message.
    > ***Info :*** There are two constants predefined by the library that can be set to the destination field:
    > - THREAD_ANY - Any thread available will handle the message
    > - THREAD_ALL - All threads will get that message (this is usefull for configuring all threads for example), in the case of this constant, the promise returned by send will be resolved by the library.
3.  ***getNextPacketId**():number* - Returns the next packet id that can be used for communication.

-------
Advanced methods
1.  ***registerHandler**(handler: IMessageHandler):void* - Register a message handler in the worker threads and in main. Usefull for custom packets and custom functionality. ( Ex. Execute handler in [execute.ts](src/pool/handlers/execute.ts))
2.  ***registerInitializer**(handler: IInitializer):void* - Register an initialization handler in the worker threads and in main. Usefull for populating the 'context' information in main and getting that information in the worker threads. (Ex. Synchronization handler in [sync.ts](src/pool/handlers/synchronization/sync.ts))
  

#### Properties
1.  ***type** :ThreadingEnvType* - Indicates the type of environment we are in (WORKER, MAIN)
2.  ***context** :any* - The data sent to the worker threads by the main thread. Available both in MAIN and WORKER environment.
3.  ***initialized** :boolean* - Indicates if the Threading system has started and everything is ok.
4.  ***threadId** :number* - The thread id of the currently executing environment.
```typescript
// This will initialize the worker pool with os.cpus()-1 workers.
Threading.initialize();

console.log(Threading.type);
console.log(Threading.context);
console.log(Threading.initialized);
console.log(Threading.threadId);

```

## Doing work

The system for handling work to be done on the child workers is based on decorators. Any class that contains code to be executed on a worker thread should be marked with **@ThreadLoad()**

```typescript
// The containing file for the following class 
//  will be replicated in the worker threads
@ThreadLoad()
class MyFunctionalityHandler{
  public doSomeWork(): Promise<any> {}
}
```
In cases where the library does not know what to load the decorator has a 'fileName' argument.
```typescript
// The containing file for the following class 
//  will be replicated in the worker threads
@ThreadLoad(__filename)
class MyFunctionalityHandler{
  public doSomeWork(): Promise<any> {}
}
```

In order to execute the functionality in the workers we need to do something on the main thread. That something means telling the workers to execute **doSomeWork()** and return the result, in order to do that, we **Create** a proxy of the class in the main thread and use that for communication.

```typescript
import * as WP from 'lib-workers';
const inst = WP.Create<MyFunctionalityHandler>(MyFunctionalityHandler);

// inst is a proxy over the original class, 
//  however when calling a method on that it will be proxied 
//  to a worker thread for execution

// This will queue work on a worker thread and wait for that work to finish
await inst.doSomeWork();
```

There are some limitation regarding the data that can be sent to the worker-threads, the data we send is cloned using [HTML structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).

Meaning we can send plain data, we can't send instances of classes and expect to use methods on those on the other side (in workers). To circumvent this and have functionalities on the other side of the channel you can decorate the class with **@Serialize()**.

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
- If you need more functionality to serialize / deserialize the message you can implement your own serializer / deserializer in the same decorator and make use of the **Serializer** methods
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


## Synchronization
The library provides a few synchronization primitives
- **Mutex**
  
  Clasic mutex functionality used for critical sections, the worker that call's *lock* owns the mutex and only that worker can unlock it. Obviously with some omissions (there is no priority for workers), also it's not reentrant.
- **BinarySemaphore**

  Clasic binary semaphore used for signaling.

- **ManualResetEvent**
  Signaling to allow multiple workers to wait on some condition, and when that condition happens they all start.
  ```typescript
    const signal: ManualResetEvent = ManualResetEvent.createOrGet(1) ...

    // Everyone waits here
    signal.waitOne();


    /*****************************/
    // Somewhere in main
    signal.set();
    // From this point on, anyone that was waiting on the barrier will start running
    /*****************************/
  ```

## Debugging
There is no way right now to debug worker threads, so we need to figure out other ways. We can debug only the main thread and see what is happening, to see what the workers are doing we have the following:

### Log
NODE_DEBUG support using the 'lib-workers' flag
```PS
$env:NODE_DEBUG="lib-workers";node --experimental-worker .\index.js
--------------------
LIB-WORKERS 50648: [1580370964517] [W-0]  - Initializing main thread. []
LIB-WORKERS 50648: [1580370964521] [W-0]  - USING Worker file '...\lib-workers\dist\src\pool\implementation\threading\threading.js' []
LIB-WORKERS 50648: [1580370964584] [W-0]  - Queue message for any, 'ExecuteMessage' (Id: 1) []
LIB-WORKERS 50648: [1580370964586] [W-0]  - No available worker to schedule []
LIB-WORKERS 50648: [1580370964681] [W-1]  - Initializing child thread 1 []
LIB-WORKERS 50648: [1580370964684] [W-1]  - Load scripts : [...\lib-workers\dist\src\pool\handlers\synchronization\sync.js, ...\lib-workers\dist\src\pool\handlers\execute.js, ...\example_workers\manual.reset.event.js, ...\example_workers\mutex.js, ...\example_workers\semaphore.js] []
LIB-WORKERS 50648: [1580370964704] [W-1] [ComChannel] - Send Message 'OnlineMessage' (Id: 0) [ 0 ]
LIB-WORKERS 50648: [1580370964740] [W-0] [ComChannel] - Got Message 'OnlineMessage' (Id: 0) [ 1 ]
LIB-WORKERS 50648: [1580370964740] [W-0]  - Handle message from worker W-1. Packet 'OnlineMessage' (Id: 0). Deferred none []
LIB-WORKERS 50648: [1580370964740] [W-0]  - Scheduled work on worker W-1. 'ExecuteMessage' (Id: 1) []
LIB-WORKERS 50648: [1580370964741] [W-0] [ComChannel] - Send Message 'ExecuteMessage' (Id: 1) [ 1 ]
LIB-WORKERS 50648: [1580370964742] [W-1] [ComChannel] - Got Message 'ExecuteMessage' (Id: 1) [ 0 ]
..................
```
### Tracing
In progress.

<img src="/resources/trace_1.png">

## Examples
### Express
- [express](/EXPRESS.md)
### NestJS
- [nestjs](/NESTJS.md)
### Inversify ([inversify](http://inversify.io/))
```typescript
// Worker
@WP.ThreadLoad()
@injectable()
export class Work {
   public doWork(timeout:number): Promise<string> {
      return new Promise((resolve) => setTimeout(resolve, timeout)).then(() => 'Done Work.');
   }
}
```

Register the worker in the container and use that down the line in the application.
```typescript
WP.Threading.initialize();
const container = new Container();
// In main bind the 'Work' service to a proxy class. 
// This means each time we use 'Work' in the main thread 
//  we will get a proxy that will create work in the pool
container.bind(Work).to(WP.Proxify(Work));

// In our code somewhere get the container
const work = container.get<Work>(Work);
// This will queue work on the pool
work.doWork(1000).then(console.log);
```

Do not get the false impression that it's fully integrated and you can inject services in the Work class. That class is created inside a worker, the container does not exist there, and the services registered in the container do not exist there. Also the class is created using Reflect.create and not a particular container, the functionality needed to do that is an advanced topic.

## Limitations
- You can't register individual functions for execution on worker threads.
- Keep in mind that properties are not proxied over
- The serialization of the method arguments is not deep, if you need something custom, provide your own serializer / deserializer.
- For now it supports only Promise as a return type from the worker. TODO: Observable, Readstream

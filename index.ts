import * as WP from './src/pool';
import { MutexTest } from './mutex.t';

// By default the WorkerPool will create (os.cpus - 1) workers, it can be overridden with the number of workers
// WP.WorkerPool.initialize(3);
WP.WorkerPool.initialize(10);

const longRunningProcess = WP.Create<MutexTest>(MutexTest);
async function bootstrap(): Promise<void> {
  // Create our instance in the main thread this will be a proxy, 
  // however if the WorkerPool is not running it will actually be an instance of our class
  const b = await WP.Mutex.get('myBarrier');
  for (let idx = 0; idx < WP.WorkerPool.workersCount(); ++idx) {
    // We still have intellisense
    // Because we are in main and this class is marked for worker process the following call 
    //  will run on workers and return a promise that will resolve when it's done
    longRunningProcess.testMutex(b); 
  }
  // setTimeout(() => {
  //   console.log('WAKEUP THREADS');
  //   b.notify();
  // }, 5000);
}

bootstrap();

// const longRunningProcess = WP.Create<LongRunning>(LongRunning);
// // instanceof should still work on the proxy
// if (longRunningProcess instanceof LongRunning) {
//   console.log('******************* EVRIKA instanceof works ******************* ');
// }

// // Queue up some work on the worker threads, twice the amount of workers available
// for (let idx = 0; idx < 2 * WP.WorkerPool.workersCount(); ++idx) {
//   // We still have intellisense
//   // Because we are in main and this class is marked for worker process the following call 
//   //  will run on workers and return a promise that will resolve when it's done
//   longRunningProcess.calculatePrimes(20000000); 
// }

// // Start something in main to see that main thread is still alive and kicking
// let cnt = 0;
// setInterval(() => console.log('In Main Thread... ' + cnt++), 1000);

/*

************************************* WARNING *********************************
************************************* WARNING *********************************
************************************* WARNING *********************************
************************************* WARNING *********************************
If you want to run the class from the main file make sure when you are creating work to be done
    that it's not running inside the worker thread


***************************** DO THIS IN THE MAIN FILE ************************
***************************** DO THIS IN THE MAIN FILE ************************
***************************** DO THIS IN THE MAIN FILE ************************
***************************** DO THIS IN THE MAIN FILE ************************

@WP.WorkerContext()
class LongRunning{
  public something(): Promise<any>{}
}

if (!WP.WorkerPool.isWorker()) {
  // In main
  WP.WorkerPool.initialize();
  let inst: LongRunning = WP.Create<LongRunning>(LongRunning);
  inst.something();  // This will run on a worker
}



************************* DON'T DO THIS IN THE MAIN FILE **********************
************************* DON'T DO THIS IN THE MAIN FILE **********************
************************* DON'T DO THIS IN THE MAIN FILE **********************
************************* DON'T DO THIS IN THE MAIN FILE **********************

In main it will proxy the call
In workers something() will run at start and block that worker until it is done 

@WP.WorkerContext()
class LongRunning{
  public something(): Promise<any>{}
}

// In main
WP.WorkerPool.initialize();
let inst: LongRunning = WP.Create<LongRunning>(LongRunning);
inst.something();  // This will run on a worker

*/

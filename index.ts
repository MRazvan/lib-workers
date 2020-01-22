import { LongRunning } from './long.running';
import * as WP from './src/pool';

// By default the WorkerPool will create (os.cpus - 1) workers, it can be overridden with the number of workers
//  WP.WorkerPool.initialize();
WP.WorkerPool.initialize(2);

// Create our instance in the main thread
const longRunningProcess = WP.Create<LongRunning>(LongRunning);

// instanceof should still work on the proxy
if (longRunningProcess instanceof LongRunning) {
  console.log('******************* EVRIKA instanceof works ******************* ');
}

// Queue up some work on the worker threads, twice the amount of workers available
for (let idx = 0; idx < 2 * WP.WorkerPool.workersCount(); ++idx) {
  longRunningProcess.calculatePrimes(20000000).catch(console.log); // This will execute all of them inside workers
}

// Start something in main to see that main thread is still alive and kicking
let cnt = 0;
setInterval(() => console.log('In Main Thread... ' + cnt++), 1000);

/** *********************************** WARNING *********************************/
/** *********************************** WARNING *********************************/
/** *********************************** WARNING *********************************/
/** *********************************** WARNING *********************************/
/*

// If you want to run the class from the main file make sure when you are creating work to be done
//    that it's not running inside the worker thread
//
// Check the example bellow


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



*/

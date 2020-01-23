import { BarrierTest } from './barrier.example';
import * as WP from './src/pool';

// By default the WorkerPool will create (os.cpus - 1) workers, it can be overridden with the number of workers
// WP.WorkerPool.initialize(3);
WP.WorkerPool.initialize();
// Create our instance in the main thread this will be a proxy,
// however if the WorkerPool is not running it will actually be an instance of our class
const longRunningProcess = WP.Create<BarrierTest>(BarrierTest);
// Create a mutex and pass that to the workers
const barrier = WP.Barrier.create('my_something_barrier');

const promiseList: Promise<any>[] = [];
console.time('Execution');
// The barrier is locked by default
for (let idx = 0; idx < WP.WorkerPool.workersCount(); ++idx) {
  // We still have intellisense
  // Because we are in main and this class is marked for worker process the following call
  //  will run on workers and return a promise that will resolve when it's done
  promiseList.push(longRunningProcess.waitOnBarrier(barrier));
}

setTimeout(() => {
  console.log('Notify the barrier');
  barrier.notify();
}, 3000);

Promise.all(promiseList).then(() => {
  console.timeEnd('Execution');
  console.log('Done. All executed in turn.');
});

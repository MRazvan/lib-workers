import * as WP from './src/pool';
import { EventTest, MY_SUPER_DUPER_EVENT_KEY } from './workers/manual.reset.event';
import { MutexTest } from './workers/mutex';
import { SemaphoreTest } from './workers/semaphore';
function wait(timeout: number): Promise<never> {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
}

async function bootstrap(): Promise<void> {
  // Initialize the thread pool
  WP.Threading.initialize();

  // ///////////////////////////////
  // Manual reset
  // ///////////////////////////////
  console.log(''.padEnd(20, '*'));
  console.log('Manual reset event');
  console.log(''.padEnd(20, '*'));
  const event = WP.ManualResetEvent.createOrGet(MY_SUPER_DUPER_EVENT_KEY);
  const eventTestInstance = WP.Create<EventTest>(EventTest);
  // Queue up work on all workers
  const eventsInWork: Promise<number>[] = [];
  for (let workerIdx = 0; workerIdx < WP.Threading.workers.length; ++workerIdx) {
    eventsInWork.push(eventTestInstance.waitOnEvent());
  }
  await wait(1000);
  console.log('LIFT');
  // Lift the barrier
  event.set();
  // Wait on all to finish before we continue
  await Promise.all(eventsInWork);

  console.log(''.padEnd(20, '*'));
  console.log('Binary semaphore');
  console.log(''.padEnd(20, '*'));
  // ///////////////////////////////
  // Semaphore, by default unlocked let the threads fight for it
  // ///////////////////////////////
  const semaphoreTestInstance = WP.Create<SemaphoreTest>(SemaphoreTest);
  // Queue up work on all workers
  const semaphoresInWork: Promise<number>[] = [];
  for (let workerIdx = 0; workerIdx < WP.Threading.workers.length; ++workerIdx) {
    semaphoresInWork.push(semaphoreTestInstance.waitOnSemaphore());
  }
  // Wait on all to finish before we continue
  await Promise.all(semaphoresInWork);

  console.log(''.padEnd(20, '*'));
  console.log('Mutex');
  console.log(''.padEnd(20, '*'));
  // ///////////////////////////////
  // Mutex, by default unlocked let the threads fight for it
  // ///////////////////////////////
  const mutexTestInstance = WP.Create<MutexTest>(MutexTest);
  // Queue up work on all workers
  const mutexInWork: Promise<number>[] = [];
  for (let workerIdx = 0; workerIdx < WP.Threading.workers.length; ++workerIdx) {
    mutexInWork.push(mutexTestInstance.waitOnMutex());
  }
  // Wait on all to finish before we continue
  await Promise.all(mutexInWork);

  console.log(''.padEnd(20, '*'));
  console.log(''.padEnd(20, '*'));
  console.log(''.padEnd(20, '*'));
  console.log('DONE');
}

bootstrap();

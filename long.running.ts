/* eslint-disable @typescript-eslint/no-use-before-define */
// Disable the rule, place the most important part first on top of the file
import * as WP from './src/pool';

// Declare our class and mark it for WorkerThread processing
@WP.WorkerContext()
export class LongRunning {
  public calculatePrimes(maxPrime: number): Promise<number> {
    // Some long running stuff
    const primes = calculatePrimesToLimit(maxPrime);
    // Log that we are done
    console.log(WP.getThreadId() + '  Finished  Found: ' + primes.length);
    // And return a result
    return Promise.resolve(WP.getThreadId());
  }
}

/** *************************************************/
/** *************************************************/
/** *************************************************/
/** *************************************************/
/** *************************************************/
// Some method that takes a while to complete
function calculatePrimesToLimit(limit: number): number[] {
  const array = [];
  const upperLimit = Math.sqrt(limit);
  const output = [];

  // Make an array from 2 to (n - 1)
  for (let i = 0; i < limit; i++) {
    array.push(true);
  }

  // Remove multiples of primes starting from 2, 3, 5,...
  for (let i = 2; i <= upperLimit; i++) {
    if (array[i]) {
      for (let j = i * i; j < limit; j += i) {
        array[j] = false;
      }
    }
  }

  // All array[i] set to true are primes
  for (let i = 2; i < limit; i++) {
    if (array[i]) {
      output.push(i);
    }
  }
  return output;
}

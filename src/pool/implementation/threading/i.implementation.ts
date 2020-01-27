export class ThreadData {
  public threadId: number;
}
export interface IThreading {
  workers: ThreadData[];
  init(workers: number, workerData: any): void;
  send(msg: any, to?: number): Promise<any>;
}

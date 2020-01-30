import { Packet } from './packet';

export class Deferred {
  public resolved = false;

  public resolve(data?: any): void {
    this._resolve(data);
    this.resolved = true;
  }

  public reject(data?: any): void {
    this._reject(data);
    this.resolved = true;
  }

  constructor(private readonly _resolve: any, private readonly _reject: any, public packet: Packet) {}
}

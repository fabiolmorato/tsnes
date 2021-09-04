import IBus from "./protocols/IBus";
import IDevice from "./protocols/IDevice";

export default class Memory implements IDevice {
  private _bus: IBus;
  private _memory: Uint8Array;
  private _addressStart: number = 0;
  private _addressEnd: number;

  constructor(bus: IBus, size: number, addressStart: number = 0) {
    this._bus = bus;
    this._memory = new Uint8Array(size);
    this._addressStart = addressStart;
    this._addressEnd = this._addressStart + size;
  }

  cycle() {
    if (this._bus.address >= this._addressStart && this._bus.address < this._addressEnd) {
      if (this._bus.mode === "read") {
        this._bus.value = this._memory[this._bus.address - this._addressStart];
      } else {
        this._memory[this._bus.address - this._addressStart] = this._bus.value;
      }
    }
  }
}

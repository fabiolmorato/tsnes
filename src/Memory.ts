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

    const program = [0x00, 0x07, 0xFE, 0x02, 0x00, 0x07, 0xFC, 0x02, 0x01, 0x07, 0xFE, 0x03];
    const data = [0x43, 0x21, 0x12, 0x34];

    for (let i = 0; i < program.length; i++) {
      this._memory[i] = program[i];
    }

    for (let i = 0; i < data.length; i++) {
      this._memory[this._addressEnd - (data.length) + i] = data[i];
    }
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

  print() {
    const value1 = this._memory[0x07FE] << 8 | this._memory[0x07FF];
    const value2 = this._memory[0x07FC] << 8 | this._memory[0x07FD];

    console.log(`Value1: ${value1.toString(16)} | Value2: ${value2.toString(16)}`);
  }
}

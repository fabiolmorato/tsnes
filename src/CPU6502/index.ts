import IBus from "../protocols/IBus";
import IDevice from "../protocols/IDevice";

export default class CPU6502 implements IDevice {
  private _bus: IBus;
  private _job?: Generator;
  private _pc: number = 0;
  private _valueRead?: number = null;
  private _pendingRead?: Generator = null;
  private _halted = false;

  private _a: number = 0;

  constructor(bus: IBus) {
    this._bus = bus;
    this._pendingRead = this._getFromMemory(this._pc++);
    this._pendingRead.next();
  }

  cycle() {
    if (this._halted) return;
    
    if (this._pendingRead) {
      this._pendingRead.next();
      this._pendingRead = null;
    }

    if (!this._job) {
      const opcode = this._consumeValue();

      switch (opcode) {
        case 0x00:
          this._job = this._lda();
          break;
        case 0x01:
          this._job = this._sta();
          break;
        case 0x02:
          this._job = this._print();
          break;
        case 0x03:
          this._halted = true;
          break;
        default:
          console.error(`Cannot run instruction with opcode "${opcode?.toString(16)}"`);
      }
    } else {
      const iteration = this._job.next();
      if (iteration.done) {
        this._job = null;
        this._pendingRead = this._getFromMemory(this._pc++);
        this._pendingRead.next();
      }
    }
  }

  private* _sta() {
    yield* this._getFromMemory(this._pc++);
    const hi = this._consumeValue();

    yield* this._getFromMemory(this._pc++);
    const lo = this._consumeValue();
    
    const address = hi << 8 | lo;

    yield* this._writeToMemory(address, (this._a & 0xFF00) >> 8);
    yield* this._writeToMemory(address + 1, this._a & 0x00FF);
  }

  private* _lda() {
    yield* this._getFromMemory(this._pc++);
    const hi = this._consumeValue();

    yield* this._getFromMemory(this._pc++);
    const lo = this._consumeValue();

    const address = hi << 8 | lo;

    yield* this._getFromMemory(address);
    const valueHi = this._consumeValue();

    yield* this._getFromMemory(address + 1);
    const valueLo = this._consumeValue();

    this._a = valueHi << 8 | valueLo;
  }

  private* _print() {
    console.log(`Value in A: "${this._a?.toString(16)}"`);
  }

  private* _getFromMemory(address: number): Generator<undefined, void, unknown> {
    this._bus.mode = "read";
    this._bus.address = address;
    yield;

    this._valueRead = this._bus.value;
  }

  private* _writeToMemory(address: number, value: number): Generator<undefined, void, unknown> {
    this._bus.mode = "write";
    this._bus.address = address;
    this._bus.value = value;
    yield;
  }

  private _consumeValue() {
    const value = this._valueRead;
    this._valueRead = null;
    return value;
  }

  describe() {
    return {
      a: this._a
    };
  }
}

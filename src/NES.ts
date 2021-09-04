import Bus from "./Bus";
import Memory from "./Memory";
import CPU from "./CPU6502";

export default class NES {
  private _dataBus: Bus;
  private _ram: Memory;
  private _cpu: CPU;

  constructor() {
    this._dataBus = new Bus();
    this._ram = new Memory(this._dataBus, 2 * 1024);
    this._cpu = new CPU(this._dataBus);
  }

  cycle() {
    this._ram.cycle();
    this._cpu.cycle();
  }
}

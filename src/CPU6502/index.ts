import IBus from "../protocols/IBus";
import IDevice from "../protocols/IDevice";

interface IInstruction {
  name: string;
  job: () => Generator<void, void, unknown>;
  addressingMode: () => Generator<void, number, unknown>;
}

export default class CPU6502 implements IDevice {
  private _bus: IBus;

  private _job?: Generator;
  private _valueRead?: number = null;

  private _pendingRead?: Generator = null;
  private _addressingMode?: () => Generator<void, number, unknown>;

  private _halted = false;
  private _currentInstructionCycle = 0;
  private _extraStalls = 0;

  private _a: number = 0;
  private _x: number = 0;
  private _y: number = 0;
  private _status: number = 0;
  private _pc: number = 0;

  private _instructionLookup: { [key: number]: IInstruction } = null;

  constructor(bus: IBus) {
    this._bus = bus;
    this._pendingRead = this._getFromMemory(this._pc++);
    this._pendingRead.next();

    this._instructionLookup = {
      0x00: { name: "BRK", job: this._brk, addressingMode: this._impliedAddressing },
      0x01: { name: "ORA", job: this._ora, addressingMode: this._indexedIndirectXAddressing },
      0x05: { name: "ORA", job: this._ora, addressingMode: this._zeroPageAddressing },
      0x06: { name: "ASL", job: this._asl, addressingMode: this._zeroPageAddressing },
      0x08: { name: "PHP", job: this._php, addressingMode: this._impliedAddressing },
      0x09: { name: "ORA", job: this._ora, addressingMode: this._immediateAddressing },
      0x0A: { name: "ASL", job: this._asl, addressingMode: this._accumulatorAddressing },
      0x0D: { name: "ORA", job: this._ora, addressingMode: this._absoluteAddressing },
      0x0E: { name: "ASL", job: this._asl, addressingMode: this._absoluteAddressing },
      0x10: { name: "BPL", job: this._bpl, addressingMode: this._relativeAddressing },
      0x11: { name: "ORA", job: this._ora, addressingMode: this._indexedIndirectYAddressing },
      0x15: { name: "ORA", job: this._ora, addressingMode: this._indexedZeroPageXAddressing },
      0x16: { name: "ASL", job: this._asl, addressingMode: this._indexedZeroPageXAddressing },
      0x18: { name: "CLC", job: this._clc, addressingMode: this._impliedAddressing },
      0x19: { name: "ORA", job: this._ora, addressingMode: this._indexedAbsoluteYAddressing },
      0x1D: { name: "ORA", job: this._ora, addressingMode: this._indexedAbsoluteXAddressing },
      0x1E: { name: "ASL", job: this._asl, addressingMode: this._indexedAbsoluteXAddressing },
      0x20: { name: "JSR", job: this._jsr, addressingMode: this._absoluteAddressing },
      0x21: { name: "AND", job: this._and, addressingMode: this._indexedIndirectXAddressing },
      0x24: { name: "BIT", job: this._bit, addressingMode: this._indexedZeroPageXAddressing },
      0x25: { name: "AND", job: this._and, addressingMode: this._zeroPageAddressing },
      0x26: { name: "ROL", job: this._rol, addressingMode: this._zeroPageAddressing },
      0x28: { name: "PLP", job: this._plp, addressingMode: this._impliedAddressing },
      0x29: { name: "AND", job: this._and, addressingMode: this._immediateAddressing },
      0x2A: { name: "ROL", job: this._rol, addressingMode: this._accumulatorAddressing },
      0x2C: { name: "BIT", job: this._bit, addressingMode: this._absoluteAddressing },
      0x2D: { name: "AND", job: this._and, addressingMode: this._absoluteAddressing },
      0x2E: { name: "ROL", job: this._rol, addressingMode: this._absoluteAddressing },
      0x30: { name: "BMI", job: this._bmi, addressingMode: this._relativeAddressing },
      0x31: { name: "AND", job: this._and, addressingMode: this._indexedIndirectYAddressing },
      0x35: { name: "AND", job: this._and, addressingMode: this._indexedZeroPageXAddressing },
      0x36: { name: "ROL", job: this._rol, addressingMode: this._indexedZeroPageXAddressing },
      0x38: { name: "SEC", job: this._sec, addressingMode: this._impliedAddressing },
      0x39: { name: "AND", job: this._and, addressingMode: this._indexedAbsoluteYAddressing },
      0x3D: { name: "AND", job: this._and, addressingMode: this._indexedAbsoluteXAddressing },
      0x3E: { name: "ROL", job: this._rol, addressingMode: this._indexedAbsoluteXAddressing },
      0x40: { name: "RTI", job: this._rti, addressingMode: this._impliedAddressing },
      0x41: { name: "EOR", job: this._eor, addressingMode: this._indexedIndirectXAddressing },
      0x45: { name: "EOR", job: this._eor, addressingMode: this._zeroPageAddressing },
      0x46: { name: "LSR", job: this._lsr, addressingMode: this._zeroPageAddressing },
      0x48: { name: "PHA", job: this._pha, addressingMode: this._impliedAddressing },
      0x49: { name: "EOR", job: this._eor, addressingMode: this._immediateAddressing },
      0x4A: { name: "LSR", job: this._lsr, addressingMode: this._accumulatorAddressing },
      0x4C: { name: "JMP", job: this._jmp, addressingMode: this._absoluteAddressing },
      0x4D: { name: "EOR", job: this._eor, addressingMode: this._absoluteAddressing },
      0x4E: { name: "LSR", job: this._lsr, addressingMode: this._absoluteAddressing },
      0x50: { name: "BVC", job: this._bvc, addressingMode: this._relativeAddressing },
      0x51: { name: "EOR", job: this._eor, addressingMode: this._indexedIndirectYAddressing },
      0x55: { name: "EOR", job: this._eor, addressingMode: this._indexedZeroPageXAddressing },
      0x56: { name: "LSR", job: this._lsr, addressingMode: this._indexedZeroPageXAddressing },
      0x58: { name: "CLI", job: this._cli, addressingMode: this._impliedAddressing },
      0x59: { name: "EOR", job: this._eor, addressingMode: this._indexedAbsoluteYAddressing },
      0x5D: { name: "EOR", job: this._eor, addressingMode: this._indexedAbsoluteXAddressing },
      0x5E: { name: "LSR", job: this._lsr, addressingMode: this._indexedAbsoluteXAddressing },
      0x60: { name: "RTS", job: this._rts, addressingMode: this._impliedAddressing },
      0x61: { name: "ADC", job: this._adc, addressingMode: this._indexedIndirectXAddressing },
      0x65: { name: "ADC", job: this._adc, addressingMode: this._zeroPageAddressing },
      0x66: { name: "ROR", job: this._ror, addressingMode: this._zeroPageAddressing },
      0x68: { name: "PLA", job: this._pla, addressingMode: this._impliedAddressing },
      0x69: { name: "ADC", job: this._adc, addressingMode: this._immediateAddressing },
      0x6A: { name: "ROR", job: this._ror, addressingMode: this._accumulatorAddressing },
      0x6C: { name: "JMP", job: this._jmp, addressingMode: this._absoluteIndirectAddressing },
      0x6D: { name: "ADC", job: this._adc, addressingMode: this._absoluteAddressing },
      0x6E: { name: "ROR", job: this._ror, addressingMode: this._absoluteAddressing },
      0x70: { name: "BVS", job: this._bvs, addressingMode: this._relativeAddressing },
      0x71: { name: "ADC", job: this._adc, addressingMode: this._indexedIndirectYAddressing },
      0x75: { name: "ADC", job: this._adc, addressingMode: this._indexedZeroPageXAddressing },
      0x76: { name: "ROR", job: this._ror, addressingMode: this._indexedZeroPageXAddressing },
      0x78: { name: "SEI", job: this._sei, addressingMode: this._impliedAddressing },
      0x79: { name: "ADC", job: this._adc, addressingMode: this._indexedAbsoluteYAddressing },
      0x7D: { name: "ADC", job: this._adc, addressingMode: this._indexedAbsoluteXAddressing },
      0x7E: { name: "ROR", job: this._ror, addressingMode: this._indexedAbsoluteXAddressing },
      0x81: { name: "STA", job: this._sta, addressingMode: this._indexedIndirectXAddressing },
      0x84: { name: "STY", job: this._sty, addressingMode: this._zeroPageAddressing },
      0x85: { name: "STA", job: this._sta, addressingMode: this._zeroPageAddressing },
      0x86: { name: "STX", job: this._stx, addressingMode: this._zeroPageAddressing },
      0x88: { name: "DEY", job: this._dey, addressingMode: this._impliedAddressing },
      0x8A: { name: "TXA", job: this._txa, addressingMode: this._impliedAddressing },
      0x8C: { name: "STY", job: this._sty, addressingMode: this._absoluteAddressing },
      0x8D: { name: "STA", job: this._sta, addressingMode: this._absoluteAddressing },
      0x8E: { name: "STX", job: this._stx, addressingMode: this._absoluteAddressing },
      0x90: { name: "BCC", job: this._bcc, addressingMode: this._relativeAddressing },
      0x91: { name: "STA", job: this._sta, addressingMode: this._indexedIndirectYAddressing },
      0x94: { name: "STY", job: this._sty, addressingMode: this._indexedZeroPageXAddressing },
      0x95: { name: "STA", job: this._sta, addressingMode: this._indexedZeroPageXAddressing },
      0x96: { name: "STX", job: this._stx, addressingMode: this._indexedZeroPageXAddressing },
      0x98: { name: "TYA", job: this._tya, addressingMode: this._impliedAddressing },
      0x99: { name: "STA", job: this._sta, addressingMode: this._indexedAbsoluteYAddressing },
      0x9A: { name: "TXS", job: this._txs, addressingMode: this._impliedAddressing },
      0x9D: { name: "STA", job: this._sta, addressingMode: this._indexedAbsoluteXAddressing },
      0xA0: { name: "LDY", job: this._ldy, addressingMode: this._immediateAddressing },
      0xA1: { name: "LDA", job: this._lda, addressingMode: this._indexedIndirectXAddressing },
      0xA2: { name: "LDX", job: this._ldx, addressingMode: this._immediateAddressing },
      0xA4: { name: "LDY", job: this._ldy, addressingMode: this._zeroPageAddressing },
      0xA5: { name: "LDA", job: this._lda, addressingMode: this._zeroPageAddressing },
      0xA6: { name: "LDX", job: this._ldx, addressingMode: this._zeroPageAddressing },
      0xA8: { name: "TAY", job: this._tay, addressingMode: this._impliedAddressing },
      0xA9: { name: "LDA", job: this._lda, addressingMode: this._immediateAddressing },
      0xAA: { name: "TAX", job: this._tax, addressingMode: this._impliedAddressing },
      0xAC: { name: "LDY", job: this._ldy, addressingMode: this._absoluteAddressing },
      0xAD: { name: "LDA", job: this._lda, addressingMode: this._absoluteAddressing },
      0xAE: { name: "LDX", job: this._ldx, addressingMode: this._absoluteAddressing },
      0xB0: { name: "BCS", job: this._bcs, addressingMode: this._relativeAddressing },
      0xB1: { name: "LDA", job: this._lda, addressingMode: this._indexedIndirectYAddressing },
      0xB4: { name: "LDY", job: this._ldy, addressingMode: this._indexedZeroPageXAddressing },
      0xB5: { name: "LDA", job: this._lda, addressingMode: this._indexedZeroPageXAddressing },
      0xB6: { name: "LDX", job: this._ldx, addressingMode: this._indexedZeroPageYAddressing },
      0xB8: { name: "CLV", job: this._clv, addressingMode: this._impliedAddressing },
      0xB9: { name: "LDA", job: this._lda, addressingMode: this._indexedAbsoluteYAddressing },
      0xBA: { name: "TSX", job: this._tsx, addressingMode: this._impliedAddressing },
      0xBC: { name: "LDY", job: this._ldy, addressingMode: this._indexedAbsoluteXAddressing },
      0xBD: { name: "LDA", job: this._lda, addressingMode: this._indexedAbsoluteXAddressing },
      0xBE: { name: "LDY", job: this._ldy, addressingMode: this._indexedAbsoluteXAddressing },
      0xC0: { name: "CPY", job: this._cpy, addressingMode: this._immediateAddressing },
      0xC1: { name: "CMP", job: this._cmp, addressingMode: this._indexedIndirectXAddressing },
      0xC4: { name: "CPY", job: this._cpy, addressingMode: this._zeroPageAddressing },
      0xC5: { name: "CMP", job: this._cmp, addressingMode: this._zeroPageAddressing },
      0xC6: { name: "DEC", job: this._dec, addressingMode: this._zeroPageAddressing },
      0xC8: { name: "INY", job: this._iny, addressingMode: this._impliedAddressing },
      0xC9: { name: "CMP", job: this._cmp, addressingMode: this._immediateAddressing },
      0xCA: { name: "DEX", job: this._dex, addressingMode: this._impliedAddressing },
      0xCC: { name: "CPY", job: this._cpy, addressingMode: this._absoluteAddressing },
      0xCD: { name: "CMP", job: this._cmp, addressingMode: this._absoluteAddressing },
      0xCE: { name: "DEC", job: this._dec, addressingMode: this._absoluteAddressing },
      0xD0: { name: "BNE", job: this._bne, addressingMode: this._relativeAddressing },
      0xD1: { name: "CMP", job: this._cmp, addressingMode: this._indexedIndirectYAddressing },
      0xD5: { name: "CMP", job: this._cmp, addressingMode: this._indexedZeroPageXAddressing },
      0xD6: { name: "DEC", job: this._dec, addressingMode: this._indexedZeroPageXAddressing },
      0xD8: { name: "CLD", job: this._cld, addressingMode: this._impliedAddressing },
      0xD9: { name: "CMP", job: this._cmp, addressingMode: this._indexedAbsoluteYAddressing },
      0xDD: { name: "CMP", job: this._cmp, addressingMode: this._indexedAbsoluteXAddressing },
      0xDE: { name: "DEC", job: this._dec, addressingMode: this._indexedAbsoluteXAddressing },
      0xE0: { name: "CPX", job: this._cpx, addressingMode: this._immediateAddressing },
      0xE1: { name: "SBC", job: this._sbc, addressingMode: this._indexedIndirectXAddressing },
      0xE4: { name: "CPX", job: this._cpx, addressingMode: this._zeroPageAddressing },
      0xE5: { name: "SBC", job: this._sbc, addressingMode: this._zeroPageAddressing },
      0xE6: { name: "INC", job: this._inc, addressingMode: this._zeroPageAddressing },
      0xE8: { name: "INX", job: this._inx, addressingMode: this._impliedAddressing },
      0xE9: { name: "SBC", job: this._sbc, addressingMode: this._immediateAddressing },
      0xEA: { name: "NOP", job: this._nop, addressingMode: this._impliedAddressing },
      0xEC: { name: "CPX", job: this._cpx, addressingMode: this._absoluteAddressing },
      0xED: { name: "SBC", job: this._sbc, addressingMode: this._absoluteAddressing },
      0xEE: { name: "INC", job: this._inc, addressingMode: this._absoluteAddressing },
      0xF0: { name: "BEQ", job: this._beq, addressingMode: this._relativeAddressing },
      0xF1: { name: "SBC", job: this._sbc, addressingMode: this._indexedIndirectYAddressing },
      0xF5: { name: "SBC", job: this._sbc, addressingMode: this._indexedZeroPageXAddressing },
      0xF6: { name: "INC", job: this._inc, addressingMode: this._indexedZeroPageXAddressing },
      0xF8: { name: "SED", job: this._sed, addressingMode: this._impliedAddressing },
      0xF9: { name: "SBC", job: this._sbc, addressingMode: this._indexedAbsoluteYAddressing },
      0xFD: { name: "SBC", job: this._sbc, addressingMode: this._indexedAbsoluteXAddressing },
      0xFE: { name: "INC", job: this._inc, addressingMode: this._indexedAbsoluteXAddressing }
    };

    this.reset();
  }

  cycle() {
    if (this._halted) return;
    
    if (this._pendingRead) {
      this._pendingRead.next();
      this._pendingRead = null;
    }

    if (!this._job) {
      const opcode = this._consumeValue();
      const instruction = this._instructionLookup[opcode];

      if (!instruction) {
        console.warn(`Illegal instruction 0x${opcode.toString(16)}! Ignoring`);
        this._getNextInstruction();
      } else {
        this._addressingMode = instruction.addressingMode.bind(this);
        this._job = instruction.job.apply(this);
        this.cycle(); // to start current instruction and don't lose a cycle over opcode fetching
      }
    } else {
      this._currentInstructionCycle++;
      const iteration = this._job.next();

      if (iteration.done) {
        this._getNextInstruction();
      }
    }
  }

  private _getNextInstruction() {
    this._currentInstructionCycle = 0;
    this._job = null;
    this._pendingRead = this._getFromMemory(this._pc++);
    this._pendingRead.next();
  }

  reset() {
    this._job = this._reset();
  }

  private* _reset() {
    const pcAddress = 0xFFFC;

    const lo = yield* this._read(pcAddress);
    const hi = yield* this._read(pcAddress + 1);

    this._pc = hi << 8 | lo;

    this._a = 0;
    this._x = 0;
    this._y = 0;

    yield* this._stall(8);
  }

  private* _indexedIndirectXAddressing() {
    const byte = yield* this._read(this._pc++);
    const baseAddress = this._x + byte;
    
    const lo = yield* this._read(baseAddress & 0xFF);
    const hi = yield* this._read((baseAddress + 1) & 0xFF);
    
    const address = hi << 8 | lo;
    return address;
  }
  
  private* _zeroPageAddressing() {
    const byte = yield* this._read(this._pc++);
    return byte & 0xFF;
  }
  
  private* _impliedAddressing() {
    return this._a;
  }

  private* _immediateAddressing() {
    return this._pc++;
  }

  private* _accumulatorAddressing() {
    return this._a;
  }

  private* _absoluteAddressing() {
    const lo = yield* this._read(this._pc++);
    const hi = yield* this._read(this._pc++);

    const address = hi << 8 | lo;
    return address;
  }

  private* _relativeAddressing() {
    let operand = yield* this._read(this._pc++);

    if (operand > 127) {
      const delta = 128 - operand;
      operand = -128 + delta;
    }

    return this._pc + operand;
  }

  private* _indexedIndirectYAddressing() {
    const zeroPageAddress = yield* this._read(this._pc++);
    
    const lo = yield* this._read(zeroPageAddress);
    const hi = yield* this._read((zeroPageAddress + 1) & 0xFF);

    const address = (hi << 8 | lo) + this._y;

    if ((address & 0xFF00) !== (hi << 8)) {
      this._extraStalls += 1;
    }

    return address;
  }

  private* _indexedZeroPageXAddressing() {
    const byte = yield* this._read(this._pc++);
    const address = (byte + this._x) & 0xFF;
    return address; 
  }

  private* _indexedZeroPageYAddressing() {
    const byte = yield* this._read(this._pc++);
    const address = (byte + this._y) & 0xFF;
    return address;
  }

  private* _indexedAbsoluteYAddressing() {
    const lo = yield* this._read(this._pc++);
    const hi = yield* this._read(this._pc++);

    const address = (hi << 8 | lo) + this._y;

    if ((address & 0xFF00) !== (hi << 8)) {
      this._extraStalls += 1;
    }

    return address;
  }

  private* _indexedAbsoluteXAddressing() {
    const lo = yield* this._read(this._pc++);
    const hi = yield* this._read(this._pc++);

    const address = (hi << 8 | lo) + this._x;

    if ((address & 0xFF00) !== (hi << 8)) {
      this._extraStalls += 1;
    }

    return address;
  }

  // this addressing mode has a bug in the actual hardware
  // and the bug is implemented here also to achieve the 
  // behavior
  private* _absoluteIndirectAddressing() {
    const pointerLo = yield* this._read(this._pc++);
    const pointerHi = yield* this._read(this._pc++);

    const pointer = pointerHi << 8 | pointerLo;

    if (pointerLo === 0xFF) { // the bug
      const hi = yield* this._read(pointer & 0xFF00);
      const lo = yield* this._read(pointer);

      const address = hi << 8 | lo;
      return address;
    } else {
      const hi = yield* this._read(pointer + 1);
      const lo = yield* this._read(pointer);

      const address = hi << 8 | lo;
      return address;
    }
  }
  
  private* _brk() {
    this._halted = true;
  }
  
  private* _ora() {
    // TODO
  }
  
  private* _asl() {
    // TODO
  }

  private* _php() {
    // TODO
  }

  private* _bpl() {
    // TODO
  }

  private* _clc() {
    // TODO
  }

  private* _jsr() {
    // TODO
  }

  private* _bit() {
    // TODO
  }

  private* _and() {
    // TODO
  }

  private* _rol() {
    // TODO
  }

  private* _plp() {
    // TODO
  }

  private* _bmi() {
    // TODO
  }

  private* _sec() {
    // TODO
  }

  private* _rti() {
    // TODO
  }

  private* _eor() {
    // TODO
  }

  private* _lsr() {
    // TODO
  }

  private* _pha() {
    // TODO
  }

  private* _jmp() {
    // TODO
  }

  private* _bvc() {
    // TODO
  }

  private* _cli() {
    // TODO
  }

  private* _rts() {
    // TODO
  }

  private* _adc() {
    // TODO
  }

  private* _ror() {
    // TODO
  }

  private* _pla() {
    // TODO
  }

  private* _bvs() {
    // TODO
  }

  private* _sei() {
    // TODO
  }

  private* _sta() {
    const address = yield* this._addressingMode();
    yield* this._write(address, this._a);
    yield* this._stall(4);
  }

  private* _sty() {
    // TODO
  }

  private* _stx() {
    // TODO
  }

  private* _dey() {
    // TODO
  }

  private* _txa() {
    // TODO
  }

  private* _bcc() {
    // TODO
  }

  private* _tya() {
    // TODO
  }

  private* _txs() {
    // TODO
  }

  private* _ldy() {
    // TODO
  }

  private* _lda() {
    const address = yield* this._addressingMode();
    const value = yield* this._read(address);
    
    this._a = value;

    this._setNegativeFlag((value & 0x80) === 0x80);
    this._setZeroFlag(value === 0);

    yield* this._stall(4);
  }

  private* _ldx() {
    // TODO
  }

  private* _tay() {
    // TODO
  }

  private* _tax() {
    // TODO
  }

  private* _bcs() {
    // TODO
  }

  private* _clv() {
    // TODO
  }

  private* _tsx() {
    // TODO
  }

  private* _cpy() {
    // TODO
  }

  private* _cmp() {
    // TODO
  }

  private* _dec() {
    // TODO
  }

  private* _iny() {
    // TODO
  }

  private* _dex() {
    // TODO
  }

  private* _bne() {
    // TODO
  }

  private* _cld() {
    // TODO
  }

  private* _cpx() {
    // TODO
  }

  private* _sbc() {
    // TODO
  }

  private* _inc() {
    const address = yield* this._addressingMode();
    const value = yield* this._read(address);
    const newValue = (value + 1) & 0xFF;

    this._setNegativeFlag((newValue & 0x80) === 0x80);
    this._setZeroFlag(newValue === 0);

    yield* this._write(address, newValue);
    yield* this._stall(6);
  }

  private* _inx() {
    // TODO
  }

  private* _nop() {
    yield* this._stall(2);
  }

  private* _beq() {
    // TODO
  }

  private* _sed() {
    // TODO
  }

  private* _read(address: number) {
    yield* this._getFromMemory(address);
    return this._consumeValue();
  }

  private* _write(address: number, value: number) {
    yield* this._writeToMemory(address, value);
  }

  private* _stall(stallCycles: number): Generator<void, void, unknown> {
    const cycles = stallCycles - this._currentInstructionCycle;
    const totalCycles = cycles + this._extraStalls;
    this._extraStalls = 0;

    if (totalCycles < 0) {
      console.warn(`Instruction took ${-totalCycles} more cycles than it should!`);
      return;
    }

    for (let i = 0; i < totalCycles; i++) yield;
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

  private _setNegativeFlag(value: boolean) {
    this._setStatusFlag(value, 7);
  }

  private _setZeroFlag(value: boolean) {
    this._setStatusFlag(value, 1);
  }

  private _setStatusFlag(value: boolean, flag: number) {
    if (value) {
      this._status = this._setBit(this._status, flag);
    } else {
      this._status = this._clearBit(this._status, flag);
    }
  }

  private _setBit(value: number, bit: number) {
    return value | (1 << bit);
  }

  private _clearBit(value: number, bit: number) {
    return value & (~(1 << bit));
  }

  get pc() {
    return this._pc;
  }

  set pc(value) {
    this._pc = value & 0xFFFF;
  }

  get x() {
    return this._x;
  }

  set x(value) {
    this._x = value & 0xFF;
  }

  get y() {
    return this._y;
  }

  set y(value) {
    this._y = value & 0xFF;
  }

  get a() {
    return this._a;
  }

  set a(value) {
    this._a = value & 0xFF;
  }
}

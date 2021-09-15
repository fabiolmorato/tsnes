import NES from "./NES";

const nes = new NES();

// program start
nes["_ram"]["_memory"][0xFFFC] = 0x00;
nes["_ram"]["_memory"][0xFFFD] = 0x00;

// program
nes["_ram"]["_memory"][0] = 0xAD;
nes["_ram"]["_memory"][1] = 0xFF;
nes["_ram"]["_memory"][2] = 0x00;
nes["_ram"]["_memory"][3] = 0x8D;
nes["_ram"]["_memory"][4] = 0x00;
nes["_ram"]["_memory"][5] = 0x01;
nes["_ram"]["_memory"][6] = 0xEE;
nes["_ram"]["_memory"][7] = 0x00;
nes["_ram"]["_memory"][8] = 0x01;
nes["_ram"]["_memory"][9] = 0xAD;
nes["_ram"]["_memory"][10] = 0x00;
nes["_ram"]["_memory"][11] = 0x01;
nes["_ram"]["_memory"][12] = 0x00;

/*
Program is
LDA $00FF
STA $0100
INC $0100
LDA $0100
BRK
*/

// data
nes["_ram"]["_memory"][0xFF] = 0xAB;

for (let i = 0; i < 26; i++) nes.cycle();
const a = nes["_cpu"]["_a"];
console.log(`A: 0x${a.toString(16).toUpperCase()} (expected 0xAC)`);

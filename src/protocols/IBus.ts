export default interface IBus {
  mode: "read" | "write";
  value: number;
  address: number;
}

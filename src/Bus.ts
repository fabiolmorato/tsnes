import IBus from "./protocols/IBus";

export default class Bus implements IBus {
  mode: "read" | "write" = "read";
  value: number = 0;
  address: number = 0;
}

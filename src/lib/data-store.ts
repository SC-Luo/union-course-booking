import fs from "node:fs";
import path from "node:path";
import type { BookingData } from "./types";

const dataFilePath = path.join(process.cwd(), "data", "booking-data.json");

export function readBookingData(): BookingData {
  const raw = fs.readFileSync(dataFilePath, "utf8");
  return JSON.parse(raw) as BookingData;
}

export function writeBookingData(data: BookingData) {
  fs.writeFileSync(dataFilePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

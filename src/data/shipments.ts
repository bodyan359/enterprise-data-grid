export const statuses = [
  "In transit",
  "Delivered",
  "Pending",
  "Exception",
] as const;
export type ShipmentStatus = (typeof statuses)[number];
export type Shipment = {
  id: string;
  customer: string;
  destination: string;
  carrier: string;
  status: ShipmentStatus;
  updatedAt: string;
  units: number;
};
export type SortField = keyof Shipment;
export type ShipmentRequest = {
  search: string;
  status: ShipmentStatus | "All statuses";
  carrier: string;
  sorting: { id: SortField; desc: boolean }[];
  pageIndex: number;
  pageSize: number;
};
export type ShipmentPage = { rows: Shipment[]; total: number };

const customers = [
  "Northstar Supply",
  "Peak & Pine",
  "Juniper Works",
  "Harbor House",
  "Forma Studio",
  "Pollen Goods",
  "Common Ground",
  "Atlas Outfitters",
  "Lumen Home",
  "Cove Market",
  "Paper Trail",
  "Fieldwork Co.",
];
const routes = [
  "Rotterdam, NL",
  "Hamburg, DE",
  "Warsaw, PL",
  "Lyon, FR",
  "Prague, CZ",
  "Vienna, AT",
  "Copenhagen, DK",
  "Gothenburg, SE",
  "Brussels, BE",
  "Milan, IT",
  "Oslo, NO",
  "Berlin, DE",
];
export const carriers = [
  "Northline",
  "Parcel One",
  "EuroFreight",
  "Waypoint",
] as const;

// Stable synthetic fixture; neither a real customer list nor a live service.
export const shipments: Shipment[] = Array.from({ length: 128 }, (_, i) => ({
  id: `RL-${42816 - i}`,
  customer: customers[i % customers.length]!,
  destination: routes[(i * 5 + Math.floor(i / 12)) % routes.length]!,
  carrier: carriers[(i + Math.floor(i / 7)) % carriers.length]!,
  status:
    i % 11 === 6
      ? "Exception"
      : i % 5 === 3
        ? "Pending"
        : i % 3 === 1
          ? "Delivered"
          : "In transit",
  updatedAt: new Date(
    Date.UTC(2026, 5, 18, 14, 35) - i * 37 * 60_000,
  ).toISOString(),
  units: 2 + ((i * 17) % 95),
}));

export function selectShipments(
  source: readonly Shipment[],
  request: ShipmentRequest,
): ShipmentPage {
  const search = request.search.trim().toLowerCase();
  const filtered = source.filter(
    (row) =>
      (request.status === "All statuses" || row.status === request.status) &&
      (request.carrier === "All carriers" || row.carrier === request.carrier) &&
      (!search ||
        [row.id, row.customer, row.destination, row.carrier].some((value) =>
          value.toLowerCase().includes(search),
        )),
  );

  const sorted = [...filtered].sort((a, b) => {
    for (const { id, desc } of request.sorting) {
      const left = a[id];
      const right = b[id];
      const result =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "en");
      if (result !== 0) return desc ? -result : result;
    }
    return a.id.localeCompare(b.id, "en");
  });
  const start = request.pageIndex * request.pageSize;
  return {
    rows: sorted.slice(start, start + request.pageSize),
    total: filtered.length,
  };
}

// Transport boundary: replace this adapter with fetch() and the table stays unchanged.
export async function fetchShipments(
  request: ShipmentRequest,
  signal: AbortSignal,
  fail = false,
): Promise<ShipmentPage> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 450);
    signal.addEventListener("abort", abort, { once: true });
  });
  if (fail) throw new Error("Shipment feed unavailable");
  return selectShipments(shipments, request);
}

export function toCsv(rows: readonly Shipment[]): string {
  const fields: SortField[] = [
    "id",
    "customer",
    "destination",
    "carrier",
    "status",
    "updatedAt",
    "units",
  ];
  const escape = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  return [
    fields.join(","),
    ...rows.map((row) => fields.map((field) => escape(row[field])).join(",")),
  ].join("\r\n");
}

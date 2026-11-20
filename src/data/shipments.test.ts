import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fetchShipments,
  selectShipments,
  shipments,
  toCsv,
  type Shipment,
  type ShipmentRequest,
} from "./shipments.ts";

const makeRequest = (
  overrides: Partial<ShipmentRequest> = {},
): ShipmentRequest => ({
  search: "",
  status: "All statuses",
  carrier: "All carriers",
  sorting: [],
  pageIndex: 0,
  pageSize: 10,
  ...overrides,
});
const makeShipment = (overrides: Partial<Shipment> = {}): Shipment => ({
  id: "RL-1",
  customer: "Northstar Supply",
  destination: "Warsaw, PL",
  carrier: "Northline",
  status: "Delivered",
  updatedAt: "2026-06-18T12:00:00Z",
  units: 4,
  ...overrides,
});

describe("shipment page contract", () => {
  it("applies all filters before calculating totals and slicing pages", () => {
    const request = makeRequest({
      search: " NORTHLINE ",
      status: "Delivered",
      carrier: "Northline",
      pageSize: 2,
    });
    const actual = selectShipments(shipments, request);
    assert.equal(
      actual.total,
      shipments.filter(
        (s) => s.status === "Delivered" && s.carrier === "Northline",
      ).length,
    );
    assert.ok(actual.rows.length <= request.pageSize);
    assert.ok(
      actual.rows.every(
        (s) => s.status === "Delivered" && s.carrier === "Northline",
      ),
    );
  });
  it("sorts numerically before paging without modifying the source", () => {
    const source = [
      makeShipment({ id: "b", units: 8 }),
      makeShipment({ id: "a", units: 21 }),
      makeShipment({ id: "c", units: 2 }),
    ];
    const result = selectShipments(
      source,
      makeRequest({ sorting: [{ id: "units", desc: true }], pageSize: 2 }),
    );
    assert.deepEqual(
      result.rows.map((row) => row.units),
      [21, 8],
    );
    assert.deepEqual(
      source.map((row) => row.units),
      [8, 21, 2],
    );
  });
  it("returns disjoint adjacent pages and an unchanged total", () => {
    const first = selectShipments(shipments, makeRequest());
    const next = selectShipments(shipments, makeRequest({ pageIndex: 1 }));
    assert.equal(first.total, next.total);
    assert.ok(
      first.rows.every(
        (row) => !next.rows.some((other) => other.id === row.id),
      ),
    );
  });
  it("returns an empty page for no matches and an empty source", () => {
    assert.deepEqual(
      selectShipments(shipments, makeRequest({ search: "unmatched!" })),
      { rows: [], total: 0 },
    );
    assert.deepEqual(selectShipments([], makeRequest()), {
      rows: [],
      total: 0,
    });
  });
  it("breaks equal sort values deterministically across pages", () => {
    const source = [makeShipment({ id: "b" }), makeShipment({ id: "a" })];
    const request = makeRequest({
      sorting: [{ id: "status", desc: false }],
      pageSize: 1,
    });
    assert.equal(selectShipments(source, request).rows[0]?.id, "a");
    assert.equal(
      selectShipments(source, { ...request, pageIndex: 1 }).rows[0]?.id,
      "b",
    );
  });
});

describe("transport boundary and export", () => {
  it("rejects a cancelled request", async () => {
    const controller = new AbortController();
    const request = fetchShipments(makeRequest(), controller.signal);
    controller.abort();
    await assert.rejects(request, { name: "AbortError" });
  });
  it("rejects simulated errors and returns a page after recovery", async () => {
    await assert.rejects(
      fetchShipments(makeRequest(), new AbortController().signal, true),
      { name: "Error" },
    );
    const result = await fetchShipments(
      makeRequest(),
      new AbortController().signal,
    );
    assert.ok(result.total > 0);
    assert.ok(result.rows.length <= 10);
  });
  it("preserves quoted commas and record boundaries in CSV", () => {
    const rows = [makeShipment({ customer: 'A, "B"' })];
    const lines = toCsv(rows).split("\r\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.split(",").length, 7);
    assert.ok(lines[1]?.includes('"A, ""B"""'));
  });
});

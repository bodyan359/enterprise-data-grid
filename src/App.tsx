import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Globe2,
  Package,
  Radio,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react";
import {
  carriers,
  fetchShipments,
  shipments,
  statuses,
  toCsv,
  type Shipment,
  type ShipmentStatus,
  type SortField,
} from "./data/shipments";

const formatDate = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const statusClass: Record<ShipmentStatus, string> = {
  "In transit": "transit",
  Delivered: "delivered",
  Pending: "pending",
  Exception: "exception",
};
const columns: ColumnDef<Shipment>[] = [
  {
    accessorKey: "id",
    header: "Shipment",
    cell: ({ row }) => (
      <span className="shipment-id">
        <Package size={15} />
        {row.original.id}
      </span>
    ),
  },
  {
    accessorKey: "customer",
    header: "Customer",
    cell: ({ getValue }) => (
      <strong className="customer">{getValue<string>()}</strong>
    ),
  },
  { accessorKey: "destination", header: "Destination" },
  { accessorKey: "carrier", header: "Carrier" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue<ShipmentStatus>();
      return (
        <span className={`status ${statusClass[status]}`}>
          <span />
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: "Last update (UTC)",
    cell: ({ getValue }) => (
      <time dateTime={getValue<string>()}>
        {formatDate.format(new Date(getValue<string>()))}
      </time>
    ),
  },
  {
    accessorKey: "units",
    header: "Units",
    cell: ({ getValue }) => <span className="units">{getValue<number>()}</span>,
  },
];
const emptyRows: Shipment[] = [];
const overview = [
  {
    label: "Total shipments",
    value: shipments.length,
    icon: Box,
    color: "neutral",
    detail: "All active records",
  },
  {
    label: "In transit",
    value: shipments.filter((s) => s.status === "In transit").length,
    icon: Truck,
    color: "transit",
    detail: "En route to destination",
  },
  {
    label: "Delivered",
    value: shipments.filter((s) => s.status === "Delivered").length,
    icon: Check,
    color: "delivered",
    detail: "Successfully completed",
  },
  {
    label: "Exceptions",
    value: shipments.filter((s) => s.status === "Exception").length,
    icon: AlertTriangle,
    color: "exception",
    detail: "Require attention",
  },
];

function downloadPage(rows: Shipment[]) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  a.href = url;
  a.download = "relay-shipments.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ShipmentStatus | "All statuses">(
    "All statuses",
  );
  const [carrier, setCarrier] = useState("All carriers");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [failure, setFailure] = useState(false);
  const request = {
    search,
    status,
    carrier,
    sorting: sorting.map((s) => ({ id: s.id as SortField, desc: s.desc })),
    ...pagination,
  };
  const query = useQuery({
    queryKey: ["shipments", request, failure],
    queryFn: ({ signal }) => fetchShipments(request, signal, failure),
  });
  const total = query.data?.total ?? 0;
  const table = useReactTable({
    data: query.data?.rows ?? emptyRows,
    columns,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    rowCount: total,
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));
  const clearFilters = () => {
    setSearch("");
    setStatus("All statuses");
    setCarrier("All carriers");
    resetPage();
  };
  const filtered =
    search.trim() || status !== "All statuses" || carrier !== "All carriers";
  const pageCount = table.getPageCount();
  const first = total ? pagination.pageIndex * pagination.pageSize + 1 : 0;
  const last = Math.min(
    total,
    (pagination.pageIndex + 1) * pagination.pageSize,
  );
  return (
    <>
      <header className="masthead">
        <div className="head-inner">
          <div className="brand">
            <div className="brand-mark">
              <span />
              <span />
              <span />
            </div>
            <span>
              relay<span className="brand-dot">.</span>
            </span>
          </div>
          <div className="head-context">
            <span className="head-rule" /> Operations <ChevronRight size={14} />{" "}
            Shipments
          </div>
          <div className="head-right">
            <Globe2 size={16} />
            <span>Europe network</span>
            <span className="avatar">OP</span>
          </div>
        </div>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <div>
            <div className="crumb">
              <span className="signal-dot" /> Shipment control center
            </div>
            <h1>Shipments</h1>
            <p>Track every consignment across your delivery network.</p>
          </div>
          <div className="heading-side">
            <span className="feed-label">
              <Radio size={15} /> Synthetic data feed
            </span>
            <button
              className="button secondary"
              onClick={() => {
                if (failure) setFailure(false);
                else void query.refetch();
              }}
              disabled={query.isFetching}
            >
              <RefreshCw size={16} className={query.isFetching ? "spin" : ""} />{" "}
              Refresh
            </button>
          </div>
        </div>
        <section className="overview" aria-label="Network overview">
          {overview.map((item) => (
            <div className="metric" key={item.label}>
              <div className="metric-top">
                <span>{item.label}</span>
                <span className={`metric-icon ${item.color}`}>
                  <item.icon size={18} />
                </span>
              </div>
              <div className="metric-value">{item.value}</div>
              <small>{item.detail}</small>
            </div>
          ))}
        </section>
        <section className="grid" aria-label="Shipment records">
          <div className="grid-head">
            <div>
              <h2>All shipments</h2>
              <p>View and filter shipment records</p>
            </div>
            <button
              className="button primary"
              disabled={!query.data?.rows.length || query.isFetching}
              onClick={() => downloadPage(query.data?.rows ?? [])}
            >
              <Download size={16} /> Export page
            </button>
          </div>
          <div className="filters">
            <label className="search">
              <Search size={17} />
              <input
                type="search"
                aria-label="Search shipments"
                placeholder="Search ID, customer, destination..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
              />
            </label>
            <div className="select-wrap">
              <Filter size={15} />
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as typeof status);
                  resetPage();
                }}
              >
                <option>All statuses</option>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
            <div className="select-wrap">
              <Truck size={15} />
              <select
                aria-label="Filter by carrier"
                value={carrier}
                onChange={(e) => {
                  setCarrier(e.target.value);
                  resetPage();
                }}
              >
                <option>All carriers</option>
                {carriers.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
            {filtered && (
              <button className="text-button" onClick={clearFilters}>
                <X size={14} /> Clear filters
              </button>
            )}
            <div className="results" role="status">
              {query.isFetching
                ? "Updating…"
                : query.isError
                  ? "Feed unavailable"
                  : `${total} shipments`}
            </div>
          </div>
          <div className="table-scroll" aria-busy={query.isFetching}>
            <table>
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const sorted = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            sorted === "asc"
                              ? "ascending"
                              : sorted === "desc"
                                ? "descending"
                                : "none"
                          }
                        >
                          <button
                            className={`column-sort ${sorted ? "sorted" : ""}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {sorted === "asc" ? (
                              <ArrowUp size={13} />
                            ) : sorted === "desc" ? (
                              <ArrowDown size={13} />
                            ) : (
                              <ArrowDownUp size={12} />
                            )}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {query.isPending ? (
                  Array.from({ length: pagination.pageSize }, (_, i) => (
                    <tr key={i} className="skeleton-row" aria-hidden="true">
                      {columns.map((_, j) => (
                        <td key={j}>
                          <span className="skeleton" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : query.isError ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <div className="table-state" role="alert">
                        <div className="state-icon warning">
                          <AlertTriangle size={24} />
                        </div>
                        <h3>Could not load shipments</h3>
                        <p>
                          The simulated shipment feed is unavailable. Reconnect
                          to restore the data.
                        </p>
                        <button
                          className="button primary"
                          onClick={() => {
                            if (failure) setFailure(false);
                            else void query.refetch();
                          }}
                        >
                          <RefreshCw size={16} /> Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <div className="table-state">
                        <div className="state-icon">
                          <Search size={24} />
                        </div>
                        <h3>No matching shipments</h3>
                        <p>
                          Try a different search or clear the filters to see
                          more results.
                        </p>
                        <button
                          className="button secondary"
                          onClick={clearFilters}
                        >
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="grid-footer">
            <span role="status">
              {query.isPending
                ? "Loading shipments…"
                : query.isError
                  ? "No results available"
                  : `Showing ${first}–${last} of ${total}`}
            </span>
            <div className="pagination">
              <label>
                Rows per page{" "}
                <select
                  value={pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                >
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                </select>
              </label>
              <button
                className="icon-button"
                aria-label="Previous page"
                disabled={!table.getCanPreviousPage() || query.isFetching}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="page-number">
                Page {pageCount ? pagination.pageIndex + 1 : 0} of {pageCount}
              </span>
              <button
                className="icon-button"
                aria-label="Next page"
                disabled={!table.getCanNextPage() || query.isFetching}
                onClick={() => table.nextPage()}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
        <footer className="workspace-footer">
          <span>
            <Activity size={15} /> Demo environment · 128 fictional shipments
          </span>
          <button
            className="text-button"
            aria-pressed={failure}
            onClick={() => setFailure((f) => !f)}
          >
            {failure ? "Restore data feed" : "Simulate feed failure"}
          </button>
        </footer>
      </main>
    </>
  );
}

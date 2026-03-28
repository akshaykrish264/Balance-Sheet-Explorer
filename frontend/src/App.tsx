import { useState, useEffect } from "react";
import { FrappeProvider, useFrappeGetDocList, useFrappeGetDoc } from "frappe-react-sdk";
import {
  Alert, Autocomplete, Box, Chip, CircularProgress, Container,
  CssBaseline, Divider, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, ThemeProvider,
  Typography, createTheme, useMediaQuery, alpha,
} from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import PieChartIcon from "@mui/icons-material/PieChart";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ReceiptIcon from "@mui/icons-material/Receipt";
 
// ─── Theme ────────────────────────────────────────────────────────────────────
 
function buildTheme(dark: boolean) {
  return createTheme({
    palette: {
      mode: dark ? "dark" : "light",
      primary: { main: "#5C6BC0" },
      secondary: { main: "#26C6DA" },
      background: {
        default: dark ? "#0F1117" : "#F4F6FB",
        paper: dark ? "#1A1D2E" : "#FFFFFF",
      },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: "'Inter', 'Roboto', sans-serif",
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          outlined: { borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: { fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" },
        },
      },
    },
  });
}
 
// ─── Types ────────────────────────────────────────────────────────────────────
 
interface GLEntry { account: string; debit: number; credit: number; root_type?: string; }
interface AccountLine { account: string; net: number; }
 
const ALL_BUCKETS = ["Asset", "Liability", "Equity", "Income", "Expense"] as const;
type Bucket = typeof ALL_BUCKETS[number];
 
const BUCKET_CONFIG: Record<Bucket, {
  color: string; light: string; icon: React.ReactNode; muiColor: "primary" | "warning" | "success" | "info" | "error";
}> = {
  Asset:     { color: "#5C6BC0", light: "#EEF0FB", icon: <AccountBalanceWalletIcon fontSize="small" />, muiColor: "primary" },
  Liability: { color: "#FF7043", light: "#FFF0EC", icon: <CreditCardIcon fontSize="small" />,           muiColor: "error" },
  Equity:    { color: "#26A69A", light: "#E8F5F4", icon: <PieChartIcon fontSize="small" />,             muiColor: "success" },
  Income:    { color: "#66BB6A", light: "#EDF7EE", icon: <AttachMoneyIcon fontSize="small" />,          muiColor: "success" },
  Expense:   { color: "#FFA726", light: "#FFF8EC", icon: <ReceiptIcon fontSize="small" />,              muiColor: "warning" },
};
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
 
const fmt = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
 
function computeImpact(glEntries: GLEntry[]) {
  const buckets: Record<Bucket, Record<string, number>> = {
    Asset: {}, Liability: {}, Equity: {}, Income: {}, Expense: {},
  };
  const unclassified: string[] = [];
 
  for (const e of glEntries) {
    const rt = e.root_type as Bucket;
    if (!ALL_BUCKETS.includes(rt)) { unclassified.push(e.account); continue; }
    // Asset & Expense: debit positive; Liability, Equity, Income: credit positive
    const net = (rt === "Asset" || rt === "Expense")
      ? e.debit - e.credit
      : e.credit - e.debit;
    buckets[rt][e.account] = (buckets[rt][e.account] ?? 0) + net;
  }
 
  const totals = { Asset: 0, Liability: 0, Equity: 0, Income: 0, Expense: 0 } as Record<Bucket, number>;
  const lines = {} as Record<Bucket, AccountLine[]>;
  for (const b of ALL_BUCKETS) {
    lines[b] = Object.entries(buckets[b]).map(([account, net]) => ({ account, net }));
    totals[b] = lines[b].reduce((s, r) => s + r.net, 0);
  }
 
  const bsTotal = totals.Asset - (totals.Liability + totals.Equity);
  return { lines, totals, equation_holds: Math.abs(bsTotal) < 0.01, unclassified };
}
 
// ─── Summary Tile ─────────────────────────────────────────────────────────────
 
function SummaryTile({ bucket, total, dark }: { bucket: Bucket; total: number; dark: boolean }) {
  const cfg = BUCKET_CONFIG[bucket];
  const isPos = total >= 0;
  return (
    <Paper
      variant="outlined"
      sx={{
        flex: "1 1 140px",
        p: 2,
        borderRadius: 3,
        borderColor: alpha(cfg.color, 0.25),
        background: dark ? alpha(cfg.color, 0.12) : cfg.light,
        transition: "transform 0.15s",
        "&:hover": { transform: "translateY(-2px)" },
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Box sx={{ color: cfg.color, display: "flex", alignItems: "center" }}>{cfg.icon}</Box>
        {total !== 0 && (
          isPos
            ? <TrendingUpIcon sx={{ fontSize: 16, color: "success.main" }} />
            : <TrendingDownIcon sx={{ fontSize: 16, color: "error.main" }} />
        )}
      </Box>
      <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 600, letterSpacing: "0.04em" }}>
        {bucket.toUpperCase()}
      </Typography>
      <Typography variant="h6" sx={{ color: isPos ? "success.main" : "error.main", mt: 0.25 }}>
        {fmt(total)}
      </Typography>
    </Paper>
  );
}
 
// ─── Account Table ────────────────────────────────────────────────────────────
 
function BucketTable({ bucket, lines, dark }: { bucket: Bucket; lines: AccountLine[]; dark: boolean }) {
  if (!lines.length) return null;
  const cfg = BUCKET_CONFIG[bucket];
  return (
    <Box mb={2.5}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Box sx={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: 2,
          background: dark ? alpha(cfg.color, 0.2) : cfg.light,
          color: cfg.color,
        }}>
          {cfg.icon}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: cfg.color }}>
          {bucket}
        </Typography>
        <Chip
          label={lines.length}
          size="small"
          sx={{
            height: 18, fontSize: "0.7rem",
            background: dark ? alpha(cfg.color, 0.2) : cfg.light,
            color: cfg.color, fontWeight: 700,
          }}
        />
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={{
        borderRadius: 2,
        borderColor: alpha(cfg.color, 0.2),
        overflow: "hidden",
      }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ background: dark ? alpha(cfg.color, 0.1) : alpha(cfg.color, 0.06) }}>
              <TableCell sx={{ color: cfg.color }}>Account</TableCell>
              <TableCell align="right" sx={{ color: cfg.color }}>Net movement</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((row, i) => (
              <TableRow
                key={row.account}
                hover
                sx={{ background: i % 2 === 0 ? "transparent" : dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }}
              >
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12, color: "text.secondary" }}>
                  {row.account}
                </TableCell>
                <TableCell align="right">
                  <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                    {row.net >= 0
                      ? <TrendingUpIcon sx={{ fontSize: 14, color: "success.main" }} />
                      : <TrendingDownIcon sx={{ fontSize: 14, color: "error.main" }} />}
                    <Typography variant="body2" fontWeight={600}
                      sx={{ color: row.net >= 0 ? "success.main" : "error.main" }}>
                      {fmt(row.net)}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
 
// ─── ImpactCard ───────────────────────────────────────────────────────────────
 
function ImpactCard({
  lines, totals, equation_holds, unclassified, dark,
}: ReturnType<typeof computeImpact> & { dark: boolean }) {
 
  const activeBuckets = ALL_BUCKETS.filter((b) => lines[b].length > 0);
 
  return (
    <Box>
      {/* Equation status */}
      <Alert
        icon={equation_holds
          ? <CheckCircleOutlineIcon fontSize="small" />
          : <ErrorOutlineIcon fontSize="small" />}
        severity={equation_holds ? "success" : "error"}
        sx={{ mb: 2.5, borderRadius: 2, fontWeight: 500 }}
      >
        {equation_holds
          ? "Accounting equation holds — Assets = Liabilities + Equity"
          : "Accounting equation does NOT balance — check your entries"}
      </Alert>
 
      {/* Summary tiles */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 3 }}>
        {ALL_BUCKETS.map((b) => (
          <SummaryTile key={b} bucket={b} total={totals[b]} dark={dark} />
        ))}
      </Box>
 
      <Divider sx={{ mb: 2.5 }} />
 
      {/* Per-bucket tables */}
      {activeBuckets.length === 0
        ? <Typography color="text.secondary" textAlign="center" py={2}>No account movements found.</Typography>
        : activeBuckets.map((b) => (
            <BucketTable key={b} bucket={b} lines={lines[b]} dark={dark} />
          ))
      }
 
      {unclassified.length > 0 && (
        <Alert severity="warning" sx={{ mt: 1, borderRadius: 2 }}>
          Unclassified accounts (no root type): {unclassified.join(", ")}
        </Alert>
      )}
    </Box>
  );
}
 
// ─── Impact Loader ────────────────────────────────────────────────────────────
 
function ImpactLoader({ journalEntry, dark }: { journalEntry: string; dark: boolean }) {
  const { data: jeDoc, isLoading: jeLoading } = useFrappeGetDoc("Journal Entry", journalEntry);
 
  const { data: glData, isLoading: glLoading } = useFrappeGetDocList("GL Entry", {
    fields: ["account", "debit", "credit"],
    filters: [["voucher_no", "=", journalEntry], ["is_cancelled", "=", 0]],
    limit: 500,
  });
 
  const accounts = [...new Set((glData ?? []).map((g: GLEntry) => g.account))];
 
  const { data: accountData, isLoading: accountLoading } = useFrappeGetDocList("Account", {
    fields: ["name", "root_type"],
    filters: accounts.length ? [["name", "in", accounts]] : [["name", "=", ""]],
    limit: accounts.length || 1,
  });
 
  if (jeLoading || glLoading || accountLoading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={6}>
        <CircularProgress size={36} thickness={4} />
        <Typography variant="body2" color="text.secondary">Loading GL entries…</Typography>
      </Box>
    );
  }
 
  if (!glData?.length) {
    return (
      <Alert severity="warning" sx={{ borderRadius: 2 }}>
        No GL Entries found for {journalEntry}.
      </Alert>
    );
  }
 
  const rootTypeMap = Object.fromEntries(
    (accountData ?? []).map((a: { name: string; root_type: string }) => [a.name, a.root_type])
  );
 
  const glEntries: GLEntry[] = glData.map((g: GLEntry) => ({
    ...g, root_type: rootTypeMap[g.account] ?? "",
  }));
 
  const impact = computeImpact(glEntries);
 
  return (
    <Box>
      {jeDoc && (
        <Box display="flex" alignItems="center" gap={1} mb={2.5} px={0.5}>
          <Box sx={{
            width: 4, height: 36, borderRadius: 2,
            background: "linear-gradient(180deg, #5C6BC0, #26C6DA)",
          }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{journalEntry}</Typography>
            <Typography variant="caption" color="text.secondary">
              {jeDoc.posting_date}{jeDoc.title ? ` — ${jeDoc.title}` : ""}
            </Typography>
          </Box>
        </Box>
      )}
      <ImpactCard {...impact} dark={dark} />
    </Box>
  );
}
 
// ─── Explorer ─────────────────────────────────────────────────────────────────
 
function BalanceSheetExplorer() {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = buildTheme(prefersDark);
 
  const initialJE = new URLSearchParams(window.location.search).get("je");
  const [selected, setSelected] = useState<string | null>(initialJE);
 
  const { data: jeList } = useFrappeGetDocList("Journal Entry", {
    fields: ["name", "title", "posting_date"],
    filters: [["docstatus", "=", 1]],
    orderBy: { field: "posting_date", order: "desc" },
    limit: 200,
  });
 
  const options = jeList?.map((je: { name: string; title?: string; posting_date: string }) => ({
    label: `${je.name}${je.title ? " — " + je.title : ""} (${je.posting_date})`,
    value: je.name,
  })) ?? [];
 
  useEffect(() => {
    const url = new URL(window.location.href);
    selected ? url.searchParams.set("je", selected) : url.searchParams.delete("je");
    window.history.replaceState(null, "", url.toString());
  }, [selected]);
 
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", background: theme.palette.background.default, py: 4 }}>
        <Container maxWidth="md">
 
          {/* Header */}
          <Box display="block" alignItems="center" textAlign="center"  gap={2} mb={4}>
            {/* <Box sx={{
              width: 48, height: 48, borderRadius: 3,
              background: "linear-gradient(135deg, #5C6BC0, #26C6DA)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AccountBalanceIcon sx={{ color: "#fff", fontSize: 26 }} />
            </Box> */}
            {/* <Box> */}
              <Typography variant="h5">Balance Sheet Explorer</Typography>
              <Typography variant="body2" color="text.secondary">
                Analyse how Journal Entries move Assets, Liabilities, Equity, Income &amp; Expense
              </Typography>
            {/* </Box> */}
          </Box>
 
          {/* Picker card */}
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}
              sx={{ letterSpacing: "0.06em", textTransform: "uppercase", display: "block", mb: 1 }}>
              Select Journal Entry
            </Typography>
            <Autocomplete
              options={options}
              getOptionLabel={(o) => o.label}
              value={options.find((o) => o.value === selected) ?? null}
              onChange={(_, val) => setSelected(val?.value ?? null)}
              isOptionEqualToValue={(a, b) => a.value === b.value}
              size="small"
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search by name, title, or date…"
                  variant="outlined"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <AccountBalanceIcon sx={{ fontSize: 18, color: "text.disabled", mr: 0.5 }} />
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Paper>
 
          {/* Results */}
          {!selected ? (
            <Paper variant="outlined" sx={{
              p: 6, borderRadius: 3, textAlign: "center",
              borderStyle: "dashed",
            }}>
              <AccountBalanceIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography variant="body1" color="text.secondary" fontWeight={500}>
                Select a Journal Entry above to view its balance sheet impact
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Only submitted entries are shown
              </Typography>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
              <ImpactLoader journalEntry={selected} dark={prefersDark} />
            </Paper>
          )}
 
        </Container>
      </Box>
    </ThemeProvider>
  );
}
 
// ─── Root ─────────────────────────────────────────────────────────────────────
 
export default function App() {
  return (
    <FrappeProvider>
      <BalanceSheetExplorer />
    </FrappeProvider>
  );
}


/* import { useState } from "react";
import { FrappeProvider, useFrappeGetDocList } from "frappe-react-sdk";
import {
  Container,
  Typography,
  Select,
  MenuItem,
  Paper,
  Grid,
  CircularProgress,
  Box,
} from "@mui/material";

// Type for impact
type ImpactResponse = {
  Assets: number;
  Liabilities: number;
  Equity: number;
  equation_holds: boolean;
};

function BalanceSheetExplorer() {
  // Fetch Journal Entries
  const { data, isLoading, error } = useFrappeGetDocList("Journal Entry", {
    fields: ["name"],
    limit: 20,
  });

  const [selected, setSelected] = useState<string>("");

  // Fetch impact as "custom field" in the Journal Entry DocType
  // For example: create a "Balance Sheet Impact" child table or virtual fields
  const { data: impactData, isLoading: impactLoading } = useFrappeGetDocList(
    "Journal Entry",
    selected
      ? {
          fields: ["name", "balance_sheet_impact_assets", "balance_sheet_impact_liabilities", "balance_sheet_impact_equity", "balance_sheet_equation_holds"],
          filters: { name: selected },
        }
      : null
  );

  const handleSelect = (name: string) => {
    setSelected(name);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={10}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Typography color="error">Error loading Journal Entries</Typography>;

  // Only one impact record since we filtered by selected
  const impact: ImpactResponse | undefined = impactData?.[0]
    ? {
        Assets: impactData[0].balance_sheet_impact_assets || 0,
        Liabilities: impactData[0].balance_sheet_impact_liabilities || 0,
        Equity: impactData[0].balance_sheet_impact_equity || 0,
        equation_holds: impactData[0].balance_sheet_equation_holds || false,
      }
    : undefined;

  return (
    <Container maxWidth="md" sx={{ mt: 5 }}>
      <Typography variant="h4" gutterBottom>
        Balance Sheet Explorer
      </Typography>

      <Select
        fullWidth
        value={selected}
        onChange={(e) => handleSelect(e.target.value as string)}
        displayEmpty
      >
        <MenuItem value="" disabled>
          Select Journal Entry
        </MenuItem>
        {data?.map((je) => (
          <MenuItem key={je.name} value={je.name}>
            {je.name}
          </MenuItem>
        ))}
      </Select>

      {impactLoading && (
        <Box mt={3}>
          <CircularProgress />
        </Box>
      )}

      {impact && (
        <Paper sx={{ mt: 4, p: 3 }}>
          <Grid container spacing={2}>
            {(["Assets", "Liabilities", "Equity"] as const).map((key) => (
              <Grid item xs={12} sm={4} key={key}>
                <Typography variant="h6">{key}</Typography>
                <Typography>{impact[key]}</Typography>
              </Grid>
            ))}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                Accounting Equation Holds: {impact.equation_holds ? "✅ Yes" : "❌ No"}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Container>
  );
}

export default function App() {
  return (
    <FrappeProvider url="http://localhost:8080" socketPort={null}>
      <BalanceSheetExplorer />
    </FrappeProvider>
  );
} */

/* import { useState, useEffect } from "react";
import { FrappeProvider, useFrappeGetDocList, useFrappeGetDoc } from "frappe-react-sdk";
import {
  Alert, Autocomplete, Box, Chip, CircularProgress, Container,
  CssBaseline, Divider, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, ThemeProvider,
  Typography, createTheme, useMediaQuery,
} from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GLEntry {
  account: string;
  debit: number;
  credit: number;
  root_type?: string;
}

interface AccountLine { account: string; net: number; }

const BUCKETS = ["Asset", "Liability", "Equity"] as const;
type Bucket = typeof BUCKETS[number];

const BUCKET_COLORS: Record<Bucket, "primary" | "warning" | "success"> = {
  Asset: "primary", Liability: "warning", Equity: "success",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

function computeImpact(glEntries: GLEntry[]) {
  const buckets: Record<Bucket, Record<string, number>> = { Asset: {}, Liability: {}, Equity: {} };
  const unclassified: string[] = [];

  for (const e of glEntries) {
    const rt = e.root_type as Bucket;
    if (!BUCKETS.includes(rt)) { unclassified.push(e.account); continue; }
    const net = rt === "Asset" ? e.debit - e.credit : e.credit - e.debit;
    buckets[rt][e.account] = (buckets[rt][e.account] ?? 0) + net;
  }

  const totals = { Asset: 0, Liability: 0, Equity: 0 } as Record<Bucket, number>;
  const lines = {} as Record<Bucket, AccountLine[]>;
  for (const b of BUCKETS) {
    lines[b] = Object.entries(buckets[b]).map(([account, net]) => ({ account, net }));
    totals[b] = lines[b].reduce((s, r) => s + r.net, 0);
  }

  return {
    lines, totals,
    equation_holds: Math.abs(totals.Asset - (totals.Liability + totals.Equity)) < 0.01,
    unclassified,
  };
}

// ─── ImpactCard ───────────────────────────────────────────────────────────────

function ImpactCard({ lines, totals, equation_holds, unclassified }: ReturnType<typeof computeImpact>) {
  return (
    <Box>
      <Alert
        icon={equation_holds
          ? <CheckCircleOutlineIcon fontSize="small" />
          : <ErrorOutlineIcon fontSize="small" />}
        severity={equation_holds ? "success" : "error"}
        sx={{ mb: 2 }}
      >
        {equation_holds
          ? "Accounting equation holds: Assets = Liabilities + Equity"
          : "Accounting equation does NOT balance — check your entries"}
      </Alert>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        {BUCKETS.map((b) => (
          <Paper key={b} variant="outlined" sx={{ px: 2, py: 1, minWidth: 130, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">{b}</Typography>
            <Typography variant="h6" fontWeight={600}
              color={totals[b] >= 0 ? "success.main" : "error.main"}>
              {fmt(totals[b])}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {BUCKETS.map((bucket) => {
        if (!lines[bucket].length) return null;
        return (
          <Box key={bucket} mb={2}>
            <Chip label={bucket} color={BUCKET_COLORS[bucket]} size="small"
              variant="outlined" sx={{ mb: 0.75 }} />
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell align="right">Net movement</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines[bucket].map((row) => (
                    <TableRow key={row.account} hover>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                        {row.account}
                      </TableCell>
                      <TableCell align="right"
                        sx={{ color: row.net >= 0 ? "success.main" : "error.main", fontWeight: 500 }}>
                        {fmt(row.net)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      })}

      {unclassified.length > 0 && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Unclassified accounts: {unclassified.join(", ")}
        </Alert>
      )}
    </Box>
  );
}

// ─── Impact loader — fetches GL + account details then computes ───────────────

function ImpactLoader({ journalEntry }: { journalEntry: string }) {
  // useFrappeGetDoc — full JE doc for header info (posting_date, title)
  const { data: jeDoc, isLoading: jeLoading } = useFrappeGetDoc(
    "Journal Entry", journalEntry
  );

  // useFrappeGetDocList — GL Entries for this voucher
  const { data: glData, isLoading: glLoading } = useFrappeGetDocList("GL Entry", {
    fields: ["account", "debit", "credit"],
    filters: [["voucher_no", "=", journalEntry], ["is_cancelled", "=", 0]],
    limit: 500,
  });

  const accounts = [...new Set((glData ?? []).map((g: GLEntry) => g.account))];

  // useFrappeGetDocList — root_type for each unique account
  const { data: accountData, isLoading: accountLoading } = useFrappeGetDocList("Account", {
    fields: ["name", "root_type"],
    filters: accounts.length ? [["name", "in", accounts]] : [["name", "=", ""]],
    limit: accounts.length || 1,
  });

  const isLoading = jeLoading || glLoading || accountLoading;

  if (isLoading) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }

  if (!glData?.length) {
    return <Alert severity="warning">No GL Entries found for {journalEntry}.</Alert>;
  }

  const rootTypeMap = Object.fromEntries(
    (accountData ?? []).map((a: { name: string; root_type: string }) => [a.name, a.root_type])
  );

  const glEntries: GLEntry[] = glData.map((g: GLEntry) => ({
    ...g,
    root_type: rootTypeMap[g.account] ?? "",
  }));

  const impact = computeImpact(glEntries);

  return (
    <Box>
      {jeDoc && (
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          {journalEntry} — {jeDoc.posting_date}{jeDoc.title ? ` — ${jeDoc.title}` : ""}
        </Typography>
      )}
      <ImpactCard {...impact} />
    </Box>
  );
}

// ─── Explorer ─────────────────────────────────────────────────────────────────

function BalanceSheetExplorer() {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = createTheme({ palette: { mode: prefersDark ? "dark" : "light" } });

  const initialJE = new URLSearchParams(window.location.search).get("je");
  const [selected, setSelected] = useState<string | null>(initialJE);

  // useFrappeGetDocList — submitted Journal Entries for picker
  const { data: jeList } = useFrappeGetDocList("Journal Entry", {
    fields: ["name", "title", "posting_date"],
    filters: [["docstatus", "=", 1]],
    orderBy: { field: "posting_date", order: "desc" },
    limit: 200,
  });

  const options = jeList?.map((je: { name: string; title?: string; posting_date: string }) => ({
    label: `${je.name}${je.title ? " — " + je.title : ""} (${je.posting_date})`,
    value: je.name,
  })) ?? [];

  useEffect(() => {
    const url = new URL(window.location.href);
    selected ? url.searchParams.set("je", selected) : url.searchParams.delete("je");
    window.history.replaceState(null, "", url.toString());
  }, [selected]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" alignItems="center" gap={1.5} mb={3}>
          <AccountBalanceIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={600}>Balance Sheet Explorer</Typography>
            <Typography variant="body2" color="text.secondary">
              See how any submitted Journal Entry moves Assets, Liabilities, and Equity
            </Typography>
          </Box>
        </Box>

        <Autocomplete
          options={options}
          getOptionLabel={(o) => o.label}
          value={options.find((o) => o.value === selected) ?? null}
          onChange={(_, val) => setSelected(val?.value ?? null)}
          isOptionEqualToValue={(a, b) => a.value === b.value}
          renderInput={(params) => (
            <TextField {...params} label="Select Journal Entry"
              placeholder="Search by name, title, or date…" variant="outlined" />
          )}
          sx={{ mb: 3 }}
        />

        {!selected
          ? <Typography color="text.secondary" textAlign="center" mt={6}>
              Pick a Journal Entry above to explore its balance sheet impact.
            </Typography>
          : <ImpactLoader journalEntry={selected} />
        }
      </Container>
    </ThemeProvider>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <FrappeProvider>
      <BalanceSheetExplorer />
    </FrappeProvider>
  );
} */
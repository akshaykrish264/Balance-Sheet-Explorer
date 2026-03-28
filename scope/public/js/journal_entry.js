/**
 * bs_impact/public/js/journal_entry.js
 *
 * Adds "Show Balance Sheet Impact" button to submitted Journal Entries.
 * Calls the whitelisted Python method and renders a styled Frappe dialog.
 */
 
frappe.ui.form.on("Journal Entry", {
    refresh(frm) {
        if (frm.doc.docstatus !== 1) return;
 
        frm.add_custom_button(
            __("Show Balance Sheet Impact"),
            () => show_bs_impact_dialog(frm),
            __("Accounting")          // groups it under an "Accounting" menu
        );
    },
});
 
// ─── Helpers ────────────────────────────────────────────────────────────────
 
function fmt_currency(val, symbol = "") {
    if (val === null || val === undefined) return "—";
    const abs = Math.abs(val).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const sign = val < 0 ? "-" : val > 0 ? "+" : "";
    return `${sign}${symbol ? symbol + "\u00a0" : ""}${abs}`;
}
 
function movement_badge(val) {
    if (val === null || val === undefined) return `<span class="bs-badge bs-neutral">P&L</span>`;
    if (val > 0) return `<span class="bs-badge bs-positive">${fmt_currency(val)}</span>`;
    if (val < 0) return `<span class="bs-badge bs-negative">${fmt_currency(val)}</span>`;
    return `<span class="bs-badge bs-neutral">${fmt_currency(val)}</span>`;
}
 
const ROOT_ICON = {
    Asset:     "⬜",   // box = "holds value"
    Liability: "🔴",
    Equity:    "🟢",
};
 
// ─── Main dialog renderer ────────────────────────────────────────────────────
 
async function show_bs_impact_dialog(frm) {
    const currency_symbol = frappe.boot.sysdefaults.currency_symbol || "";
 
    // Show a loading dialog while we fetch
    /* const loading = new frappe.ui.Dialog({
        title: __("Fetching GL Entries…"),
        fields: [{ fieldtype: "HTML", options: `<div style="text-align:center;padding:24px">
            <div class="bs-spinner"></div>
            <p style="margin-top:12px;color:var(--text-muted)">Analysing ${frm.doc.name}…</p>
        </div>` }],
    }); */
    //loading.show();
 
    let result;
    try {
        result = await frappe.call({
            method: "scope.api.get_balance_sheet_impact",
            args: { voucher_no: frm.doc.name },
            freeze: false,
        });
    } catch (err) {
        //loading.hide();
        frappe.msgprint({ title: __("Error"), message: String(err), indicator: "red" });
        return;
    }
 
    //loading.hide();
 
    const data = result.message;
    if (!data) {
        frappe.msgprint(__("No data returned. Check the server logs."));
        return;
    }
 
    // ── Build HTML ────────────────────────────────────────────────────────
 
    const { lines, summary, equation_ok, delta_a, delta_l_e } = data;
 
    // Group lines by root_type for rendering
    const grouped = { Asset: [], Liability: [], Equity: [], Other: [] };
    for (const line of lines) {
        const key = ["Asset", "Liability", "Equity"].includes(line.root_type)
            ? line.root_type : "Other";
        grouped[key].push(line);
    }
 
    function render_section(root_type) {
        const section_lines = grouped[root_type];
        if (!section_lines || section_lines.length === 0) return "";
 
        const rows = section_lines.map(l => `
            <tr>
                <td class="bs-account">${frappe.utils.escape_html(l.account)}</td>
                <td class="bs-num">${fmt_currency(l.debit, currency_symbol)}</td>
                <td class="bs-num">${fmt_currency(l.credit, currency_symbol)}</td>
                <td class="bs-num bs-movement">${movement_badge(l.movement)}</td>
            </tr>
            ${l.note ? `<tr><td colspan="4" class="bs-note">${l.note}</td></tr>` : ""}
        `).join("");
 
        const net = summary[root_type];
        const net_label = net > 0 ? "Increase" : net < 0 ? "Decrease" : "No change";
        const net_cls   = net > 0 ? "bs-positive" : net < 0 ? "bs-negative" : "bs-neutral";
 
        return `
        <div class="bs-section">
            <div class="bs-section-header">
                <span class="bs-icon">${ROOT_ICON[root_type] || "⬜"}</span>
                <span class="bs-section-title">${root_type}</span>
                <span class="bs-section-net ${net_cls}">${net_label}: ${fmt_currency(net, currency_symbol)}</span>
            </div>
            <table class="bs-table">
                <thead>
                    <tr>
                        <th>Account</th>
                        <th class="bs-num">Debit</th>
                        <th class="bs-num">Credit</th>
                        <th class="bs-num">Net Movement</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }
 
    const other_section = grouped.Other.length ? `
        <div class="bs-section bs-section-muted">
            <div class="bs-section-header">
                <span class="bs-icon">📋</span>
                <span class="bs-section-title">Income / Expense (P&L)</span>
                <span class="bs-section-net bs-neutral">Flows through Retained Earnings</span>
            </div>
            <table class="bs-table">
                <thead><tr>
                    <th>Account</th><th class="bs-num">Debit</th>
                    <th class="bs-num">Credit</th><th class="bs-num">Root Type</th>
                </tr></thead>
                <tbody>${grouped.Other.map(l => `
                    <tr>
                        <td class="bs-account">${frappe.utils.escape_html(l.account)}</td>
                        <td class="bs-num">${fmt_currency(l.debit, currency_symbol)}</td>
                        <td class="bs-num">${fmt_currency(l.credit, currency_symbol)}</td>
                        <td class="bs-num"><em>${frappe.utils.escape_html(l.root_type)}</em></td>
                    </tr>`).join("")}
                </tbody>
            </table>
        </div>` : "";
 
    const eq_icon  = equation_ok ? "✅" : "⚠️";
    const eq_msg   = equation_ok
        ? `Accounting equation holds: ΔAssets (${fmt_currency(delta_a, currency_symbol)}) = ΔLiabilities + ΔEquity (${fmt_currency(delta_l_e, currency_symbol)})`
        : `Equation imbalance detected: ΔAssets (${fmt_currency(delta_a, currency_symbol)}) ≠ ΔL+E (${fmt_currency(delta_l_e, currency_symbol)}) — P&L accounts may bridge the gap.`;
    const eq_cls   = equation_ok ? "bs-eq-ok" : "bs-eq-warn";
 
    const html = `
<style>
.bs-dialog-wrap { font-family: var(--font-stack); color: var(--text-color); }
 
.bs-section {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    margin-bottom: 16px;
    overflow: hidden;
}
.bs-section-muted { opacity: 0.75; }
 
.bs-section-header {
    display: flex; align-items: center; gap: 8px;
    background: var(--subtle-fg);
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-color);
    font-weight: 600;
}
.bs-icon { font-size: 16px; line-height: 1; }
.bs-section-title { font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; flex: 1; }
.bs-section-net { font-size: 12px; font-weight: 700; }
 
.bs-table {
    width: 100%; border-collapse: collapse;
    font-size: 12.5px;
}
.bs-table th, .bs-table td {
    padding: 7px 14px;
    border-bottom: 1px solid var(--border-color);
    text-align: left;
}
.bs-table th { font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--text-muted);
    background: var(--subtle-accent); }
.bs-table tr:last-child td { border-bottom: none; }
.bs-table tr:hover td { background: var(--fg-hover-color); }
 
.bs-num { text-align: right !important; font-variant-numeric: tabular-nums; }
.bs-account { max-width: 260px; word-break: break-all; }
.bs-note { color: var(--text-muted); font-style: italic; font-size: 11px; padding: 2px 14px 6px; }
 
.bs-badge {
    display: inline-block;
    padding: 2px 8px; border-radius: 999px;
    font-weight: 700; font-size: 11.5px;
    letter-spacing: 0.02em;
}
.bs-positive { background: #198754; color: #ffffff; }
.bs-negative { background: #dc3545; color: #ffffff; }
.bs-neutral  { background: #fd7e14; color: #ffffff; }
 
.bs-movement { min-width: 120px; }
 
.bs-equation {
    border-radius: var(--border-radius-md);
    padding: 12px 16px; margin-top: 4px;
    font-size: 13px; font-weight: 500;
    display: flex; align-items: center; gap: 10px;
}
.bs-eq-ok   { background: #198754; color: #ffffff; }
.bs-eq-warn { background: #fd7e14; color: #ffffff; }
 
/* spinner */
@keyframes bs-spin { to { transform: rotate(360deg); } }
.bs-spinner {
    display: inline-block; width: 32px; height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: bs-spin 0.8s linear infinite;
}
</style>
 
<div class="bs-dialog-wrap">
    ${render_section("Asset")}
    ${render_section("Liability")}
    ${render_section("Equity")}
    ${other_section}
 
    <div class="bs-equation ${eq_cls}">
        <span style="font-size:18px">${eq_icon}</span>
        <span>${eq_msg}</span>
    </div>
</div>`;
 
    // ── Show dialog ───────────────────────────────────────────────────────
    const dialog = new frappe.ui.Dialog({
        title: __("Balance Sheet Impact — {0}", [frm.doc.name]),
        size: "extra-large",
        fields: [{ fieldtype: "HTML", options: html }],
        primary_action_label: __("Close"),
        primary_action() { dialog.hide(); },
    });
    dialog.show();
}
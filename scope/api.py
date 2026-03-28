import frappe
from frappe import _


@frappe.whitelist()
def get_balance_sheet_impact(voucher_no: str) -> dict:
    if not frappe.db.exists("Journal Entry", voucher_no):
        frappe.throw(_("Journal Entry {0} not found").format(voucher_no))

    je_status = frappe.db.get_value("Journal Entry", voucher_no, "docstatus")
    if je_status != 1:
        frappe.throw(_("Balance Sheet Impact is only available for submitted Journal Entries."))

    gl_entries = frappe.get_all(
        "GL Entry",
        filters={"voucher_no": voucher_no, "is_cancelled": 0},
        fields=["account", "debit", "credit", "account_currency",
                "debit_in_account_currency", "credit_in_account_currency",
                "cost_center", "party_type", "party"],
    )

    if not gl_entries:
        frappe.throw(_("No GL Entries found for {0}").format(voucher_no))

    accounts = list({e["account"] for e in gl_entries})
    root_type_map = {
        row["name"]: row["root_type"]
        for row in frappe.get_all(
            "Account",
            filters={"name": ["in", accounts]},
            fields=["name", "root_type"],
        )
    }

    BS_CATEGORIES = {"Asset", "Liability", "Equity"}
    lines = []
    summary = {"Asset": 0.0, "Liability": 0.0, "Equity": 0.0}

    for entry in gl_entries:
        root_type = root_type_map.get(entry["account"], "")
        if root_type not in BS_CATEGORIES:
            lines.append({
                "account": entry["account"],
                "root_type": root_type or "Unknown",
                "debit": entry["debit"],
                "credit": entry["credit"],
                "movement": None,
                "note": "P&L account — not a direct BS line",
            })
            continue

        if root_type == "Asset":
            movement = (entry["debit"] or 0) - (entry["credit"] or 0)
        else:
            movement = (entry["credit"] or 0) - (entry["debit"] or 0)

        summary[root_type] = round(summary[root_type] + movement, 2)

        lines.append({
            "account": entry["account"],
            "root_type": root_type,
            "debit": entry["debit"],
            "credit": entry["credit"],
            "movement": round(movement, 2),
            "note": "",
        })

    delta_a = round(summary["Asset"], 2)
    delta_l_e = round(summary["Liability"] + summary["Equity"], 2)
    equation_ok = abs(delta_a - delta_l_e) < 0.005

    return {
        "voucher_no": voucher_no,
        "lines": lines,
        "summary": summary,
        "equation_ok": equation_ok,
        "delta_a": delta_a,
        "delta_l_e": delta_l_e,
    }

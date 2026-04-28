"use client";

import { useEffect, useState } from "react";
import { getBillingSummary, getInvoices, downloadInvoicePDF } from "@/lib/api/settings";
import { useSettings } from "@/lib/hooks/useSettings";
import { showToast } from "@/components/ui/Toast";
import type { BillingSummary, Invoice } from "@/lib/api/settings";

export function BillingTab() {
  const billingState = useSettings<BillingSummary>();
  const invoicesState = useSettings<Invoice[]>();
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    loadBillingData();
  }, []);

  useEffect(() => {
    if (billingState.data) setBilling(billingState.data);
  }, [billingState.data]);

  useEffect(() => {
    if (invoicesState.data) setInvoices(invoicesState.data);
  }, [invoicesState.data]);

  const loadBillingData = async () => {
    try {
      await Promise.all([
        billingState.execute(() => getBillingSummary()),
        invoicesState.execute(() => getInvoices()),
      ]);
    } catch (error) {
      showToast("error", "Failed to load billing data");
    }
  };

  const handleDownloadInvoice = async (invoiceId: string, filename: string) => {
    try {
      const pdf = await downloadInvoicePDF(invoiceId);
      const url = window.URL.createObjectURL(pdf);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("success", "Invoice downloaded");
    } catch (error) {
      showToast("error", "Failed to download invoice");
    }
  };

  if ((billingState.isLoading || invoicesState.isLoading) && !billing && invoices.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  const usagePercentage = billing?.current_usage_percentage || 0;
  const usageColor =
    usagePercentage < 50
      ? "bg-green-500"
      : usagePercentage < 80
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="space-y-8">
      {/* Current Plan Summary */}
      {billing && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Plan</p>
                <p className="text-2xl font-bold capitalize">{billing.current_plan}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-lg font-semibold capitalize text-green-600">
                  {billing.status}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Billing Cycle</p>
                <p className="text-sm">
                  {new Date(billing.billing_cycle_start).toLocaleDateString()} -{" "}
                  {new Date(billing.billing_cycle_end).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Next Billing</p>
                <p className="text-sm">
                  {new Date(billing.next_billing_date).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Usage Bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium">Usage</p>
                <p className="text-sm font-semibold">
                  {billing.amount_used} / {billing.amount_limit}{" "}
                  <span className="text-gray-600">
                    ({usagePercentage.toFixed(0)}%)
                  </span>
                </p>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-3">
                <div
                  className={`${usageColor} h-3 rounded-full transition-all`}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Invoices */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Invoices</h2>
        {invoices.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No invoices yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Invoice ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">
                      {invoice.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(invoice.issued_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      {invoice.currency} {invoice.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          invoice.status === "paid"
                            ? "bg-green-100 text-green-800"
                            : invoice.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {invoice.status.charAt(0).toUpperCase() +
                          invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {invoice.pdf_url ? (
                        <button
                          onClick={() =>
                            handleDownloadInvoice(
                              invoice.id,
                              `invoice-${invoice.id}.pdf`
                            )
                          }
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Download
                        </button>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Payment Methods Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Payment Methods</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Add Payment Method
          </button>
        </div>
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No payment methods configured yet</p>
        </div>
      </section>
    </div>
  );
}

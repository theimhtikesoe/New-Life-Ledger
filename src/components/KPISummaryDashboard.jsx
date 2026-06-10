"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateTotalOutstandingDebt } from "@/lib/debt-utils";

/**
 * KPISummaryDashboard Component
 * 
 * Displays key business metrics:
 * - Today&apos;s Revenue (ဒီနေ့ ရရှိတဲ့ ငွေ): Sum of DEBIT transactions from today
 * - Total Outstanding Debt (စုစုပေါင်း ရရန်ရှိ အကြွေး): Sum of CREDIT transactions
 * 
 * Features:
 * - Real-time calculations from customer ledger data
 * - Responsive grid layout (1 column mobile, 2 columns medium+)
 * - Dark aesthetic with gradient backgrounds
 * - Proper number formatting with MMK currency
 * - Thematic color codes (Emerald for revenue, Rose for debt)
 */

async function fetchAllCustomersWithLedgers() {
  const response = await fetch("/api/customers");
  if (!response.ok) {
    throw new Error("Failed to fetch customers");
  }
  const data = await response.json();
  return data.data || [];
}

async function fetchCustomerLedgers(customerId) {
  const response = await fetch(`/api/customers/${customerId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ledgers for customer ${customerId}`);
  }
  const data = await response.json();
  return data.data?.ledgers || [];
}

export default function KPISummaryDashboard() {
  const [customers, setCustomers] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all customers and their ledgers on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all customers
        const customerList = await fetchAllCustomersWithLedgers();
        setCustomers(customerList);

        // Fetch ledgers for each customer
        const allLedgersData = [];
        for (const customer of customerList) {
          try {
            const ledgers = await fetchCustomerLedgers(customer.id);
            allLedgersData.push(...ledgers);
          } catch (err) {
            console.error(`Error fetching ledgers for customer ${customer.id}:`, err);
          }
        }

        setAllLedgers(allLedgersData);
      } catch (err) {
        setError(err.message);
        console.error("Error loading KPI data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate Today&apos;s Revenue (DEBIT transactions from today)
  const todaysRevenue = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allLedgers.reduce((sum, ledger) => {
      const ledgerDate = new Date(ledger.date);
      ledgerDate.setHours(0, 0, 0, 0);

      // Filter: DEBIT type AND transaction date equals today
      if (ledger.type === "DEBIT" && ledgerDate.getTime() === today.getTime()) {
        return sum + (ledger.amount || 0);
      }
      return sum;
    }, 0);
  }, [allLedgers]);

  // Calculate Total Outstanding Debt using FIFO logic
  const totalOutstandingDebt = useMemo(() => {
    // Note: allLedgers here is a flattened array of all customers' ledgers.
    // To correctly apply FIFO, we should calculate per customer.
    // However, for total debt, if we assume current_balance is always correct,
    // we could also just sum customer.current_balance.
    // Let's use the current_balance from customers for accuracy.
    return customers.reduce((sum, customer) => sum + (customer.current_balance || 0), 0);
  }, [customers]);

  // Format currency with MMK
  const formatCurrency = (amount) => {
    return `${amount.toLocaleString("en-US")} MMK`;
  };

  if (loading) {
    return (
      <section className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 mb-6">
        <div className="animate-pulse rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-xl">
          <div className="h-4 w-24 rounded bg-slate-700"></div>
          <div className="mt-4 h-8 w-32 rounded bg-slate-700"></div>
        </div>
        <div className="animate-pulse rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-xl">
          <div className="h-4 w-24 rounded bg-slate-700"></div>
          <div className="mt-4 h-8 w-32 rounded bg-slate-700"></div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 mb-6">
      {/* Today&apos;s Revenue Card */}
      <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-xl transition hover:shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">ဒီနေ့ ရရှိတဲ့ ငွေ</p>
            <p className="text-xs text-slate-500 mt-1">Today&apos;s Revenue</p>
          </div>
          <div className="rounded-lg bg-emerald-950/40 p-2">
            <svg
              className="h-5 w-5 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-emerald-400">
            {formatCurrency(todaysRevenue)}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {allLedgers.filter(
              (l) =>
                l.type === "DEBIT" &&
                new Date(l.date).toDateString() === new Date().toDateString()
            ).length}{" "}
            transactions
          </p>
        </div>
      </div>

      {/* Total Outstanding Debt Card */}
      <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-xl transition hover:shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">စုစုပေါင်း ရရန်ရှိ အကြွေး</p>
            <p className="text-xs text-slate-500 mt-1">Total Outstanding Debt</p>
          </div>
          <div className="rounded-lg bg-rose-950/40 p-2">
            <svg
              className="h-5 w-5 text-rose-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-rose-400">
            {formatCurrency(totalOutstandingDebt)}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {allLedgers.filter((l) => l.type === "CREDIT").length} outstanding
            transactions
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="col-span-full rounded-lg border border-rose-900 bg-rose-950/30 p-4">
          <p className="text-sm text-rose-200">
            Error loading KPI data: {error}
          </p>
        </div>
      )}
    </section>
  );
}

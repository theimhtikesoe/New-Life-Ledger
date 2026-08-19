"use client";

import { useState, useMemo, useEffect } from "react";
import { getOldestUnpaidCreditDate } from "@/lib/debt-utils";

/**
 * OverdueNotificationBell Component
 * ၁၅ ရက်ကျော်နေတဲ့ အကြွေးတွေကို သတိပေးတဲ့ component
 */
export default function OverdueNotificationBell({ customers = [], onSelectCustomer }) {
  const [showModal, setShowModal] = useState(false);

  // Load modal state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("overdueModalOpen");
    if (savedState === "true") {
      setShowModal(true);
    }
  }, []);

  // Persist modal state to localStorage
  useEffect(() => {
    localStorage.setItem("overdueModalOpen", showModal ? "true" : "false");
  }, [showModal]);

  // Calculate overdue debts (15+ days old)
  const overdueDebts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fifteenDaysAgo = new Date(today);
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const overdue = [];

    customers.forEach((customer) => {
      // Skip if no balance or no ledgers
      if (customer.current_balance <= 0 || !customer.ledgers || customer.ledgers.length === 0) return;

      // Use FIFO logic to find the oldest unpaid credit date
      const oldestUnpaidDate = getOldestUnpaidCreditDate(customer.ledgers);

      if (oldestUnpaidDate) {
        const creditDate = new Date(oldestUnpaidDate);
        creditDate.setHours(0, 0, 0, 0);

        if (creditDate <= fifteenDaysAgo) {
          const daysOverdue = Math.floor((today - creditDate) / (1000 * 60 * 60 * 24));
          
          overdue.push({
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            balance: customer.current_balance,
            lastCreditDate: creditDate,
            daysOverdue,
            totalDebt: customer.current_balance,
          });
        }
      }
    });

    // Sort by days overdue (descending - most overdue first)
    return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [customers]);

  const formatMoney = (value) => {
    return new Intl.NumberFormat("en-US").format(Number(value || 0));
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
    }).format(date);
  };

  if (overdueDebts.length === 0) {
    return (
      <button
        type="button"
        className="relative flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        title="No overdue debts"
      >
        <span className="text-base">🔔</span>
        <span>အကြွေး သတိပေးချက်</span>
        <span className="text-xs font-medium text-slate-400">မရှိ</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="relative flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm transition-colors hover:bg-rose-100"
        title={`${overdueDebts.length} overdue debts`}
      >
        <span className="text-base">🔔</span>
        <span>အကြွေး သတိပေးချက်</span>
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-xs font-bold text-white">
          {overdueDebts.length}
        </span>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-lg">
            {/* Header */}
            <div className="border-b border-slate-200 bg-gradient-to-r from-rose-50 to-rose-100/50 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    ⚠️ အကြွေး သတိပေးချက်
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    ၁၅ ရက်ကျော်နေတဲ့ အကြွေးများ ({overdueDebts.length} ယောက်)
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto p-6">
              <div className="space-y-3">
                {overdueDebts.map((debt, index) => (
                  <div
                    key={`${debt.customerId}-${debt.lastCreditDate}`}
                    onClick={() => {
                      if (onSelectCustomer) {
                        onSelectCustomer(debt.customerId);
                        setShowModal(false);
                      }
                    }}
                    className={`rounded-lg border border-rose-200 bg-rose-50/50 p-4 transition-colors ${
                      onSelectCustomer ? "cursor-pointer hover:bg-rose-100 hover:border-rose-300" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center min-w-6 h-6 rounded-full bg-rose-600 text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <h3 className="font-semibold text-slate-900">
                            {debt.customerName}
                          </h3>
                        </div>
                        {debt.customerPhone && (
                          <p className="mt-1 text-xs text-slate-600">
                            📞 {debt.customerPhone}
                          </p>
                        )}
                        <div className="mt-2 space-y-1 text-xs text-slate-700">
                          <p>
                            <span className="font-medium">နောက်ဆုံးအကြွေး ရက်စွဲ:</span>{" "}
                            {formatDate(debt.lastCreditDate)}
                          </p>
                          <p>
                            <span className="font-medium">ကျော်သွားတဲ့ ရက်ပေါင်း:</span>{" "}
                            <span className="text-rose-600 font-bold">
                              {debt.daysOverdue} ရက်
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-600 font-medium">
                          လက်ကျန်အကြွေး
                        </p>
                        <p className="text-lg font-bold text-rose-700">
                          {formatMoney(debt.balance)} Ks
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-300 transition-colors"
              >
                ပိတ်ရန်
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

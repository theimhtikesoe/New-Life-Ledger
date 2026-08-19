"use client";

import React, { useState, useMemo, useEffect } from "react";
function formatMyanmarDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + (6 * 60 + 30) * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

/**
 * TransactionFilter Component
 *
 * Provides robust client-side filtering for transactions with multiple predefined scopes
 * and custom date range selection. Optimized for performance with useMemo.
 */

export default function TransactionFilter({
  transactions = [],
  onFilterChange,
  extraActions,
}) {
  const [filterType, setFilterType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  /**
   * Filtering Logic wrapped in useMemo for optimal client-side performance
   */
  const filteredTransactions = useMemo(() => {
    const today = formatMyanmarDateInputValue(new Date());
    const currentMonth = today.slice(0, 7);

    return transactions.filter((t) => {
      const txDate = formatMyanmarDateInputValue(t.date);

      if (filterType === "today") {
        return txDate === today;
      }

      if (filterType === "month") {
        return txDate.slice(0, 7) === currentMonth;
      }

      if (filterType === "custom") {
        if (startDate && endDate) return txDate >= startDate && txDate <= endDate;
        if (startDate) return txDate >= startDate;
        if (endDate) return txDate <= endDate;
      }

      return true; // default 'all'
    });
  }, [transactions, filterType, startDate, endDate]);

  /**
   * Trigger parent state update whenever filtered data changes
   */
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filteredTransactions);
    }
  }, [filteredTransactions, onFilterChange]);

  /**
   * Handle reset of custom date range
   */
  const handleResetCustom = () => {
    setFilterType("all");
    setStartDate("");
    setEndDate("");
  };

  /**
   * Handle quick filter button click
   */
  const handleQuickFilter = (type) => {
    setFilterType(type);
    // Clear custom date inputs when switching to quick filters
    if (type !== "custom") {
      setStartDate("");
      setEndDate("");
    }
  };

  /**
   * Handle start date change - automatically switch to custom filter
   */
  const handleStartDateChange = (e) => {
    setFilterType("custom");
    setStartDate(e.target.value);
  };

  /**
   * Handle end date change - automatically switch to custom filter
   */
  const handleEndDateChange = (e) => {
    setFilterType("custom");
    setEndDate(e.target.value);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white border border-slate-200 rounded-xl w-full">
      {/* Quick Action Filter Tabs */}
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <button
          onClick={() => handleQuickFilter("all")}
          className={`min-h-10 w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors sm:w-auto ${
            filterType === "all"
              ? "bg-indigo-600 text-white"
              : "text-slate-700 hover:text-white hover:bg-slate-300"
          }`}
        >
          အားလုံး
        </button>
        <button
          onClick={() => handleQuickFilter("today")}
          className={`min-h-10 w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors sm:w-auto ${
            filterType === "today"
              ? "bg-indigo-600 text-white"
              : "text-slate-700 hover:text-white hover:bg-slate-300"
          }`}
        >
          ဒီနေ့
        </button>
        <button
          onClick={() => handleQuickFilter("month")}
          className={`min-h-10 w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors sm:w-auto ${
            filterType === "month"
              ? "bg-indigo-600 text-white"
              : "text-slate-700 hover:text-white hover:bg-slate-300"
          }`}
        >
          ဒီလအတွက်ပဲ
        </button>
      </div>

      {/* Custom Date Range Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="grid grid-cols-1 items-stretch gap-2 sm:flex sm:flex-wrap sm:items-center">
          <label className="text-xs text-slate-700 font-medium">
            Custom Range:
          </label>
          <input
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            className="min-h-10 w-full bg-white border border-slate-300 text-sm text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors sm:min-w-[130px] sm:w-auto"
            placeholder="Start Date"
          />
          <span className="hidden text-slate-700 text-sm font-medium sm:inline">မှ</span>
          <input
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            className="min-h-10 w-full bg-white border border-slate-300 text-sm text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors sm:min-w-[130px] sm:w-auto"
            placeholder="End Date"
          />
        </div>

        {/* Reset Button - Only show when custom filter is active */}
        {filterType === "custom" && (startDate || endDate) && (
          <button
            onClick={handleResetCustom}
            className="min-h-10 rounded-md px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 font-medium transition-colors underline underline-offset-2 sm:text-right"
          >
            Reset
          </button>
        )}
      </div>

      {/* Extra Actions (e.g., Export Button) */}
      {extraActions && <div className="flex items-center">{extraActions}</div>}
    </div>
  );
}

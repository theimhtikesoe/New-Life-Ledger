import DailySalesSummaryPanel from "@/components/DailySalesSummaryPanel";

export const metadata = {
  title: "နေ့စဉ် လက်လီ / လက်ကား ရောင်းရငွေ | New Life Ledger",
};

export default function DailySalesSummaryPage({ searchParams }) {
  const date = typeof searchParams?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
    ? searchParams.date
    : "";

  return <DailySalesSummaryPanel selectedDate={date} fullPage />;
}

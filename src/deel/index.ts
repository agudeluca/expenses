import * as fs from "fs";
import * as path from "path";
import {
  formatDate,
  groupByWeek,
  WeeklyGroup,
  NormalizedTransaction,
} from "../shared";

export { getWeekStart, getWeekEnd, formatDate, groupByWeek } from "../shared";
export type { WeeklyGroup } from "../shared";

export interface Transaction {
  originalCurrency: string;
  originalAmount: number;
  USDAmount: number;
  date: string;
  mcc: string;
  merchantName: string;
  merchantCountry: string;
  status: string;
  declineReason: string;
  authCode: string;
  type: string;
  externalTxId: string;
  externalRootTxId: string;
  apiTransaction: string;
  last4: string;
}

export type WeeklyExpense = WeeklyGroup<Transaction>;

export function parseCSV(csvContent: string): Transaction[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length <= 1) return [];

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return {
      originalCurrency: values[0] || "",
      originalAmount: parseFloat(values[1]) || 0,
      USDAmount: parseFloat(values[2]) || 0,
      date: values[3] || "",
      mcc: values[4] || "",
      merchantName: values[7] || "",
      merchantCountry: values[8] || "",
      status: values[9] || "",
      declineReason: values[10] || "",
      authCode: values[11] || "",
      type: values[12] || "",
      externalTxId: values[13] || "",
      externalRootTxId: values[14] || "",
      apiTransaction: values[15] || "",
      last4: values[16] || "",
    };
  });
}

export function toNormalized(rows: Transaction[]): NormalizedTransaction[] {
  return rows.map((t) => {
    const signedAmount =
      t.type === "REFUND" ? -t.originalAmount : t.originalAmount;
    return {
      date: t.date.slice(0, 10),
      description: t.merchantName,
      amount: signedAmount,
      currency: t.originalCurrency,
      source: "deel",
      meta: {
        mcc: t.mcc,
        merchantCountry: t.merchantCountry,
        status: t.status,
        last4: t.last4,
        type: t.type,
        USDAmount: t.USDAmount,
      },
    };
  });
}

export function displayWeeklyExpenses(weeklyExpenses: WeeklyExpense[]): void {
  console.log("\n📊 Weekly Expenses Summary (USD)\n");
  console.log("=".repeat(80));

  weeklyExpenses.forEach((week) => {
    console.log(`\n📅 Week of ${week.weekStart} to ${week.weekEnd}`);
    console.log(`💰 Total: $${week.total.toFixed(2)}`);
    console.log(`📝 Transactions: ${week.transactionCount}`);

    const topTransactions = week.transactions.sort(
      (a, b) => b.USDAmount - a.USDAmount
    );

    if (topTransactions.length > 0) {
      console.log("All transactions:");
      topTransactions.forEach((tx, index) => {
        console.log(
          `   ${index + 1}. ${tx.merchantName} - $${tx.USDAmount.toFixed(2)} (${
            tx.originalCurrency
          } ${tx.originalAmount}) - ${formatDate(new Date(tx.date))}`
        );
      });
    }

    console.log("-".repeat(40));
  });

  const totalAmount = weeklyExpenses.reduce(
    (sum, week) => sum + week.total,
    0
  );
  const totalTransactions = weeklyExpenses.reduce(
    (sum, week) => sum + week.transactionCount,
    0
  );
  const averagePerWeek = totalAmount / weeklyExpenses.length;

  console.log("\n📈 Summary Statistics:");
  console.log(`💰 Total amount: $${totalAmount.toFixed(2)}`);
  console.log(`📝 Total transactions: ${totalTransactions}`);
  console.log(`📊 Average per week: $${averagePerWeek.toFixed(2)}`);
  console.log(`📅 Number of weeks: ${weeklyExpenses.length}`);
}

export function main(): void {
  try {
    const csvPath = path.join(__dirname, "..", "data-deel", "card-transactions.csv");

    if (!fs.existsSync(csvPath)) {
      console.error(
        "❌ Error: transactions.csv file not found in data directory"
      );
      return;
    }

    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const transactions = parseCSV(csvContent);

    if (transactions.length === 0) {
      console.log("📭 No transactions found in the CSV file");
      return;
    }

    console.log(`📄 Loaded ${transactions.length} transactions from CSV`);

    const weeklyExpenses = groupByWeek(
      transactions,
      (t) => new Date(t.date),
      (t) => t.USDAmount
    );
    displayWeeklyExpenses(weeklyExpenses);
  } catch (error) {
    console.error("❌ Error processing transactions:", error);
  }
}

if (require.main === module) {
  main();
}

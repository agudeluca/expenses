import * as fs from "fs";
import * as path from "path";

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

export interface WeeklyExpense {
  weekStart: string;
  weekEnd: string;
  totalUSD: number;
  transactionCount: number;
  transactions: Transaction[];
}

export function parseCSV(csvContent: string): Transaction[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length <= 1) return [];

  return lines.slice(1).map((line) => {
    const values = line.split(";");
    return {
      originalCurrency: values[0] || "",
      originalAmount: parseFloat(values[1]) || 0,
      USDAmount: parseFloat(values[2]) || 0,
      date: values[3] || "",
      mcc: values[4] || "",
      merchantName: values[5] || "",
      merchantCountry: values[6] || "",
      status: values[7] || "",
      declineReason: values[8] || "",
      authCode: values[9] || "",
      type: values[10] || "",
      externalTxId: values[11] || "",
      externalRootTxId: values[12] || "",
      apiTransaction: values[13] || "",
      last4: values[14] || "",
    };
  });
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date.getTime()); // Create a new date object to avoid mutation
  const day = d.getUTCDay(); // Use UTC day to avoid timezone issues

  if (day === 0) {
    // Sunday - go to next Monday
    d.setUTCDate(d.getUTCDate() + 1);
  } else if (day > 1) {
    // Tuesday through Saturday - go back to Monday
    d.setUTCDate(d.getUTCDate() - (day - 1));
  }
  // Monday stays as Monday

  return d;
}

export function getWeekEnd(weekStart: Date): Date {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return weekEnd;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function groupByWeek(transactions: Transaction[]): WeeklyExpense[] {
  const weeklyMap = new Map<string, WeeklyExpense>();

  transactions.forEach((transaction) => {
    const transactionDate = new Date(transaction.date);
    const weekStart = getWeekStart(transactionDate);
    const weekKey = formatDate(weekStart);

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, {
        weekStart: formatDate(weekStart),
        weekEnd: formatDate(getWeekEnd(weekStart)),
        totalUSD: 0,
        transactionCount: 0,
        transactions: [],
      });
    }

    const weekData = weeklyMap.get(weekKey)!;
    weekData.totalUSD += transaction.USDAmount;
    weekData.transactionCount += 1;
    weekData.transactions.push(transaction);
  });

  // Convert map to array and sort by week start date
  return Array.from(weeklyMap.values()).sort(
    (a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
  );
}

export function displayWeeklyExpenses(weeklyExpenses: WeeklyExpense[]): void {
  console.log("\n📊 Weekly Expenses Summary (USD)\n");
  console.log("=".repeat(80));

  weeklyExpenses.forEach((week) => {
    console.log(`\n📅 Week of ${week.weekStart} to ${week.weekEnd}`);
    console.log(`💰 Total: $${week.totalUSD.toFixed(2)}`);
    console.log(`📝 Transactions: ${week.transactionCount}`);

    // Show top 3 transactions by amount
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

  // Summary statistics
  const totalAmount = weeklyExpenses.reduce(
    (sum, week) => sum + week.totalUSD,
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
    const csvPath = path.join(__dirname, "data", "transactions.csv");

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

    const weeklyExpenses = groupByWeek(transactions);
    displayWeeklyExpenses(weeklyExpenses);
  } catch (error) {
    console.error("❌ Error processing transactions:", error);
  }
}

// Run the script if this file is executed directly
if (require.main === module) {
  main();
}

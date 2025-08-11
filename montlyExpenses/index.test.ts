import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  parseCSV,
  getWeekStart,
  getWeekEnd,
  formatDate,
  groupByWeek,
  type Transaction,
  type WeeklyExpense,
} from "./index";

// Test data
const sampleCSV = `originalCurrency;originalAmount;USDAmount;date;mcc;merchantName;merchantCountry;status;declineReason;authCode;type;externalTxId;externalRootTxId;apiTransaction;last4
EUR;6.7500;7.9700;2025-08-11T11:31:28.217Z;5411;MERCADONA RAMBLA DEL POBL;ES;PENDING;;9GYXE4;POS_TX;65dcfa2c-b2cd-4694-9d01-c8dc72ccca5d;65dcfa2c-b2cd-4694-9d01-c8dc72ccca5d;test;6530
EUR;42.6000;50.3500;2025-08-11T09:47:51.658Z;4111;METRO BARCELONA;ES;PENDING;;WCC1HN;POS_TX;8f85fb50-0fa1-4797-911e-d1522ce63013;8f85fb50-0fa1-4797-911e-d1522ce63013;test;6530
CHF;30.0000;37.0100;2025-08-10T00:38:27.341Z;7011;Geneva Hostel;CH;APPROVED;;694086;REFUND;f96f7cfd-3106-4ceb-9ccc-2054718f6662;f96f7cfd-3106-4ceb-9ccc-2054718f6662;test;6530
EUR;23.6600;28.0400;2025-08-09T19:37:01.625Z;5411;EXPRESS MARINA 2;ES;APPROVED;;SWFYNI;POS_TX;42cd389d-df92-4370-a9e0-a8f6392ead47;42cd389d-df92-4370-a9e0-a8f6392ead47;test;6530
USD;14.0900;14.0900;2025-08-08T01:51:03.444Z;4816;Hetzner Online;DE;APPROVED;;EVLST0;POS_TX;b094724b-e2bd-447d-8e34-3931f27bfdce;b094724b-e2bd-447d-8e34-3931f27bfdce;test;6530`;

const sampleTransactions: Transaction[] = [
  {
    originalCurrency: "EUR",
    originalAmount: 6.75,
    USDAmount: 7.97,
    date: "2025-08-11T11:31:28.217Z",
    mcc: "5411",
    merchantName: "MERCADONA RAMBLA DEL POBL",
    merchantCountry: "ES",
    status: "PENDING",
    declineReason: "",
    authCode: "9GYXE4",
    type: "POS_TX",
    externalTxId: "65dcfa2c-b2cd-4694-9d01-c8dc72ccca5d",
    externalRootTxId: "65dcfa2c-b2cd-4694-9d01-c8dc72ccca5d",
    apiTransaction: "test",
    last4: "6530",
  },
  {
    originalCurrency: "EUR",
    originalAmount: 42.6,
    USDAmount: 50.35,
    date: "2025-08-11T09:47:51.658Z",
    mcc: "4111",
    merchantName: "METRO BARCELONA",
    merchantCountry: "ES",
    status: "PENDING",
    declineReason: "",
    authCode: "WCC1HN",
    type: "POS_TX",
    externalTxId: "8f85fb50-0fa1-4797-911e-d1522ce63013",
    externalRootTxId: "8f85fb50-0fa1-4797-911e-d1522ce63013",
    apiTransaction: "test",
    last4: "6530",
  },
];

describe("Weekly Expenses Script", () => {
  describe("parseCSV", () => {
    it("should parse CSV content correctly", () => {
      const transactions = parseCSV(sampleCSV);

      expect(transactions).toHaveLength(5);
      expect(transactions[0]).toEqual({
        originalCurrency: "EUR",
        originalAmount: 6.75,
        USDAmount: 7.97,
        date: "2025-08-11T11:31:28.217Z",
        mcc: "5411",
        merchantName: "MERCADONA RAMBLA DEL POBL",
        merchantCountry: "ES",
        status: "PENDING",
        declineReason: "",
        authCode: "9GYXE4",
        type: "POS_TX",
        externalTxId: "65dcfa2c-b2cd-4694-9d01-c8dc72ccca5d",
        externalRootTxId: "65dcfa2c-b2cd-4694-9d01-c8dc72ccca5d",
        apiTransaction: "test",
        last4: "6530",
      });
    });

    it("should handle empty CSV", () => {
      const transactions = parseCSV("");
      expect(transactions).toHaveLength(0);
    });

    it("should handle CSV with only headers", () => {
      const csvWithOnlyHeaders =
        "originalCurrency;originalAmount;USDAmount;date;mcc;merchantName;merchantCountry;status;declineReason;authCode;type;externalTxId;externalRootTxId;apiTransaction;last4";
      const transactions = parseCSV(csvWithOnlyHeaders);
      expect(transactions).toHaveLength(0);
    });
  });

  describe("getWeekStart", () => {
    it("should return Monday for a Monday date", () => {
      const monday = new Date("2025-08-11"); // This is a Monday
      const weekStart = getWeekStart(monday);
      expect(formatDate(weekStart)).toBe("2025-08-11");
    });

    it("should return Monday for a Wednesday date", () => {
      const wednesday = new Date("2025-08-13"); // This is a Wednesday
      const weekStart = getWeekStart(wednesday);
      expect(formatDate(weekStart)).toBe("2025-08-11"); // Should return Monday
    });

    it("should return Monday for a Sunday date", () => {
      const sunday = new Date("2025-08-17"); // This is a Sunday
      const weekStart = getWeekStart(sunday);
      expect(formatDate(weekStart)).toBe("2025-08-18"); // Should return next Monday
    });
  });

  describe("getWeekEnd", () => {
    it("should return Sunday for a Monday start", () => {
      const monday = new Date("2025-08-11");
      const weekEnd = getWeekEnd(monday);
      expect(formatDate(weekEnd)).toBe("2025-08-17");
    });
  });

  describe("formatDate", () => {
    it("should format date as YYYY-MM-DD", () => {
      const date = new Date("2025-08-11T10:30:00Z");
      expect(formatDate(date)).toBe("2025-08-11");
    });
  });

  describe("groupByWeek", () => {
    it("should group transactions by week correctly", () => {
      const transactions = [
        {
          ...sampleTransactions[0],
          date: "2025-08-11T11:31:28.217Z", // Monday
        },
        {
          ...sampleTransactions[1],
          date: "2025-08-12T09:47:51.658Z", // Tuesday
        },
        {
          ...sampleTransactions[0],
          date: "2025-08-18T11:31:28.217Z", // Next Monday
        },
      ];

      const weeklyExpenses = groupByWeek(transactions);

      expect(weeklyExpenses).toHaveLength(2);
      expect(weeklyExpenses[0].weekStart).toBe("2025-08-11");
      expect(weeklyExpenses[0].weekEnd).toBe("2025-08-17");
      expect(weeklyExpenses[0].totalUSD).toBe(58.32); // 7.97 + 50.35
      expect(weeklyExpenses[0].transactionCount).toBe(2);

      expect(weeklyExpenses[1].weekStart).toBe("2025-08-18");
      expect(weeklyExpenses[1].weekEnd).toBe("2025-08-24");
      expect(weeklyExpenses[1].totalUSD).toBe(7.97);
      expect(weeklyExpenses[1].transactionCount).toBe(1);
    });

    it("should handle empty transactions array", () => {
      const weeklyExpenses = groupByWeek([]);
      expect(weeklyExpenses).toHaveLength(0);
    });

    it("should sort weeks chronologically", () => {
      const transactions = [
        {
          ...sampleTransactions[0],
          date: "2025-08-18T11:31:28.217Z", // Later week
        },
        {
          ...sampleTransactions[1],
          date: "2025-08-11T09:47:51.658Z", // Earlier week
        },
      ];

      const weeklyExpenses = groupByWeek(transactions);

      expect(weeklyExpenses[0].weekStart).toBe("2025-08-11");
      expect(weeklyExpenses[1].weekStart).toBe("2025-08-18");
    });
  });

  describe("Integration Tests", () => {
    it("should process real CSV file correctly", () => {
      const csvPath = path.join(__dirname, "data", "transactions.csv");

      if (fs.existsSync(csvPath)) {
        const csvContent = fs.readFileSync(csvPath, "utf-8");
        const transactions = parseCSV(csvContent);
        const weeklyExpenses = groupByWeek(transactions);

        // Basic validation
        expect(transactions.length).toBeGreaterThan(0);
        expect(weeklyExpenses.length).toBeGreaterThan(0);

        // Validate weekly structure
        weeklyExpenses.forEach((week) => {
          expect(week.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(week.weekEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(week.totalUSD).toBeGreaterThanOrEqual(0);
          expect(week.transactionCount).toBeGreaterThan(0);
          expect(week.transactions.length).toBe(week.transactionCount);
        });

        // Validate total amounts match
        const totalFromWeeks = weeklyExpenses.reduce(
          (sum, week) => sum + week.totalUSD,
          0
        );
        const totalFromTransactions = transactions.reduce(
          (sum, tx) => sum + tx.USDAmount,
          0
        );
        expect(totalFromWeeks).toBeCloseTo(totalFromTransactions, 2);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle transactions with zero amounts", () => {
      const transactions = [
        {
          ...sampleTransactions[0],
          USDAmount: 0,
        },
        {
          ...sampleTransactions[1],
          USDAmount: 10.5,
        },
      ];

      const weeklyExpenses = groupByWeek(transactions);
      expect(weeklyExpenses[0].totalUSD).toBe(10.5);
    });

    it("should handle negative amounts (refunds)", () => {
      const transactions = [
        {
          ...sampleTransactions[0],
          USDAmount: -7.97,
        },
        {
          ...sampleTransactions[1],
          USDAmount: 50.35,
        },
      ];

      const weeklyExpenses = groupByWeek(transactions);
      expect(weeklyExpenses[0].totalUSD).toBe(42.38); // -7.97 + 50.35
    });

    it("should handle malformed CSV gracefully", () => {
      const malformedCSV = `originalCurrency;originalAmount;USDAmount;date
EUR;6.75;7.97;2025-08-11T11:31:28.217Z
EUR;42.6;50.35;2025-08-11T09:47:51.658Z;4111;METRO BARCELONA`; // Missing fields

      expect(() => parseCSV(malformedCSV)).not.toThrow();
    });
  });
});

# Expenses Tracker

A TypeScript application for analyzing and tracking personal expenses from CSV transaction data. This tool processes financial transaction data and provides weekly expense summaries with detailed breakdowns.

## Features

### 📊 Weekly Expense Analysis
- Groups transactions by week (Monday to Sunday)
- Calculates total spending per week
- Shows transaction counts and individual transaction details
- Provides summary statistics across all weeks

### 💰 Multi-Currency Support
- Handles transactions in multiple currencies (EUR, CHF, USD, etc.)
- Converts all amounts to USD for consistent reporting
- Preserves original currency information

### 📈 Detailed Transaction Information
- Merchant names and locations
- Transaction dates and amounts
- MCC (Merchant Category Codes) for categorization
- Transaction status and authorization codes
- Card information (last 4 digits)

### 📋 Comprehensive Reporting
- Weekly expense summaries with totals
- Individual transaction listings per week
- Overall statistics (total amount, average per week, etc.)
- Sorted by date for easy chronological review

## Setup

1. Install dependencies:
```bash
npm install
```

2. Place your transaction CSV file in the `src/data/` directory as `transactions.csv`

## CSV Format

The application expects a CSV file with the following columns (semicolon-separated):

```csv
originalCurrency;originalAmount;USDAmount;date;mcc;merchantName;merchantCountry;status;declineReason;authCode;type;externalTxId;externalRootTxId;apiTransaction;last4
```

Example:
```csv
EUR;6.7500;7.9700;2025-08-11T11:31:28.217Z;5411;MERCADONA RAMBLA DEL POBL;ES;PENDING;;9GYXE4;POS_TX;65dcfa2c-b2cd-4694-9d01-c8dc72ccca5d;65dcfa2c-b2cd-4694-9d01-c8dc72ccca5d;"{...}";6530
```

## Usage

### Run the Expense Analysis
```bash
npm start
```

This will:
1. Load transactions from `src/data/transactions.csv`
2. Group them by week
3. Display a detailed weekly summary
4. Show overall statistics

### Run Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

## Output Example

```
📄 Loaded 112 transactions from CSV

📊 Weekly Expenses Summary (USD)
================================================================================

📅 Week of 2025-07-28 to 2025-08-03
💰 Total: $123.45
📝 Transactions: 15
All transactions:
   1. MERCADONA RAMBLA DEL POBL - $7.97 (EUR 6.75) - 2025-08-11
   2. METRO BARCELONA - $50.35 (EUR 42.6) - 2025-08-11
   3. Geneva Hostel - $37.01 (CHF 30) - 2025-08-11
   ...
----------------------------------------

📈 Summary Statistics:
💰 Total amount: $1,234.56
📝 Total transactions: 112
📊 Average per week: $123.46
📅 Number of weeks: 10
```

## Project Structure

```
expenses/
├── src/
│   ├── data/
│   │   └── transactions.csv    # Your transaction data
│   ├── index.ts               # Main application logic
│   └── index.test.ts          # Unit tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── types.ts                   # TypeScript type definitions
```

## Dependencies

- **TypeScript** - Type-safe JavaScript development
- **Vitest** - Fast unit testing framework
- **dayjs** - Date manipulation library
- **bignumber.js** - Precise decimal arithmetic
- **dotenv** - Environment variable management

## Development

The project uses:
- **TypeScript** for type safety
- **Vitest** for testing
- **ESLint** for code quality (if configured)
- **Prettier** for code formatting (if configured)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
// The summary holds one entry per metric; the component reads the net worth ones
export type FireflySummary = Record<string, { value_parsed: string }>;

export type FireflyBudgetEntry = {
    type: string;
    attributes: {
        amount: string;
        spent_in_budgets: { sum?: string }[];
        currency_symbol: string;
    };
};

export type FireflyBudgets = {
    data?: FireflyBudgetEntry[];
};

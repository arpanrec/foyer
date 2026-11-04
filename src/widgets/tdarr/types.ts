export type TdarrStatistics = {
    table1Count: string;
    table2Count: string;
    table3Count: string;
    table4Count: string;
    table5Count: string;
    table6Count: string;
    // set when the library has disabled libraries etc, and then preferred over the plain count
    table1ViewableCount?: string;
    table2ViewableCount?: string;
    table3ViewableCount?: string;
    table4ViewableCount?: string;
    table5ViewableCount?: string;
    table6ViewableCount?: string;
    sizeDiff: string;
};

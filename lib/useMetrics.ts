import { useMemo } from "react";
import { INDUSTRIES } from "./data";
import type { Profile, Metrics } from "./data";

export function useMetrics(p: Profile): Metrics {
  return useMemo(() => {
    const rev = +p.revenue || 0, exp = +p.expenses || 0, cash = +p.cash || 0, emp = +p.employees || 1, age = +p.age || 0;
    const bench = INDUSTRIES[p.industry] || INDUSTRIES.Other;
    const profit = rev - exp;
    const margin = rev ? profit / rev : 0;
    const mRev = rev / 12, mExp = exp / 12, mCash = mRev - mExp;
    const varCosts = exp * bench.varRatio, fixedCosts = exp - varCosts;
    const cmRatio = rev ? 1 - varCosts / rev : 0;
    const breakEven = cmRatio > 0 ? fixedCosts / cmRatio : Infinity;
    const runway = mCash >= 0 ? Infinity : cash / Math.abs(mCash);
    const revPerEmp = rev / emp;
    let score = 50;
    score += Math.max(-20, Math.min(20, (margin - bench.margin) * 200));
    score += mCash > 0 ? 12 : -12;
    score += Math.min(10, age * 2);
    score += cash > mExp * 3 ? 8 : cash > mExp ? 3 : -8;
    score = Math.round(Math.max(5, Math.min(98, score)));
    return { rev, exp, cash, emp, age, bench, profit, margin, mRev, mExp, mCash, varCosts, fixedCosts, cmRatio, breakEven, runway, revPerEmp, score };
  }, [p]);
}

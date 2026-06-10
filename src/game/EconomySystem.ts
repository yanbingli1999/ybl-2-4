import { Order, IncomeRecord } from './types';
import {
  LATE_PENALTY_RATE,
  EARLY_BONUS_RATE,
  URGENCY_BONUS_RATE,
} from './constants';
import { calculateTailPaymentRetained } from './OrderSystem';

export interface SettlementResult {
  record: IncomeRecord;
  rating: number;
  details: string[];
}

export function calculateSettlement(order: Order, playerStamina: number): SettlementResult {
  const details: string[] = [];
  const baseReward = order.reward;
  details.push(`基础报酬: ¥${baseReward}`);

  const timeRatio = order.deadline / order.maxDeadline;
  let latePenalty = 0;
  let earlyBonus = 0;

  if (timeRatio < 0.3) {
    latePenalty = Math.floor(baseReward * LATE_PENALTY_RATE * 2);
    details.push(`迟到严重: -¥${latePenalty}`);
  } else if (timeRatio < 0.6) {
    latePenalty = Math.floor(baseReward * LATE_PENALTY_RATE);
    details.push(`迟到扣款: -¥${latePenalty}`);
  } else if (timeRatio > 0.85) {
    earlyBonus = Math.floor(baseReward * EARLY_BONUS_RATE);
    details.push(`提早送达奖励: +¥${earlyBonus}`);
  }

  let urgencyBonus = 0;
  if (order.customerUrgency >= 4 && timeRatio > 0.5) {
    urgencyBonus = Math.floor(baseReward * URGENCY_BONUS_RATE * order.customerUrgency);
    details.push(`紧急单奖励: +¥${urgencyBonus}`);
  }

  let staminaPenalty = 0;
  if (playerStamina < 20) {
    staminaPenalty = Math.floor(baseReward * 0.2);
    details.push(`体力透支: -¥${staminaPenalty}`);
  } else if (playerStamina < 40) {
    staminaPenalty = Math.floor(baseReward * 0.1);
    details.push(`体力不足: -¥${staminaPenalty}`);
  }

  let bonus = earlyBonus + urgencyBonus;
  let finalAmount = baseReward - latePenalty - staminaPenalty + bonus;

  if (finalAmount < 0) {
    finalAmount = 0;
  }

  const rating = calculateRating(timeRatio, order.customerUrgency, latePenalty > 0, playerStamina);
  details.push(`客户评分: ${'⭐'.repeat(rating)}`);

  const finalDetails = details.join(' | ');

  return {
    record: {
      id: `income-${Date.now()}`,
      orderId: order.id,
      baseReward,
      latePenalty,
      bonus,
      finalAmount,
      rating,
      completedAt: Date.now(),
      details: finalDetails,
      isGroupBuy: order.isGroupBuy,
      deliveredCount: order.isGroupBuy ? order.deliveryPoints.filter((p) => p.delivered).length : (order.status === 'completed' ? 1 : 0),
      totalDeliveryPoints: order.isGroupBuy ? order.deliveryPoints.length : 1,
      tailPaymentRetained: order.isGroupBuy ? calculateTailPaymentRetained(order) : 1,
      complaintCount: order.isGroupBuy ? order.deliveryPoints.filter((p) => Math.random() < p.complaintProbability).length : 0,
    },
    rating,
    details,
  };
}

function calculateRating(
  timeRatio: number,
  urgency: number,
  isLate: boolean,
  stamina: number
): number {
  let rating = 3;

  if (timeRatio > 0.9) {
    rating += 1;
  } else if (timeRatio > 0.75) {
    rating += 0.5;
  } else if (timeRatio < 0.3) {
    rating -= 2;
  } else if (timeRatio < 0.5) {
    rating -= 1;
  }

  if (urgency >= 4 && !isLate) {
    rating += 0.5;
  }

  if (stamina < 20) {
    rating -= 1;
  } else if (stamina < 40) {
    rating -= 0.5;
  }

  rating = Math.max(1, Math.min(5, rating));
  return Math.round(rating);
}

export function calculateTotalRating(records: IncomeRecord[]): number {
  if (records.length === 0) return 0;
  const sum = records.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / records.length) * 10) / 10;
}

export function formatMoney(amount: number): string {
  return `¥${amount.toFixed(0)}`;
}

export function getRatingStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  return '⭐'.repeat(fullStars) + (hasHalf ? '☆' : '');
}

export function calculateGroupBuySettlement(order: Order, playerStamina: number): SettlementResult {
  const details: string[] = [];
  const baseReward = order.reward;
  details.push(`基础报酬: ¥${baseReward}`);

  const timeRatio = order.deadline / order.maxDeadline;
  let latePenalty = 0;
  let earlyBonus = 0;

  if (timeRatio < 0.3) {
    latePenalty = Math.floor(baseReward * LATE_PENALTY_RATE * 2);
    details.push(`迟到严重: -¥${latePenalty}`);
  } else if (timeRatio < 0.6) {
    latePenalty = Math.floor(baseReward * LATE_PENALTY_RATE);
    details.push(`迟到扣款: -¥${latePenalty}`);
  } else if (timeRatio > 0.85) {
    earlyBonus = Math.floor(baseReward * EARLY_BONUS_RATE);
    details.push(`提早送达奖励: +¥${earlyBonus}`);
  }

  const deliveredCount = order.deliveryPoints.filter((p) => p.delivered).length;
  const skippedCount = order.deliveryPoints.filter((p) => p.skipped).length;
  const totalCount = order.deliveryPoints.length;
  const deliveryBonus = deliveredCount * 15;
  details.push(`签收奖励: ${deliveredCount}/${totalCount}点 +¥${deliveryBonus}`);

  const skipPenalty = skippedCount * 25;
  if (skippedCount > 0) {
    details.push(`跳过扣款: ${skippedCount}点 -¥${skipPenalty}`);
  }

  const tailRetained = calculateTailPaymentRetained(order);
  const tailPayment = Math.floor(baseReward * 0.3 * tailRetained);
  details.push(`尾款保住: ${Math.round(tailRetained * 100)}% +¥${tailPayment}`);

  const complaintCount = order.deliveryPoints.filter((p) => Math.random() < p.complaintProbability).length;
  const complaintPenalty = complaintCount * 20;
  if (complaintCount > 0) {
    details.push(`投诉扣款: ${complaintCount}起 -¥${complaintPenalty}`);
  }

  let staminaPenalty = 0;
  if (playerStamina < 20) {
    staminaPenalty = Math.floor(baseReward * 0.2);
    details.push(`体力透支: -¥${staminaPenalty}`);
  } else if (playerStamina < 40) {
    staminaPenalty = Math.floor(baseReward * 0.1);
    details.push(`体力不足: -¥${staminaPenalty}`);
  }

  let bonus = earlyBonus + deliveryBonus + tailPayment;
  let finalAmount = baseReward - latePenalty - skipPenalty - complaintPenalty - staminaPenalty + bonus;
  if (finalAmount < 0) finalAmount = 0;

  let rating = 3;
  if (timeRatio > 0.9) rating += 1;
  else if (timeRatio > 0.75) rating += 0.5;
  else if (timeRatio < 0.3) rating -= 2;
  else if (timeRatio < 0.5) rating -= 1;
  if (deliveredCount === totalCount) rating += 1;
  if (skippedCount > 0) rating -= skippedCount * 0.5;
  if (complaintCount > 0) rating -= complaintCount * 0.3;
  if (playerStamina < 20) rating -= 1;
  else if (playerStamina < 40) rating -= 0.5;
  rating = Math.max(1, Math.min(5, Math.round(rating)));

  details.push(`客户评分: ${'⭐'.repeat(rating)}`);

  const finalDetails = details.join(' | ');

  return {
    record: {
      id: `income-${Date.now()}`,
      orderId: order.id,
      baseReward,
      latePenalty,
      bonus,
      finalAmount,
      rating,
      completedAt: Date.now(),
      details: finalDetails,
      isGroupBuy: true,
      deliveredCount,
      totalDeliveryPoints: totalCount,
      tailPaymentRetained: tailRetained,
      complaintCount,
    },
    rating,
    details,
  };
}

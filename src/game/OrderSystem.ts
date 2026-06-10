import { Order, MapData, Position, DeliveryPoint } from './types';
import {
  MIN_ORDER_REWARD,
  MAX_ORDER_REWARD,
  MIN_ORDER_DISTANCE,
  MAX_ORDER_DISTANCE,
  LOCATION_NAMES,
  COMMUNITY_NAMES,
  TEAM_LEADER_NAMES,
  GROUP_BUY_MIN_POINTS,
  GROUP_BUY_MAX_POINTS,
  GROUP_BUY_MIN_REWARD,
  GROUP_BUY_MAX_REWARD,
  GROUP_BUY_PATIENCE_DRAIN_RATE,
  GROUP_BUY_SKIP_COMPLAINT_INCREASE,
  GROUP_BUY_BASE_COMPLAINT_PROBABILITY,
  GROUP_BUY_LATE_PATIENCE_PENALTY,
  GRID_SIZE,
} from './constants';
import { getNearestRoadPosition } from './mapData';

export function generateOrder(
  map: MapData,
  playerPos: Position,
  gameTime: number,
  existingOrders: Order[]
): Order | null {
  const availablePickupPoints = map.chargingStations.concat(map.repairShops);
  
  if (availablePickupPoints.length < 2) return null;

  const usedNames = new Set(existingOrders.flatMap((o) => [
    o.pickupLocation.name,
    o.deliveryLocation.name,
  ]));

  const availableNames = LOCATION_NAMES.filter((n) => !usedNames.has(n));
  if (availableNames.length < 2) return null;

  const getRandomRoadPosition = (): Position & { name: string } => {
    const roads = map.roads.filter((r) => r.type === 'intersection');
    const road = roads[Math.floor(Math.random() * roads.length)];
    const name = availableNames[Math.floor(Math.random() * availableNames.length)];
    return {
      x: road.x + GRID_SIZE / 2,
      y: road.y + GRID_SIZE / 2,
      name,
    };
  };

  const pickupLocation = getRandomRoadPosition();
  let deliveryLocation = getRandomRoadPosition();

  const distance = Math.floor(
    Math.hypot(deliveryLocation.x - pickupLocation.x, deliveryLocation.y - pickupLocation.y) / GRID_SIZE
  );

  const clampedDistance = Math.max(MIN_ORDER_DISTANCE, Math.min(MAX_ORDER_DISTANCE, distance));
  const baseReward = Math.floor(MIN_ORDER_REWARD + (clampedDistance / MAX_ORDER_DISTANCE) * (MAX_ORDER_REWARD - MIN_ORDER_REWARD));
  const reward = baseReward + Math.floor(Math.random() * 20 - 10);

  const estimatedTime = clampedDistance * 1.5;
  const deadline = estimatedTime + 30;
  const customerUrgency = Math.floor(Math.random() * 5) + 1;

  return {
    id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    pickupLocation,
    deliveryLocation,
    reward: Math.max(MIN_ORDER_REWARD, reward),
    deadline,
    maxDeadline: deadline,
    status: 'available',
    customerUrgency,
    distance: clampedDistance,
    createdAt: gameTime,
    isGroupBuy: false,
    deliveryPoints: [],
    currentDeliveryIndex: 0,
    skipCount: 0,
  };
}

export function generateGroupBuyOrder(
  map: MapData,
  playerPos: Position,
  gameTime: number,
  existingOrders: Order[]
): Order | null {
  const roads = map.roads.filter((r) => r.type === 'intersection');
  if (roads.length < GROUP_BUY_MAX_POINTS + 1) return null;

  const usedNames = new Set(existingOrders.flatMap((o) => [
    o.pickupLocation.name,
    o.deliveryLocation.name,
    ...o.deliveryPoints.map((p) => p.name),
  ]));

  const availableCommunityNames = COMMUNITY_NAMES.filter((n) => !usedNames.has(n));
  const numPoints = GROUP_BUY_MIN_POINTS + Math.floor(Math.random() * (GROUP_BUY_MAX_POINTS - GROUP_BUY_MIN_POINTS + 1));

  if (availableCommunityNames.length < numPoints) return null;

  const shuffledCommunities = [...availableCommunityNames].sort(() => Math.random() - 0.5);
  const selectedNames = shuffledCommunities.slice(0, numPoints);

  const teamLeaderName = TEAM_LEADER_NAMES[Math.floor(Math.random() * TEAM_LEADER_NAMES.length)];

  const usedRoadIndices = new Set<number>();
  const pickRandomRoad = (): { x: number; y: number } => {
    let idx: number;
    let attempts = 0;
    do {
      idx = Math.floor(Math.random() * roads.length);
      attempts++;
    } while (usedRoadIndices.has(idx) && attempts < 50);
    usedRoadIndices.add(idx);
    return { x: roads[idx].x + GRID_SIZE / 2, y: roads[idx].y + GRID_SIZE / 2 };
  };

  const pickupPos = pickRandomRoad();
  const pickupLocation: Position & { name: string } = {
    ...pickupPos,
    name: `${teamLeaderName}的仓库`,
  };

  const deliveryPoints: DeliveryPoint[] = selectedNames.map((name, i) => {
    const pos = pickRandomRoad();
    const patience = 60 + Math.floor(Math.random() * 40);
    const tailPaymentRatio = 0.1 + Math.random() * 0.15;

    return {
      id: `dp-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
      name,
      x: pos.x,
      y: pos.y,
      patience,
      maxPatience: patience,
      tailPaymentRatio: Math.round(tailPaymentRatio * 100) / 100,
      delivered: false,
      complaintProbability: GROUP_BUY_BASE_COMPLAINT_PROBABILITY,
      skipped: false,
    };
  });

  const firstDelivery = deliveryPoints[0];
  const lastDelivery = deliveryPoints[deliveryPoints.length - 1];

  const totalDistance = Math.floor(
    Math.hypot(pickupPos.x - firstDelivery.x, pickupPos.y - firstDelivery.y) / GRID_SIZE
  );

  const baseReward = GROUP_BUY_MIN_REWARD + Math.floor(
    (totalDistance / MAX_ORDER_DISTANCE) * (GROUP_BUY_MAX_REWARD - GROUP_BUY_MIN_REWARD)
  );
  const pointBonus = numPoints * 20;
  const reward = baseReward + pointBonus + Math.floor(Math.random() * 30);

  const estimatedTime = totalDistance * 1.5 + numPoints * 10;
  const deadline = estimatedTime + 60;

  const lastDeliveryPos = { x: lastDelivery.x, y: lastDelivery.y };

  return {
    id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    pickupLocation,
    deliveryLocation: { ...lastDeliveryPos, name: lastDelivery.name },
    reward: Math.max(GROUP_BUY_MIN_REWARD, reward),
    deadline,
    maxDeadline: deadline,
    status: 'available',
    customerUrgency: 3 + Math.floor(Math.random() * 3),
    distance: totalDistance + numPoints * 3,
    createdAt: gameTime,
    isGroupBuy: true,
    deliveryPoints,
    currentDeliveryIndex: 0,
    skipCount: 0,
  };
}

export function canAcceptOrder(order: Order, player: { currentOrderId: string | null }): boolean {
  return order.status === 'available' && player.currentOrderId === null;
}

export function isAtLocation(
  playerPos: Position,
  targetPos: Position,
  threshold: number = GRID_SIZE
): boolean {
  const dist = Math.hypot(playerPos.x - targetPos.x, playerPos.y - targetPos.y);
  return dist <= threshold;
}

export function updateOrderDeadlines(orders: Order[], deltaTime: number): Order[] {
  return orders.map((order) => {
    if (order.status === 'accepted' || order.status === 'pickedup' || order.status === 'delivering' || order.status === 'group_delivering') {
      const newDeadline = order.deadline - deltaTime;
      if (newDeadline <= 0) {
        return { ...order, deadline: 0, status: 'failed' as const };
      }

      if (order.isGroupBuy && order.status === 'group_delivering') {
        const updatedPoints = order.deliveryPoints.map((point, idx) => {
          if (point.delivered || idx < order.currentDeliveryIndex) return point;
          const patienceDrain = GROUP_BUY_PATIENCE_DRAIN_RATE * deltaTime;
          const timeRatio = newDeadline / order.maxDeadline;
          const latePenalty = timeRatio < 0.4 ? GROUP_BUY_LATE_PATIENCE_PENALTY * deltaTime : 0;
          return {
            ...point,
            patience: Math.max(0, point.patience - patienceDrain - latePenalty),
          };
        });
        return { ...order, deadline: newDeadline, deliveryPoints: updatedPoints };
      }

      return { ...order, deadline: newDeadline };
    }
    return order;
  });
}

export function getOrderStatusText(status: Order['status']): string {
  const statusMap: Record<Order['status'], string> = {
    available: '可接单',
    accepted: '已接单',
    pickedup: '已取货',
    delivering: '配送中',
    group_delivering: '团购配送',
    completed: '已完成',
    failed: '已失败',
  };
  return statusMap[status];
}

export function getUrgencyText(urgency: number): string {
  const levels = ['', '不急', '正常', '稍急', '紧急', '非常急'];
  return levels[urgency] || '正常';
}

export function calculateTailPaymentRetained(order: Order): number {
  if (!order.isGroupBuy) return 1.0;
  let retained = 1.0;
  for (const point of order.deliveryPoints) {
    if (point.delivered) {
      retained -= point.tailPaymentRatio * point.complaintProbability;
    } else if (point.skipped) {
      retained -= point.tailPaymentRatio;
    } else {
      retained -= point.tailPaymentRatio * point.complaintProbability;
    }
  }
  return Math.max(0, Math.min(1, retained));
}

export function getRemainingDeliveryCount(order: Order): number {
  if (!order.isGroupBuy) return 0;
  return order.deliveryPoints.filter((p) => !p.delivered && !p.skipped).length;
}

export function getCurrentDeliveryPoint(order: Order): DeliveryPoint | null {
  if (!order.isGroupBuy || order.currentDeliveryIndex >= order.deliveryPoints.length) return null;
  return order.deliveryPoints[order.currentDeliveryIndex];
}

export function applySkipToOrder(order: Order): Order {
  if (!order.isGroupBuy || order.currentDeliveryIndex >= order.deliveryPoints.length) return order;

  const updatedPoints = order.deliveryPoints.map((point, idx) => {
    if (idx === order.currentDeliveryIndex) {
      return { ...point, skipped: true };
    }
    if (idx > order.currentDeliveryIndex && !point.delivered) {
      return {
        ...point,
        complaintProbability: Math.min(1, point.complaintProbability + GROUP_BUY_SKIP_COMPLAINT_INCREASE * (order.skipCount + 1)),
      };
    }
    return point;
  });

  return {
    ...order,
    deliveryPoints: updatedPoints,
    currentDeliveryIndex: order.currentDeliveryIndex + 1,
    skipCount: order.skipCount + 1,
  };
}

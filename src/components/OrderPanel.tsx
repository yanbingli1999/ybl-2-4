import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectCurrentOrder, selectAvailableOrders } from '../store/gameStore';
import { getOrderStatusText, getUrgencyText, calculateTailPaymentRetained, getRemainingDeliveryCount, getCurrentDeliveryPoint } from '../game/OrderSystem';
import { formatMoney } from '../game/EconomySystem';
import { Package, MapPin, Clock, AlertTriangle, Check, SkipForward, Users } from 'lucide-react';

export default function OrderPanel() {
  const dispatch = useGameStore((state) => state.dispatch);
  const player = useGameStore((state) => state.player);
  const currentOrder = useGameStore(useShallow(selectCurrentOrder));
  const availableOrders = useGameStore(useShallow(selectAvailableOrders));

  const formatDeadline = (seconds: number) => {
    if (seconds <= 0) return '已超时';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDeadlineColor = (deadline: number, maxDeadline: number) => {
    const ratio = deadline / maxDeadline;
    if (ratio < 0.3) return 'text-game-danger animate-pulse';
    if (ratio < 0.6) return 'text-game-streetLight';
    return 'text-game-success';
  };

  const handleAcceptOrder = (orderId: string) => {
    if (player.currentOrderId) return;
    dispatch({ type: 'ACCEPT_ORDER', orderId });
  };

  return (
    <div className="game-card p-4 w-80 space-y-4 max-h-[600px] flex flex-col">
      <h3 className="font-pixel text-sm text-game-neon glow-text">订单中心</h3>

      {currentOrder && (
        <div className={`bg-game-neon/10 border-2 rounded p-3 space-y-2 ${
          currentOrder.isGroupBuy ? 'border-purple-400' : 'border-game-neon'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`font-pixel text-xs ${currentOrder.isGroupBuy ? 'text-purple-400' : 'text-game-neon'}`}>
              {currentOrder.isGroupBuy ? '🏘️ 团购订单' : '当前订单'}
            </span>
            <span className={`font-retro text-xs px-2 py-0.5 rounded ${
              currentOrder.status === 'accepted' ? 'bg-blue-500/30 text-blue-400' :
              currentOrder.status === 'group_delivering' ? 'bg-purple-500/30 text-purple-400' :
              'bg-orange-500/30 text-orange-400'
            }`}>
              {getOrderStatusText(currentOrder.status)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin size={14} className="text-game-success mt-1 flex-shrink-0" />
              <div>
                <div className="font-retro text-xs text-gray-400">取货点{currentOrder.isGroupBuy ? '（团长仓）' : ''}</div>
                <div className="font-retro text-sm text-game-success">{currentOrder.pickupLocation.name}</div>
              </div>
            </div>

            {!currentOrder.isGroupBuy && (
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-game-danger mt-1 flex-shrink-0" />
                <div>
                  <div className="font-retro text-xs text-gray-400">送货点</div>
                  <div className="font-retro text-sm text-game-danger">{currentOrder.deliveryLocation.name}</div>
                </div>
              </div>
            )}

            {currentOrder.isGroupBuy && currentOrder.status === 'group_delivering' && (
              <>
                <div className="border-t border-purple-400/30 pt-2 space-y-1">
                  <div className="flex items-center gap-1 mb-1">
                    <Users size={12} className="text-purple-400" />
                    <span className="font-pixel text-xs text-purple-400">投递进度</span>
                  </div>
                  {currentOrder.deliveryPoints.map((point, idx) => (
                    <div
                      key={point.id}
                      className={`flex items-center justify-between text-xs font-retro px-2 py-1 rounded ${
                        point.delivered ? 'bg-game-success/10 text-game-success' :
                        point.skipped ? 'bg-game-danger/10 text-game-danger' :
                        idx === currentOrder.currentDeliveryIndex ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50' :
                        'text-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="w-4 text-center">{idx + 1}</span>
                        <span>{point.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {point.delivered && <span>✅</span>}
                        {point.skipped && <span>❌</span>}
                        {!point.delivered && !point.skipped && (
                          <span className={`text-[10px] ${
                            point.patience / point.maxPatience > 0.5 ? 'text-game-success' :
                            point.patience / point.maxPatience > 0.25 ? 'text-game-streetLight' :
                            'text-game-danger'
                          }`}>
                            耐心{Math.floor(point.patience)}%
                          </span>
                        )}
                        {!point.delivered && !point.skipped && point.complaintProbability > 0.1 && (
                          <span className="text-[10px] text-game-danger">
                            投诉{Math.round(point.complaintProbability * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs font-retro bg-game-night/70 rounded p-2 border border-purple-400/30">
                  <div>
                    <span className="text-gray-400">剩余小区: </span>
                    <span className="text-purple-300">{getRemainingDeliveryCount(currentOrder)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">当前: </span>
                    <span className="text-purple-300">{getCurrentDeliveryPoint(currentOrder)?.name || '-'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-retro bg-game-night/70 rounded p-2 border border-purple-400/30">
                  <div>
                    <span className="text-gray-400">尾款保住: </span>
                    <span className={`${
                      calculateTailPaymentRetained(currentOrder) > 0.7 ? 'text-game-success' :
                      calculateTailPaymentRetained(currentOrder) > 0.4 ? 'text-game-streetLight' :
                      'text-game-danger'
                    }`}>
                      {Math.round(calculateTailPaymentRetained(currentOrder) * 100)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">可获尾款: </span>
                    <span className="text-game-streetLight">
                      ¥{Math.floor(currentOrder.reward * 0.3 * calculateTailPaymentRetained(currentOrder))}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => dispatch({ type: 'SKIP_GROUP_POINT', orderId: currentOrder.id })}
                  className="pixel-btn pixel-btn-danger text-xs w-full flex items-center justify-center gap-1 mt-1"
                >
                  <SkipForward size={12} />
                  跳过当前小区（扣尾款）
                </button>
              </>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Clock size={14} className={getDeadlineColor(currentOrder.deadline, currentOrder.maxDeadline)} />
                <span className={`font-retro text-sm ${getDeadlineColor(currentOrder.deadline, currentOrder.maxDeadline)}`}>
                  {formatDeadline(currentOrder.deadline)}
                </span>
              </div>
              <div className="text-right">
                <div className="font-retro text-lg text-game-streetLight">{formatMoney(currentOrder.reward)}</div>
                <div className="font-retro text-xs text-gray-500">距离: {currentOrder.distance}格</div>
              </div>
            </div>

            {currentOrder.customerUrgency >= 4 && (
              <div className="flex items-center gap-1 bg-game-danger/20 rounded px-2 py-1">
                <AlertTriangle size={12} className="text-game-danger" />
                <span className="font-retro text-xs text-game-danger">
                  {getUrgencyText(currentOrder.customerUrgency)}！客户在催单
                </span>
              </div>
            )}

            <div className="text-xs font-retro text-gray-400 mt-2 p-2 bg-game-night/70 rounded border border-game-neon/30">
              {currentOrder.status === 'accepted' && !currentOrder.isGroupBuy && '🎯 第一步：沿青色虚线路径开到绿色标记的取货点'}
              {currentOrder.status === 'accepted' && currentOrder.isGroupBuy && '🎯 前往团长仓库取货，然后依次送往各小区'}
              {currentOrder.status === 'pickedup' && '🎯 第二步：沿青色虚线路径开到红色标记的送货点'}
              {currentOrder.status === 'delivering' && '🎯 正在配送中，请沿路径行驶至送货点'}
              {currentOrder.status === 'group_delivering' && '🏘️ 按顺序送到各小区门口，耐心耗尽会投诉，跳过会扣尾款'}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        <h4 className="font-pixel text-xs text-gray-400 sticky top-0 bg-game-nightLight py-1">
          可用订单 ({availableOrders.length})
        </h4>

        {availableOrders.length === 0 ? (
          <div className="text-center py-8">
            <Package size={32} className="mx-auto text-gray-600 mb-2" />
            <p className="font-retro text-sm text-gray-500">暂无可用订单</p>
            <p className="font-retro text-xs text-gray-600">请稍候，新订单即将到来...</p>
          </div>
        ) : (
          availableOrders.map((order) => (
            <div
              key={order.id}
              className={`bg-game-night/50 border rounded p-3 hover:border-game-neon/50 transition-all space-y-2 ${
                order.isGroupBuy ? 'border-purple-500/50' : 'border-gray-700'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-retro text-xs text-gray-400">
                    {order.isGroupBuy ? (
                      <span className="text-purple-400">🏘️ 团购: {order.pickupLocation.name} → {order.deliveryPoints.length}个小区</span>
                    ) : (
                      `${order.pickupLocation.name} → ${order.deliveryLocation.name}`
                    )}
                  </div>
                  <div className="font-retro text-lg text-game-streetLight">{formatMoney(order.reward)}</div>
                  {order.isGroupBuy && (
                    <div className="font-retro text-[10px] text-purple-300 mt-0.5">
                      小区: {order.deliveryPoints.map((p) => p.name).join(' → ')}
                    </div>
                  )}
                </div>
                <span className={`font-retro text-xs ${getDeadlineColor(order.deadline, order.maxDeadline)}`}>
                  ⏱ {formatDeadline(order.deadline)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs font-retro text-gray-400">
                  <span>距离: {order.distance}格</span>
                  <span className={order.customerUrgency >= 4 ? 'text-game-danger' : ''}>
                    紧急度: {'⭐'.repeat(order.customerUrgency)}
                  </span>
                </div>
                <button
                  onClick={() => handleAcceptOrder(order.id)}
                  disabled={!!player.currentOrderId}
                  className={`pixel-btn text-xs ${
                    order.isGroupBuy ? 'pixel-btn-success' : 'pixel-btn-success'
                  } ${
                    player.currentOrderId ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Check size={12} className="inline mr-1" />
                  {order.isGroupBuy ? '接团购' : '接单'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!player.currentOrderId && availableOrders.length > 0 && (
        <div className="text-xs font-retro text-gray-500 text-center border-t border-gray-700 pt-2">
          💡 点击"接单"按钮接受订单
        </div>
      )}
    </div>
  );
}

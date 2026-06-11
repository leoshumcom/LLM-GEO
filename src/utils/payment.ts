// 虎皮椒支付工具 - LLMGEO 平台支付集成
import { md5 } from './md5';

export const XUNHUPAY_CONFIG = {
  API_URL: 'https://api.xunhupay.com/payment/do.html',
  APPID: '201906181495',
  APPSECRET: '5b668496a8550ae69ec510ca55e48795',
};

interface XunhupayOrderParams {
  trade_order_id: string;
  total_fee: string;
  title: string;
  description?: string;
  time: string;
  notify_url: string;
  return_url: string;
  wx_images_url?: string;
  plugin?: string;
}

/**
 * 生成虎皮椒签名
 * 签名：所有参数按 key 排序拼接 + appsecret，然后 MD5
 * hash = md5(key1=value1&key2=value2&key=hash + appsecret)
 */
function generateSign(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys.map(key => `${key}=${params[key]}`).join('') + XUNHUPAY_CONFIG.APPSECRET;
  return md5(signStr);
}

/**
 * 创建虎皮椒支付订单
 */
export async function createXunhupayOrder(params: XunhupayOrderParams): Promise<{
  success: boolean;
  url?: string;
  qrcode?: string;
  order_id?: string;
  error?: string;
}> {
  try {
    const { trade_order_id, total_fee, title, description, time, notify_url, return_url, plugin } = params;

    const postData: Record<string, string> = {
      version: '1.1',
      appid: XUNHUPAY_CONFIG.APPID,
      trade_order_id,
      total_fee,
      title,
      time,
      notify_url,
      return_url,
      plugin: plugin || 'LLMGEO',
    };

    if (description) {
      postData.description = description.substring(0, 255);
    }

    const sign = generateSign(postData);
    postData.hash = sign;

    console.log('[HuPiPay] Request:', JSON.stringify({ ...postData, hash: sign.substring(0, 8) + '...' }));

    const response = await fetch(XUNHUPAY_CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(postData),
    });

    const text = await response.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      return { success: false, error: '支付网关响应异常: ' + text.substring(0, 200) };
    }

    console.log('[HuPiPay] Response:', JSON.stringify(result));

    // 虎皮椒成功返回：{errcode: 0, url_qrcode: '...', order_id: '...'}
    if (result.errcode === 0) {
      return {
        success: true,
        url: result.url_qrcode || result.url,
        qrcode: result.url_qrcode,
        order_id: result.order_id,
      };
    } else {
      return {
        success: false,
        error: result.errmsg || `支付创建失败 (${result.errcode})`,
      };
    }
  } catch (e: any) {
    console.error('[HuPiPay] Error:', e.message);
    return { success: false, error: '支付请求异常: ' + (e.message || '未知错误') };
  }
}

/**
 * 验证虎皮椒异步通知签名
 * 虎皮椒回调：参数按 key 排序拼接 + appsecret，MD5 后与 hash 比对
 */
export async function verifyNotify(params: Record<string, string>): Promise<{
  valid: boolean;
  orderId?: string;
  totalFee?: string;
  tradeOrderId?: string;
}> {
  const { hash, ...rest } = params;
  const expectedSign = generateSign(rest);
  const isValid = expectedSign === hash;

  return {
    valid: isValid,
    orderId: params.order_id,
    totalFee: params.total_fee,
    tradeOrderId: params.trade_order_id,
  };
}

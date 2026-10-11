import { resolveEntitlement } from '../../pay/pricing-config.js';

/**
 * saMacros Activation API - Cloudflare Function
 * 使用 Web Crypto API 进行 RSA 签名
 * 集成 Cloudflare KV 防止订单重放攻击
 */

/**
 * @param {Object} context - Cloudflare Pages 函数上下文
 * @param {Request} context.request - HTTP 请求对象
 * @param {Object} context.env - 环境变量和绑定
 * @param {any} context.env.ORDER_DB - KV 命名空间
 * @param {string} context.env.RSA_PRIVATE_KEY - RSA 私钥
 * @param {string} context.env.PAYPAL_CLIENT_ID - PayPal Client ID
 * @param {string} context.env.PAYPAL_SECRET - PayPal Client Secret
 * @param {string} [context.env.PAYPAL_BASE_URL] - PayPal API Base URL
 */
export async function onRequestPost(context) {
    const { request, env } = context;
    const licenseType = 'PERSONAL';
    const entitle = 'personal';

    try {
        // 解析请求体
        const body = await request.json();
        const { order_id, machine_code, paypal_order_id, platform } = body;
        const isPayPalPlatform = platform === 'paypal' || !!paypal_order_id;

        const normalizedMachineCode = machine_code ? machine_code.trim() : '';
        const normalizedOrderId = order_id ? order_id.trim() : '';
        const normalizedPayPalOrderId = paypal_order_id ? paypal_order_id.trim() : '';

        // === 1. 输入验证 ===
        if (!normalizedMachineCode) {
            return new Response(JSON.stringify({
                error: 'Missing required field: machine_code'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const effectiveOrderId = normalizedOrderId;
        const effectivePayPalOrderId = normalizedPayPalOrderId;

        if (!effectiveOrderId) {
            return new Response(JSON.stringify({
                error: 'Missing required field: order_id'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (isPayPalPlatform && !effectivePayPalOrderId) {
            return new Response(JSON.stringify({
                error: 'Missing required field: paypal_order_id'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 验证 machine_code 格式 (SAM-XXXX)
        if (!/^SAM-[A-Z0-9]{12,}$/i.test(normalizedMachineCode)) {
            return new Response(JSON.stringify({
                error: 'Invalid machine_code format. Expected: SAM-XXXXXXXXXXXX'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // === 2. KV 防重放校验 ===
        if (!env.ORDER_DB) {
            return new Response(JSON.stringify({
                error: 'KV namespace not configured'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const existingOrder = await env.ORDER_DB.get(effectiveOrderId);
        if (existingOrder) {
            return new Response(JSON.stringify({
                error: 'This order has already been used. Each order can only generate one activation key.'
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // === 3. 读取 PayPal 支付金额 ===
        let pricePaid = 0;
        if (isPayPalPlatform) {
            try {
                pricePaid = await fetchPayPalAmount(effectivePayPalOrderId, env);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return new Response(JSON.stringify({
                    error: 'PayPal verification failed',
                    details: errorMessage
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        } else {
            return new Response(JSON.stringify({
                error: 'Unsupported platform. Only paypal is currently supported.'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (pricePaid < 0.99) {
            return new Response(JSON.stringify({
                error: 'Payment amount below minimum threshold (0.99 USD).'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // === 4. 构造激活数据 ===
        const entitlement = resolveEntitlement(pricePaid);
        const expirationDate = entitlement.expirationDate;

        // 激活码格式: type=权益类型;term=时长;id=机器码;exp=过期时间
        const activationData = `type=${licenseType};term=${entitlement.termCode};id=${normalizedMachineCode};exp=${expirationDate}`;

        // === 5. RSA 数字签名 ===
        if (!env.RSA_PRIVATE_KEY) {
            return new Response(JSON.stringify({
                error: 'RSA private key not configured'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const signature = await signWithRSA(activationData, env.RSA_PRIVATE_KEY);

        // === 6. 生成最终激活码 ===
        // 格式: Base64(原始数据 + "|" + 签名)
        const activationKey = btoa(`${activationData}|${signature}`);

        // === 7. 记录到 KV 数据库 ===
        const orderRecord = {
            order_id: effectiveOrderId,
            machine_code: normalizedMachineCode,
            paypal_order_id: effectivePayPalOrderId,
            price_paid: pricePaid,
            type: licenseType,
            term: entitlement.termCode,
            entitle,
            entitlement: entitlement.label,
            activated_at: new Date().toISOString(),
            expiration_date: expirationDate,
            status: 'activated'
        };

        await env.ORDER_DB.put(effectiveOrderId, JSON.stringify(orderRecord));

        // === 8. 返回成功响应 ===
        return new Response(JSON.stringify({
            success: true,
            activation_key: activationKey,
            type: licenseType,
            term: entitlement.termCode,
            entitle,
            price_paid: pricePaid,
            entitlement: entitlement.label,
            expiration_date: expirationDate,
            activated_at: orderRecord.activated_at
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Activation error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Internal server error during activation',
            details: errorMessage
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 使用 Web Crypto API 进行 RSA-SHA256 签名
 * @param {string} data - 待签名的数据
 * @param {string} privateKeyPem - PEM 格式的 RSA 私钥
 * @returns {Promise<string>} 十六进制格式的签名
 */
async function signWithRSA(data, privateKeyPem) {
    try {
        // 清理 PEM 格式
        const pemHeader = '-----BEGIN PRIVATE KEY-----';
        const pemFooter = '-----END PRIVATE KEY-----';
        const pemContents = privateKeyPem
            .replace(pemHeader, '')
            .replace(pemFooter, '')
            .replace(/\s+/g, '');

        // Base64 解码为 ArrayBuffer
        const binaryDer = atob(pemContents);
        const binaryArray = new Uint8Array(binaryDer.length);
        for (let i = 0; i < binaryDer.length; i++) {
            binaryArray[i] = binaryDer.charCodeAt(i);
        }

        // 导入私钥
        const privateKey = await crypto.subtle.importKey(
            'pkcs8',
            binaryArray.buffer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: 'SHA-256'
            },
            false,
            ['sign']
        );

        // 将数据转换为 ArrayBuffer
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);

        // 执行签名
        const signatureBuffer = await crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            privateKey,
            dataBuffer
        );

        // 转换为十六进制字符串
        const signatureArray = Array.from(new Uint8Array(signatureBuffer));
        const signatureHex = signatureArray
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return signatureHex;

    } catch (error) {
        console.error('RSA signing error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to sign data: ${errorMessage}`);
    }
}


async function fetchPayPalAmount(paypalOrderId, env) {
    const clientId = env.PAYPAL_CLIENT_ID;
    const clientSecret = env.PAYPAL_SECRET;
    const baseUrl = env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

    if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials not configured');
    }

    const authToken = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${authToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
        throw new Error('Failed to obtain PayPal access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData?.access_token;
    if (!accessToken) {
        throw new Error('PayPal access token missing');
    }

    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!orderResponse.ok) {
        throw new Error('Failed to fetch PayPal order');
    }

    const orderData = await orderResponse.json();
    const amountValue = orderData?.purchase_units?.[0]?.amount?.value;
    const amount = Number(amountValue);
    if (!Number.isFinite(amount)) {
        throw new Error('PayPal order amount invalid');
    }

    return amount;
}

/**
 * OPTIONS 请求处理 (CORS 预检)
 */
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        }
    });
}

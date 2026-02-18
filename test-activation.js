#!/usr/bin/env node
// @ts-check
/// <reference types="node" />

/**
 * saMacros Activation API 测试脚本
 * 用法: node test-activation.js [API_URL]
 */

const API_URL = process.argv[2] || 'http://localhost:8788/api/activate';
const PAYPAL_ORDER_ID = process.argv[3];

if (!PAYPAL_ORDER_ID) {
    console.error('用法: node test-activation.js [API_URL] <PAYPAL_ORDER_ID>');
    process.exit(1);
}

// 生成随机订单号
function generateOrderId() {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `ORD-${date}-${random}`;
}

// 生成随机机器码
function generateMachineCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'SAM-';
    for (let i = 0; i < 12; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 测试激活 API
async function testActivation() {
    const orderId = generateOrderId();
    const machineCode = generateMachineCode();
    console.log('🧪 测试 saMacros Activation API\n');
    console.log(`📍 API URL: ${API_URL}`);
    console.log(`📦 Order ID: ${orderId}`);
    console.log(`💻 Machine Code: ${machineCode}`);
    console.log(`🧾 PayPal Order ID: ${PAYPAL_ORDER_ID}\n`);

    try {
        console.log('⏳ 发送激活请求...\n');

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order_id: orderId,
                machine_code: machineCode,
                paypal_order_id: PAYPAL_ORDER_ID
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ 激活成功!\n');
            console.log('📄 响应数据:');
            console.log(JSON.stringify(data, null, 2));
            console.log('\n🔑 激活码:');
            console.log(data.activation_key);
            console.log(`\n📅 有效期至: ${data.expiration_date}`);
            console.log(`📋 权益类型: ${data.entitlement}`);
            console.log(`💵 支付金额: ${data.price_paid}`);
        } else {
            console.error('❌ 激活失败!\n');
            console.error(`HTTP ${response.status}: ${data.error}`);
            if (data.details) {
                console.error(`详情: ${data.details}`);
            }
        }

        // 测试重复激活
        console.log('\n\n🔄 测试防重放机制...');
        console.log('⏳ 使用相同订单号再次请求...\n');

        const response2 = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order_id: orderId,
                machine_code: machineCode,
                paypal_order_id: PAYPAL_ORDER_ID
            })
        });

        const data2 = await response2.json();

        if (response2.status === 403) {
            console.log('✅ 防重放机制正常工作!');
            console.log(`错误信息: ${data2.error}`);
        } else {
            console.warn('⚠️  警告: 防重放机制可能未生效');
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ 测试失败:', errorMessage);
        console.error('\n💡 提示:');
        console.error('1. 确保 API 服务正在运行');
        console.error('2. 检查 URL 是否正确');
        console.error('3. 如果是本地测试，运行: npm run dev');
    }
}

// 运行测试
testActivation();

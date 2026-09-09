#!/bin/bash

# 【关键修复】设置 HOME 变量，确保 rabbitmqctl 能找到 .erlang.cookie
export HOME=/var/lib/rabbitmq

echo "Starting RabbitMQ Server..."

# 后台启动 RabbitMQ
rabbitmq-server &
RABBITMQ_PID=$!

# 【关键优化】使用 await_startup 等待应用完全就绪
# 这比简单的 ping 更可靠，能避免 "Failed to connect" 错误
echo "Waiting for RabbitMQ to be ready..."
until rabbitmqctl await_startup; do
  echo "RabbitMQ is starting..."
  sleep 2
done

echo "RabbitMQ is up! Configuring..."

# ---------------------------------------------------------
# 1. 配置 Vhost
# ---------------------------------------------------------
if rabbitmqctl list_vhosts | grep -q "^platform$"; then
  echo "Vhost 'platform' already exists."
else
  echo "Creating vhost 'platform'..."
  rabbitmqctl add_vhost platform
fi

# ---------------------------------------------------------
# 2. 配置用户
# ---------------------------------------------------------
# 尝试添加用户，忽略"已存在"的错误
rabbitmqctl add_user test test 2>/dev/null || echo "User 'test' might already exist."
# 强制重置密码，确保一致性
rabbitmqctl change_password test test

# ---------------------------------------------------------
# 3. 配置权限
# ---------------------------------------------------------
echo "Setting permissions..."
rabbitmqctl set_permissions -p platform test ".*" ".*" ".*"

echo "RabbitMQ initialization completed successfully."

# 挂起脚本，防止容器退出
wait $RABBITMQ_PID
#!/bin/sh

minio server /data --console-address ":9001" &

# 等待 MinIO 启动
until curl -s http://minio:9000/minio/health/live; do
  echo "Waiting for MinIO to start..."
  sleep 2
done

# 使用 MinIO 客户端设置别名
mc alias set myminio http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}

# 检查存储桶是否已存在
if mc ls myminio/jiushuyun > /dev/null 2>&1; then
  echo "Bucket 'jiushuyun' already exists. Skipping creation."
else
  # 存储桶不存在，创建它
  mc mb myminio/jiushuyun
  echo "Bucket 'jiushuyun' created."
fi

# 检查存储桶是否已存在
if mc ls myminio/cdn > /dev/null 2>&1; then
  echo "Bucket 'cdn' already exists. Skipping creation."
else
  # 存储桶不存在，创建它
  mc mb myminio/cdn
  echo "Bucket 'cdn' created."
fi

# 检查存储桶是否已存在
if mc ls myminio/lake > /dev/null 2>&1; then
  echo "Bucket 'lake' already exists. Skipping creation."
else
  # 存储桶不存在，创建它
  mc mb myminio/lake
  echo "Bucket 'lake' created."
fi

# jiushuyun 只清理未完成分片，不自动删除正常对象；cdn、lake 不配置生命周期
printf '%s\n' '{"Rules":[{"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":3},"Filter":{"Prefix":""},"ID":"incomplete-multipart-cleanup","Status":"Enabled"}]}' \
  | mc ilm rule import myminio/jiushuyun

# 自动过期文件桶：对象保留 14 天，未完成分片保留 3 天
if mc ls myminio/expired > /dev/null 2>&1; then
  echo "Bucket 'expired' already exists. Skipping creation."
else
  mc mb myminio/expired
  echo "Bucket 'expired' created."
fi
printf '%s\n' '{"Rules":[{"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":3},"Expiration":{"Days":14},"Filter":{"Prefix":""},"ID":"expired-bucket-cleanup","Status":"Enabled"}]}' \
  | mc ilm rule import myminio/expired

# cdn桶设置为公开访问
mc anonymous set public myminio/cdn
echo "Make 'cdn' public."


# 确保 MinIO 服务继续运行
wait

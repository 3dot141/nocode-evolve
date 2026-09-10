#!/usr/bin/env bash
set -euo pipefail

exec /usr/lib/jvm/java-11-openjdk/bin/java \
  --add-opens=java.rmi/sun.rmi.transport=ALL-UNNAMED \
  --add-opens=java.base/jdk.internal.loader=ALL-UNNAMED \
  --add-opens=java.base/jdk.internal.ref=ALL-UNNAMED \
  --add-opens=java.base/sun.nio.ch=ALL-UNNAMED \
  --add-opens=jdk.management/com.sun.management.internal=ALL-UNNAMED \
  --add-exports=java.base/jdk.internal.misc=ALL-UNNAMED \
  -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:12345 \
  -Djdk.attach.allowAttachSelf=true \
  -Dhome=/mnt/polars \
  -DenableLake=true \
  -Ds3point=http://minio:9000 \
  -Dhost=${POLARS_HOST:-localhost}  \
  -Dpolars.resource.group.config.manager.type=file \
  -Dpolars.resource.group.config.file.path=/mnt/lib/resource_group.json \
  -DjniJvmPath=/usr/lib/jvm/java-11-openjdk/lib/server/libjvm.so \
  -DjniJvmArgs='-Djava.class.path=/mnt/lib/polars-kernel-assemble.jar' \
  -cp /mnt/lib/polars-kernel-assemble.jar \
  com.fanruan.polars.hihidata.MppRunCluster "$@"
